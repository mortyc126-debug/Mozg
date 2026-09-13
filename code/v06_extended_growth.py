"""
v0.6: продлённое развитие с точными снимками на нескольких горизонтах
времени (12/24/48/96с), для проверки: сближаются ли структуры,
выращенные разными правилами v0.5, при более длительном росте, или
различие устойчиво.

simulate_v05_snapshots() -- построчная копия v5f.py::simulate_v05 с
единственным содержательным добавлением: продолжение до max(duration_
snapshots) и сохранение ПОЛНОГО состояния (включая RNG) на каждый
запрошенный момент, вместо остановки после одного duration.

RNG-СОСТОЯНИЯ: v05_four_conditions.pkl НЕ содержит состояний rng_growth/
rng_noise (подтверждено: simulate_v05() создаёт их локально из seed и не
возвращает). Точное продолжение существующих сохранённых сетей с 12с
поэтому невозможно. Здесь выполняется ЧЕСТНЫЙ ПОЛНЫЙ ПЕРЕЗАПУСК развития
с t=0 в ТОЧНО той же реализации кода, с фиксацией снимков по пути.
Корректность проверяется ДВАЖДЫ (см. verify_snapshot_matches_v05):
  (а) снимок на t=12с должен ТОЧНО (np.array_equal, без tolerance)
      совпасть с результатом повторного вызова simulate_v05();
  (б) снимок на t=12с должен ТОЧНО совпасть с АРХИВНЫМ
      v05_four_conditions.pkl для той же (seed, условие).
Без обеих проверок продолжение не считается доказанно точным.

ИНДЕКСАЦИЯ ШАГА: "снимок после t секунд" означает "после выполнения
round(t/dt) обновлений; следующий шаг, который будет выполнен при
продолжении, имеет индекс round(t/dt) (0-based)". Например, снимок
"12.0с" фиксируется после шагов 0..11999 включительно (12000 обновлений
всего); next_step_index=12000.
"""
import numpy as np
import pickle

DT = 0.001


def simulate_v05_snapshots(
    seed=42,
    use_budget=False,
    use_length_penalty=False,
    max_in_degree=12,
    length_penalty_scale=0.10,
    growth_seed_offset=100000,
    duration_snapshots=(12.0, 24.0, 48.0, 96.0),
):
    """
    Возвращает dict: {snapshot_time -> net_dict}.

    net_dict содержит ВСЕ поля исходного simulate_v05() (weights,
    contacts, positions, distance, metrics, dt, growth_log (кумулятивный
    с начала), normalization_events (кумулятивный)), ПЛЮС:
      - "state": v, syn, adaptation, refractory, threshold, drive, rate,
                 trace (rate/trace ранее не сохранялись в v05_four_
                 conditions.pkl -- добавлены здесь как необходимые для
                 честного продолжения гомеостаза/пластичности);
      - "rng_growth_state": jsonable state dict rng_growth.bit_generator.state
      - "rng_noise_state":  state dict rng_noise.bit_generator.state
      - "t_snapshot": float, запрошенное время
      - "next_step_index": int, 0-based индекс следующего невыполненного шага
      - "n_new_contacts_last_second": int, число новых контактов за
        последнюю секунду ДО снимка (проверка "рост продолжается ли
        у границы снимка")
      - "code_version": str

    Все массивы -- независимые копии (.copy()); продолжение симуляции
    после снимка не может изменить уже сохранённый снимок.
    """
    rng_growth = np.random.default_rng(seed)
    rng_noise = np.random.default_rng(seed + growth_seed_offset)

    N = 80
    dt = DT
    max_duration = max(duration_snapshots)
    total_steps = int(round(max_duration / dt))

    snapshot_after_step = {
        int(round(t / dt)): t for t in duration_snapshots
    }  # snapshot fires when next_step_index (=completed steps count) equals key

    positions = rng_growth.uniform(0, 1, size=(N, 2))
    distance = np.linalg.norm(
        positions[:, None, :] - positions[None, :, :], axis=2,
    )

    birth = (np.arange(N) // 8) * 0.5

    v = np.zeros(N)
    syn = np.zeros(N)
    adaptation = np.zeros(N)
    refractory = np.zeros(N)
    threshold = np.ones(N)
    rate = np.zeros(N)
    trace = np.zeros(N)

    W = np.zeros((N, N))
    contacts = np.zeros((N, N), dtype=bool)
    drive = rng_noise.uniform(1.10, 1.25, N)

    logs = []
    growth_log = []
    normalization_events = 0

    tail_buffer_steps = int(round(2.0 / dt))
    tail_buffer = np.zeros((tail_buffer_steps, N), dtype=bool)

    # track total_contacts at each growth check to compute
    # n_new_contacts_last_second at snapshot time
    contacts_history_by_step = {}  # step -> int total_contacts (only growth-check steps)

    snapshots = {}

    for step in range(total_steps):
        t = step * dt

        alive = t >= birth
        age = np.maximum(0.0, t - birth)
        maturity = np.clip(age / 1.0, 0.0, 1.0)
        ready = alive & (maturity >= 0.6)

        if step % 250 == 0:
            eligible = (
                ready[:, None] & ready[None, :]
                & (distance < 0.25) & ~contacts
            )
            np.fill_diagonal(eligible, False)

            draws = rng_growth.random((N, N))

            if use_length_penalty:
                length_factor = np.exp(-distance / length_penalty_scale)
                prob = 0.15 * length_factor
            else:
                prob = np.full((N, N), 0.15)

            passed_probability = eligible & (draws < prob)
            n_passed = int(passed_probability.sum())

            if use_budget:
                current_in_degree = contacts.sum(axis=1)
                budget_remaining = np.maximum(0, max_in_degree - current_in_degree)

                new = np.zeros_like(contacts)
                n_rejected_by_budget = 0

                for i in range(N):
                    candidates_i = np.flatnonzero(passed_probability[i])
                    if len(candidates_i) == 0:
                        continue
                    slots = budget_remaining[i]
                    if slots <= 0:
                        n_rejected_by_budget += len(candidates_i)
                        continue
                    if len(candidates_i) <= slots:
                        chosen = candidates_i
                    else:
                        chosen = rng_growth.choice(
                            candidates_i, size=int(slots), replace=False
                        )
                        n_rejected_by_budget += len(candidates_i) - int(slots)

                    new[i, chosen] = True
            else:
                new = passed_probability
                n_rejected_by_budget = 0

            n_accepted = int(new.sum())

            contacts |= new
            W[new] = 0.015

            in_degree_now = contacts.sum(axis=1)
            n_budget_exhausted = (
                int((in_degree_now >= max_in_degree).sum()) if use_budget else 0
            )

            growth_log.append({
                "step": step,
                "t": t,
                "n_passed_probability": n_passed,
                "n_accepted": n_accepted,
                "n_rejected_by_budget": n_rejected_by_budget,
                "n_budget_exhausted_nodes": n_budget_exhausted,
                "total_contacts": int(contacts.sum()),
            })
            contacts_history_by_step[step] = int(contacts.sum())

        syn *= np.exp(-dt / 0.010)
        adaptation *= np.exp(-dt / 0.200)
        refractory = np.maximum(0.0, refractory - dt)
        trace *= np.exp(-dt / 0.020)
        rate *= np.exp(-dt / 1.0)

        available = alive & (refractory == 0.0)

        current = maturity * drive + syn - adaptation
        noise = 0.012 * rng_noise.standard_normal(N)

        dv = (dt / 0.020) * (-v + current)
        v[available] += (dv + noise)[available]

        fired = available & (v >= threshold)
        tail_buffer[step % tail_buffer_steps] = fired

        if np.any(fired):
            eta = 0.0002
            W[fired, :] += eta * trace[None, :] * contacts[fired, :]
            W[:, fired] -= 1.05 * eta * trace[:, None] * contacts[:, fired]

        np.clip(W, 0.0, 0.08, out=W)

        total_input = W.sum(axis=1)
        pre_clip_over_cap = total_input > 0.6
        if pre_clip_over_cap.any():
            normalization_events += int(pre_clip_over_cap.sum())

        W *= np.minimum(1.0, 0.6 / np.maximum(total_input, 1e-12))[:, None]

        if np.any(fired):
            syn += W[:, fired].sum(axis=1)

        v[fired] = 0.0
        refractory[fired] = 0.005
        adaptation[fired] += 0.25
        trace[fired] += 1.0
        rate[fired] += 1.0

        target_rate = 5.0 * maturity
        threshold[ready] += dt * 0.02 * (rate[ready] - target_rate[ready])
        np.clip(threshold, 0.7, 1.5, out=threshold)

        if step % 100 == 0:
            logs.append([
                t,
                rate[ready].mean() if ready.any() else 0.0,
                threshold[ready].mean() if ready.any() else 1.0,
                W[contacts].mean() if contacts.any() else 0.0,
            ])

        completed_steps = step + 1  # number of updates done so far
        if completed_steps in snapshot_after_step:
            t_snap = snapshot_after_step[completed_steps]

            if completed_steps >= tail_buffer_steps:
                start_idx = completed_steps % tail_buffer_steps
                tail = np.concatenate([
                    tail_buffer[start_idx:], tail_buffer[:start_idx]
                ], axis=0)
            else:
                tail = tail_buffer[:completed_steps]

            rates = tail.sum(axis=0) / 2.0
            bin_steps = int(0.020 / dt)
            n_full_bins = tail.shape[0] // bin_steps
            usable = tail[:n_full_bins * bin_steps]
            counts = usable.reshape(-1, bin_steps, N).sum(axis=(1, 2))
            population_cv = (
                counts.std() / counts.mean() if counts.mean() > 0 else np.nan
            )

            metrics = {
                "rate_hz": rates.mean(),
                "silent_fraction": np.mean(rates == 0),
                "population_cv": population_cv,
            }

            # contacts added in the last 1.0s before this snapshot
            one_sec_steps_ago = completed_steps - int(round(1.0 / dt))
            prior_growth_steps = sorted(
                s for s in contacts_history_by_step if s < completed_steps
            )
            contacts_now = int(contacts.sum())
            contacts_1s_ago = None
            for s in reversed(prior_growth_steps):
                if s <= one_sec_steps_ago:
                    contacts_1s_ago = contacts_history_by_step[s]
                    break
            if contacts_1s_ago is None:
                contacts_1s_ago = 0
            n_new_contacts_last_second = contacts_now - contacts_1s_ago

            snapshots[t_snap] = {
                "t_snapshot": t_snap,
                "next_step_index": completed_steps,
                "weights": W.copy(),
                "contacts": contacts.copy(),
                "positions": positions.copy(),
                "distance": distance.copy(),
                "metrics": metrics,
                "dt": dt,
                "logs": np.array(logs, dtype=float),
                "growth_log": [dict(g) for g in growth_log],
                "normalization_events": normalization_events,
                "n_new_contacts_last_second": n_new_contacts_last_second,
                "state": {
                    "v": v.copy(), "syn": syn.copy(),
                    "adaptation": adaptation.copy(),
                    "refractory": refractory.copy(),
                    "threshold": threshold.copy(),
                    "drive": drive.copy(),
                    "rate": rate.copy(),
                    "trace": trace.copy(),
                },
                "rng_growth_state": _copy_rng_state(rng_growth),
                "rng_noise_state": _copy_rng_state(rng_noise),
                "code_version": "v06_extended_growth.py::simulate_v05_snapshots",
                "seed": seed,
                "use_budget": use_budget,
                "use_length_penalty": use_length_penalty,
                "max_in_degree": max_in_degree,
                "length_penalty_scale": length_penalty_scale,
            }

    return snapshots


def _copy_rng_state(rng):
    """Глубокая независимая копия состояния np.random.Generator."""
    import copy
    return copy.deepcopy(rng.bit_generator.state)


def _exact_array_equal(a, b, name=""):
    """Строгая проверка: форма, dtype, точное поэлементное равенство,
    отсутствие NaN/inf там где не ожидается. Возвращает (bool, str)."""
    if a.shape != b.shape:
        return False, f"{name}: shape mismatch {a.shape} vs {b.shape}"
    if a.dtype != b.dtype:
        return False, f"{name}: dtype mismatch {a.dtype} vs {b.dtype}"
    if not np.array_equal(a, b):
        return False, f"{name}: values differ"
    if np.issubdtype(a.dtype, np.floating):
        if np.isnan(a).any() != np.isnan(b).any():
            return False, f"{name}: NaN pattern differs"
        if np.isinf(a).any() or np.isinf(b).any():
            return False, f"{name}: contains inf"
    return True, f"{name}: OK"


def verify_snapshot_matches_v05(seed=11, use_budget=False, use_length_penalty=False,
                                 max_in_degree=12, archived_net=None):
    """
    Строгая (без tolerance) проверка честности продолжения.
    (а) снимок t=12с vs повторный вызов simulate_v05() с теми же параметрами.
    (б) если archived_net передан (запись из v05_four_conditions.pkl для
        той же seed/условия) -- снимок t=12с vs archived_net.

    Возвращает (all_ok: bool, checks: dict[str, (bool,str)]).
    """
    from v5f import simulate_v05

    original = simulate_v05(
        seed=seed, use_budget=use_budget, use_length_penalty=use_length_penalty,
        max_in_degree=max_in_degree,
    )
    snaps = simulate_v05_snapshots(
        seed=seed, use_budget=use_budget, use_length_penalty=use_length_penalty,
        max_in_degree=max_in_degree, duration_snapshots=(12.0, 24.0, 48.0, 96.0),
    )
    snap12 = snaps[12.0]

    checks = {}

    def add(label, ok, msg):
        checks[label] = (ok, msg)

    for field in ("weights", "contacts", "positions", "distance"):
        ok, msg = _exact_array_equal(original[field], snap12[field], field)
        add(f"vs_fresh_call__{field}", ok, msg)

    add("vs_fresh_call__normalization_events",
        original["normalization_events"] == snap12["normalization_events"],
        f"{original['normalization_events']} vs {snap12['normalization_events']}")

    for key in ("v", "syn", "adaptation", "refractory", "threshold", "drive"):
        ok, msg = _exact_array_equal(
            original["state"][key], snap12["state"][key], f"state.{key}"
        )
        add(f"vs_fresh_call__state_{key}", ok, msg)

    for mkey in ("rate_hz", "silent_fraction", "population_cv"):
        o_val = original["metrics"][mkey]
        s_val = snap12["metrics"][mkey]
        if np.isnan(o_val) and np.isnan(s_val):
            ok = True
        else:
            ok = (o_val == s_val)
        add(f"vs_fresh_call__metrics_{mkey}", ok, f"{o_val} vs {s_val}")

    if archived_net is not None:
        for field in ("weights", "contacts", "positions", "distance"):
            ok, msg = _exact_array_equal(archived_net[field], snap12[field], field)
            add(f"vs_archived_pkl__{field}", ok, msg)
        add("vs_archived_pkl__normalization_events",
            archived_net["normalization_events"] == snap12["normalization_events"],
            f"{archived_net['normalization_events']} vs {snap12['normalization_events']}")
        for key in ("v", "syn", "adaptation", "refractory", "threshold", "drive"):
            ok, msg = _exact_array_equal(
                archived_net["state"][key], snap12["state"][key], f"state.{key}"
            )
            add(f"vs_archived_pkl__state_{key}", ok, msg)

    all_ok = all(ok for ok, _ in checks.values())
    return all_ok, checks


if __name__ == "__main__":
    with open("v05_four_conditions.pkl", "rb") as f:
        archive = pickle.load(f)

    seed_to_index = {11: 0, 22: 1, 33: 2}
    condition_params = {
        "Исходное": dict(use_budget=False, use_length_penalty=False),
        "Только бюджет": dict(use_budget=True, use_length_penalty=False),
        "Только длина": dict(use_budget=False, use_length_penalty=True),
        "Совместное": dict(use_budget=True, use_length_penalty=True),
    }

    all_pass = True
    for seed in (11, 22, 33):
        for cond_name, params in condition_params.items():
            archived_net = archive[cond_name][seed_to_index[seed]]
            ok, checks = verify_snapshot_matches_v05(
                seed=seed, archived_net=archived_net, **params
            )
            status = "OK" if ok else "MISMATCH"
            print(f"seed={seed} condition={cond_name}: {status}")
            if not ok:
                all_pass = False
                for k, (c_ok, msg) in checks.items():
                    if not c_ok:
                        print(f"    FAIL {k}: {msg}")

    print()
    print("ВСЕ 12 КОМБИНАЦИЙ ТОЧНО СОВПАЛИ (fresh call + archived pkl):" , all_pass)

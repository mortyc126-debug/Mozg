import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sim_core import simulate, free_run_snapshots, trace_probe_preserve_syn
from sequence_test import train_weights, select_groups, mean_existing_weight


def causal_traces_preserve(
    weights_network, state_snapshot, source, target, seed,
    transmission=True,
):
    """
    Как causal_traces(), но:
      - веса/contacts/dt берутся из weights_network (обученная
        сеть AB или BA с фиксированной структурой и весами);
      - динамическое состояние (v, syn, adaptation, refractory,
        threshold, drive) берётся из state_snapshot — снимка
        свободного прогона, ОБЩЕГО для AB и BA;
      - syn копируется, а не обнуляется (trace_probe_preserve_syn).
    """
    network = {
        "weights": weights_network["weights"],
        "contacts": weights_network["contacts"],
        "dt": weights_network["dt"],
        "state": state_snapshot,
    }

    dt = network["dt"]
    N = network["weights"].shape[0]
    steps = int(round(0.080 / dt))

    rng = np.random.default_rng(seed)
    noise = (
        0.012
        * np.sqrt(dt / 0.001)
        * rng.standard_normal((steps, N))
    )

    baseline = trace_probe_preserve_syn(
        network, source, noise,
        stimulus=False,
        transmission=transmission,
    )
    stimulated = trace_probe_preserve_syn(
        network, source, noise,
        stimulus=True,
        transmission=transmission,
    )

    if not transmission:
        for key in baseline:
            assert np.array_equal(
                baseline[key][:, target],
                stimulated[key][:, target],
            )

    effects = {}
    for key in ("v", "syn", "spikes"):
        effects[key] = (
            stimulated[key][:, target].astype(float)
            - baseline[key][:, target].astype(float)
        )
    effects["raw"] = {
        "with_stim": stimulated["spikes"][:, target],
        "no_stim": baseline["spikes"][:, target],
    }
    return effects


def run_corrected_protocol(
    development_seeds=(11, 22, 33),
    selection_seeds=(100, 200, 300),
    learning_seeds=(2026, 2027, 2028),
    free_run_seeds=(5000, 5001, 5002),
    snapshot_times=(2.0, 3.0, 4.0, 5.0, 6.0),
    n_noise=10,
    lag=0.010,
    noise_seed_base=900,
):
    per_network_summary = []

    for net_idx, (dev_seed, sel_seed, learn_seed, fr_seed) in enumerate(
        zip(development_seeds, selection_seeds, learning_seeds, free_run_seeds)
    ):
        print(f"\n{'='*60}")
        print(f"Сеть {net_idx+1}: dev_seed={dev_seed}")
        print(f"{'='*60}")

        # --- А. Один раз развиваем и один раз обучаем AB/BA ---
        developed = simulate(seed=dev_seed)
        print(
            f"Развита. Контактов: {developed['contacts'].sum()}, "
            f"rate_hz={developed['metrics']['rate_hz']:.3f}"
        )

        A, B = select_groups(developed, seed=sel_seed)
        print("A:", A)
        print("B:", B)

        learned_AB, norm_AB = train_weights(
            developed, nodes=A, second_nodes=B, lag=lag,
            stimulated=True, plasticity=True, seed=learn_seed,
        )
        learned_BA, norm_BA = train_weights(
            developed, nodes=B, second_nodes=A, lag=lag,
            stimulated=True, plasticity=True, seed=learn_seed,
        )

        for key in developed["state"]:
            assert np.array_equal(
                learned_AB["state"][key],
                learned_BA["state"][key],
            )

        dw_AB = (
            mean_existing_weight(learned_AB, A, B)
            - mean_existing_weight(learned_BA, A, B)
        )
        dw_BA = (
            mean_existing_weight(learned_AB, B, A)
            - mean_existing_weight(learned_BA, B, A)
        )
        print(f"ΔW(A→B) между обучением AB/BA: {dw_AB:+.7f}")
        print(f"ΔW(B→A) между обучением AB/BA: {dw_BA:+.7f}")
        print("Шаги нормировки (AB, BA):", norm_AB, norm_BA)

        # --- Б. Отдельно собираем состояния свободного прогона ---
        snapshots = free_run_snapshots(
            developed,
            snapshot_times=snapshot_times,
            pre_run=2.0,
            seed=fr_seed,
        )
        print(f"Снимков состояний получено: {len(snapshots)}")

        # --- В. Проверяем фиксированные W_AB / W_BA в этих состояниях ---
        network_records = []

        for snap_idx, snapshot in enumerate(snapshots):
            state = snapshot["state"]

            for direction, (source, target) in [
                ("A→B", (A, B)),
                ("B→A", (B, A)),
            ]:
                syn_vals = []
                v_vals = []
                spike_diff_total = []
                changed_trials = 0
                changed_cells_total = 0
                shift_events = []
                base_mismatch_count = 0

                # Контроль без передачи -- на обеих ветвях (AB и BA),
                # используя один и тот же общий снимок состояния.
                causal_traces_preserve(
                    learned_AB, state, source, target,
                    seed=noise_seed_base - 1, transmission=False,
                )
                causal_traces_preserve(
                    learned_BA, state, source, target,
                    seed=noise_seed_base - 1, transmission=False,
                )

                for k in range(n_noise):
                    noise_seed = noise_seed_base + k

                    eff_AB = causal_traces_preserve(
                        learned_AB, state, source, target, noise_seed
                    )
                    eff_BA = causal_traces_preserve(
                        learned_BA, state, source, target, noise_seed
                    )

                    dt = learned_AB["dt"]
                    early = int(round(0.020 / dt))

                    d_syn = (eff_AB["syn"] - eff_BA["syn"])[:early].mean()
                    d_v = (eff_AB["v"] - eff_BA["v"])[:early].mean()
                    syn_vals.append(d_syn)
                    v_vals.append(d_v)

                    delta_R = eff_AB["spikes"] - eff_BA["spikes"]
                    spike_diff_total.append(delta_R.sum())

                    base_ab = eff_AB["raw"]["no_stim"]
                    base_ba = eff_BA["raw"]["no_stim"]
                    base_differs = not np.array_equal(base_ab, base_ba)
                    if base_differs:
                        base_mismatch_count += 1

                    changed = delta_R != 0
                    if changed.any():
                        changed_trials += 1
                        changed_cells_total += int(changed.sum())

                        cols = np.flatnonzero(changed.any(axis=0))
                        for col in cols:
                            shift_events.append({
                                "noise_seed": noise_seed,
                                "node": int(target[col]),
                                "base_differs": bool(base_differs),
                                "AB_base_ms": (
                                    np.flatnonzero(eff_AB["raw"]["no_stim"][:, col])
                                    * dt * 1000
                                ).tolist(),
                                "AB_stim_ms": (
                                    np.flatnonzero(eff_AB["raw"]["with_stim"][:, col])
                                    * dt * 1000
                                ).tolist(),
                                "BA_base_ms": (
                                    np.flatnonzero(eff_BA["raw"]["no_stim"][:, col])
                                    * dt * 1000
                                ).tolist(),
                                "BA_stim_ms": (
                                    np.flatnonzero(eff_BA["raw"]["with_stim"][:, col])
                                    * dt * 1000
                                ).tolist(),
                            })

                record = {
                    "network": net_idx,
                    "snapshot": snap_idx,
                    "snapshot_t": snapshot["t"],
                    "direction": direction,
                    "syn_mean": np.mean(syn_vals),
                    "syn_std": np.std(syn_vals),
                    "v_mean": np.mean(v_vals),
                    "v_std": np.std(v_vals),
                    "spike_count_diff_mean": np.mean(spike_diff_total),
                    "trials_with_timing_change": changed_trials,
                    "n_trials": n_noise,
                    "base_mismatch_trials": base_mismatch_count,
                    "changed_cells_total": changed_cells_total,
                    "shift_events": shift_events,
                }
                network_records.append(record)

                print(
                    f"  снимок t={snapshot['t']:.2f}с (free-run), {direction}: "
                    f"Δsyn={record['syn_mean']:+.6f}±{record['syn_std']:.6f}, "
                    f"Δv={record['v_mean']:+.6f}±{record['v_std']:.6f}, "
                    f"ΔR_count={record['spike_count_diff_mean']:+.3f}, "
                    f"timing-изменённых тестов={changed_trials}/{n_noise}, "
                    f"фон-различался={base_mismatch_count}/{n_noise}"
                )

        per_network_summary.append({
            "dev_seed": dev_seed,
            "A": A,
            "B": B,
            "dw_forward": dw_AB,
            "dw_reverse": dw_BA,
            "records": network_records,
        })

    return per_network_summary


results = run_corrected_protocol()

print(f"\n\n{'='*60}")
print("СВОДКА ПО ВСЕМ СЕТЯМ (исправленный протокол)")
print(f"{'='*60}")

all_records = [r for net in results for r in net["records"]]

for direction in ("A→B", "B→A"):
    recs = [r for r in all_records if r["direction"] == direction]

    syn_means = np.array([r["syn_mean"] for r in recs])
    v_means = np.array([r["v_mean"] for r in recs])
    timing_fracs = np.array([
        r["trials_with_timing_change"] / r["n_trials"] for r in recs
    ])
    base_mismatch_fracs = np.array([
        r["base_mismatch_trials"] / r["n_trials"] for r in recs
    ])
    count_diffs = np.array([r["spike_count_diff_mean"] for r in recs])

    print(f"\nНаправление {direction} ({len(recs)} снимков по 3 сетям)")
    print(
        f"  Δsyn: среднее={syn_means.mean():+.6f}, "
        f"std между снимками={syn_means.std():.6f}, "
        f"согласованный знак: {max((syn_means>0).sum(),(syn_means<0).sum())}/{len(syn_means)}"
    )
    print(
        f"  Δv: среднее={v_means.mean():+.6f}, "
        f"std между снимками={v_means.std():.6f}"
    )
    print(
        f"  Доля тестов с изменением времени (ΔR): "
        f"среднее={timing_fracs.mean():.3f}, "
        f"диапазон [{timing_fracs.min():.2f}, {timing_fracs.max():.2f}]"
    )
    print(
        f"  Доля тестов, где уже ФОН отличался: "
        f"среднее={base_mismatch_fracs.mean():.3f}, "
        f"диапазон [{base_mismatch_fracs.min():.2f}, {base_mismatch_fracs.max():.2f}]"
    )
    print(
        f"  ΔR количество импульсов: среднее={count_diffs.mean():+.4f}, "
        f"максимум |значение|={np.abs(count_diffs).max():.4f}"
    )

print(f"\n{'='*60}")
print("КЛАССИФИКАЦИЯ СОБЫТИЙ С ИЗМЕНЁННЫМ ВРЕМЕНЕМ")
print(f"{'='*60}")

cat_simple = 0
cat_complex = 0
total_events = 0

for net in results:
    for r in net["records"]:
        for ev in r["shift_events"]:
            total_events += 1
            if ev["base_differs"]:
                cat_complex += 1
            else:
                cat_simple += 1

print(f"Всего узловых событий с ΔR≠0: {total_events}")
print(f"  фон совпадал (простой случай): {cat_simple}")
print(f"  фон тоже различался (сложный случай): {cat_complex}")

n_tests_total = sum(r["n_trials"] for r in all_records)
n_tests_with_timing = sum(r["trials_with_timing_change"] for r in all_records)
n_tests_with_base_mismatch = sum(r["base_mismatch_trials"] for r in all_records)

print(f"\nВсего проверок (сеть×снимок×направление×шум): {n_tests_total}")
print(f"Проверок с изменённым временным ответом: {n_tests_with_timing}")
print(f"Проверок с различающимся фоном: {n_tests_with_base_mismatch}")

print(f"\n{'='*60}")
print("ПРОСТЫЕ СЛУЧАИ (фон совпадал) -- сопоставимые сдвиги")
print(f"{'='*60}")

for net in results:
    for r in net["records"]:
        for ev in r["shift_events"]:
            if not ev["base_differs"]:
                print(
                    f"\nСеть dev={net['dev_seed']}, снимок t={r['snapshot_t']:.2f}с, "
                    f"{r['direction']}, шум {ev['noise_seed']}, узел {ev['node']}"
                )
                print(f"  AB со стимулом:  {ev['AB_stim_ms']} мс (без стимула: {ev['AB_base_ms']})")
                print(f"  BA со стимулом:  {ev['BA_stim_ms']} мс (без стимула: {ev['BA_base_ms']})")

fig, axes = plt.subplots(3, 2, figsize=(11, 10), sharex=True)

for net_idx, net in enumerate(results):
    for col, direction in enumerate(("A→B", "B→A")):
        recs = [r for r in net["records"] if r["direction"] == direction]
        times = [r["snapshot_t"] for r in recs]
        syn = [r["syn_mean"] for r in recs]
        syn_err = [r["syn_std"] for r in recs]

        ax = axes[net_idx, col]
        ax.errorbar(times, syn, yerr=syn_err, marker="o", capsize=3)
        ax.axhline(0, color="gray", linewidth=0.7)
        ax.set_title(f"Сеть {net_idx+1} ({net['dev_seed']}), {direction}")
        if col == 0:
            ax.set_ylabel("Δsyn, первые 20мс")
        if net_idx == 2:
            ax.set_xlabel("Момент снимка (free-run), с")

plt.tight_layout()
plt.savefig("/home/claude/sim/corrected_protocol_output.png", dpi=100)
print("\nOK: saved plot")

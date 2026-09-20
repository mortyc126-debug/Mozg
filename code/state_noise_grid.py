import csv
import numpy as np

from sim_core import simulate
from regime_map import DT, copy_state, advance, force_initial_spikes, run_probe


def bin_counts(spikes, dt=DT, bin_duration=0.020):
    bin_steps = int(round(bin_duration / dt))
    usable = len(spikes) // bin_steps * bin_steps
    return spikes[:usable].reshape(
        -1, bin_steps, spikes.shape[1]
    ).sum(axis=1).astype(float)


def response_by_equal_windows(
    baseline,
    stimulated,
    target_mask,
    dt,
    window_seconds=0.050,
):
    width = int(round(window_seconds / dt))
    usable = min(len(baseline), len(stimulated))
    usable = usable // width * width

    base = baseline[:usable, target_mask]
    stim = stimulated[:usable, target_mask]

    results = []

    for start in range(0, usable, width):
        b = base[start:start + width]
        s = stim[start:start + width]

        results.append({
            "start_ms": start * dt * 1000,
            "changed_fraction": np.any(b != s, axis=0).mean(),
            "delta_spikes_per_node": (
                s.sum(axis=0).astype(float)
                - b.sum(axis=0).astype(float)
            ).mean(),
        })

    return results


def make_free_run_state(
    initial, internal_drive, gain, warm_duration, seed
):
    """
    Один свободный прогон (структурная динамика, пластичность,
    гомеостаз выключены -- как и в evaluate_point) с заданным
    seed, возвращающий полное состояние в конце прогона.
    """
    W = initial["weights"]
    N = W.shape[0]

    state = {
        key: initial["state"][key].copy()
        for key in (
            "v", "syn", "adaptation",
            "refractory", "threshold",
        )
    }
    state["syn"].fill(0.0)

    original_drive = initial["state"]["drive"]
    drive = (
        internal_drive
        * original_drive
        / original_drive.mean()
    )

    rng = np.random.default_rng(seed)
    warm_steps = int(round(warm_duration / DT))

    warm_noise = (
        0.012
        * np.sqrt(DT / 0.001)
        * rng.standard_normal((warm_steps, N))
    )

    for step in range(warm_steps):
        advance(state, W, drive, gain, warm_noise[step])

    return state, drive


def probe_pair(
    checkpoint, W, drive, gain, nodes, test_seed,
    probe_duration=0.200, transmission_check=False,
):
    """
    Одна пара (baseline, stimulated) с заданным тестовым шумом.
    Возвращает полные растры импульсов (время x узел).
    """
    N = W.shape[0]
    probe_rng = np.random.default_rng(test_seed + 100_000)
    probe_steps = int(round(probe_duration / DT))

    probe_noise = (
        0.012
        * np.sqrt(DT / 0.001)
        * probe_rng.standard_normal((probe_steps, N))
    )

    # Копии, чтобы одна проверка не влияла на другую.
    ckpt = copy_state(checkpoint)

    baseline = run_probe(
        ckpt, W, drive, gain, probe_noise, nodes, stimulus=False,
    )
    stimulated = run_probe(
        ckpt, W, drive, gain, probe_noise, nodes, stimulus=True,
    )

    if transmission_check:
        # Контроль с нулевой передачей: остальные узлы должны
        # совпадать в паре при том же состоянии и шуме.
        zero_gain = 0.0
        base0 = run_probe(
            ckpt, W, drive, zero_gain, probe_noise, nodes,
            stimulus=False,
        )
        stim0 = run_probe(
            ckpt, W, drive, zero_gain, probe_noise, nodes,
            stimulus=True,
        )
        other = np.ones(N, dtype=bool)
        other[nodes] = False
        assert np.array_equal(base0[:, other], stim0[:, other]), (
            "Контроль нулевой передачи не пройден."
        )

    return baseline, stimulated


def evaluate_pair(baseline, stimulated, nodes, N, dt=DT):
    other = np.ones(N, dtype=bool)
    other[nodes] = False

    base = baseline[:, other]
    stim = stimulated[:, other]

    changed_nodes = np.any(base != stim, axis=0)
    response_fraction = changed_nodes.mean()

    delta_total = int(stim.sum()) - int(base.sum())

    base_binned = bin_counts(base)
    stim_binned = bin_counts(stim)
    delta_binned = stim_binned - base_binned
    response_magnitude = np.mean(np.abs(delta_binned))

    # Равные окна по 50 мс (0-50, 50-100, 100-150, 150-200).
    windows = response_by_equal_windows(
        baseline, stimulated, other, dt, window_seconds=0.050
    )

    result = {
        "response_fraction": response_fraction,
        "delta_total_spikes": delta_total,
        "response_magnitude": response_magnitude,
    }
    for w in windows:
        tag = f"w{int(w['start_ms'])}"
        result[f"{tag}_changed_fraction"] = w["changed_fraction"]
        result[f"{tag}_delta_spikes_per_node"] = w["delta_spikes_per_node"]

    return result


def run_state_noise_grid(
    development_seeds=(11, 22, 33),
    gains=(4.0, 6.0),
    drive=1.25,
    warm_duration=12.0,
    state_seeds=(1500, 1501, 1502, 1503, 1504),
    test_seeds=(2500, 2501, 2502, 2503, 2504),
):
    records = []

    for development_seed in development_seeds:
        initial = simulate(seed=development_seed)
        N = initial["weights"].shape[0]

        # Одна фиксированная группа узлов, без выбора по её
        # результатам: первая группа из предыдущего эксперимента.
        rng = np.random.default_rng(3100)
        chosen = rng.choice(N, size=15, replace=False)
        nodes = np.sort(chosen[0:5])

        for gain in gains:
            # 5 свободных прогонов -> 5 сохранённых состояний.
            # Выполняем один раз, переиспользуем для всех
            # 5 тестовых шумов (30 прогонов вместо 150 на сеть/gain).
            checkpoints = []
            for state_id, state_seed in enumerate(state_seeds):
                state, drive_vec = make_free_run_state(
                    initial, drive, gain, warm_duration, state_seed
                )
                checkpoints.append({
                    "state_id": state_id,
                    "state_seed": state_seed,
                    "state": copy_state(state),
                    "drive_vec": drive_vec,
                })

            W = initial["weights"]

            for ckpt_info in checkpoints:
                state_id = ckpt_info["state_id"]
                state_seed = ckpt_info["state_seed"]
                checkpoint = ckpt_info["state"]
                drive_vec = ckpt_info["drive_vec"]

                for test_id, test_seed in enumerate(test_seeds):
                    baseline, stimulated = probe_pair(
                        checkpoint, W, drive_vec, gain, nodes,
                        test_seed,
                        transmission_check=(test_id == 0 and state_id == 0),
                    )

                    metrics = evaluate_pair(
                        baseline, stimulated, nodes, N
                    )

                    record = {
                        "development_seed": development_seed,
                        "gain": gain,
                        "drive": drive,
                        "state_id": state_id,
                        "state_seed": state_seed,
                        "test_id": test_id,
                        "test_seed": test_seed,
                        "nodes": " ".join(map(str, nodes)),
                        **metrics,
                    }
                    records.append(record)

            print(
                f"сеть={development_seed}, gain={gain:.1f}: "
                f"5x5={len(state_seeds)*len(test_seeds)} проверок готово"
            )

            # Промежуточное сохранение.
            with open(
                "/home/claude/sim/state_noise_grid.csv",
                "w", newline="", encoding="utf-8",
            ) as file:
                writer = csv.DictWriter(
                    file, fieldnames=list(records[0].keys())
                )
                writer.writeheader()
                writer.writerows(records)

    return records


def summarize(records):
    development_seeds = sorted(set(r["development_seed"] for r in records))
    gains = sorted(set(r["gain"] for r in records))

    for development_seed in development_seeds:
        for gain in gains:
            selected = [
                r for r in records
                if r["development_seed"] == development_seed
                and r["gain"] == gain
            ]

            n_states = len(set(r["state_id"] for r in selected))
            n_tests = len(set(r["test_id"] for r in selected))

            matrix = np.full((n_states, n_tests), np.nan)
            for r in selected:
                matrix[r["state_id"], r["test_id"]] = r["response_fraction"]

            if not np.isfinite(matrix).all():
                raise ValueError("Неполная матрица состояние x шум.")

            state_means = matrix.mean(axis=1)
            test_means = matrix.mean(axis=0)

            residual = (
                matrix - state_means[:, None] - test_means[None, :]
                + matrix.mean()
            )

            print(f"\nСеть {development_seed}, gain={gain:.1f}")
            print("Строки — состояния, столбцы — тестовые шумы:")
            print(np.array2string(100 * matrix, precision=1))
            print(
                "Разброс средних по состояниям:",
                f"{100*state_means.std():.1f} п.п.",
            )
            print(
                "Разброс средних по тестовым шумам:",
                f"{100*test_means.std():.1f} п.п.",
            )
            print(
                "RMS остатка:",
                f"{100*np.sqrt(np.mean(residual**2)):.1f} п.п.",
            )

            for key in (
                "response_magnitude",
                "delta_total_spikes",
            ):
                values = np.array([r[key] for r in selected], dtype=float)
                print(f"  {key}: среднее={values.mean():.4f}, std={values.std():.4f}")

            print("  Равные окна по 50мс (changed_fraction, delta_spikes_per_node):")
            for tag in ("w0", "w50", "w100", "w150"):
                cf_key = f"{tag}_changed_fraction"
                ds_key = f"{tag}_delta_spikes_per_node"
                if cf_key not in selected[0]:
                    continue
                cf = np.array([r[cf_key] for r in selected], dtype=float)
                ds = np.array([r[ds_key] for r in selected], dtype=float)
                print(
                    f"    {tag}: changed_fraction={cf.mean():.4f}±{cf.std():.4f}, "
                    f"delta_spikes_per_node={ds.mean():+.4f}±{ds.std():.4f}"
                )


if __name__ == "__main__":
    records = run_state_noise_grid()
    summarize(records)

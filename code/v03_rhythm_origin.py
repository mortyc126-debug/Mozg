import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sim_core import simulate
from regime_map import DT, copy_state


def advance_v03(
    state, W, drive, gain, noise,
    transmission_enabled=True,
    adaptation_enabled=True,
    adaptation_tau=0.200,
):
    """
    Как advance() в regime_map.py, но с явными переключателями:
      - transmission_enabled=False: связи не передают импульсы
        (синаптический вклад в syn не накапливается).
      - adaptation_enabled=False: адаптация не растёт после
        импульсов (state["adaptation"] остаётся нулевым, если
        изначально обнулена вызывающим кодом).
      - adaptation_tau: постоянная затухания адаптации в секундах
        (по умолчанию 0.200, как в исходной модели).
    """
    v = state["v"]
    syn = state["syn"]
    adaptation = state["adaptation"]
    refractory = state["refractory"]
    threshold = state["threshold"]

    syn *= np.exp(-DT / 0.010)
    adaptation *= np.exp(-DT / adaptation_tau)
    refractory[:] = np.maximum(0.0, refractory - DT)

    available = refractory == 0.0

    current = drive + gain * syn - adaptation
    dv = (DT / 0.020) * (-v + current)

    v[available] += (dv + noise)[available]

    fired = available & (v >= threshold)

    if transmission_enabled and np.any(fired):
        syn += W[:, fired].sum(axis=1)

    v[fired] = 0.0
    refractory[fired] = 0.005

    if adaptation_enabled:
        adaptation[fired] += 0.25

    return fired


def free_dynamics_run(
    initial,
    drive_scalar=1.25,
    gain=4.0,
    duration=14.0,
    measure_duration=10.0,
    seed=600,
    transmission_enabled=True,
    adaptation_enabled=True,
    adaptation_tau=0.200,
):
    """
    Свободная динамика БЕЗ обучения и БЕЗ тестового стимула:
    только рекуррентная электрическая динамика на фиксированных
    весах развитой сети, под заданными условиями.
    """
    W = initial["weights"]
    N = W.shape[0]

    state = {
        key: initial["state"][key].copy()
        for key in ("v", "syn", "adaptation", "refractory", "threshold")
    }
    state["syn"].fill(0.0)

    if not adaptation_enabled:
        state["adaptation"].fill(0.0)

    original_drive = initial["state"]["drive"]
    drive = drive_scalar * original_drive / original_drive.mean()

    rng = np.random.default_rng(seed)
    steps = int(round(duration / DT))
    measure_steps = int(round(measure_duration / DT))

    noise = 0.012 * np.sqrt(DT / 0.001) * rng.standard_normal((steps, N))

    spikes = np.zeros((measure_steps, N), dtype=bool)
    measure_start = steps - measure_steps

    for step in range(steps):
        fired = advance_v03(
            state, W, drive, gain, noise[step],
            transmission_enabled=transmission_enabled,
            adaptation_enabled=adaptation_enabled,
            adaptation_tau=adaptation_tau,
        )
        if step >= measure_start:
            spikes[step - measure_start] = fired

    return spikes


def analyze_free_dynamics(spikes, dt=DT):
    steps, N = spikes.shape
    duration_s = steps * dt

    rate_per_node = spikes.sum(axis=0) / duration_s

    bin_steps = int(round(0.020 / dt))
    usable = steps // bin_steps * bin_steps
    population_counts = spikes[:usable].reshape(
        -1, bin_steps, N
    ).sum(axis=(1, 2)).astype(float)

    population_cv = (
        population_counts.std() / population_counts.mean()
        if population_counts.mean() > 0 else np.nan
    )

    all_isis = []
    for node in range(N):
        spike_times = np.flatnonzero(spikes[:, node]) * dt
        if len(spike_times) >= 2:
            all_isis.append(np.diff(spike_times))
    all_isis = np.concatenate(all_isis) * 1000 if all_isis else np.array([])

    fine_width = int(round(0.005 / dt))
    fine_usable = steps // fine_width * fine_width
    fine_counts = spikes[:fine_usable].reshape(
        -1, fine_width, N
    ).sum(axis=(1, 2)).astype(float)

    s = fine_counts - fine_counts.mean()
    if (s**2).sum() > 1e-12:
        autocorr = np.correlate(s, s, mode="full")
        autocorr = autocorr[len(s) - 1:]
        autocorr /= autocorr[0]

        lag_min = int(round(60 / 5))
        lag_max = min(int(round(250 / 5)), len(autocorr) - 1)
        window = autocorr[lag_min:lag_max + 1]

        if len(window) >= 3:
            peak_idx = np.argmax(window)
            peak_value = window[peak_idx]
            at_boundary = peak_idx == 0 or peak_idx == len(window) - 1
            background = np.median(window)
            prominent = peak_value > background + 0.15
            well_defined = (not at_boundary) and prominent and peak_value > 0.2
            period_ms = (lag_min + peak_idx) * 5
        else:
            period_ms, well_defined, peak_value = None, False, np.nan
    else:
        period_ms, well_defined, peak_value = None, False, np.nan

    # ИСПРАВЛЕНО: прежде усреднялось только по окнам с хотя бы
    # одним активным узлом (условное среднее), что давало
    # систематически завышенное значение, нарушающее неравенство
    # occupancy <= rate*bin_duration. Теперь -- по всем окнам.
    bin_active = spikes[:usable].reshape(-1, bin_steps, N).any(axis=1)
    coactivation = bin_active.mean()

    return {
        "mean_rate_hz": rate_per_node.mean(),
        "silent_fraction": np.mean(rate_per_node == 0),
        "population_cv": population_cv,
        "isi_median_ms": np.median(all_isis) if len(all_isis) else np.nan,
        "isi_cv": (
            all_isis.std() / all_isis.mean()
            if len(all_isis) and all_isis.mean() > 0 else np.nan
        ),
        "n_isis": len(all_isis),
        "rhythm_period_ms": period_ms if well_defined else None,
        "rhythm_peak_autocorr": peak_value,
        "rhythm_well_defined": well_defined,
        "occupancy_fraction": coactivation,  # переименовано:
        # это не независимый индекс синхронизации, а почти точно
        # rate_hz * bin_duration (см. аудит). Оставлено для
        # справки, но не должно интерпретироваться как мера
        # согласованности сверх частоты.
    }


CONDITIONS = {
    "Исходная модель": dict(
        transmission_enabled=True, adaptation_enabled=True,
        adaptation_tau=0.200,
    ),
    "Без передачи": dict(
        transmission_enabled=False, adaptation_enabled=True,
        adaptation_tau=0.200,
    ),
    "Без адаптации": dict(
        transmission_enabled=True, adaptation_enabled=False,
        adaptation_tau=0.200,
    ),
    "Адаптация τ/2": dict(
        transmission_enabled=True, adaptation_enabled=True,
        adaptation_tau=0.100,
    ),
    "Адаптация τ×2": dict(
        transmission_enabled=True, adaptation_enabled=True,
        adaptation_tau=0.400,
    ),
}


def run_all_conditions(
    development_seed=11, drive_scalar=1.25, gain=4.0,
    duration=14.0, measure_duration=10.0,
    seeds=(600, 601, 602),
):
    initial = simulate(seed=development_seed)

    results = {}
    for name, params in CONDITIONS.items():
        runs = []
        for seed in seeds:
            spikes = free_dynamics_run(
                initial, drive_scalar=drive_scalar, gain=gain,
                duration=duration, measure_duration=measure_duration,
                seed=seed, **params,
            )
            runs.append(analyze_free_dynamics(spikes))
        results[name] = runs

        print(f"\n{name}:")
        for key in (
            "mean_rate_hz", "silent_fraction", "population_cv",
            "isi_median_ms", "isi_cv", "rhythm_period_ms",
            "rhythm_peak_autocorr", "occupancy_fraction",
        ):
            values = [
                r[key] for r in runs
                if r[key] is not None and not (
                    isinstance(r[key], float) and np.isnan(r[key])
                )
            ]
            if values and isinstance(values[0], (int, float)):
                arr = np.array(values, dtype=float)
                print(f"  {key}: {arr.mean():.4f} ± {arr.std():.4f} (n={len(arr)}/{len(runs)})")
            else:
                print(f"  {key}: {values}")

    return results, initial


if __name__ == "__main__":
    results, initial = run_all_conditions()

    fig, axes = plt.subplots(
        len(CONDITIONS), 1, figsize=(12, 3 * len(CONDITIONS)), sharex=True
    )

    for ax, (name, params) in zip(axes, CONDITIONS.items()):
        spikes = free_dynamics_run(
            initial, drive_scalar=1.25, gain=4.0,
            duration=14.0, measure_duration=2.0,
            seed=600, **params,
        )
        times, nodes_idx = np.nonzero(spikes)
        ax.scatter(times * DT, nodes_idx, s=1, marker="|")
        ax.set_ylabel(name, fontsize=9)
        ax.set_xlim(0, 2.0)

    axes[-1].set_xlabel("время, с (последние 2с измеряемого окна)")
    fig.suptitle("Растры свободной динамики по условиям (development_seed=11)")
    plt.tight_layout()
    plt.savefig("/home/claude/sim/v03_conditions_rasters.png", dpi=110)
    print("\nOK: сохранён график растров")

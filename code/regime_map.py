import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sim_core import simulate


DT = 0.001


def copy_state(state):
    return {
        key: value.copy()
        for key, value in state.items()
    }


def advance(state, W, drive, gain, noise):
    """Один шаг. Все временные параметры — в секундах."""
    v = state["v"]
    syn = state["syn"]
    adaptation = state["adaptation"]
    refractory = state["refractory"]
    threshold = state["threshold"]

    syn *= np.exp(-DT / 0.010)
    adaptation *= np.exp(-DT / 0.200)
    refractory[:] = np.maximum(0.0, refractory - DT)

    available = refractory == 0.0

    current = drive + gain * syn - adaptation
    dv = (DT / 0.020) * (-v + current)

    v[available] += (dv + noise)[available]

    fired = available & (v >= threshold)

    if np.any(fired):
        # syn хранит неусиленный вклад.
        # gain применяется при вычислении current.
        syn += W[:, fired].sum(axis=1)

    v[fired] = 0.0
    refractory[fired] = 0.005
    adaptation[fired] += 0.25

    return fired


def force_initial_spikes(state, W, nodes):
    """Контролируемое вмешательство до первого шага."""
    state["v"][nodes] = 0.0
    state["refractory"][nodes] = 0.005
    state["adaptation"][nodes] += 0.25
    state["syn"] += W[:, nodes].sum(axis=1)


def run_probe(checkpoint, W, drive, gain, noise, nodes, stimulus):
    state = copy_state(checkpoint)

    if stimulus:
        force_initial_spikes(state, W, nodes)

    spikes = np.zeros(
        (len(noise), len(drive)),
        dtype=bool,
    )

    for step in range(len(noise)):
        spikes[step] = advance(
            state, W, drive, gain, noise[step]
        )

    return spikes


def evaluate_point(
    initial,
    internal_drive,
    gain,
    nodes,
    seed=500,
    warm_duration=4.0,
):
    W = initial["weights"]
    N = W.shape[0]

    state = {
        key: initial["state"][key].copy()
        for key in (
            "v", "syn", "adaptation",
            "refractory", "threshold",
        )
    }

    # Одинаковый сброс остаточного тока во всех точках.
    # Дальше идёт свободный прогон длительностью warm_duration.
    state["syn"].fill(0.0)

    # Сохраняем индивидуальные различия возбудимости,
    # но задаём её средний уровень.
    original_drive = initial["state"]["drive"]
    drive = (
        internal_drive
        * original_drive
        / original_drive.mean()
    )

    rng = np.random.default_rng(seed)

    warm_steps = int(round(warm_duration / DT))

    if warm_duration < 2.0:
        raise ValueError("Нужны как минимум 2 секунды для измерений.")

    measure_steps = int(round(2.0 / DT))

    warm_noise = (
        0.012
        * np.sqrt(DT / 0.001)
        * rng.standard_normal((warm_steps, N))
    )

    history = np.zeros((measure_steps, N), dtype=bool)

    for step in range(warm_steps):
        fired = advance(
            state, W, drive, gain, warm_noise[step]
        )

        if step >= warm_steps - measure_steps:
            history[step - (warm_steps - measure_steps)] = fired

    # Частоты отдельных узлов за последние 2 секунды.
    rates = history.sum(axis=0) / 2.0

    # Количество импульсов всей сети в окнах по 20 мс.
    bin_steps = int(round(0.020 / DT))
    counts = history.reshape(
        -1, bin_steps, N
    ).sum(axis=(1, 2))

    population_cv = (
        counts.std() / counts.mean()
        if counts.mean() > 0
        else np.nan
    )

    # Грубая проверка продолжающегося дрейфа частоты:
    # сравниваем две последние секунды по отдельности.
    one_second = int(round(1.0 / DT))
    rate_first = history[:one_second].sum() / N
    rate_second = history[one_second:].sum() / N

    checkpoint = copy_state(state)

    probe_steps = int(round(0.200 / DT))

    # Шум проверки отделён от шума свободного прогона:
    # изменение warm_duration не меняет тестовый шум.
    probe_rng = np.random.default_rng(seed + 100_000)

    probe_noise = (
        0.012
        * np.sqrt(DT / 0.001)
        * probe_rng.standard_normal((probe_steps, N))
    )

    baseline = run_probe(
        checkpoint, W, drive, gain,
        probe_noise, nodes, stimulus=False,
    )

    stimulated = run_probe(
        checkpoint, W, drive, gain,
        probe_noise, nodes, stimulus=True,
    )

    other = np.ones(N, dtype=bool)
    other[nodes] = False

    base = baseline[:, other]
    stim = stimulated[:, other]

    if gain == 0.0:
        assert np.array_equal(base, stim), (
            "Воздействие достигло других узлов "
            "при нулевом усилении передачи."
        )

    changed_nodes = np.any(base != stim, axis=0)

    return {
        "rate_hz": rates.mean(),
        "silent_fraction": np.mean(rates == 0),
        "population_cv": population_cv,
        "rate_drift_hz": rate_second - rate_first,
        "response_fraction": changed_nodes.mean(),
        "delta_spikes": int(stim.sum()) - int(base.sum()),
    }


def main():
    # Формируем сеть один раз.
    initial = simulate(seed=11)
    N = initial["weights"].shape[0]

    rng = np.random.default_rng(100)
    nodes = np.sort(rng.choice(N, size=5, replace=False))

    # Это диапазон поиска, не биологические нормы.
    drive_values = np.array([0.80, 0.95, 1.10, 1.25, 1.40])
    gain_values = np.array([0.0, 1.0, 2.0, 4.0, 8.0])

    metric_names = [
        "rate_hz",
        "silent_fraction",
        "population_cv",
        "rate_drift_hz",
        "response_fraction",
        "delta_spikes",
    ]

    maps = {
        name: np.zeros((len(drive_values), len(gain_values)))
        for name in metric_names
    }

    for row, internal_drive in enumerate(drive_values):
        for col, gain in enumerate(gain_values):
            result = evaluate_point(
                initial,
                internal_drive=internal_drive,
                gain=gain,
                nodes=nodes,
                seed=500,
            )

            for name in metric_names:
                maps[name][row, col] = result[name]

            print(
                f"drive={internal_drive:.2f}, gain={gain:.1f}"
                f" | rate={result['rate_hz']:.2f} Гц"
                f" | silent={result['silent_fraction']:.0%}"
                f" | response={result['response_fraction']:.0%}"
                f" | drift={result['rate_drift_hz']:+.2f} Гц"
            )

    # Сохраняем числа: для новой сводки не нужен новый прогон.
    np.savez_compressed(
        "/home/claude/sim/regime_map_results.npz",
        drive_values=drive_values,
        gain_values=gain_values,
        stimulated_nodes=nodes,
        **maps,
    )

    panels = [
        ("rate_hz", "Средняя частота, Гц"),
        ("silent_fraction", "Доля молчащих узлов"),
        ("population_cv", "Неравномерность общей активности, CV"),
        ("response_fraction", "Доля остальных узлов с изменённым ответом"),
    ]

    fig, axes = plt.subplots(2, 2, figsize=(12, 9))

    for ax, (key, title) in zip(axes.flat, panels):
        image = ax.imshow(
            maps[key],
            origin="lower",
            aspect="auto",
            interpolation="nearest",
        )

        ax.set_xticks(
            np.arange(len(gain_values)),
            labels=gain_values,
        )
        ax.set_yticks(
            np.arange(len(drive_values)),
            labels=drive_values,
        )
        ax.set_xlabel("Усиление передачи")
        ax.set_ylabel("Среднее внутреннее возбуждение")
        ax.set_title(title)

        fig.colorbar(image, ax=ax)

    plt.tight_layout()
    plt.savefig("/home/claude/sim/regime_map.png", dpi=160)
    print("\nOK: saved plot and npz")


if __name__ == "__main__":
    main()

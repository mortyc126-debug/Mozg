import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sequence_test import result


def trace_probe(network, source, noise, stimulus, transmission=True):
    dt = network["dt"]
    W = network["weights"]
    state = network["state"]

    v = state["v"].copy()
    adaptation = state["adaptation"].copy()
    refractory = state["refractory"].copy()
    threshold = state["threshold"].copy()
    drive = state["drive"].copy()

    syn = np.zeros_like(v)

    steps, N = noise.shape

    voltage = np.zeros((steps, N))
    synaptic = np.zeros((steps, N))
    spikes = np.zeros((steps, N), dtype=bool)

    for step in range(steps):
        syn *= np.exp(-dt / 0.010)
        adaptation *= np.exp(-dt / 0.200)
        refractory = np.maximum(0.0, refractory - dt)

        available = refractory == 0.0

        current = drive + syn - adaptation
        dv = (dt / 0.020) * (-v + current)
        v[available] += (dv + noise[step])[available]

        fired = available & (v >= threshold)

        # Воздействие сразу, без предварительного свободного прогона.
        if stimulus and step == 0:
            fired[source] = True

        if transmission and np.any(fired):
            syn += W[:, fired].sum(axis=1)

        v[fired] = 0.0
        refractory[fired] = 0.005
        adaptation[fired] += 0.25

        # Потенциал записываем после возможного сброса.
        voltage[step] = v
        synaptic[step] = syn
        spikes[step] = fired

    return {
        "v": voltage,
        "syn": synaptic,
        "spikes": spikes,
    }


def causal_traces(network, source, target, seed, transmission=True):
    dt = network["dt"]
    N = network["weights"].shape[0]
    steps = int(round(0.080 / dt))

    rng = np.random.default_rng(seed)
    noise = (
        0.012
        * np.sqrt(dt / 0.001)
        * rng.standard_normal((steps, N))
    )

    baseline = trace_probe(
        network, source, noise,
        stimulus=False,
        transmission=transmission,
    )
    stimulated = trace_probe(
        network, source, noise,
        stimulus=True,
        transmission=transmission,
    )

    if not transmission:
        # Контроль именно на нестимулируемой целевой группе.
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

    return effects


def inspect_sequence(result, seeds=range(900, 910)):
    networks = result["networks"]
    A, B = result["A"], result["B"]
    dt = networks["AB"]["dt"]

    # Проверяем одинаковость исходных динамических состояний.
    for key in networks["AB"]["state"]:
        assert np.array_equal(
            networks["AB"]["state"][key],
            networks["BA"]["state"][key],
        )

    fig, axes = plt.subplots(2, 2, figsize=(11, 7), sharex=True)
    output = {}

    for column, (name, source, target) in enumerate([
        ("A→B", A, B),
        ("B→A", B, A),
    ]):
        differences = {"syn": [], "v": [], "spikes": []}

        # Отдельная проверка отсутствия передачи без связей.
        causal_traces(
            networks["AB"], source, target,
            seed=999, transmission=False,
        )

        for seed in seeds:
            effect_AB = causal_traces(
                networks["AB"], source, target, seed
            )
            effect_BA = causal_traces(
                networks["BA"], source, target, seed
            )

            for key in differences:
                differences[key].append(
                    effect_AB[key] - effect_BA[key]
                )

        differences = {
            key: np.stack(values)
            for key, values in differences.items()
        }
        output[name] = differences

        early = int(round(0.020 / dt))
        print(f"\nНаправление {name}")

        for row, key in enumerate(("syn", "v")):
            data = differences[key]

            # По одному скалярному измерению на тестовый шум.
            values = data[:, :early, :].mean(axis=(1, 2))

            print(
                f"  Среднее Δ{key}, первые 20 мс: "
                f"{values.mean():+.7f} ± {values.std():.7f}"
            )

            mean_trace = data.mean(axis=(0, 2))
            times = np.arange(len(mean_trace)) * dt * 1000

            axes[row, column].plot(times, mean_trace)
            axes[row, column].axhline(
                0, color="gray", linewidth=0.7
            )
            axes[row, column].set_ylabel(f"Δ{key}, условные единицы")

        axes[0, column].set_title(name)
        axes[1, column].set_xlabel("Время после воздействия, мс")

        spike_difference = differences["spikes"].sum(axis=1).mean(axis=1)
        print(
            "  Различие вызванного числа импульсов за 80 мс: "
            f"{spike_difference.mean():+.6f} "
            f"± {spike_difference.std():.6f}"
        )

    plt.tight_layout()
    plt.savefig("/home/claude/sim/trace_diag_output.png", dpi=100)
    print("\nOK: saved plot")

    print("\nКонтроль без передачи пройден.")
    print("± — разброс по тестовому шуму, не доверительный интервал.")

    return output


diagnostics = inspect_sequence(result)

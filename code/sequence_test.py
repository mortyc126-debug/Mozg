import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sim_core import simulate, probe


def train_weights(
    initial,
    nodes,
    stimulated=True,
    plasticity=True,
    seed=2026,
    duration=16.0,
    second_nodes=None,
    lag=0.010,
):
    rng = np.random.default_rng(seed)

    dt = initial["dt"]
    state = initial["state"]

    W = initial["weights"].copy()
    contacts = initial["contacts"]
    N = len(state["v"])

    v = state["v"].copy()
    adaptation = state["adaptation"].copy()
    refractory = state["refractory"].copy()
    threshold = state["threshold"].copy()
    drive = state["drive"].copy()

    syn = np.zeros(N)
    trace = np.zeros(N)

    steps = int(duration / dt)
    first_pulse = int(0.5 / dt)
    pulse_period = int(0.4 / dt)

    lag_steps = int(round(lag / dt))

    if second_nodes is not None:
        if not 0 < lag_steps < pulse_period:
            raise ValueError("Задержка должна быть внутри периода.")

    normalization_steps = 0

    for step in range(steps):
        syn *= np.exp(-dt / 0.010)
        adaptation *= np.exp(-dt / 0.200)
        refractory = np.maximum(0.0, refractory - dt)
        trace *= np.exp(-dt / 0.020)

        available = refractory == 0.0

        current = drive + syn - adaptation
        noise = (
            0.012
            * np.sqrt(dt / 0.001)
            * rng.standard_normal(N)
        )

        dv = (dt / 0.020) * (-v + current)
        v[available] += (dv + noise)[available]

        fired = available & (v >= threshold)

        elapsed = step - first_pulse

        first_now = (
            elapsed >= 0
            and elapsed % pulse_period == 0
        )

        second_now = (
            second_nodes is not None
            and elapsed >= lag_steps
            and (elapsed - lag_steps) % pulse_period == 0
        )

        if stimulated:
            if first_now:
                fired[nodes] = True

            if second_now:
                fired[second_nodes] = True

        if plasticity:
            eta = 0.0002

            if np.any(fired):
                W[fired, :] += (
                    eta * trace[None, :] * contacts[fired, :]
                )
                W[:, fired] -= (
                    1.05 * eta * trace[:, None] * contacts[:, fired]
                )

            np.clip(W, 0.0, 0.08, out=W)

            total_input = W.sum(axis=1)

            if np.any(total_input > 0.6):
                normalization_steps += 1

            W *= np.minimum(
                1.0,
                0.6 / np.maximum(total_input, 1e-12),
            )[:, None]

        if np.any(fired):
            syn += W[:, fired].sum(axis=1)

        v[fired] = 0.0
        refractory[fired] = 0.005
        adaptation[fired] += 0.25
        trace[fired] += 1.0

    result = dict(initial)
    result["weights"] = W
    result["state"] = {
        key: value.copy()
        for key, value in initial["state"].items()
    }

    return result, normalization_steps


def measure_response(network, nodes, seed):
    dt = network["dt"]
    N = network["weights"].shape[0]

    steps = int(1.5 / dt)
    pulse_step = int(0.5 / dt)
    bin_steps = int(0.020 / dt)

    rng = np.random.default_rng(seed)
    noise = (
        0.012
        * np.sqrt(dt / 0.001)
        * rng.standard_normal((steps, N))
    )

    baseline = probe(
        network, noise, nodes,
        transmission=True,
        stimulus=False,
    )

    stimulated = probe(
        network, noise, nodes,
        transmission=True,
        stimulus=True,
    )

    assert np.array_equal(
        baseline[:pulse_step],
        stimulated[:pulse_step],
    )

    other = np.ones(N, dtype=bool)
    other[nodes] = False

    def bin_spikes(spikes):
        data = spikes[pulse_step:][:, other]
        usable = (len(data) // bin_steps) * bin_steps

        return data[:usable].reshape(
            -1, bin_steps, other.sum()
        ).sum(axis=1).astype(float)

    base_binned = bin_spikes(baseline)
    stim_binned = bin_spikes(stimulated)

    return stim_binned - base_binned, base_binned


def select_groups(initial, seed=100):
    rng = np.random.default_rng(seed)
    contacts = initial["contacts"]
    N = contacts.shape[0]

    for _ in range(1000):
        chosen = rng.choice(N, size=10, replace=False)
        A = np.sort(chosen[:5])
        B = np.sort(chosen[5:])

        # W[получатель, источник]
        count_AB = contacts[np.ix_(B, A)].sum()
        count_BA = contacts[np.ix_(A, B)].sum()

        if count_AB >= 2 and count_BA >= 2:
            return A, B

    raise RuntimeError("Не удалось выбрать группы с контактами в обе стороны.")


def mean_existing_weight(network, source, target):
    block = network["weights"][np.ix_(target, source)]
    mask = network["contacts"][np.ix_(target, source)]
    return block[mask].mean()


def boundary_fractions(network):
    weights = network["weights"][network["contacts"]]

    return (
        np.mean(weights <= 1e-12),
        np.mean(weights >= 0.08 - 1e-12),
    )


def directed_response(network, source, target, seed):
    response, _ = measure_response(
        network, source, seed
    )

    N = network["weights"].shape[0]

    # Столбцы measure_response() соответствуют всем узлам,
    # кроме непосредственно стимулируемых.
    returned_nodes = np.setdiff1d(
        np.arange(N), source
    )
    target_columns = np.isin(returned_nodes, target)

    # Три окна по 20 мс.
    early_response = response[:3, target_columns]

    return early_response.sum(axis=0).mean()


def sequence_test(
    development_seed=11,
    selection_seed=100,
    learning_seed=2026,
    test_seeds=range(700, 710),
):
    initial = simulate(seed=development_seed)
    A, B = select_groups(initial, seed=selection_seed)

    learned_AB, norm_AB = train_weights(
        initial,
        nodes=A,
        second_nodes=B,
        lag=0.010,
        stimulated=True,
        plasticity=True,
        seed=learning_seed,
    )

    learned_BA, norm_BA = train_weights(
        initial,
        nodes=B,
        second_nodes=A,
        lag=0.010,
        stimulated=True,
        plasticity=True,
        seed=learning_seed,
    )

    # После train_weights() состояния должны совпадать:
    # различаются только веса.
    for key in initial["state"]:
        assert np.array_equal(
            learned_AB["state"][key],
            learned_BA["state"][key],
        )

    print("\nA:", A)
    print("B:", B)
    print("Шаги нормировки:", norm_AB, norm_BA)

    for name, network in [
        ("Исходная", initial),
        ("Обучение AB", learned_AB),
        ("Обучение BA", learned_BA),
    ]:
        w_AB = mean_existing_weight(network, A, B)
        w_BA = mean_existing_weight(network, B, A)
        lower, upper = boundary_fractions(network)

        print(
            f"{name}:"
            f"\n  средний вес A→B = {w_AB:.7f}"
            f"\n  средний вес B→A = {w_BA:.7f}"
            f"\n  веса на нижней/верхней границе: "
            f"{lower:.1%} / {upper:.1%}"
        )

    dw_AB = (
        mean_existing_weight(learned_AB, A, B)
        - mean_existing_weight(learned_BA, A, B)
    )
    dw_BA = (
        mean_existing_weight(learned_AB, B, A)
        - mean_existing_weight(learned_BA, B, A)
    )

    print("\nРазличие весов между обучением AB и BA:")
    print(f"  A→B: {dw_AB:+.7f}  (ожидание: положительное)")
    print(f"  B→A: {dw_BA:+.7f}  (ожидание: отрицательное)")

    rows = []

    for seed in test_seeds:
        ab_forward = directed_response(
            learned_AB, A, B, seed
        )
        ba_forward = directed_response(
            learned_BA, A, B, seed
        )

        ab_reverse = directed_response(
            learned_AB, B, A, seed
        )
        ba_reverse = directed_response(
            learned_BA, B, A, seed
        )

        forward_difference = ab_forward - ba_forward
        reverse_difference = ab_reverse - ba_reverse

        contrast = 0.5 * (
            forward_difference - reverse_difference
        )

        rows.append([
            forward_difference,
            reverse_difference,
            contrast,
        ])

    rows = np.array(rows)

    print("\nФункциональный ответ, первые 60 мс:")
    for column, label in enumerate([
        "Различие A→B",
        "Различие B→A",
        "Направленный контраст",
    ]):
        values = rows[:, column]
        print(
            f"  {label}: "
            f"{values.mean():+.6f} ± {values.std():.6f}"
        )

    print("± — разброс между тестовыми шумами, не доверительный интервал.")

    return {
        "weight_forward": dw_AB,
        "weight_reverse": dw_BA,
        "response_forward": rows[:, 0].mean(),
        "response_reverse": rows[:, 1].mean(),
        "contrast": rows[:, 2].mean(),
        "networks": {
            "AB": learned_AB,
            "BA": learned_BA,
        },
        "A": A.copy(),
        "B": B.copy(),
    }


result = sequence_test()

if __name__ == "__main__":
    results = [result]  # Не запускаем первую сеть повторно.

    for dev, select, learn in [
        (22, 200, 2027),
        (33, 300, 2028),
    ]:
        results.append(sequence_test(dev, select, learn))

    print("\nКонтрасты независимых сетей:")
    print([r["contrast"] for r in results])

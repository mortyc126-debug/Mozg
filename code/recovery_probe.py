import numpy as np

from sim_core import simulate
from regime_map import DT, copy_state, advance, force_initial_spikes
from state_noise_grid import make_free_run_state


def run_probe_recording(checkpoint, W, drive, gain, noise, nodes, stimulus):
    """
    Как run_probe(), но также записывает внутренние переменные
    на каждом шаге, для ВСЕХ узлов (не только наблюдаемых):
      v, (threshold - v), adaptation, gain*syn, refractory
    Переменные записываются ПОСЛЕ обновления на этом шаге,
    то есть после возможного сброса потенциала импульсом.
    Возвращает spikes (все узлы) и словарь traces (время x узел,
    все узлы).
    """
    state = copy_state(checkpoint)

    if stimulus:
        force_initial_spikes(state, W, nodes)

    steps = len(noise)
    N = len(drive)

    spikes = np.zeros((steps, N), dtype=bool)
    v_trace = np.zeros((steps, N))
    margin_trace = np.zeros((steps, N))  # threshold - v
    adaptation_trace = np.zeros((steps, N))
    syn_trace = np.zeros((steps, N))  # gain * syn (эффективный вклад)
    refractory_trace = np.zeros((steps, N))

    for step in range(steps):
        fired = advance(state, W, drive, gain, noise[step])
        spikes[step] = fired

        # Записано ПОСЛЕ сброса v[fired]=0 внутри advance().
        v_trace[step] = state["v"]
        margin_trace[step] = state["threshold"] - state["v"]
        adaptation_trace[step] = state["adaptation"]
        syn_trace[step] = gain * state["syn"]
        refractory_trace[step] = state["refractory"]

    traces = {
        "v": v_trace,
        "margin": margin_trace,
        "adaptation": adaptation_trace,
        "syn_effective": syn_trace,
        "refractory": refractory_trace,
    }

    return spikes, traces


def probe_pair_recording(
    checkpoint, W, drive, gain, nodes, test_seed,
    probe_duration=2.0,
):
    N = len(drive)
    probe_rng = np.random.default_rng(test_seed + 100_000)
    probe_steps = int(round(probe_duration / DT))

    probe_noise = (
        0.012
        * np.sqrt(DT / 0.001)
        * probe_rng.standard_normal((probe_steps, N))
    )

    ckpt = copy_state(checkpoint)

    baseline_spikes, baseline_traces = run_probe_recording(
        ckpt, W, drive, gain, probe_noise, nodes, stimulus=False,
    )
    stimulated_spikes, stimulated_traces = run_probe_recording(
        ckpt, W, drive, gain, probe_noise, nodes, stimulus=True,
    )

    return {
        "noise": probe_noise,
        "baseline_spikes": baseline_spikes,
        "stimulated_spikes": stimulated_spikes,
        "baseline_traces": baseline_traces,
        "stimulated_traces": stimulated_traces,
    }


def pilot_save_load_check(
    development_seed=22, gain=6.0, state_seed=1500, test_seed=2500,
    drive=1.25,
):
    """
    Один прогон + сохранение + загрузка + проверка совпадения +
    построение сводки из загруженного файла, без повторной
    симуляции. Должен выполняться перед основным протоколом.
    """
    initial = simulate(seed=development_seed)
    N = initial["weights"].shape[0]
    W = initial["weights"]

    rng = np.random.default_rng(3100)
    chosen = rng.choice(N, size=15, replace=False)
    nodes = np.sort(chosen[0:5])

    state, drive_vec = make_free_run_state(
        initial, drive, gain, warm_duration=12.0, seed=state_seed
    )

    result = probe_pair_recording(
        state, W, drive_vec, gain, nodes, test_seed, probe_duration=2.0
    )

    # --- 1. Сохранение ---
    filename = "/home/claude/sim/pilot_2s_probe.npz"
    save_dict = {
        "noise": result["noise"],
        "baseline_spikes": result["baseline_spikes"],
        "stimulated_spikes": result["stimulated_spikes"],
        "nodes": nodes,
        "development_seed": development_seed,
        "gain": gain,
        "state_seed": state_seed,
        "test_seed": test_seed,
        "drive": drive,
    }
    for key, arr in result["baseline_traces"].items():
        save_dict[f"baseline_{key}"] = arr
    for key, arr in result["stimulated_traces"].items():
        save_dict[f"stimulated_{key}"] = arr

    np.savez_compressed(filename, **save_dict)
    print(f"Сохранено: {filename}")

    # --- 2. Загрузка ---
    loaded = np.load(filename)

    # --- 3. Проверка совпадения массивов ---
    assert np.array_equal(loaded["noise"], result["noise"]), (
        "Шум не совпал после сохранения/загрузки."
    )
    assert np.array_equal(
        loaded["baseline_spikes"], result["baseline_spikes"]
    ), "baseline_spikes не совпали после save/load."
    assert np.array_equal(
        loaded["stimulated_spikes"], result["stimulated_spikes"]
    ), "stimulated_spikes не совпали после save/load."
    for key in result["baseline_traces"]:
        assert np.array_equal(
            loaded[f"baseline_{key}"], result["baseline_traces"][key]
        ), f"baseline trace '{key}' не совпал после save/load."
    for key in result["stimulated_traces"]:
        assert np.array_equal(
            loaded[f"stimulated_{key}"], result["stimulated_traces"][key]
        ), f"stimulated trace '{key}' не совпал после save/load."

    print("Все массивы совпали после сохранения и загрузки. OK.")

    # --- 4. Проверка совпадения первых 200 мс с прежним запуском ---
    steps_200ms = int(round(0.200 / DT))

    from state_noise_grid import probe_pair as probe_pair_200ms

    baseline_200ms, stimulated_200ms = probe_pair_200ms(
        state, W, drive_vec, gain, nodes, test_seed,
        transmission_check=False,
    )

    noise_200ms = (
        0.012 * np.sqrt(DT / 0.001)
        * np.random.default_rng(test_seed + 100_000)
        .standard_normal((steps_200ms, N))
    )

    assert np.array_equal(
        result["noise"][:steps_200ms], noise_200ms
    ), "Префикс шума 2с-теста не совпадает с 0.2с-тестом."

    assert np.array_equal(
        loaded["baseline_spikes"][:steps_200ms], baseline_200ms
    ), "Префикс baseline растра не совпадает с прежним 0.2с тестом."

    assert np.array_equal(
        loaded["stimulated_spikes"][:steps_200ms], stimulated_200ms
    ), "Префикс stimulated растра не совпадает с прежним 0.2с тестом."

    print(
        "Префикс 200мс двухсекундного теста совпадает с "
        "прежним 0.2с тестом. OK."
    )

    # --- 5. Сводка из загруженного файла (без повторной симуляции) ---
    other = np.ones(N, dtype=bool)
    other[nodes] = False

    base_spikes = loaded["baseline_spikes"][:, other]
    stim_spikes = loaded["stimulated_spikes"][:, other]

    print(f"\nСводка (построена только из {filename}):")
    print(f"  Всего шагов: {base_spikes.shape[0]} ({base_spikes.shape[0]*DT:.1f}с)")
    print(f"  Средняя частота фон: {base_spikes.sum()/(other.sum()*2.0):.3f} Гц")
    print(f"  Средняя частота стимул: {stim_spikes.sum()/(other.sum()*2.0):.3f} Гц")
    print(
        f"  Доля узлов с хотя бы одним отличием за 2с: "
        f"{np.any(base_spikes != stim_spikes, axis=0).mean():.3f}"
    )

    return result, loaded


if __name__ == "__main__":
    pilot_save_load_check()

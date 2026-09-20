"""
Пилот функционального теста v0.5: ОДНА пара (условие="Исходное",
development_seed=11, один набор стимулируемых узлов, один warm_seed,
один test_seed). Версия 2: явный общий шумовой массив вместо RNG,
хранимого в состоянии (см. v05_functional.py).

Проверяет перед расширением до 324 пар:
  1. Неизменность стартового снимка после свободного прогона / проб.
  2. Неизменность весов и порогов во время всего протокола.
  3. Контроль: при transmission=False у остальных узлов растры baseline
     и stimulated идентичны (нет обходного пути воздействия).
  4. Явно одинаковый шумовой массив используется в обеих ветвях пары.
  5. Размер пилотной записи растров (для оценки объёма всех 324).
  6. R и F по 4 окнам + 200мс.
"""
import numpy as np
import pickle
import os

from v05_functional import DT, copy_state, make_noise, probe, run_free_dynamics_with_weights

with open("v05_four_conditions.pkl", "rb") as f:
    ALL_NETS = pickle.load(f)

CONDITION = "Исходное"
DEV_SEED_INDEX = 0  # seeds saved in order (11, 22, 33) per v5f.py run_four_conditions
STIM_NODES = np.array([3, 47, 61])  # arbitrary fixed pilot set, disjoint, no selection by degree
WARM_SEED = 500
TEST_SEED = 900
FREE_DYNAMICS_DURATION = 12.0
PROBE_DURATION_MS = 200
PROBE_STEPS = int(round(PROBE_DURATION_MS / 1000 / DT))


def main():
    net = ALL_NETS[CONDITION][DEV_SEED_INDEX]
    W = net["weights"]
    contacts = net["contacts"]
    N = W.shape[0]

    W_ref = W.copy()
    threshold_ref = net["state"]["threshold"].copy()

    print("=== Пилот: условие =", CONDITION, ", seed index =", DEV_SEED_INDEX, "===")
    print("N =", N, "contacts =", int(contacts.sum()))
    print("stim nodes:", STIM_NODES)

    # --- Step 1: free dynamics run (12s) from saved state, own noise seed ---
    checkpoint = run_free_dynamics_with_weights(
        net["state"], W, seed=WARM_SEED, duration=FREE_DYNAMICS_DURATION,
        transmission=True,
    )

    assert np.array_equal(W, W_ref), "веса изменились во время свободного прогона!"
    assert np.array_equal(net["state"]["threshold"], threshold_ref), (
        "исходный threshold в net['state'] изменился!"
    )
    assert np.array_equal(checkpoint["threshold"], threshold_ref), (
        "threshold изменился во время замороженной динамики -- ошибка!"
    )
    print("OK: веса и пороги не изменились за 12с свободного прогона")

    checkpoint_ref = {k: v.copy() for k, v in checkpoint.items()}

    # --- Step 2: explicit shared noise, paired probes from SAME checkpoint ---
    noise = make_noise(TEST_SEED, PROBE_STEPS, N)
    noise_ref = noise.copy()

    baseline_spikes, _ = probe(
        checkpoint, W, noise, transmission=True, stimulate_nodes=None,
    )
    stimulated_spikes, _ = probe(
        checkpoint, W, noise, transmission=True, stimulate_nodes=STIM_NODES,
    )

    # verify checkpoint and noise untouched by probe()
    for k in checkpoint:
        assert np.array_equal(checkpoint[k], checkpoint_ref[k]), (
            f"checkpoint['{k}'] изменился после probe()!"
        )
    assert np.array_equal(noise, noise_ref), "noise массив изменился после probe()!"
    print("OK: исходный снимок и шумовой массив не изменились после проб")
    print("OK: baseline и stimulated явно используют один и тот же noise-массив (по построению)")

    # --- Step 3: no-transmission control ---
    base_nt_spikes, _ = probe(
        checkpoint, W, noise, transmission=False, stimulate_nodes=None,
    )
    stim_nt_spikes, _ = probe(
        checkpoint, W, noise, transmission=False, stimulate_nodes=STIM_NODES,
    )

    observe_mask = np.ones(N, dtype=bool)
    observe_mask[STIM_NODES] = False

    identical_control = np.array_equal(
        base_nt_spikes[:, observe_mask], stim_nt_spikes[:, observe_mask]
    )
    print(
        "Контроль (transmission=False): растры остальных узлов идентичны:",
        identical_control,
    )
    assert identical_control, (
        "ОШИБКА: при отключённой передаче стимул всё равно влияет на "
        "остальные узлы -- обходной путь воздействия!"
    )

    stim_only_diff = not np.array_equal(
        base_nt_spikes[:, STIM_NODES], stim_nt_spikes[:, STIM_NODES]
    )
    print("Стимулированные узлы отличаются в контроле (ожидаемо True):", stim_only_diff)

    # --- Step 4: R and F metrics, 4 windows + 200ms ---
    window_width = int(round(0.050 / DT))
    R_windows = []
    F_windows = []
    n_observed = observe_mask.sum()

    for w_start_ms in (0, 50, 100, 150):
        start_step = int(round(w_start_ms / 1000 / DT))
        end_step = start_step + window_width
        b = baseline_spikes[start_step:end_step, observe_mask]
        s = stimulated_spikes[start_step:end_step, observe_mask]

        R = (s.sum() - b.sum()) / n_observed
        changed_nodes = np.any(b != s, axis=0)
        F = changed_nodes.mean()

        R_windows.append(R)
        F_windows.append(F)
        print(f"window {w_start_ms}-{w_start_ms+50}ms: R={R:.5f}  F={F:.4f}")

    R_200 = sum(R_windows)
    b_full = baseline_spikes[:, observe_mask]
    s_full = stimulated_spikes[:, observe_mask]
    F_200 = np.any(b_full != s_full, axis=0).mean()

    print(f"R_200 (sum of windows) = {R_200:.5f}")
    print(f"F_200 (union over full 200ms) = {F_200:.4f}")

    b_full_end = int(round(200 / 1000 / DT))
    R_200_direct = (
        stimulated_spikes[:b_full_end, observe_mask].sum()
        - baseline_spikes[:b_full_end, observe_mask].sum()
    ) / n_observed
    assert abs(R_200 - R_200_direct) < 1e-9, "R_200 не совпадает с прямой суммой!"
    print("OK: R_200 согласован с прямым расчётом по полному окну")

    # frequencies baseline/stimulated (per required saved fields)
    baseline_rate_hz = baseline_spikes[:, observe_mask].sum() / n_observed / (PROBE_DURATION_MS / 1000)
    stimulated_rate_hz = stimulated_spikes[:, observe_mask].sum() / n_observed / (PROBE_DURATION_MS / 1000)
    print(f"baseline rate ~{baseline_rate_hz:.2f} Hz, stimulated rate ~{stimulated_rate_hz:.2f} Hz")

    # --- Step 5: save/load roundtrip ---
    pilot_record = {
        "condition": CONDITION,
        "dev_seed_index": DEV_SEED_INDEX,
        "stim_nodes": STIM_NODES,
        "warm_seed": WARM_SEED,
        "test_seed": TEST_SEED,
        "baseline_spikes": baseline_spikes,
        "stimulated_spikes": stimulated_spikes,
        "R_windows": R_windows,
        "F_windows": F_windows,
        "R_200": R_200,
        "F_200": F_200,
        "baseline_rate_hz": baseline_rate_hz,
        "stimulated_rate_hz": stimulated_rate_hz,
        "code_version": "v05_functional.py explicit-noise (post-review)",
    }
    with open("v05_pilot_record.pkl", "wb") as f:
        pickle.dump(pilot_record, f)

    size_bytes = os.path.getsize("v05_pilot_record.pkl")
    print(f"Размер пилотной записи: {size_bytes} байт ({size_bytes/1024:.1f} КБ)")

    with open("v05_pilot_record.pkl", "rb") as f:
        reloaded = pickle.load(f)
    assert np.array_equal(reloaded["baseline_spikes"], baseline_spikes)
    assert np.array_equal(reloaded["stimulated_spikes"], stimulated_spikes)
    print("OK: сохранение/загрузка согласованы")

    print("\n=== ПИЛОТ ЗАВЕРШЁН УСПЕШНО ===")


if __name__ == "__main__":
    main()

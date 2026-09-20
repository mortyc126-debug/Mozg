"""
v0.7 функциональный тест: 36 конечных снимков (t=24с, после истории
перестройки) x 3 набора стимуляции x 3 тестовых шума = 324 пары.

БЕЗ дополнительного прогрева -- пробы стартуют непосредственно со
снимка t=24с (согласовано: вопрос теста -- "как отличается реакция
сети НЕПОСРЕДСТВЕННО после разных историй перестройки", включая и
граф, и накопленное динамическое состояние).

Стимульные наборы и тестовые шумы идентичны протоколу v0.5/v0.6.
"""
import numpy as np
import pickle
import time

from v05_functional import DT, make_noise, probe

CODE_VERSION = "v07_functional_full.py (no extra warm-up, 324 pairs)"

with open("v07_rewiring_full.pkl", "rb") as f:
    D07 = pickle.load(f)

N = 80
PROBE_DURATION_MS = 200
PROBE_STEPS = int(round(PROBE_DURATION_MS / 1000 / DT))
WINDOW_WIDTH = int(round(0.050 / DT))

TEST_SEEDS = [900, 901, 902]  # identical to v0.5/v0.6 protocol

# identical stimulus sets to v05_full_run.py / v06_functional_96s.py
rng_stim = np.random.default_rng(12345)
STIM_SETS = []
all_nodes = np.arange(N)
used = set()
for k in range(3):
    remaining = np.array([n for n in all_nodes if n not in used])
    chosen = rng_stim.choice(remaining, size=3, replace=False)
    STIM_SETS.append(np.sort(chosen))
    used.update(chosen.tolist())
print("Наборы стимулируемых узлов (идентичны v0.5/v0.6):")
for k, s in enumerate(STIM_SETS):
    print(f"  set {k}: {s}")


def compute_metrics(baseline_spikes, stimulated_spikes, observe_mask):
    n_observed = observe_mask.sum()
    R_windows, F_windows = [], []
    for w_start_ms in (0, 50, 100, 150):
        start_step = int(round(w_start_ms / 1000 / DT))
        end_step = start_step + WINDOW_WIDTH
        b = baseline_spikes[start_step:end_step, observe_mask]
        s = stimulated_spikes[start_step:end_step, observe_mask]
        R = (s.sum() - b.sum()) / n_observed
        F = np.any(b != s, axis=0).mean()
        R_windows.append(R)
        F_windows.append(F)
    R_200 = sum(R_windows)
    b_full = baseline_spikes[:, observe_mask]
    s_full = stimulated_spikes[:, observe_mask]
    F_200 = np.any(b_full != s_full, axis=0).mean()
    baseline_rate_hz = b_full.sum() / n_observed / (PROBE_DURATION_MS / 1000)
    stimulated_rate_hz = s_full.sum() / n_observed / (PROBE_DURATION_MS / 1000)
    return R_windows, F_windows, R_200, F_200, baseline_rate_hz, stimulated_rate_hz


def main():
    t_start = time.time()
    results = []
    n_pairs = 0

    trajectory_keys = list(D07["results"].keys())
    assert len(trajectory_keys) == 36

    for traj_key in trajectory_keys:
        seed, growth_cond, policy, repeat = traj_key
        snap24 = D07["results"][traj_key]["snapshots"][24.0]
        W = snap24["weights"]
        state = snap24["state"]
        W_ref = W.copy()
        threshold_ref = state["threshold"].copy()

        for stim_idx, stim_nodes in enumerate(STIM_SETS):
            observe_mask = np.ones(N, dtype=bool)
            observe_mask[stim_nodes] = False

            for test_seed in TEST_SEEDS:
                noise = make_noise(test_seed, PROBE_STEPS, N)

                baseline_spikes, _ = probe(
                    state, W, noise, transmission=True, stimulate_nodes=None,
                )
                stimulated_spikes, _ = probe(
                    state, W, noise, transmission=True, stimulate_nodes=stim_nodes,
                )

                assert np.array_equal(W, W_ref), f"веса изменились! {traj_key}"
                assert np.array_equal(state["threshold"], threshold_ref), (
                    f"threshold изменился! {traj_key}"
                )

                (R_windows, F_windows, R_200, F_200,
                 baseline_rate_hz, stimulated_rate_hz) = compute_metrics(
                    baseline_spikes, stimulated_spikes, observe_mask,
                )

                results.append({
                    "geometry_seed": seed,
                    "growth_condition": growth_cond,
                    "policy": policy,
                    "repeat_index": repeat,
                    "stim_set_index": stim_idx,
                    "stim_nodes": stim_nodes,
                    "test_seed": test_seed,
                    "baseline_spikes": baseline_spikes,
                    "stimulated_spikes": stimulated_spikes,
                    "R_windows": R_windows,
                    "F_windows": F_windows,
                    "R_200": R_200,
                    "F_200": F_200,
                    "baseline_rate_hz": baseline_rate_hz,
                    "stimulated_rate_hz": stimulated_rate_hz,
                })
                n_pairs += 1

    t_end = time.time()
    print(f"Завершено: {n_pairs} пар за {t_end-t_start:.1f}с")
    assert n_pairs == 324

    output = {
        "results": results,
        "stim_sets": STIM_SETS,
        "test_seeds": TEST_SEEDS,
        "probe_duration_ms": PROBE_DURATION_MS,
        "dt": DT,
        "source": "v07_rewiring_full.pkl snapshots at t=24.0, NO additional warm-up",
        "code_version": CODE_VERSION,
        "runtime_seconds": t_end - t_start,
    }

    with open("v07_functional_full_324.pkl", "wb") as f:
        pickle.dump(output, f)

    import os
    print(f"Сохранено: v07_functional_full_324.pkl "
          f"({os.path.getsize('v07_functional_full_324.pkl')/1024/1024:.2f} МБ)")


if __name__ == "__main__":
    main()

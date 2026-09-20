"""
v0.6 функциональный тест: тот же протокол v0.5 (36 свободных прогонов,
324 пары), применённый к снимкам t=96с из v06_extended_growth_full.pkl.

Все параметры (стимулируемые узлы, warm_seeds, test_seeds, длительность
свободного прогона, окна, метрики) СОХРАНЕНЫ идентичными v05_full_run.py
-- единственное отличие: net["state"]/net["weights"] берутся из снимка
t=96с вместо исходного (t=12с) состояния v05_four_conditions.pkl.

Перед этим набором подтверждено (см. чат): протокол на снимке t=12с из
v06_extended_growth_full.pkl побитово воспроизводит ранее сохранённый
результат v05_functional_full_324.pkl -- значит совместимость снимков
v0.6 с v05_functional.py подтверждена эмпирически, не только по схеме
полей.
"""
import numpy as np
import pickle
import time

from v05_functional import DT, run_free_dynamics_with_weights, make_noise, probe

CODE_VERSION = "v06_functional_96s.py (same protocol as v05_full_run.py, t=96s snapshots)"

with open("v06_extended_growth_full.pkl", "rb") as f:
    D06 = pickle.load(f)

CONDITIONS = ["Исходное", "Только бюджет", "Только длина", "Совместное"]
GEOMETRY_SEEDS = [11, 22, 33]  # actual development seeds, unlike v0.5's ambiguous index
SNAPSHOT_TIME = 96.0

N = 80
FREE_DYNAMICS_DURATION = 12.0  # same as v0.5 protocol: additional 12s free run
PROBE_DURATION_MS = 200
PROBE_STEPS = int(round(PROBE_DURATION_MS / 1000 / DT))
WINDOW_WIDTH = int(round(0.050 / DT))

WARM_SEEDS = [500, 501, 502]      # identical to v05_full_run.py
TEST_SEEDS = [900, 901, 902]      # identical to v05_full_run.py

# identical stimulus sets to v05_full_run.py (same rng seed=12345, same construction)
rng_stim = np.random.default_rng(12345)
STIM_SETS = []
all_nodes = np.arange(N)
used = set()
for k in range(3):
    remaining = np.array([n for n in all_nodes if n not in used])
    chosen = rng_stim.choice(remaining, size=3, replace=False)
    STIM_SETS.append(np.sort(chosen))
    used.update(chosen.tolist())
print("Наборы стимулируемых узлов (идентичны v05_full_run.py):")
for k, s in enumerate(STIM_SETS):
    print(f"  set {k}: {s}")


def compute_metrics(baseline_spikes, stimulated_spikes, observe_mask):
    n_observed = observe_mask.sum()
    R_windows = []
    F_windows = []
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
    checkpoints_store = {}
    n_pairs = 0
    n_warm = 0

    for geom_seed in GEOMETRY_SEEDS:
        for condition in CONDITIONS:
            snap = D06["snapshots"][geom_seed][condition][SNAPSHOT_TIME]
            W = snap["weights"]
            W_ref = W.copy()
            threshold_ref = snap["state"]["threshold"].copy()

            for warm_seed in WARM_SEEDS:
                checkpoint = run_free_dynamics_with_weights(
                    snap["state"], W, seed=warm_seed,
                    duration=FREE_DYNAMICS_DURATION, transmission=True,
                )
                n_warm += 1
                checkpoints_store[(geom_seed, condition, warm_seed)] = {
                    k: v.copy() for k, v in checkpoint.items()
                }

                assert np.array_equal(W, W_ref), (
                    f"веса изменились! seed={geom_seed} cond={condition} warm={warm_seed}"
                )
                assert np.array_equal(snap["state"]["threshold"], threshold_ref), (
                    f"исходный threshold изменился! seed={geom_seed} cond={condition}"
                )

                for stim_idx, stim_nodes in enumerate(STIM_SETS):
                    observe_mask = np.ones(N, dtype=bool)
                    observe_mask[stim_nodes] = False

                    for test_seed in TEST_SEEDS:
                        noise = make_noise(test_seed, PROBE_STEPS, N)

                        baseline_spikes, _ = probe(
                            checkpoint, W, noise, transmission=True,
                            stimulate_nodes=None,
                        )
                        stimulated_spikes, _ = probe(
                            checkpoint, W, noise, transmission=True,
                            stimulate_nodes=stim_nodes,
                        )

                        (R_windows, F_windows, R_200, F_200,
                         baseline_rate_hz, stimulated_rate_hz) = compute_metrics(
                            baseline_spikes, stimulated_spikes, observe_mask,
                        )

                        results.append({
                            "geometry_seed": geom_seed,
                            "condition": condition,
                            "snapshot_time": SNAPSHOT_TIME,
                            "warm_seed": warm_seed,
                            "test_seed": test_seed,
                            "stim_set_index": stim_idx,
                            "stim_nodes": stim_nodes,
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
    print(f"Завершено: {n_warm} свободных прогонов, {n_pairs} пар за {t_end-t_start:.1f}с")
    assert n_warm == 36
    assert n_pairs == 324

    output = {
        "results": results,
        "checkpoints": checkpoints_store,
        "conditions": CONDITIONS,
        "geometry_seeds": GEOMETRY_SEEDS,
        "snapshot_time": SNAPSHOT_TIME,
        "warm_seeds": WARM_SEEDS,
        "test_seeds": TEST_SEEDS,
        "stim_sets": STIM_SETS,
        "probe_duration_ms": PROBE_DURATION_MS,
        "free_dynamics_duration_s": FREE_DYNAMICS_DURATION,
        "dt": DT,
        "code_version": CODE_VERSION,
        "runtime_seconds": t_end - t_start,
    }

    with open("v06_functional_96s_full_324.pkl", "wb") as f:
        pickle.dump(output, f)
    print("Сохранено: v06_functional_96s_full_324.pkl")

    import os
    print(f"Размер: {os.path.getsize('v06_functional_96s_full_324.pkl')/1024/1024:.2f} МБ")


if __name__ == "__main__":
    main()

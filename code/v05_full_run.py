"""
Полный функциональный тест версии 0.5: 324 пары.

Сетка:
  3 геометрии (development_seed, ПРЕДПОЛОЖИТЕЛЬНО 11/22/33 по порядку
    вызова в v5f.py::run_four_conditions -- см. index_to_seed ниже;
    подтверждено эмпирически ТОЛЬКО что index соответствует одной и той
    же геометрии (positions/distance идентичны) во всех 4 условиях роста,
    НЕ что index=0 <-> seed=11 буквально)
  x 4 условия роста (Исходное / Только бюджет / Только длина / Совместное)
  x 3 состояния после 12с дополнительного свободного прогона (warm_seed)
  x 3 тестовых шума (test_seed)
  x 3 набора стимулируемых узлов (случайные, непересекающиеся, без отбора
    по степени/весам)
  = 3*4*3*3*3 = 324 пары; 36 warm-прогонов (переиспользуются для всех
    комбинаций стимул x тестовый шум).

Для каждой пары сохраняется: условие, geometry_index, warm_seed, test_seed,
номер набора стимуляции и сами узлы, оба полных растра, R/F по 4 окнам
и за 200мс, частоты baseline/stimulated, версия кода.
"""
import numpy as np
import pickle
import time

from v05_functional import DT, run_free_dynamics_with_weights, make_noise, probe

CODE_VERSION = "v05_functional.py explicit-noise (post-review, full run)"

with open("v05_four_conditions.pkl", "rb") as f:
    ALL_NETS = pickle.load(f)

CONDITIONS = ["Исходное", "Только бюджет", "Только длина", "Совместное"]
GEOMETRY_INDICES = [0, 1, 2]
# Порядок вызова в v5f.py::run_four_conditions: for seed in seeds: for name in CONDITIONS_V05.
# seeds по умолчанию = (11, 22, 33) -- это ВЫВЕДЕНО из кода, не проверено независимо
# от факта самого числа. Подтверждено эмпирически: positions/distance идентичны
# по index между всеми 4 условиями (см. чат) -- то есть index корректно
# сопоставляет геометрии между условиями, даже если подпись seed неточна.
INDEX_TO_SEED_LABEL = {0: 11, 1: 22, 2: 33}  # предполагаемая подпись, из кода v5f.py

N = 80
FREE_DYNAMICS_DURATION = 12.0
PROBE_DURATION_MS = 200
PROBE_STEPS = int(round(PROBE_DURATION_MS / 1000 / DT))
WINDOW_WIDTH = int(round(0.050 / DT))

WARM_SEEDS = [500, 501, 502]
TEST_SEEDS = [900, 901, 902]

rng_stim = np.random.default_rng(12345)
STIM_SETS = []
all_nodes = np.arange(N)
used = set()
for k in range(3):
    remaining = np.array([n for n in all_nodes if n not in used])
    chosen = rng_stim.choice(remaining, size=3, replace=False)
    STIM_SETS.append(np.sort(chosen))
    used.update(chosen.tolist())
print("Наборы стимулируемых узлов (непересекающиеся, случайные):")
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
    checkpoints_store = {}  # (geom_idx, condition, warm_seed) -> checkpoint dict
    n_pairs = 0
    n_warm = 0

    for geom_idx in GEOMETRY_INDICES:
        for condition in CONDITIONS:
            net = ALL_NETS[condition][geom_idx]
            W = net["weights"]
            W_ref = W.copy()
            threshold_ref = net["state"]["threshold"].copy()

            for warm_seed in WARM_SEEDS:
                checkpoint = run_free_dynamics_with_weights(
                    net["state"], W, seed=warm_seed,
                    duration=FREE_DYNAMICS_DURATION, transmission=True,
                )
                n_warm += 1
                checkpoints_store[(geom_idx, condition, warm_seed)] = {
                    k: v.copy() for k, v in checkpoint.items()
                }

                # integrity checks every warm run (cheap, keep them)
                assert np.array_equal(W, W_ref), (
                    f"веса изменились! geom={geom_idx} cond={condition} warm={warm_seed}"
                )
                assert np.array_equal(net["state"]["threshold"], threshold_ref), (
                    f"исходный threshold изменился! geom={geom_idx} cond={condition}"
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
                            "geometry_index": geom_idx,
                            "geometry_seed_label": INDEX_TO_SEED_LABEL[geom_idx],
                            "condition": condition,
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
    assert n_warm == 36, f"ожидалось 36 прогревов, получено {n_warm}"
    assert n_pairs == 324, f"ожидалось 324 пары, получено {n_pairs}"

    output = {
        "results": results,
        "checkpoints": checkpoints_store,
        "conditions": CONDITIONS,
        "geometry_indices": GEOMETRY_INDICES,
        "index_to_seed_label": INDEX_TO_SEED_LABEL,
        "index_to_seed_label_note": (
            "Соответствие index->seed выведено из порядка вызова в "
            "v5f.py::run_four_conditions (for seed in seeds: for name in "
            "CONDITIONS_V05), НЕ проверено независимо от значения самого "
            "числа. Эмпирически подтверждено только то, что один и тот же "
            "index даёт идентичные positions/distance во всех 4 условиях "
            "(т.е. index корректно сопоставляет геометрии между условиями)."
        ),
        "warm_seeds": WARM_SEEDS,
        "test_seeds": TEST_SEEDS,
        "stim_sets": STIM_SETS,
        "probe_duration_ms": PROBE_DURATION_MS,
        "free_dynamics_duration_s": FREE_DYNAMICS_DURATION,
        "dt": DT,
        "code_version": CODE_VERSION,
        "runtime_seconds": t_end - t_start,
    }

    with open("v05_functional_full_324.pkl", "wb") as f:
        pickle.dump(output, f)
    print("Сохранено: v05_functional_full_324.pkl")

    import os
    print(f"Размер: {os.path.getsize('v05_functional_full_324.pkl')/1024/1024:.2f} МБ")


if __name__ == "__main__":
    main()

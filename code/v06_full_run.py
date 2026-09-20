"""
v0.6: полный структурный прогон -- 12 траекторий развития до 96с
(3 геометрии x 4 условия), снимки на 12/24/48/96с.

Сохраняет:
  - все снимки целиком (structure + state + RNG-состояния) для
    возможного точного продолжения в будущем;
  - структурную сводку на каждый снимок (см. v06_structural_summary.py);
  - индекс Жаккара между ВСЕМИ 6 парами условий, для каждой геометрии
    и каждого времени.

Функциональные проверки НЕ запускаются на этом шаге (согласовано отдельно).
"""
import numpy as np
import pickle
import time
import itertools

from v06_extended_growth import simulate_v05_snapshots
from v06_structural_summary import structural_summary, jaccard

CODE_VERSION = "v06_full_run.py (structural extended-growth run)"

SEEDS = [11, 22, 33]
CONDITIONS = {
    "Исходное": dict(use_budget=False, use_length_penalty=False),
    "Только бюджет": dict(use_budget=True, use_length_penalty=False),
    "Только длина": dict(use_budget=False, use_length_penalty=True),
    "Совместное": dict(use_budget=True, use_length_penalty=True),
}
DURATION_SNAPSHOTS = (12.0, 24.0, 48.0, 96.0)
MAX_IN_DEGREE = 12


def main():
    t_start = time.time()

    # snapshots[seed][condition] = {t -> net_dict}
    all_snapshots = {}
    # summaries[seed][condition][t] = structural_summary dict
    all_summaries = {}

    for seed in SEEDS:
        all_snapshots[seed] = {}
        all_summaries[seed] = {}
        for cond_name, params in CONDITIONS.items():
            snaps = simulate_v05_snapshots(
                seed=seed, max_in_degree=MAX_IN_DEGREE,
                duration_snapshots=DURATION_SNAPSHOTS, **params,
            )
            all_snapshots[seed][cond_name] = snaps

            summaries_by_t = {}
            for t, snap in snaps.items():
                summaries_by_t[t] = structural_summary(
                    snap, use_budget=params["use_budget"], max_in_degree=MAX_IN_DEGREE,
                )
            all_summaries[seed][cond_name] = summaries_by_t

            print(f"seed={seed} condition={cond_name}: done "
                  f"({[round(all_summaries[seed][cond_name][t]['fill_fraction'], 3) for t in DURATION_SNAPSHOTS]} fill fractions)")

    # Jaccard between all 6 pairs of conditions, per geometry, per time
    condition_names = list(CONDITIONS.keys())
    condition_pairs = list(itertools.combinations(condition_names, 2))

    jaccard_results = {}  # jaccard_results[seed][t][(condA,condB)] = J
    for seed in SEEDS:
        jaccard_results[seed] = {}
        for t in DURATION_SNAPSHOTS:
            jaccard_results[seed][t] = {}
            for condA, condB in condition_pairs:
                cA = all_snapshots[seed][condA][t]["contacts"]
                cB = all_snapshots[seed][condB][t]["contacts"]
                jaccard_results[seed][t][(condA, condB)] = jaccard(cA, cB)

    t_end = time.time()
    print(f"\nЗавершено за {t_end - t_start:.1f}с")

    output = {
        "snapshots": all_snapshots,
        "summaries": all_summaries,
        "jaccard": jaccard_results,
        "seeds": SEEDS,
        "conditions": condition_names,
        "condition_params": CONDITIONS,
        "duration_snapshots": DURATION_SNAPSHOTS,
        "max_in_degree": MAX_IN_DEGREE,
        "dt": 0.001,
        "code_version": CODE_VERSION,
        "runtime_seconds": t_end - t_start,
    }

    with open("v06_extended_growth_full.pkl", "wb") as f:
        pickle.dump(output, f)

    import os
    size_mb = os.path.getsize("v06_extended_growth_full.pkl") / 1024 / 1024
    print(f"Сохранено: v06_extended_growth_full.pkl ({size_mb:.2f} МБ)")


if __name__ == "__main__":
    main()

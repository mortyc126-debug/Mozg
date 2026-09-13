"""v0.11 фаза 1: обучение (протокол v0.8) на НОВЫХ парах групп A/B.

Переиспользует ЗАФИКСИРОВАННЫЙ код v0.8 (run_experience_trajectory) без
изменений -- новая пара групп это параметр, а не новая семантика.

Механизмы: M1 (пластичность + замена слабейшего, основная ветвь) и
M3 (без пластичности, замена слабейшего -- технический контроль,
обязан давать ТОЧНОЕ совпадение AB/BA). M2/M0 не запускаются: они
отвечали на вопрос v0.10 о вкладе перестройки, не на вопрос о
полезности.

Все параметры протокола -- те же, что в v08_full_run.py.
"""
import pickle
import time

import numpy as np

from v08_experience_rewiring import run_experience_trajectory
from v11_groups import SELECTION_SEEDS, select_pair_both_histories

GEOMETRY_SEEDS = [11, 22, 33]
GROWTH_CONDITIONS = ["Только бюджет", "Совместное"]
SNAPSHOT_TIME = 96.0

MECHANISMS = [
    (True, "weakest", "M1_plasticity_weakest"),
    (False, "weakest", "M3_no_plasticity_weakest"),
]

DURATION = 24.0
REWIRE_INTERVAL = 0.5
SEQUENCE_PERIOD = 0.4
FIRST_PULSE_TIME = 0.2
LAG = 0.010
REWIRE_SEEDS = [42, 43]
NOISE_SEEDS = [1000, 1001]


def resolve_groups(D06):
    """Пара групп на (seed отбора, геометрия). Критерий из v0.8."""
    groups = {}
    for sel in SELECTION_SEEDS:
        for geom in GEOMETRY_SEEDS:
            cbh = [D06["snapshots"][geom][g][SNAPSHOT_TIME]["contacts"]
                   for g in GROWTH_CONDITIONS]
            groups[(sel, geom)] = select_pair_both_histories(cbh, sel)
    return groups


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    groups = resolve_groups(D06)

    results = {}
    t0 = time.time()
    n_m3_checked = 0

    for sel in SELECTION_SEEDS:
        for geom in GEOMETRY_SEEDS:
            group_A, group_B = groups[(sel, geom)]
            for growth in GROWTH_CONDITIONS:
                snap = D06["snapshots"][geom][growth][SNAPSHOT_TIME]
                for plast, policy, mech in MECHANISMS:
                    for rep, (rw_seed, nz_seed) in enumerate(
                            zip(REWIRE_SEEDS, NOISE_SEEDS)):
                        trajs = {}
                        for order in ("AB", "BA"):
                            trajs[order] = run_experience_trajectory(
                                snap["contacts"], snap["weights"], snap["state"],
                                snap["distance"],
                                order=order, plasticity_enabled=plast,
                                rewire_policy=policy,
                                group_A=group_A, group_B=group_B,
                                duration=DURATION, rewire_interval=REWIRE_INTERVAL,
                                sequence_period=SEQUENCE_PERIOD,
                                first_pulse_time=FIRST_PULSE_TIME, lag=LAG,
                                rewire_seed=rw_seed, noise_seed=nz_seed)

                        # M3 -- ТОЧНЫЙ контроль (без допуска, ловушка №14)
                        if mech == "M3_no_plasticity_weakest":
                            same_c = np.array_equal(trajs["AB"]["contacts"],
                                                    trajs["BA"]["contacts"])
                            same_w = np.array_equal(trajs["AB"]["weights"],
                                                    trajs["BA"]["weights"])
                            if not (same_c and same_w):
                                raise AssertionError(
                                    f"M3 КОНТРОЛЬ НЕ ПРОЙДЕН: sel={sel} geom={geom} "
                                    f"{growth} rep={rep}: contacts={same_c} weights={same_w}")
                            n_m3_checked += 1

                        results[(sel, geom, growth, mech, rep)] = {
                            "AB": {k: trajs["AB"][k] for k in ("contacts", "weights")},
                            "BA": {k: trajs["BA"][k] for k in ("contacts", "weights")},
                            "group_A": np.asarray(group_A),
                            "group_B": np.asarray(group_B),
                        }

    out = {
        "results": results,
        "groups": {k: (np.asarray(v[0]), np.asarray(v[1])) for k, v in groups.items()},
        "selection_seeds": SELECTION_SEEDS,
        "geometry_seeds": GEOMETRY_SEEDS,
        "growth_conditions": GROWTH_CONDITIONS,
        "mechanisms": [m[2] for m in MECHANISMS],
        "repeats": list(range(len(REWIRE_SEEDS))),
        "rewire_seeds": REWIRE_SEEDS, "noise_seeds": NOISE_SEEDS,
        "snapshot_time_source": SNAPSHOT_TIME,
        "duration": DURATION, "lag": LAG,
        "n_m3_exact_checks_passed": n_m3_checked,
        "code_version": "v0.11 phase1 train",
        "runtime_seconds": time.time() - t0,
    }
    with open("v11_train_full.pkl", "wb") as f:
        pickle.dump(out, f)

    print(f"траекторий: {len(results)*2}  время: {out['runtime_seconds']:.1f} c")
    print(f"M3 точных контролей пройдено: {n_m3_checked}")
    print("сохранено: v11_train_full.pkl")


if __name__ == "__main__":
    main()

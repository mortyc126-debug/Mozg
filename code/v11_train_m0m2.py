"""v0.11 фаза 4: обучение M0 и M2 на тех же 3 парах групп.

Вопрос: держится ли структурный след (dW>0) и ускорение отклика на
ОДНОЙ пластичности, без перестройки контактов?

M0 -- пластичность, перестройка ВЫКЛЮЧЕНА (v10_no_rewiring.py,
      побитовое совпадение с v0.8 при одинаковой политике подтверждено
      unit-тестами, прогнаны в этой среде).
M2 -- пластичность + СЛУЧАЙНАЯ замена (v08, policy="random").

Ожидаемые контроли (по v0.9): у M0 граф не меняется вовсе, у M2
случайный выбор не зависит от весов/активности => contacts AB==BA
ТОЧНО в обеих ветвях, и вклад топологии в dW обязан быть РОВНО нулём.
Это проверяется, а не предполагается.
"""
import pickle
import time

import numpy as np

from v08_experience_rewiring import run_experience_trajectory as run_v08
from v10_no_rewiring import run_experience_trajectory as run_v10
from v11_train import (GEOMETRY_SEEDS, GROWTH_CONDITIONS, SNAPSHOT_TIME,
                       DURATION, REWIRE_INTERVAL, SEQUENCE_PERIOD,
                       FIRST_PULSE_TIME, LAG, REWIRE_SEEDS, NOISE_SEEDS,
                       resolve_groups)
from v11_groups import SELECTION_SEEDS

MECHANISMS = [
    ("M0_plasticity_norewire", run_v10, True, "none"),
    ("M2_plasticity_random", run_v08, True, "random"),
]


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    groups = resolve_groups(D06)

    results = {}
    t0 = time.time()
    n_contacts_equal = 0
    n_graph_unchanged = 0

    for sel in SELECTION_SEEDS:
        for geom in GEOMETRY_SEEDS:
            gA, gB = groups[(sel, geom)]
            for growth in GROWTH_CONDITIONS:
                snap = D06["snapshots"][geom][growth][SNAPSHOT_TIME]
                for mech, runner, plast, policy in MECHANISMS:
                    for rep, (rw, nz) in enumerate(zip(REWIRE_SEEDS, NOISE_SEEDS)):
                        trajs = {}
                        for order in ("AB", "BA"):
                            trajs[order] = runner(
                                snap["contacts"], snap["weights"], snap["state"],
                                snap["distance"],
                                order=order, plasticity_enabled=plast,
                                rewire_policy=policy,
                                group_A=gA, group_B=gB,
                                duration=DURATION, rewire_interval=REWIRE_INTERVAL,
                                sequence_period=SEQUENCE_PERIOD,
                                first_pulse_time=FIRST_PULSE_TIME, lag=LAG,
                                rewire_seed=rw, noise_seed=nz)

                        # КОНТРОЛЬ: контакты ветвей обязаны совпадать ТОЧНО
                        if not np.array_equal(trajs["AB"]["contacts"],
                                              trajs["BA"]["contacts"]):
                            raise AssertionError(
                                f"{mech}: contacts AB != BA -- {sel},{geom},{growth},{rep}")
                        n_contacts_equal += 1

                        # КОНТРОЛЬ для M0: граф вообще не изменился
                        if mech == "M0_plasticity_norewire":
                            if not np.array_equal(trajs["AB"]["contacts"],
                                                  snap["contacts"]):
                                raise AssertionError(f"M0 изменил граф: {sel},{geom}")
                            n_graph_unchanged += 1

                        results[(sel, geom, growth, mech, rep)] = {
                            "AB": {k: trajs["AB"][k] for k in ("contacts", "weights")},
                            "BA": {k: trajs["BA"][k] for k in ("contacts", "weights")},
                            "group_A": np.asarray(gA), "group_B": np.asarray(gB),
                        }

    out = {"results": results,
           "groups": {k: (np.asarray(v[0]), np.asarray(v[1])) for k, v in groups.items()},
           "selection_seeds": SELECTION_SEEDS,
           "mechanisms": [m[0] for m in MECHANISMS],
           "n_contacts_equal_checks": n_contacts_equal,
           "n_m0_graph_unchanged_checks": n_graph_unchanged,
           "code_version": "v0.11 phase4 train M0/M2",
           "runtime_seconds": time.time() - t0}
    with open("v11_train_m0m2.pkl", "wb") as f:
        pickle.dump(out, f)

    print(f"траекторий: {len(results)*2}  время: {out['runtime_seconds']:.1f} c")
    print(f"контроль contacts AB==BA пройден: {n_contacts_equal}")
    print(f"контроль 'M0 не изменил граф' пройден: {n_graph_unchanged}")
    print("сохранено: v11_train_m0m2.pkl")


if __name__ == "__main__":
    main()

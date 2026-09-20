"""v0.11 фаза 2: проверка БЕЗ ДЕКОДЕРА -- есть ли вообще различие
отклика между двумя порядками предъявления?

Зачем: точность декодера у случайного уровня допускает ДВА разных
объяснения -- (а) различия нет в принципе, (б) различие есть, но
декодер слаб (1960 признаков на 80 проб). Их надо развести, иначе
нулевой результат не интерпретируем.

Метод, не использующий обучение: для каждой ветви усредняем растр
НЕ стимулированных узлов (после обоих импульсов) по 40 шумам отдельно
для порядка AB и BA, берём |разность|. Порог шума строим из того же
материала: делим пробы ОДНОГО порядка пополам и меряем ту же величину
между половинами. Если различие между порядками не превышает различия
внутри порядка -- сигнала нет, и это свойство модели, а не декодера.
"""
import pickle
import time

import numpy as np

from v05_functional import make_noise
from v09_functional_probe import build_common_start_state
from v11_sequence_probe import sequence_probe, build_order_schedule

TEST_SEEDS = list(range(930, 970))
PROBE_STEPS = 200
T0_MS, LAG_MS = 50, 10
FEATURE_START_MS = T0_MS + LAG_MS + 1
SNAPSHOT_TIME = 96.0
N = 80


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    with open("v11_train_full.pkl", "rb") as f:
        T = pickle.load(f)
    noises = {s: make_noise(s, PROBE_STEPS, N) for s in TEST_SEEDS}
    rng = np.random.default_rng(777)

    between, within = [], []
    t0 = time.time()
    for key, rec in T["results"].items():
        if key[3] != "M1_plasticity_weakest":
            continue
        sel, geom, growth, mech, rep = key
        gA, gB = rec["group_A"], rec["group_B"]
        keep = np.setdiff1d(np.arange(N), np.concatenate([gA, gB]))
        v06_state = D06["snapshots"][geom][growth][SNAPSHOT_TIME]["state"]

        for br in ("AB", "BA"):
            state, W, contacts = build_common_start_state(v06_state, rec[br])
            r = {"AB": [], "BA": []}
            for seed in TEST_SEEDS:
                for order in ("AB", "BA"):
                    first, second = (gA, gB) if order == "AB" else (gB, gA)
                    sched = build_order_schedule(first, second, T0_MS, LAG_MS)
                    sp, _, _ = sequence_probe(state, W, contacts,
                                              noises[seed], sched)
                    r[order].append(sp[FEATURE_START_MS:][:, keep])
            A = np.array(r["AB"], float); B = np.array(r["BA"], float)
            # МЕЖДУ порядками
            between.append(float(np.abs(A.mean(0) - B.mean(0)).mean()))
            # ВНУТРИ порядка: случайное разбиение проб одного порядка пополам
            w = []
            for M in (A, B):
                for _ in range(10):
                    idx = rng.permutation(len(M)); h = len(M) // 2
                    w.append(float(np.abs(M[idx[:h]].mean(0) - M[idx[h:]].mean(0)).mean()))
            within.append(float(np.mean(w)))

    between = np.array(between); within = np.array(within)
    print(f"сравнений: {len(between)}  (36 комбинаций x 2 ветви)")
    print(f"различие МЕЖДУ порядками  : среднее {between.mean():.6f}")
    print(f"различие ВНУТРИ порядка   : среднее {within.mean():.6f}  (порог шума)")
    print(f"отношение между/внутри    : {between.mean()/within.mean():.4f}")
    print(f"доля случаев между > внутри: {(between>within).mean():.3f} "
          f"({(between>within).sum()}/{len(between)})")
    print()
    if between.mean() <= within.mean():
        print("ВЫВОД: различие между порядками НЕ превышает собственный шум")
        print("=> нулевой результат декодера объясняется ОТСУТСТВИЕМ сигнала")
        print("   в этой пробе, а не слабостью декодера.")
    else:
        print("ВНИМАНИЕ: различие между порядками ПРЕВЫШАЕТ шум --")
        print("=> нулевой результат декодера может быть его слабостью.")
    print(f"время: {time.time()-t0:.1f} c")


if __name__ == "__main__":
    main()

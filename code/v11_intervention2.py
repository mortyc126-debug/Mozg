"""v0.11 фаза 3, шаг 3: УСИЛЕННЫЙ контроль специфичности.

Почему нужен: в v11_intervention.py контролем был блок ОБРАТНОГО
направления W[A,B]. Его нулевой эффект оказался гарантирован
МЕХАНИЧЕСКИ: этот блок несёт сигнал от B к A, а измеряется время
ПЕРВОГО импульса в B -- до него B по определению не срабатывала и
повлиять не могла. Такой контроль подтверждает исправность кода, но
не специфичность пути: любая корректная реализация дала бы ноль.

Здесь контроль на пути, который ВЛИЯТЬ МОЖЕТ: пересаживается блок
W[ЦЕЛЬ, R], где R -- 5 случайных узлов вне групп A и B. Он такого же
размера, так же изменён обучением и так же идёт В цель.

ПРЕДСКАЗАНИЕ ЗАФИКСИРОВАНО ДО ЗАПУСКА: если ускорение специфично
выученному пути, ctrl_rand закроет СУЩЕСТВЕННО МЕНЬШУЮ долю разрыва,
чем tw (78.8%). Если ctrl_rand закроет сопоставимую долю -- эффект
объясняется просто "больше входа в цель", а не выученным путём, и
вывод о специфичности неверен.

R выбирается ОДИН раз на ячейку с фиксированным seed, без отбора.
"""
import pickle
import time

import numpy as np

from v05_functional import make_noise
from v09_functional_probe import build_common_start_state
from v11_intervention import transplant, mean_latency, TEST_SEEDS, PROBE_STEPS, N

SNAPSHOT_TIME = 96.0
RAND_SEED = 31337


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    with open("v11_train_full.pkl", "rb") as f:
        T = pickle.load(f)
    noises = [make_noise(s, PROBE_STEPS, N) for s in TEST_SEEDS]
    rng = np.random.default_rng(RAND_SEED)

    mis, rand, tw, match = [], [], [], []
    n_changed = {"tw": 0, "ctrl_rand": 0}
    n_cells = 0
    t0 = time.time()

    for key, rec in T["results"].items():
        if key[3] != "M1_plasticity_weakest":
            continue
        sel, geom, growth, mech, rep = key
        gA, gB = rec["group_A"], rec["group_B"]
        v06 = D06["snapshots"][geom][growth][SNAPSHOT_TIME]["state"]

        for direction, (src_g, tgt_g) in (("ab", (gA, gB)), ("ba", (gB, gA))):
            mb = "AB" if direction == "ab" else "BA"
            xb = "BA" if direction == "ab" else "AB"
            st_m, W_m, C_m = build_common_start_state(v06, rec[mb])
            st_x, W_x, C_x = build_common_start_state(v06, rec[xb])

            outside = np.setdiff1d(np.arange(N), np.concatenate([gA, gB]))
            R = np.sort(rng.choice(outside, size=len(src_g), replace=False))

            W_tw, _ = transplant(W_x, C_x, W_m, C_m, tgt_g, src_g, False)
            W_rd, _ = transplant(W_x, C_x, W_m, C_m, tgt_g, R, False)
            n_changed["tw"] += int((W_tw != W_x).sum() > 0)
            n_changed["ctrl_rand"] += int((W_rd != W_x).sum() > 0)
            n_cells += 1

            mis.append(mean_latency(st_x, W_x, noises, src_g, tgt_g)[0])
            tw.append(mean_latency(st_x, W_tw, noises, src_g, tgt_g)[0])
            rand.append(mean_latency(st_x, W_rd, noises, src_g, tgt_g)[0])
            match.append(mean_latency(st_m, W_m, noises, src_g, tgt_g)[0])

    mis = np.array(mis); tw = np.array(tw); rand = np.array(rand); match = np.array(match)
    print(f"ячеек: {n_cells}")
    print(f"реально изменили веса: tw {n_changed['tw']}/{n_cells}, "
          f"ctrl_rand {n_changed['ctrl_rand']}/{n_cells}")
    print("\nсредняя парная латентность (мс):")
    for nm, a in (("mis", mis), ("ctrl_rand", rand), ("tw", tw), ("match", match)):
        print(f"  {nm:10s}: {a.mean():+.4f}")

    span = mis.mean() - match.mean()
    print(f"\nразрыв mis - match = {span:+.4f} мс")
    for nm, a in (("tw", tw), ("ctrl_rand", rand)):
        print(f"  {nm:10s} закрывает {(mis.mean()-a.mean())/span*100:+.1f}% разрыва"
              f"  | ускорил в {((mis-a)>0).sum()}/{n_cells} ячейках")

    np.savez("v11_intervention2.npz", mis=mis, tw=tw, ctrl_rand=rand, match=match)
    print(f"\nвремя: {time.time()-t0:.1f} c -> v11_intervention2.npz")


if __name__ == "__main__":
    main()

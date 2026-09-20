"""v0.11 фаза 3, шаг 4: переносится ли на НАДЁЖНОСТЬ (U3) тот же
причинный механизм, что объяснил латентность (U1)?

Гипотеза "быстрее, но менее устойчиво" подтверждается ТОЛЬКО если один
и тот же блок весов причинно сдвигает обе меры. Иначе это два разных
явления, случайно совпавших по знаку.

Те же четыре условия и тот же контроль специфичности, что в
v11_intervention2.py, но измеряется НАДЁЖНОСТЬ отклика (средняя
попарная доля несовпадающих отметок растра группы-цели по тестовым
шумам; БОЛЬШЕ = менее надёжно).

ПРЕДСКАЗАНИЕ ДО ЗАПУСКА: если механизм один, tw сдвинет надёжность от
mis В СТОРОНУ match (то есть сделает отклик МЕНЕЕ надёжным, т.к. U3
показал совпадающую ветвь менее устойчивой), а ctrl_rand -- нет.
Если tw надёжность не сдвигает -- механизмы РАЗНЫЕ, и гипотезу
"быстрее, но менее устойчиво" как единый компромисс принять нельзя.
"""
import pickle
import time

import numpy as np

from v05_functional import make_noise, probe
from v09_functional_probe import build_common_start_state
from v11_intervention import transplant, TEST_SEEDS, PROBE_STEPS, N
from v11_measures import response_reliability
from v11_intervention2 import RAND_SEED

SNAPSHOT_TIME = 96.0


def reliability(state, W, noises, stim_g, obs_g):
    rasters = [probe(state, W, nz, True, stim_g)[0] for nz in noises]
    return response_reliability(rasters, obs_g)


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    with open("v11_train_full.pkl", "rb") as f:
        T = pickle.load(f)
    noises = [make_noise(s, PROBE_STEPS, N) for s in TEST_SEEDS]
    rng = np.random.default_rng(RAND_SEED)

    mis, tw, rand, match = [], [], [], []
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

            mis.append(reliability(st_x, W_x, noises, src_g, tgt_g))
            tw.append(reliability(st_x, W_tw, noises, src_g, tgt_g))
            rand.append(reliability(st_x, W_rd, noises, src_g, tgt_g))
            match.append(reliability(st_m, W_m, noises, src_g, tgt_g))

    mis = np.array(mis); tw = np.array(tw); rand = np.array(rand); match = np.array(match)
    print(f"ячеек: {len(mis)}")
    print("\nразброс растра группы-цели (БОЛЬШЕ = менее надёжно):")
    for nm, a in (("mis", mis), ("ctrl_rand", rand), ("tw", tw), ("match", match)):
        print(f"  {nm:10s}: {a.mean():.6f}")

    span = match.mean() - mis.mean()
    print(f"\nразрыв match - mis = {span:+.6f}"
          f"  (положительный = совпадающая ветвь МЕНЕЕ надёжна)")
    if abs(span) > 1e-12:
        for nm, a in (("tw", tw), ("ctrl_rand", rand)):
            print(f"  {nm:10s} закрывает {(a.mean()-mis.mean())/span*100:+.1f}% разрыва")

    np.savez("v11_intervention3.npz", mis=mis, tw=tw, ctrl_rand=rand, match=match)
    print(f"\nвремя: {time.time()-t0:.1f} c -> v11_intervention3.npz")


if __name__ == "__main__":
    main()

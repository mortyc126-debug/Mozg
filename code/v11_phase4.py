"""v0.11 фаза 4: держится ли след и ускорение на ОДНОЙ пластичности?

Сравниваются три механизма на ОДНИХ И ТЕХ ЖЕ 3 парах групп:
  M0 -- пластичность, перестройка выключена
  M1 -- пластичность + замена слабейшего (основная ветвь фаз 1-3)
  M2 -- пластичность + случайная замена

Две величины, обе уже определённые ранее:
  dW  -- структурный след: вес выученного направления, перекрёстная форма
  U1  -- ускорение отклика: парная латентность, перекрёстная форма

Тестовые шумы 1030-1069 -- свежие, не пересекаются с 900-902, 910-919,
930-969, 980-1019.
"""
import pickle
import time

import numpy as np

from v05_functional import make_noise
from v09_functional_probe import build_common_start_state
from v11_intervention import mean_latency
from v11_measures import crossed_contrast
from v11_mechanism import block_sum

TEST_SEEDS = list(range(1030, 1070))
PROBE_STEPS = 200
SNAPSHOT_TIME = 96.0
N = 80


def dW_for(rec):
    gA, gB = rec["group_A"], rec["group_B"]
    Wab, Cab = rec["AB"]["weights"], rec["AB"]["contacts"]
    Wba, Cba = rec["BA"]["weights"], rec["BA"]["contacts"]
    full = 0.5 * ((block_sum(Wab, Cab, gB, gA) - block_sum(Wba, Cba, gB, gA))
                  + (block_sum(Wba, Cba, gA, gB) - block_sum(Wab, Cab, gA, gB)))
    comAB = Cab[np.ix_(gB, gA)] & Cba[np.ix_(gB, gA)]
    comBA = Cab[np.ix_(gA, gB)] & Cba[np.ix_(gA, gB)]
    w = 0.5 * float((Wab[np.ix_(gB, gA)][comAB].sum() - Wba[np.ix_(gB, gA)][comAB].sum())
                    + (Wba[np.ix_(gA, gB)][comBA].sum() - Wab[np.ix_(gA, gB)][comBA].sum()))
    return full, w, full - w


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    with open("v11_train_full.pkl", "rb") as f:
        T1 = pickle.load(f)
    with open("v11_train_m0m2.pkl", "rb") as f:
        T2 = pickle.load(f)
    noises = [make_noise(s, PROBE_STEPS, N) for s in TEST_SEEDS]

    allrec = {}
    for key, rec in T1["results"].items():
        if key[3] == "M1_plasticity_weakest":
            allrec[key] = rec
    allrec.update(T2["results"])

    rows = {}
    t0 = time.time()
    for key, rec in allrec.items():
        sel, geom, growth, mech, rep = key
        gA, gB = rec["group_A"], rec["group_B"]
        v06 = D06["snapshots"][geom][growth][SNAPSHOT_TIME]["state"]
        dWf, dWw, dWt = dW_for(rec)

        lat = {}
        for direction, (src_g, tgt_g) in (("ab", (gA, gB)), ("ba", (gB, gA))):
            for br in ("AB", "BA"):
                st, W, _ = build_common_start_state(v06, rec[br])
                lat[(br, direction)] = mean_latency(st, W, noises, src_g, tgt_g)[0]
        U1, _, _ = crossed_contrast(lat[("AB", "ab")], lat[("BA", "ab")],
                                    lat[("BA", "ba")], lat[("AB", "ba")],
                                    lower_is_better=True)
        rows[key] = {"dW": dWf, "dW_w": dWw, "dW_topo": dWt, "U1": U1}

    print(f"комбинаций: {len(rows)}  время: {time.time()-t0:.1f} c")
    print(f"тестовые шумы: {TEST_SEEDS[0]}-{TEST_SEEDS[-1]} (свежие)\n")

    for mech in ("M0_plasticity_norewire", "M1_plasticity_weakest",
                 "M2_plasticity_random"):
        ks = [k for k in rows if k[3] == mech]
        if not ks:
            continue
        dW = np.array([rows[k]["dW"] for k in ks])
        dWw = np.array([rows[k]["dW_w"] for k in ks])
        dWt = np.array([rows[k]["dW_topo"] for k in ks])
        U1 = np.array([rows[k]["U1"] for k in ks])
        print(f"=== {mech} (n={len(ks)})")
        print(f"  dW полный : {dW.mean():+.6f}  >0:{(dW>0).sum()} =0:{(dW==0).sum()} <0:{(dW<0).sum()}")
        print(f"  dW веса   : {dWw.mean():+.6f}  >0:{(dWw>0).sum()} =0:{(dWw==0).sum()} <0:{(dWw<0).sum()}")
        print(f"  dW топол. : {dWt.mean():+.6f}  >0:{(dWt>0).sum()} =0:{(dWt==0).sum()} <0:{(dWt<0).sum()}")
        print(f"  U1 латент.: {U1.mean():+.4f} мс  >0:{(U1>0).sum()} =0:{(U1==0).sum()} <0:{(U1<0).sum()}")
        for pos, name in ((0, "пара групп"), (1, "геометрия")):
            lv = sorted({k[pos] for k in ks}, key=str)
            ms = [U1[[i for i, k in enumerate(ks) if k[pos] == l]].mean() for l in lv]
            print(f"    U1 по {name}: " + ", ".join(f"{l}={m:+.3f}" for l, m in zip(lv, ms))
                  + f" | один знак: {all(np.sign(m)==np.sign(ms[0]) for m in ms)}")

    with open("v11_phase4.pkl", "wb") as f:
        pickle.dump({"rows": rows, "test_seeds": TEST_SEEDS,
                     "code_version": "v0.11 phase4"}, f)
    print("\nсохранено: v11_phase4.pkl")


if __name__ == "__main__":
    main()

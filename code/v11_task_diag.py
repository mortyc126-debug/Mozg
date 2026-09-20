"""v0.11 фаза 5, диагностика: почему измеренный U5 превысил предсказание в 1.53 раза?

Обязательство было зафиксировано до запуска: превышение надо ОБЪЯСНИТЬ,
а не праздновать. Разбираем U5 на составляющие.

Гипотеза Г1: предсказание использовало сдвиг U1 -- ПАРНУЮ разность
(со стимулом минус без стимула), тогда как долю попаданий определяет
распределение латентностей СО СТИМУЛОМ само по себе. Если базовая
(без стимула) латентность тоже различается между ветвями, парный сдвиг
не равен сдвигу распределения попаданий.

Гипотеза Г2: сдвиг НЕ жёсткий -- у совпадающей ветви меняется форма
распределения (больше массы на коротких латентностях), что у короткого
срока даёт больший прирост, чем простой сдвиг.

Гипотеза Г3: вклад ложных тревог -- score = hit - FA, и часть эффекта
может идти от РАЗНИЦЫ FA, а не попаданий.
"""
import pickle
import time

import numpy as np

from v05_functional import make_noise, probe
from v09_functional_probe import build_common_start_state
from v11_measures import first_spike_latency
from v11_task import TEST_SEEDS, PROBE_STEPS, SNAPSHOT_TIME, N, latencies

T_MAIN = 30


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    with open("v11_train_full.pkl", "rb") as f:
        T1 = pickle.load(f)
    noises = [make_noise(s, PROBE_STEPS, N) for s in TEST_SEEDS]

    S = {"matched": {"stim": [], "base": []}, "mismatched": {"stim": [], "base": []}}
    t0 = time.time()
    for key, rec in T1["results"].items():
        if key[3] != "M1_plasticity_weakest":
            continue
        sel, geom, growth, mech, rep = key
        gA, gB = rec["group_A"], rec["group_B"]
        v06 = D06["snapshots"][geom][growth][SNAPSHOT_TIME]["state"]
        for direction, (src_g, tgt_g) in (("ab", (gA, gB)), ("ba", (gB, gA))):
            mb = "AB" if direction == "ab" else "BA"
            xb = "BA" if direction == "ab" else "AB"
            for role, br in (("matched", mb), ("mismatched", xb)):
                st, W, _ = build_common_start_state(v06, rec[br])
                ls, lb = latencies(st, W, noises, src_g, tgt_g)
                S[role]["stim"].append(ls)
                S[role]["base"].append(lb)

    for role in S:
        for k in S[role]:
            S[role][k] = np.concatenate(S[role][k])

    def rate(v, T):
        return float(np.mean((v >= 0) & (v < T)))

    print(f"проб на роль: {S['matched']['stim'].size}\n")
    print(f"=== Г3: разбор score = hit - FA при T={T_MAIN}")
    h_m, h_x = rate(S["matched"]["stim"], T_MAIN), rate(S["mismatched"]["stim"], T_MAIN)
    f_m, f_x = rate(S["matched"]["base"], T_MAIN), rate(S["mismatched"]["base"], T_MAIN)
    print(f"  попадания : совпадающая {h_m:.4f}, несовпадающая {h_x:.4f}, "
          f"разница {h_m-h_x:+.4f}")
    print(f"  ложн.трев.: совпадающая {f_m:.4f}, несовпадающая {f_x:.4f}, "
          f"разница {f_m-f_x:+.4f}")
    print(f"  вклад попаданий {h_m-h_x:+.4f}, вклад ложных тревог "
          f"{-(f_m-f_x):+.4f}, сумма {(h_m-h_x)-(f_m-f_x):+.4f}")

    print(f"\n=== Г1: какой сдвиг на самом деле определяет попадания")
    for role in ("matched", "mismatched"):
        v = S[role]["stim"]; v = v[v >= 0]
        b = S[role]["base"]; b = b[b >= 0]
        print(f"  {role:11s}: латентность СО стимулом среднее {v.mean():.3f}, "
              f"медиана {np.median(v):.1f} | БЕЗ стимула среднее {b.mean():.3f}")
    vm = S["matched"]["stim"]; vm = vm[vm >= 0]
    vx = S["mismatched"]["stim"]; vx = vx[vx >= 0]
    shift_stim = vx.mean() - vm.mean()
    bm = S["matched"]["base"]; bm = bm[bm >= 0]
    bx = S["mismatched"]["base"]; bx = bx[bx >= 0]
    shift_base = bx.mean() - bm.mean()
    print(f"  сдвиг ТОЛЬКО по пробам со стимулом : {shift_stim:+.4f} мс")
    print(f"  сдвиг по пробам без стимула        : {shift_base:+.4f} мс")
    print(f"  парная разность (то, что есть U1)  : {shift_stim-shift_base:+.4f} мс")

    pred_paired = float(np.mean((vx >= T_MAIN) & (vx < T_MAIN + 1.0674)))
    pred_stim = float(np.mean((vx >= T_MAIN) & (vx < T_MAIN + shift_stim)))
    print(f"\n  предсказание по ПАРНОМУ сдвигу (1.067мс): {pred_paired:+.4f}")
    print(f"  предсказание по сдвигу СО СТИМУЛОМ ({shift_stim:.3f}мс): {pred_stim:+.4f}")
    print(f"  фактическая разница попаданий           : {h_m-h_x:+.4f}")

    print(f"\n=== Г2: жёсткий ли сдвиг? доля попаданий по срокам")
    print("   T |  совпад. | несовпад. |  разница | предсказ. по жёсткому сдвигу")
    for T in (10, 20, 30, 40, 60, 100):
        a, b_ = rate(S["matched"]["stim"], T), rate(S["mismatched"]["stim"], T)
        rigid = float(np.mean((vx >= T) & (vx < T + shift_stim)))
        print(f"  {T:3d} |  {a:.4f}  |  {b_:.4f}   | {a-b_:+.4f}  | {rigid:+.4f}")

    print(f"\nвремя: {time.time()-t0:.1f} c")


if __name__ == "__main__":
    main()

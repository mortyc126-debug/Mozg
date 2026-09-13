"""v0.11 фаза 1: ПРОВЕРКА эффекта U1 альтернативными методами.

Не доверяем среднему по 36 комбинациям, пока не показано, что эффект
больше собственного шума измерения. Четыре независимые проверки:
  V1 абсолютный масштаб латентности (велик ли +1.6мс относительно неё)
  V2 разброс оценки: пересчёт U1 на подвыборках тестовых шумов
  V3 перестановочный нуль: шумы случайно переставляются МЕЖДУ ветвями
  V4 разбивка по геометриям и историям роста
"""
import pickle
import time

import numpy as np

from v05_functional import make_noise, probe
from v09_functional_probe import build_common_start_state
from v11_measures import first_spike_latency, CENSORED

TEST_SEEDS = [910, 911, 912, 913, 914, 915, 916, 917, 918, 919]
PROBE_STEPS = 200
SNAPSHOT_TIME = 96.0
N = 80
N_PERM = 2000


def collect_latencies():
    """Возвращает per_seed[(sel,geom,growth,mech,rep,branch,direction)] =
    массив парных латентностей по тестовым шумам."""
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    with open("v11_train_full.pkl", "rb") as f:
        T = pickle.load(f)
    noises = {s: make_noise(s, PROBE_STEPS, N) for s in TEST_SEEDS}

    per_seed = {}
    abs_lat = []
    for key, rec in T["results"].items():
        sel, geom, growth, mech, rep = key
        if mech != "M1_plasticity_weakest":
            continue
        gA, gB = rec["group_A"], rec["group_B"]
        v06_state = D06["snapshots"][geom][growth][SNAPSHOT_TIME]["state"]
        for direction, (stim_g, obs_g) in (("ab", (gA, gB)), ("ba", (gB, gA))):
            for br in ("AB", "BA"):
                s, W, _ = build_common_start_state(v06_state, rec[br])
                vals = []
                for seed in TEST_SEEDS:
                    base, _ = probe(s, W, noises[seed], True, None)
                    stim, _ = probe(s, W, noises[seed], True, stim_g)
                    lb = first_spike_latency(base, obs_g)
                    ls = first_spike_latency(stim, obs_g)
                    assert lb != CENSORED and ls != CENSORED
                    abs_lat.append((lb, ls))
                    vals.append(float(ls - lb))
                per_seed[key + (br, direction)] = np.array(vals)
    return per_seed, np.array(abs_lat)


def U1_from(per_seed, combo, seed_idx_AB, seed_idx_BA):
    """U1 для одной комбинации из выбранных индексов шумов."""
    L = lambda br, d, idx: per_seed[combo + (br, d)][idx].mean()
    U_A = L("BA", "ab", seed_idx_BA) - L("AB", "ab", seed_idx_AB)
    U_B = L("AB", "ba", seed_idx_AB) - L("BA", "ba", seed_idx_BA)
    return 0.5 * (U_A + U_B)


def main():
    t0 = time.time()
    per_seed, abs_lat = collect_latencies()
    combos = sorted({k[:5] for k in per_seed})
    full = np.arange(len(TEST_SEEDS))

    print("=== V1: абсолютный масштаб латентности")
    print(f"  латентность первого импульса группы-цели, baseline : "
          f"среднее {abs_lat[:,0].mean():.2f}мс, медиана {np.median(abs_lat[:,0]):.1f}, "
          f"диапазон {abs_lat[:,0].min()}-{abs_lat[:,0].max()}")
    print(f"  то же, stimulated                                  : "
          f"среднее {abs_lat[:,1].mean():.2f}мс, медиана {np.median(abs_lat[:,1]):.1f}, "
          f"диапазон {abs_lat[:,1].min()}-{abs_lat[:,1].max()}")
    obs = np.array([U1_from(per_seed, c, full, full) for c in combos])
    print(f"  наблюдённое среднее U1 = {obs.mean():+.4f} мс "
          f"({(obs>0).sum()}>0, {(obs==0).sum()}=0, {(obs<0).sum()}<0 из {len(obs)})")

    print("\n=== V2: устойчивость к подвыборке тестовых шумов (половины)")
    rng = np.random.default_rng(12345)
    halves = []
    for _ in range(200):
        idx = rng.permutation(len(TEST_SEEDS))
        h = idx[:len(TEST_SEEDS)//2]
        halves.append(np.mean([U1_from(per_seed, c, h, h) for c in combos]))
    halves = np.array(halves)
    print(f"  U1 на случайных половинах шумов: среднее {halves.mean():+.4f}, "
          f"ст.откл {halves.std():.4f}, доля >0: {(halves>0).mean():.3f}")

    print("\n=== V3: перестановочный нуль (шумы переставляются МЕЖДУ ветвями)")
    print("  нулевая гипотеза: ветвь не важна, различие -- шум измерения")
    null = []
    for _ in range(N_PERM):
        vals = []
        for c in combos:
            # независимая случайная перестановка приписки шумов к ветвям
            idx = rng.permutation(len(TEST_SEEDS))
            a, b = idx[:len(TEST_SEEDS)//2], idx[len(TEST_SEEDS)//2:]
            vals.append(U1_from(per_seed, c, a, b))
        null.append(np.mean(vals))
    null = np.array(null)
    p = (1 + int((np.abs(null) >= abs(obs.mean())).sum())) / (N_PERM + 1)
    print(f"  нулевое распределение: среднее {null.mean():+.4f}, ст.откл {null.std():.4f}")
    print(f"  |нуль| >= |наблюдённое|: p = {p:.4f}  "
          f"(минимум достижимый 1/{N_PERM+1} = {1/(N_PERM+1):.5f}, ловушка №9)")

    print("\n=== V4: разбивка (эффект не должен держаться на одной группе)")
    for axis, pos in (("пара групп", 0), ("геометрия", 1), ("история роста", 2)):
        print(f"  по признаку '{axis}':")
        for lvl in sorted({c[pos] for c in combos}, key=str):
            sub = [U1_from(per_seed, c, full, full) for c in combos if c[pos] == lvl]
            sub = np.array(sub)
            print(f"    {str(lvl):18s} n={len(sub):2d}  среднее {sub.mean():+.3f}  "
                  f">0:{(sub>0).sum()} =0:{(sub==0).sum()} <0:{(sub<0).sum()}")

    print(f"\nвремя проверки: {time.time()-t0:.1f} c")


if __name__ == "__main__":
    main()

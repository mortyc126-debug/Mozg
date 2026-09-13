"""v0.11: ИСПРАВЛЕННАЯ проверка U1.

Ошибка первой версии (v11_verify.py::V3): перестановка меняла, какие
ШУМЫ усредняются для каждой ветви, но не трогала приписку ВЕТВЕЙ.
Структура "BA минус AB" сохранялась, поэтому нулевое распределение
воспроизводило проверяемый эффект (нуль +1.6085 против наблюдённого
+1.6097) и тест не проверял гипотезу о ветви вообще. Обнаружено по
совпадению нуля с наблюдением -- обязательная самопроверка любого
перестановочного теста.

Верный нуль для ПАРНЫХ данных (один и тот же шум подан обеим ветвям):
разность по каждому шуму d_s = L_несовпадающая[s] - L_совпадающая[s];
при нулевой гипотезе "ветвь не важна" знак d_s случаен => нуль
строится случайным переворотом знаков d_s.
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
N_PERM = 10000


def collect_diffs():
    """diffs[combo] = массив (2, n_seeds): построчно d для направления
    ab и для ba. d = латентность НЕСОВПАДАЮЩЕЙ ветви минус СОВПАДАЮЩЕЙ
    (положительное d = совпадающая быстрее)."""
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    with open("v11_train_full.pkl", "rb") as f:
        T = pickle.load(f)
    noises = {s: make_noise(s, PROBE_STEPS, N) for s in TEST_SEEDS}

    diffs = {}
    for key, rec in T["results"].items():
        sel, geom, growth, mech, rep = key
        if mech != "M1_plasticity_weakest":
            continue
        gA, gB = rec["group_A"], rec["group_B"]
        v06_state = D06["snapshots"][geom][growth][SNAPSHOT_TIME]["state"]
        lat = {}
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
                    vals.append(float(ls - lb))
                lat[(br, direction)] = np.array(vals)
        # совпадающая ветвь: AB на направлении ab, BA на направлении ba
        d_ab = lat[("BA", "ab")] - lat[("AB", "ab")]
        d_ba = lat[("AB", "ba")] - lat[("BA", "ba")]
        diffs[key] = np.vstack([d_ab, d_ba])
    return diffs


def main():
    t0 = time.time()
    diffs = collect_diffs()
    combos = sorted(diffs)
    D = np.stack([diffs[c] for c in combos])          # (n_combo, 2, n_seeds)
    obs_per_combo = D.mean(axis=(1, 2))               # U1 каждой комбинации
    obs = float(obs_per_combo.mean())

    print(f"комбинаций M1: {len(combos)}, шумов на ячейку: {D.shape[2]}")
    print(f"наблюдённое U1 = {obs:+.4f} мс "
          f"({(obs_per_combo>0).sum()}>0, {(obs_per_combo==0).sum()}=0, "
          f"{(obs_per_combo<0).sum()}<0)")

    print("\n=== САМОПРОВЕРКА нулевого распределения")
    rng = np.random.default_rng(20260913)
    null = np.empty(N_PERM)
    for i in range(N_PERM):
        signs = rng.choice([-1.0, 1.0], size=D.shape)
        null[i] = float((D * signs).mean())
    print(f"  нуль: среднее {null.mean():+.5f} (обязано быть ~0), "
          f"ст.откл {null.std():.4f}")
    if abs(null.mean()) > 0.1 * abs(obs):
        raise AssertionError("нуль воспроизводит эффект -- тест невалиден")
    print("  нуль центрирован в нуле => тест валиден "
          "(в отличие от первой версии, где нуль дал +1.6085)")

    p = (1 + int((np.abs(null) >= abs(obs)).sum())) / (N_PERM + 1)
    print(f"\n  p = {p:.5f}  (минимум достижимый 1/{N_PERM+1} = "
          f"{1/(N_PERM+1):.6f} -- ловушка №9, это НЕ ноль)")

    print("\n=== Эффект против собственного разброса")
    per_combo_sd = D.reshape(len(combos), -1).std(axis=1)
    print(f"  ст.откл отдельных парных разностей внутри ячейки: "
          f"среднее {per_combo_sd.mean():.3f} мс")
    print(f"  среднее U1 по комбинациям {obs:+.3f} мс, "
          f"ст.откл U1 между комбинациями {obs_per_combo.std():.3f} мс")

    print("\n=== Уровни независимости (комбинации НЕ независимы)")
    for pos, name in ((0, "пара групп"), (1, "геометрия")):
        lvls = sorted({c[pos] for c in combos}, key=str)
        means = [obs_per_combo[[i for i, c in enumerate(combos) if c[pos] == l]].mean()
                 for l in lvls]
        print(f"  по '{name}': " +
              ", ".join(f"{l}={m:+.3f}" for l, m in zip(lvls, means)) +
              f"  | все одного знака: {all(np.sign(m) == np.sign(means[0]) for m in means)}")

    print(f"\nвремя: {time.time()-t0:.1f} c")


if __name__ == "__main__":
    main()

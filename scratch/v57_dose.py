"""Проверка на насыщение: растёт ли расстояние с ЧИСЛОМ перенесённых связей.

Доля 0.889 читается как величина только если мера отзывается на ДОЛЮ
подмены. Если уже одна перенесённая связь даёт то же расстояние, что и
все, то мера -- всего лишь указатель "изменилось / не изменилось", и
никакой доли из неё выводить нельзя.
"""
import sys
import numpy as np
sys.path.insert(0, "code")
import v57_does_history_count as v
from sim_core import simulate

FRACS = [0.0, 0.05, 0.25, 0.50, 0.75, 1.0]
fixed = {k: val for k, val in v.BASE.items() if k != "growth_by_division"}
rows = []
for seed in v.SEEDS[:12]:
    grown = simulate(seed=seed, div_rate=0.10, coupling=v.COUPLING,
                     duration=24.0, **v.BASE)
    if grown["born"] < v.N:
        continue
    pos, birth = grown["positions"], grown["birth"]
    far = v.far_mask(pos); alive = np.isfinite(birth)
    a_net = v.run_variant(seed + 1000, pos, birth, fixed)
    la = v.long_links(a_net, far)
    if len(la) < v.MIN_LINKS:
        continue
    base = (a_net["weights"] * a_net["contacts"]).astype(float)
    w_vec = np.array([base[i, j] for i, j in la])
    local = base.copy()
    for i, j in la:
        local[i, j] = 0.0
    av = np.where(alive)[0]
    cand = [(int(i), int(j)) for i in av for j in av
            if i != j and far[i, j] and base[i, j] == 0.0]
    rng = np.random.default_rng(seed + 57)
    st = v.fresh(a_net); pats = v.patterns(pos, alive); read = av
    W0 = local.copy()
    for (i, j), w in zip(la, w_vec):
        W0[i, j] = w
    f0 = v.fingerprint(W0, st, pats, read, np.random.default_rng(seed + 101))
    row = []
    for fr in FRACS:
        k = int(round(fr * len(la)))
        links = list(la)
        if k:
            moved = rng.choice(len(la), size=k, replace=False)
            pick = rng.choice(len(cand), size=k, replace=False)
            for m, c in zip(moved, pick):
                links[m] = cand[c]
        W = local.copy()
        for (i, j), w in zip(links, w_vec):
            W[i, j] = w
        f = v.fingerprint(W, st, pats, read, np.random.default_rng(seed + 202))
        row.append(v.dist(f0, f))
    rows.append(row)
    print(f"сид {seed}: связей {len(la):3d} | " +
          " ".join(f"{x:.4f}" for x in row), flush=True)

m = np.array(rows).mean(axis=0)
print("\nдоля перенесённых:  " + "  ".join(f"{f:5.2f}" for f in FRACS))
print("расстояние:         " + "  ".join(f"{x:5.3f}" for x in m))
if m[-1] > m[0]:
    print("\nот пола до полной подмены: " +
          "  ".join(f"{(x - m[0]) / (m[-1] - m[0]):5.2f}" for x in m))

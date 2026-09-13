"""v0.12 шаг 1 (ИСПРАВЛЕНО): распространяется ли активность пространственно?

Первая версия (v11_waves.py) использовала наклон регрессии "время" на
"расстояние от начала волны" и была ЗАБРАКОВАНА собственным контролем:
на переставленных координатах наклон +9.53 против +10.24 на реальных.
Причина -- структурное смещение: начало волны выбирается как самый
ранний узел, поэтому у него d=0 И t=0 ПО ПОСТРОЕНИЮ. Эта точка --
якорь в левом нижнем углу облака, и прямая наименьших квадратов через
облако плюс такой якорь даёт наклон ~ (среднее t / среднее d) даже при
полном отсутствии связи.

ИСПРАВЛЕНИЯ:
1. узлы-начало ИСКЛЮЧЕНЫ из регрессии -- якоря больше нет;
2. вместо наклона используется РАНГОВАЯ корреляция Спирмена между
   расстоянием и временем: она не зависит от масштабов d и t и не
   тянется одной точкой;
3. контроль перестановки позиций СОХРАНЁН и остаётся главным
   критерием -- сравниваются те же самые импульсы.

ПРЕДСКАЗАНИЕ ДО ЗАПУСКА: если активность распространяется
пространственно, корреляция на реальных позициях > 0 и заметно выше,
чем на переставленных. Если разность снова окажется около нуля --
требование №8 из STAGE_MAP.md НЕ выполнено, и так и записывается.
"""
import pickle
import time

import numpy as np

from v05_functional import make_noise, probe
from v09_functional_probe import build_common_start_state
from v11_waves import (GEOMETRY_SEEDS, GROWTH_CONDITIONS, SNAPSHOT_TIME,
                       NOISE_SEEDS, RUN_MS, N, BURST_WINDOW,
                       MIN_NODES_IN_BURST, N_SHUFFLES, detect_bursts)


def spearman(x, y):
    """Ранговая корреляция без scipy."""
    if x.size < 3:
        return np.nan
    rx = np.argsort(np.argsort(x)).astype(float)
    ry = np.argsort(np.argsort(y)).astype(float)
    if rx.std() == 0 or ry.std() == 0:
        return np.nan
    return float(np.corrcoef(rx, ry)[0, 1])


def burst_corr(spikes, peak, positions):
    """Ранговая корреляция 'расстояние от начала' ~ 'время первого
    импульса', БЕЗ узлов-начала (устранён якорь d=0,t=0)."""
    a, b = max(0, peak + BURST_WINDOW[0]), min(spikes.shape[0], peak + BURST_WINDOW[1])
    win = spikes[a:b]
    first = np.full(N, -1)
    for node in range(N):
        idx = np.flatnonzero(win[:, node])
        if idx.size:
            first[node] = idx[0]
    active = np.flatnonzero(first >= 0)
    if active.size < MIN_NODES_IN_BURST:
        return np.nan
    t0 = first[active].min()
    origin_nodes = active[first[active] == t0]
    origin = positions[origin_nodes].mean(axis=0)
    rest = np.setdiff1d(active, origin_nodes)      # ИСКЛЮЧАЕМ начало
    if rest.size < MIN_NODES_IN_BURST - 1:
        return np.nan
    d = np.linalg.norm(positions[rest] - origin, axis=1)
    t = first[rest].astype(float)
    return spearman(d, t)


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    rng = np.random.default_rng(555)

    real, shuf = [], []
    t0 = time.time()
    for geom in GEOMETRY_SEEDS:
        for growth in GROWTH_CONDITIONS:
            snap = D06["snapshots"][geom][growth][SNAPSHOT_TIME]
            positions = snap["positions"]
            state, W, _ = build_common_start_state(snap["state"], snap)
            for ns in NOISE_SEEDS:
                noise = make_noise(ns, RUN_MS, N)
                spikes, _ = probe(state, W, noise, True, None)
                for peak in detect_bursts(spikes):
                    r = burst_corr(spikes, peak, positions)
                    if not np.isfinite(r):
                        continue
                    sh = [burst_corr(spikes, peak, positions[rng.permutation(N)])
                          for _ in range(N_SHUFFLES)]
                    sh = [v for v in sh if np.isfinite(v)]
                    if not sh:
                        continue
                    real.append(r)
                    shuf.append(float(np.mean(sh)))

    real = np.array(real); shuf = np.array(shuf)
    d = real - shuf
    print(f"всплесков обработано: {len(real)}\n")
    print(f"ранговая корреляция, РЕАЛЬНЫЕ позиции  : {real.mean():+.4f} "
          f"(>0: {(real>0).sum()}/{len(real)})")
    print(f"ранговая корреляция, ПЕРЕСТАВЛЕННЫЕ    : {shuf.mean():+.4f} "
          f"(>0: {(shuf>0).sum()}/{len(shuf)})")
    print(f"САМОПРОВЕРКА: контроль обязан быть ~0 -- "
          f"{'ОК' if abs(shuf.mean()) < 0.02 else 'НЕ ПРОЙДЕНА'}")
    print(f"\nразность реальный - контроль           : {d.mean():+.4f}")
    print(f"  положительна в {(d>0).sum()}/{len(d)} всплесках "
          f"({(d>0).mean():.3f})")
    print(f"  ст.откл разности {d.std():.4f}, "
          f"|среднее|/ст.откл = {abs(d.mean())/d.std():.3f}")

    np.savez("v11_waves2.npz", real=real, shuffled=shuf)
    print(f"\nвремя: {time.time()-t0:.1f} c -> v11_waves2.npz")


if __name__ == "__main__":
    main()

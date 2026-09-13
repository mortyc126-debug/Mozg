"""v0.12 шаг 1: распространяется ли активность ПРОСТРАНСТВЕННО?

Требование №8 из STAGE_MAP.md -- единственное со статусом "не
проверено" (а не "отсутствует"). Проверяется на СУЩЕСТВУЮЩЕЙ модели,
новых механизмов не добавляется. Принцип: сначала измерить то, что
модель уже умеет, потом добавлять.

ВАЖНАЯ ОГОВОРКА, ЗАФИКСИРОВАННАЯ ДО ЗАПУСКА: в модели НЕТ задержек
проведения (передача мгновенная, MODEL_SPEC п.9). Поэтому любая
найденная скорость распространения задаётся не проведением по
"аксону", а инерцией интегрирования мембраны (tau_v=20мс). Это надо
называть прямо и не выдавать за аналог скорости проведения в ткани.

МЕТОД. На свободном прогоне (без стимуляции) детектируются
популяционные всплески. Внутри всплеска для каждого узла берётся время
первого импульса; начало волны -- самый ранний узел. Регрессия
"время первого импульса" на "расстояние от начала". Наклон > 0 =
активность приходит к дальним узлам позже, то есть распространяется.

ГЛАВНЫЙ КОНТРОЛЬ (перестановка позиций): те же САМЫЕ растры, но
координаты узлов случайно переставлены. Динамика, связи и все импульсы
идентичны -- меняется только геометрия. Если наклон держится и на
перестановке, он не про пространство. Контроль не требует повторной
симуляции и потому сравнивает буквально одни и те же события.

ПРЕДСКАЗАНИЯ ДО ЗАПУСКА: наклон на реальных позициях > 0; на
переставленных ~0.
"""
import pickle
import time

import numpy as np

from v05_functional import make_noise, probe
from v09_functional_probe import build_common_start_state

GEOMETRY_SEEDS = [11, 22, 33]
GROWTH_CONDITIONS = ["Только бюджет", "Совместное"]
SNAPSHOT_TIME = 96.0
NOISE_SEEDS = [1200, 1201, 1202, 1203, 1204]
RUN_MS = 3000
N = 80
SMOOTH_MS = 5
BURST_WINDOW = (-10, 40)   # окно всплеска относительно пика, мс
MIN_NODES_IN_BURST = 10    # всплеск засчитывается, если сработало >= узлов
N_SHUFFLES = 20


def detect_bursts(spikes, smooth_ms=SMOOTH_MS):
    """Пики популяционного счёта. Порог -- среднее + 1 ст.откл
    сглаженного счёта, объявлен заранее; минимальное расстояние между
    пиками 50мс (меньше периода ритма v0.3 ~81-270мс)."""
    pop = spikes.sum(axis=1).astype(float)
    k = np.ones(smooth_ms) / smooth_ms
    sm = np.convolve(pop, k, mode="same")
    thr = sm.mean() + sm.std()
    peaks = []
    i = 0
    while i < len(sm):
        if sm[i] > thr:
            j = i
            while j < len(sm) and sm[j] > thr:
                j += 1
            seg = sm[i:j]
            peaks.append(i + int(np.argmax(seg)))
            i = j
        else:
            i += 1
    # разрежаем ближе 50мс
    out = []
    for p in peaks:
        if not out or p - out[-1] >= 50:
            out.append(p)
    return out


def burst_slope(spikes, peak, positions):
    """Наклон 'время первого импульса' ~ 'расстояние от начала волны'.
    Возвращает (наклон, число узлов) или (nan, 0)."""
    a, b = peak + BURST_WINDOW[0], peak + BURST_WINDOW[1]
    a, b = max(0, a), min(spikes.shape[0], b)
    win = spikes[a:b]
    first = np.full(N, -1)
    for node in range(N):
        idx = np.flatnonzero(win[:, node])
        if idx.size:
            first[node] = idx[0]
    active = np.flatnonzero(first >= 0)
    if active.size < MIN_NODES_IN_BURST:
        return np.nan, 0
    t0 = first[active].min()
    origin_nodes = active[first[active] == t0]
    origin = positions[origin_nodes].mean(axis=0)
    d = np.linalg.norm(positions[active] - origin, axis=1)
    t = first[active].astype(float) - t0
    if d.std() == 0:
        return np.nan, 0
    slope = float(np.polyfit(d, t, 1)[0])   # мс на единицу расстояния
    return slope, int(active.size)


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    rng = np.random.default_rng(555)

    real_slopes, shuf_slopes, sizes = [], [], []
    n_bursts = 0
    t0 = time.time()

    for geom in GEOMETRY_SEEDS:
        for growth in GROWTH_CONDITIONS:
            snap = D06["snapshots"][geom][growth][SNAPSHOT_TIME]
            positions = snap["positions"]
            state, W, _ = build_common_start_state(snap["state"], snap)
            for ns in NOISE_SEEDS:
                noise = make_noise(ns, RUN_MS, N)
                spikes, _ = probe(state, W, noise, transmission=True,
                                  stimulate_nodes=None)
                for peak in detect_bursts(spikes):
                    s_real, n_act = burst_slope(spikes, peak, positions)
                    if not np.isfinite(s_real):
                        continue
                    n_bursts += 1
                    real_slopes.append(s_real)
                    sizes.append(n_act)
                    # КОНТРОЛЬ: те же импульсы, переставленные координаты
                    sh = []
                    for _ in range(N_SHUFFLES):
                        perm = rng.permutation(N)
                        s_sh, _ = burst_slope(spikes, peak, positions[perm])
                        if np.isfinite(s_sh):
                            sh.append(s_sh)
                    shuf_slopes.append(float(np.mean(sh)) if sh else np.nan)

    real = np.array(real_slopes)
    shuf = np.array(shuf_slopes)
    ok = np.isfinite(real) & np.isfinite(shuf)
    real, shuf = real[ok], shuf[ok]

    print(f"структур: {len(GEOMETRY_SEEDS)*len(GROWTH_CONDITIONS)}, "
          f"шумов на структуру: {len(NOISE_SEEDS)}, прогон {RUN_MS}мс")
    print(f"всплесков обработано: {len(real)} "
          f"(узлов во всплеске: среднее {np.mean(sizes):.1f})\n")
    print(f"наклон на РЕАЛЬНЫХ позициях   : {real.mean():+.4f} мс/ед.расст. "
          f"(>0: {(real>0).sum()}/{len(real)})")
    print(f"наклон на ПЕРЕСТАВЛЕННЫХ      : {shuf.mean():+.4f} "
          f"(>0: {(shuf>0).sum()}/{len(shuf)})")
    d = real - shuf
    print(f"разность реальный - контроль  : {d.mean():+.4f}, "
          f">0 в {(d>0).sum()}/{len(d)} всплесках")
    if real.mean() > 0 and abs(shuf.mean()) < abs(real.mean()) / 3:
        sp = 1.0 / real.mean()
        print(f"\nскорость (1/наклон) ~ {sp:.4f} ед.расстояния/мс")
        print("ВАЖНО: задержек проведения в модели НЕТ -- эта скорость")
        print("задаётся инерцией интегрирования (tau_v=20мс), а НЕ")
        print("проведением по отростку. Аналогом скорости проведения")
        print("в ткани она НЕ является.")

    np.savez("v11_waves.npz", real=real, shuffled=shuf, sizes=np.array(sizes)[ok])
    print(f"\nвремя: {time.time()-t0:.1f} c -> v11_waves.npz")


if __name__ == "__main__":
    main()

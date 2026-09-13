"""v0.12 шаг 2: проверка волн ПРИ задержках проведения.

Метрика и контроль -- ТЕ ЖЕ, что в v11_waves2.py (ранговая корреляция
без узлов-начала; контроль перестановки координат на тех же растрах).
Ничего в измерении не меняется -- меняется только наличие механизма.
Это и делает сравнение причинным.

СЕТКА СКОРОСТЕЙ ОБЪЯВЛЕНА ЗАРАНЕЕ, кривая сообщается целиком:
  None (нулевая задержка -- контроль тождества), 0.5, 0.2, 0.1,
  0.05, 0.02 ед.расстояния/мс. Отбор "удачной" скорости запрещён.

ПРЕДСКАЗАНИЯ ДО ЗАПУСКА:
1. при нулевой задержке результат обязан ВОСПРОИЗВЕСТИ шаг 1
   (разность реальный-контроль ~+0.015, около нуля) -- иначе что-то
   сломано в переносе;
2. с ростом задержки (падением скорости) разность реальный-контроль
   РАСТЁТ -- если задержки действительно тот недостающий механизм;
3. контроль перестановки на ЛЮБОЙ скорости обязан оставаться ~0.
Если 2 не выполнится -- задержки НЕ являются достаточным механизмом
для пространственного распространения в этой модели, и так и
записывается.
"""
import pickle
import time

import numpy as np

from v05_functional import make_noise
from v09_functional_probe import build_common_start_state
from v11_waves import (GEOMETRY_SEEDS, GROWTH_CONDITIONS, SNAPSHOT_TIME,
                       NOISE_SEEDS, RUN_MS, N, N_SHUFFLES, detect_bursts)
from v11_waves2 import burst_corr
from v12_delays import build_delay_steps, probe_delayed

SPEEDS = [None, 0.5, 0.2, 0.1, 0.05, 0.02]


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    t0 = time.time()
    # ВАЖНО: задержку надо смотреть ПО СУЩЕСТВУЮЩИМ КОНТАКТАМ, а не по
    # всей матрице расстояний -- связи есть только при d<0.25, поэтому
    # максимум по матрице сильно завышает реально действующую задержку.
    print(f"{'скорость':>10} | {'задержка на контактах':>21} | {'всплесков':>9} | "
          f"{'реальные':>9} | {'контроль':>9} | {'разность':>9} | доля>0")
    rows = {}
    for speed in SPEEDS:
        rng = np.random.default_rng(555)
        real, shuf = [], []
        maxdelay = 0
        for geom in GEOMETRY_SEEDS:
            for growth in GROWTH_CONDITIONS:
                snap = D06["snapshots"][geom][growth][SNAPSHOT_TIME]
                positions, dist = snap["positions"], snap["distance"]
                dl = build_delay_steps(dist, speed)
                ct = snap["contacts"]
                maxdelay = max(maxdelay, int(dl[ct].max()) if ct.any() else 0)
                state, W, _ = build_common_start_state(snap["state"], snap)
                for ns in NOISE_SEEDS:
                    noise = make_noise(ns, RUN_MS, N)
                    spikes = probe_delayed(state, W, noise, dl, transmission=True)
                    for peak in detect_bursts(spikes):
                        r = burst_corr(spikes, peak, positions)
                        if not np.isfinite(r):
                            continue
                        sh = [burst_corr(spikes, peak, positions[rng.permutation(N)])
                              for _ in range(N_SHUFFLES)]
                        sh = [v for v in sh if np.isfinite(v)]
                        if not sh:
                            continue
                        real.append(r); shuf.append(float(np.mean(sh)))
        real = np.array(real); shuf = np.array(shuf); d = real - shuf
        rows[str(speed)] = (real, shuf)
        name = "0 (контроль)" if speed is None else f"{speed}"
        print(f"{name:>10} | {('макс ' + str(maxdelay)):>21} | {len(real):>9} | "
              f"{real.mean():>+9.4f} | {shuf.mean():>+9.4f} | "
              f"{d.mean():>+9.4f} | {(d>0).mean():.3f}")

    print("\nСАМОПРОВЕРКИ:")
    for k, (r, s) in rows.items():
        if abs(s.mean()) > 0.02:
            print(f"  ВНИМАНИЕ: контроль при скорости {k} = {s.mean():+.4f}, "
                  f"обязан быть ~0")
    print(f"  контроль перестановки ~0 на всех скоростях: "
          f"{all(abs(s.mean()) <= 0.02 for _, s in rows.values())}")

    np.savez("v12_waves_delayed.npz",
             **{f"real_{k}": v[0] for k, v in rows.items()},
             **{f"shuf_{k}": v[1] for k, v in rows.items()})
    print(f"\nвремя: {time.time()-t0:.1f} c -> v12_waves_delayed.npz")


if __name__ == "__main__":
    main()

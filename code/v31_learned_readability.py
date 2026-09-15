"""v0.31: становится ли вход читаемее оттого, что ткань росла под ним.

Это четвёртый пункт критерия зачатка и единственный, который до сих пор
не удалось даже поставить. v0.30 его не измерил: задача "какой из двух
образов подан" решалась геометрией даром -- точность около 0.95 даже у
ткани, никогда не видевшей входа (ошибка №39).

ЧТО ИЗМЕНЕНО В ЗАДАЧЕ. Образы теперь ПЕРЕМЕЖЕНЫ: узлы поверхности берутся
по высоте через одного, чётные -- первый образ, нечётные -- второй. Их
пространственные окрестности почти совпадают, и геометрия перестаёт
отвечать за ответ. Измерено при калибровке: контроль падает с 0.95 до
величины в середине промежутка, где есть куда расти и есть куда падать.

РЕЖИМ. Граница ВЫКЛЮЧЕНА (state_affinity = 0). Это прямое следствие
v0.30: при включённой границе вход отрезает поверхность от ткани (40.0
связей -> 0.6) и отклика за поверхностью нет вовсе. Пока две службы
величины s не разведены, спрашивать про читаемость при включённой
границе не о чем. Дифференцировка тоже выключена: при affinity = 0 она
ни на что не влияет, а фазировка только укоротила бы время на обучение.

ПОЧЕМУ СРАВНЕНИЕ ЧИСТОЕ. При выключенной границе рост контактов не
зависит от состояний, а воздействие не тратит случайных чисел. Поэтому
у всех трёх условий развития СЕТЬ КОНТАКТОВ ПОБИТОВО ОДНА И ТА ЖЕ, и
шум при чтении тот же. Отличаются только ВЕСА -- то, что вход успел
сделать пластичностью. Это проверяется в прогоне, а не предполагается.

УСЛОВИЯ РАЗВИТИЯ:
  БЕЗ ВХОДА      -- воздействия нет;
  СО СТРОЕНИЕМ   -- два образа чередуются каждые 200 мс по 20 мс;
  БЕЗ СТРОЕНИЯ   -- столько же тока и столько же спайков, но каждый раз
                    случайные узлы поверхности: повторяющегося образа
                    нет. Отделяет "ткань выучила ЧТО происходило" от
                    "ткань просто была активна".

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * ОБА КРАЯ стерегутся (ошибка №39). Если контроль БЕЗ ВХОДА выходит
    за промежуток 0.52-0.85, вердикт не выносится: ниже -- улучшать
    нечего, выше -- задача решается без ткани;
  * если отклик вне поверхности ниже 0.005, точность не истолковывается:
    это "отклика нет", а не "не читается";
  * перемешанные метки обязаны дать 0.42-0.58, иначе мера неисправна
    (ошибка №40);
  * ЗАСЧИТЫВАЕТСЯ, если СО СТРОЕНИЕМ выше и БЕЗ ВХОДА, и БЕЗ СТРОЕНИЯ,
    по знаку у большинства сидов с биномиальным p < 0.05;
  * выше без входа, но не выше бесстроенного -- помогает АКТИВНОСТЬ, а
    не строение входа, и так и записывается;
  * величина всегда рядом с долей сидов (урок №36).
"""
import sys
from math import comb

import numpy as np

sys.path.insert(0, "code")
from readout import separability
from sim_core import simulate

N = 80
SEEDS = list(range(1901, 1925))
SURF = 20
AMP = 0.4
COUPLING = 10.0
DT = 0.001
PROBE_MS = 400
PULSE_AT = 300
DEADLINE = 30
TRIALS = 40
FLOOR = 0.005
PERIOD = 0.2

BASE = dict(drive=0.8, homeostasis=False, gradual_growth=False,
            coupling=COUPLING, contact_radius=0.25, state_affinity=0.0)


def p_ge(k, n):
    return sum(comb(n, i) for i in range(k, n + 1)) / 2 ** n


def interleaved(pos):
    """Образы перемежены: геометрия ответа не подсказывает."""
    surf = np.argsort(pos[:, 0])[:SURF]
    o = surf[np.argsort(pos[surf, 1])]
    return o[0::2], o[1::2], surf


def unstructured(surf, rng, cycles):
    half = SURF // 2
    return [rng.choice(surf, size=half, replace=False) for _ in range(cycles)]


def fresh(net):
    s = net["state"]
    return dict(v=s["v"].copy(), syn=np.zeros(N), adapt=s["adaptation"].copy(),
                refr=s["refractory"].copy(), thr=s["threshold"].copy(),
                drive=s["drive"].copy(), asc=s["adapt_scale"].copy())


def step(st, W, nrow, forced=None):
    st["syn"] *= np.exp(-DT / 0.010); st["adapt"] *= np.exp(-DT / 0.200)
    st["refr"] = np.maximum(0.0, st["refr"] - DT)
    avail = st["refr"] == 0.0
    cur = st["drive"] + st["syn"] - st["adapt"]
    dv = (DT / 0.020) * (-st["v"] + cur)
    st["v"][avail] += (dv + nrow)[avail]
    fired = avail & (st["v"] >= st["thr"])
    if forced is not None:
        fired[forced] = True
    if fired.any():
        st["syn"] += COUPLING * W[:, fired].sum(axis=1)
    st["v"][fired] = 0.0; st["refr"][fired] = 0.005
    st["adapt"][fired] += 0.25 * st["asc"][fired]
    return fired


def response(net, pat, read, noise):
    st = fresh(net)
    W = net["weights"] * net["contacts"]
    got = np.zeros(N, dtype=bool)
    for t in range(PROBE_MS):
        fired = step(st, W, noise[t], pat if t == PULSE_AT else None)
        if PULSE_AT < t <= PULSE_AT + DEADLINE:
            got |= fired
    return got[read]


def measure(net, p1, p2, read, seed):
    rng = np.random.default_rng(seed)
    X, y = [], []
    for lab, pat in ((0, p1), (1, p2)):
        for _ in range(TRIALS):
            nz = 0.012 * rng.standard_normal((PROBE_MS, N))
            X.append(response(net, pat, read, nz).astype(float))
            y.append(lab)
    X = np.array(X); y = np.array(y)
    frac = float(X.mean())
    if frac < FLOOR:
        return frac, None, None
    return (frac, separability(X, y, seed + 5),
            separability(X, rng.permutation(y), seed + 6))


def main():
    conds = ("БЕЗ ВХОДА", "СО СТРОЕНИЕМ", "БЕЗ СТРОЕНИЯ")
    res = {c: {"frac": [], "acc": [], "nul": [], "w": []} for c in conds}
    paired = {c: [] for c in conds}
    same_wiring = True
    skipped = 0
    for seed in SEEDS:
        pos = simulate(seed=seed, **BASE)["positions"]
        p1, p2, surf = interleaved(pos)
        read = np.setdiff1d(np.arange(N), surf)
        rng = np.random.default_rng(seed + 31)
        cycles = int(round(12.0 / PERIOD))
        pats = {"БЕЗ ВХОДА": (None, 0.0),
                "СО СТРОЕНИЕМ": ([p1, p2], AMP),
                "БЕЗ СТРОЕНИЯ": (unstructured(surf, rng, cycles), AMP)}
        ref_c, row = None, {}
        for c in conds:
            stim, amp = pats[c]
            net = simulate(seed=seed, stimulus=stim, stimulus_amp=amp,
                           stimulus_period=PERIOD, **BASE)
            if ref_c is None:
                ref_c = net["contacts"].copy()
            elif not np.array_equal(ref_c, net["contacts"]):
                same_wiring = False
            f, a, nl = measure(net, p1, p2, read, seed + 77)
            res[c]["frac"].append(f); res[c]["w"].append(float(
                (net["weights"] * net["contacts"]).sum()))
            row[c] = a
            res[c]["acc"].append(a); res[c]["nul"].append(nl)
        if any(row[c] is None for c in conds):
            skipped += 1
        else:
            for c in conds:
                paired[c].append(row[c])

    n = len(paired["БЕЗ ВХОДА"])
    print(f"{len(SEEDS)} сидов ({n} в счёт, {skipped} без отклика), "
          f"поверхность {SURF}, образ {SURF // 2} перемежённых узлов, "
          f"добавка {AMP}, период {PERIOD} с, проб на образ {TRIALS}")
    print(f"сеть контактов одна и та же во всех условиях: "
          f"{'ДА' if same_wiring else 'НЕТ -- сравнение не чистое'}\n")
    print(f"{'условие':<14} | {'отклик':>7} | {'вес сети':>9} | "
          f"{'точность':>9} | {'перемешано':>10}")
    for c in conds:
        acc = [a for a in res[c]["acc"] if a is not None]
        nul = [a for a in res[c]["nul"] if a is not None]
        print(f"{c:<14} | {np.mean(res[c]['frac']):7.3f} | "
              f"{np.mean(res[c]['w']):9.3f} | "
              f"{(np.mean(acc) if acc else float('nan')):9.3f} | "
              f"{(np.mean(nul) if nul else float('nan')):10.3f}")

    if n == 0:
        print("\n  отклика нет ни у одного сида -- мерить не на чем")
        return
    b = np.array(paired["БЕЗ ВХОДА"])
    s_ = np.array(paired["СО СТРОЕНИЕМ"])
    u = np.array(paired["БЕЗ СТРОЕНИЯ"])
    nul_all = np.mean([a for c in conds for a in res[c]["nul"] if a is not None])
    k1, k2 = int((s_ > b).sum()), int((s_ > u).sum())
    print(f"\nЧТЕНИЕ ({n} сидов):")
    print(f"  со строением выше БЕЗ ВХОДА:    {k1} из {n}, "
          f"p = {p_ge(k1, n):.4f} ({b.mean():.3f} -> {s_.mean():.3f}, "
          f"{(s_ - b).mean() * 100:+.2f} п.п.)")
    print(f"  со строением выше БЕССТРОЕННОГО: {k2} из {n}, "
          f"p = {p_ge(k2, n):.4f} ({u.mean():.3f} -> {s_.mean():.3f}, "
          f"{(s_ - u).mean() * 100:+.2f} п.п.)")
    if not (0.42 <= nul_all <= 0.58):
        print(f"  ПЕРЕМЕШАННЫЕ МЕТКИ ДАЛИ {nul_all:.3f} -- мера неисправна, "
              "вердикт не выносится")
    elif not (0.52 <= b.mean() <= 0.85):
        print(f"  КОНТРОЛЬ БЕЗ ВХОДА {b.mean():.3f} вне промежутка 0.52-0.85 "
              "-- вердикт не выносится")
    elif p_ge(k1, n) < 0.05 and p_ge(k2, n) < 0.05:
        print("  ВХОД СТАНОВИТСЯ ЧИТАЕМЕЕ ОТТОГО, ЧТО ТКАНЬ РОСЛА ПОД НИМ "
              "-- пункт 4 критерия зачатка закрыт")
    elif p_ge(k1, n) < 0.05:
        print("  помогает АКТИВНОСТЬ, а не строение входа")
    else:
        print("  развитие под входом читаемости не прибавляет")


if __name__ == "__main__":
    main()

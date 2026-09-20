"""v0.27: есть ли задача, где РАСПОЛОЖЕНИЕ имеет значение.

Пять измерений подряд (v0.22-v0.26) дали одно: работает СОСТАВ -- какие
узлы есть и какие у них веса; не работает РАСПОЛОЖЕНИЕ -- где они стоят
и как поделены на области. Отсюда вопрос уже не к механизму, а к КАРТЕ:
существует ли в этой модели задача, где расположение вообще нужно.

Берётся задача, которая ПО ПОСТРОЕНИЮ требует разделения: две
независимые пары "источник -> цель", которые надо помнить ОДНОВРЕМЕННО,
не путая. Если ткань разделена перегородкой, след одной пары не должен
протекать в другую.

ЗАДАЧА. Пары (A1 -> B1) слева и (A2 -> B2) справа, места выбраны
ГЕОМЕТРИЧЕСКИ и одинаковы во всех условиях. Обучение чередует обе пары.
Проверка: подать импульс в A1 и посмотреть, кто ответит.
    попадание  -- ответила B1 (своя цель);
    путаница   -- ответила B2 (чужая цель).
    счёт = попадание - путаница, усреднённый по обеим парам.

РЕЖИМ -- МОЛЧАЩАЯ ПОДЛОЖКА (ток 0.8, гомеостаз выключен, сила связи 10),
и это вынужденный, но содержательный выбор. Сперва задача ставилась в
ЗАНЯТОМ режиме при силе связи 4, и там она неразрешима в принципе:
сеть идёт популяционными пачками примерно каждые 250 мс, и импульс
попадает либо В пачку -- тогда отвечают почти все (попадание 0.825 при
путанице 0.708, потолок), либо МЕЖДУ пачками -- тогда не отвечает никто
(попадание 0.008). Промежутка, где отклик локален и читаем, в занятом
режиме нет. В молчащей подложке он есть: фон равен нулю по построению,
а отклик градуирован (v0.21: отвечает 28% сети при точности 0.856).
Это частично возвращает значение молчащему режиму, который v0.22
понизил в правах: тишина не нужна для пользы следа, но нужна для
задач, требующих ЛОКАЛЬНОГО читаемого отклика.

УСЛОВИЯ, плотность выравнена:
  БЕЗ ГРАНИЦЫ   -- state_affinity = 0;
  С ГРАНИЦЕЙ    -- state_affinity = 1, радиус 0.285;
  СЛУЧАЙНЫЙ РЕЗ -- контакты как без границы, но СТОЛЬКО ЖЕ связей
                   удалено СЛУЧАЙНО. Потеря связности та же, место
                   потери -- произвольное.

Третье условие -- главный контроль, по образцу v0.26. Без него нельзя
отличить "помогает граница" от "помогает любое разрежение связей".

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * ПЕРВОЕ И ГЛАВНОЕ: при расхождении плотности выше 10% вердикт не
    выносится вовсе. В первой редакции проверка плотности печаталась, но
    с вердиктом связана НЕ БЫЛА, и при расхождении 26% было напечатано
    "РАСПОЛОЖЕНИЕ ИМЕЕТ ЗНАЧЕНИЕ". Теперь вердикт привязан к проверке;
  * счёт у ГРАНИЦЫ выше, чем БЕЗ неё, И выше, чем у СЛУЧАЙНОГО РЕЗА, --
    расположение имеет значение, пункты 1-3 и 6 карты остаются;
  * счёт выше, чем без границы, но НЕ выше случайного реза -- помогает
    разрежение, а не перегородка;
  * счёт не выше -- расположение не имеет значения и в этой задаче, и
    это довод за сокращение карты;
  * попадание и путаница сообщаются ОТДЕЛЬНО: если граница режет и то и
    другое одинаково, выигрыша нет, сколь бы ни падала путаница;
  * рядом с долей сидов выводится биномиальный p (урок №36).
"""
import sys
from math import comb

import numpy as np

sys.path.insert(0, "code")
from sim_core import simulate

N = 80
SEEDS = list(range(1201, 1225))
ETA_DIFF = 0.5
COUPLING = 10.0
DRIVE = 0.8
HOMEO = False
GROUP = 4
LAG = 10
PERIOD = 400
TRAIN_MS = 12000
PROBE_MS = 300
PULSE_AT = 50      # фон равен нулю, тихую фазу искать не нужно
DEADLINE = 30
TRIALS = 30
DT = 0.001
ETA_W = 0.0002


def p_ge(k, n):
    return sum(comb(n, i) for i in range(k, n + 1)) / 2 ** n


def pick_pairs(pos):
    """Две пары: (A1,B1) слева, (A2,B2) справа. Без пересечений."""
    used = np.zeros(N, dtype=bool)
    out = []
    for cx in (0.22, 0.38, 0.62, 0.78):
        idx = np.where(~used)[0]
        g = idx[np.argsort(np.linalg.norm(pos[idx] - np.array([cx, 0.5]),
                                          axis=1))][:GROUP]
        used[g] = True
        out.append(np.sort(g))
    return out


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


def train(net, C, pairs, seed):
    """Чередование двух пар: A1->B1, затем A2->B2 через полпериода."""
    W = net["weights"].copy() * C
    A1, B1, A2, B2 = pairs
    st = fresh(net)
    rng = np.random.default_rng(seed)
    noise = 0.012 * rng.standard_normal((TRAIN_MS, N))
    trace = np.zeros(N)
    half = PERIOD // 2
    for t in range(TRAIN_MS):
        ph = t % PERIOD
        forced = None
        if ph == 0:
            forced = A1
        elif ph == LAG:
            forced = B1
        elif ph == half:
            forced = A2
        elif ph == half + LAG:
            forced = B2
        fired = step(st, W, noise[t], forced)
        trace *= np.exp(-DT / 0.020)
        if fired.any():
            W[fired, :] += ETA_W * trace[None, :] * C[fired, :]
            W[:, fired] -= 1.05 * ETA_W * trace[:, None] * C[:, fired]
            np.clip(W, 0.0, 0.08, out=W)
            tot = W.sum(axis=1)
            W *= np.minimum(1.0, 0.6 / np.maximum(tot, 1e-12))[:, None]
        trace[fired] += 1.0
    return W


def latency(net, W, stim, obs, noise, pulse):
    """Импульс подаётся ПОСЛЕ переходной динамики, в тихой фазе.

    Первая редакция стимулировала на 20-й мс от старта пробы. Проба
    стартует из конечного состояния развития, где адаптация 0.28 при
    пороге 1.08 и токе 1.175: ток ниже порога, и сеть молчит первые
    около 100 мс, пока адаптация не спадёт. Импульс попадал в мёртвое
    окно, и попадания выходили 0.05 -- мерить было не на чем.
    У штатной пробы проекта (sim_core.probe) для этого есть 0.5 с на
    переходную динамику; здесь она была не перенесена.
    """
    st = fresh(net)
    for t in range(PROBE_MS):
        fired = step(st, W, noise[t], stim if t == pulse else None)
        if t > pulse and fired[obs].any():
            return t - pulse
    return -1


def score(net, W, pairs, seed):
    A1, B1, A2, B2 = pairs
    pulse = PULSE_AT
    rng = np.random.default_rng(seed)
    hit, conf = [], []
    for _ in range(TRIALS):
        nz = 0.012 * rng.standard_normal((PROBE_MS, N))
        for stim, own, other in ((A1, B1, B2), (A2, B2, B1)):
            lo = latency(net, W, stim, own, nz, pulse)
            lx = latency(net, W, stim, other, nz, pulse)
            hit.append(0 <= lo < DEADLINE)
            conf.append(0 <= lx < DEADLINE)
    return float(np.mean(hit)), float(np.mean(conf))


def main():
    res = {c: {"s": [], "h": [], "c": [], "deg": []}
           for c in ("БЕЗ ГРАНИЦЫ", "С ГРАНИЦЕЙ", "СЛУЧАЙНЫЙ РЕЗ")}
    for seed in SEEDS:
        base = simulate(seed=seed, drive=DRIVE, homeostasis=HOMEO,
                        gradual_growth=False, differentiation=ETA_DIFF,
                        coupling=COUPLING, state_affinity=0.0,
                        contact_radius=0.25)
        bnd = simulate(seed=seed, drive=DRIVE, homeostasis=HOMEO,
                       gradual_growth=False, differentiation=ETA_DIFF,
                       coupling=COUPLING, state_affinity=1.0,
                       contact_radius=0.285)
        pairs = pick_pairs(base["positions"])
        Cb = base["contacts"].astype(float)
        Cg = bnd["contacts"].astype(float)
        # случайный рез: столько же связей, сколько не хватает у границы
        drop = int(max(0, Cb.sum() - Cg.sum()) // 2)
        Cr = Cb.copy()
        iu = np.transpose(np.nonzero(np.triu(Cb, 1)))
        if drop and len(iu):
            sel = np.random.default_rng(seed + 5).choice(
                len(iu), size=min(drop, len(iu)), replace=False)
            for i, j in iu[sel]:
                Cr[i, j] = Cr[j, i] = 0.0
        for name, net, C in (("БЕЗ ГРАНИЦЫ", base, Cb),
                             ("С ГРАНИЦЕЙ", bnd, Cg),
                             ("СЛУЧАЙНЫЙ РЕЗ", base, Cr)):
            W = train(net, C, pairs, seed)
            h, c = score(net, W, pairs, seed + 50)
            res[name]["h"].append(h); res[name]["c"].append(c)
            res[name]["s"].append(h - c)
            res[name]["deg"].append(float(C.sum(axis=1).mean()))

    n = len(SEEDS)
    print(f"{n} seed'ов, сила связи {COUPLING:g}, срок {DEADLINE} мс, "
          f"проб на пару {TRIALS}\n")
    ref = np.mean(res["БЕЗ ГРАНИЦЫ"]["deg"])
    print("плотность связей (порог расхождения 10%):")
    for c in res:
        d = np.mean(res[c]["deg"])
        print(f"  {c:<15}: соседей {d:6.3f}  расхождение {abs(d-ref)/ref*100:5.2f}%")
    print(f"\n{'условие':<15} | {'попадание':>10} | {'путаница':>10} | {'счёт':>16}")
    for c in res:
        print(f"{c:<15} | {np.mean(res[c]['h']):>10.3f} | "
              f"{np.mean(res[c]['c']):>10.3f} | "
              f"{np.mean(res[c]['s']):>7.3f} +- {np.std(res[c]['s']):.3f}")

    b = np.array(res["БЕЗ ГРАНИЦЫ"]["s"])
    g = np.array(res["С ГРАНИЦЕЙ"]["s"])
    r = np.array(res["СЛУЧАЙНЫЙ РЕЗ"]["s"])
    ub, ur = int((g > b).sum()), int((g > r).sum())
    print(f"\nЧТЕНИЕ ({n} сидов):")
    print(f"  граница выше БЕЗ ГРАНИЦЫ:   {ub} из {n}, p = {p_ge(ub, n):.4f} "
          f"({b.mean():+.3f} -> {g.mean():+.3f})")
    print(f"  граница выше СЛУЧАЙНОГО:    {ur} из {n}, p = {p_ge(ur, n):.4f} "
          f"({r.mean():+.3f} -> {g.mean():+.3f})")
    thr = int(np.ceil(n * 5 / 6))
    dens_ok = all(abs(np.mean(res[c]["deg"]) - ref) / ref <= 0.10 for c in res)
    if not dens_ok:
        print("  ПЛОТНОСТЬ НЕ ВЫРАВНЕНА -- результат не читается, вердикт не выносится")
    elif ub >= thr and ur >= thr:
        print("  РАСПОЛОЖЕНИЕ ИМЕЕТ ЗНАЧЕНИЕ: пункты 1-3 и 6 карты остаются")
    elif ub >= thr:
        print("  помогает РАЗРЕЖЕНИЕ связей, а не перегородка")
    else:
        print("  порог 5/6 не взят; читать по величинам и p выше")


if __name__ == "__main__":
    main()

"""v0.30: ткань отгораживается от того места, где её касается мир.

ОТКУДА ВОПРОС. По критерию зачатка, записанному в STAGE_MAP, из пяти
пунктов закрыты два с половиной, а главный незакрытый -- четвёртый:
ткань должна ПЕРЕСТРАИВАТЬ СЕБЯ под внешним воздействием так, чтобы это
воздействие читалось лучше. До сих пор структура менялась только от
собственной динамики: развитие без адресата.

ЧТО ДОБАВЛЕНО В ДВИЖОК. Параметр stimulus: наборы узлов (образы),
которые по очереди получают добавку к входу. Добавка идёт в ТОТ ЖЕ вход,
что и собственный ток узла -- отдельного сенсорного канала у ткани нет.
Тождество при выключенном воздействии сохранено (9 из 9).

ЗАМЫСЕЛ. Поверхность -- 12 крайних левых узлов. Два образа: нижние 6 и
верхние 6. Развитие идёт 12 с, образы чередуются каждые 400 мс по 20 мс.

УСЛОВИЯ, полный перебор 3 x 2:
  вход:    БЕЗ ВХОДА | СО СТРОЕНИЕМ (два образа по очереди)
                     | БЕЗ СТРОЕНИЯ (каждый раз случайные 6 узлов
                       поверхности -- столько же тока, столько же
                       спайков, но повторяющегося образа нет);
  граница: ВКЛ (state_affinity = 1) | ВЫКЛ (state_affinity = 0).

Контроль БЕЗ СТРОЕНИЯ -- главный. Он отделяет "разметка записывает, ЧТО
делал мир" от "разметка записывает, что вообще что-то происходило".

ЧТО МЕРИТСЯ:
  1. структурно -- связей между поверхностью и остальной тканью, и
     насколько разошлись состояния поверхности и остальных;
  2. функционально -- можно ли по отклику НЕ-поверхностных узлов узнать,
     какой образ подан. Ближайший центр, проверка с выбрасыванием по
     одной пробе, пустой отсчёт -- перемешанные метки.

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * если доля ответивших узлов вне поверхности ниже 0.02, точность НЕ
    ИСТОЛКОВЫВАЕТСЯ вовсе: это не "не читается", а "отклика нет", и
    писать надо именно так;
  * точность засчитывается, только если перемешанные метки дают около
    0.5 (в пределах 0.40-0.60);
  * рядом с долей сидов всегда биномиальный p (урок №36);
  * разведочный прогон на 6 сидах уже показал обвал связей поверхности
    (36.5 -> 1.2) при включённой границе. Поэтому здесь берутся ДРУГИЕ
    сиды (1701-1724), и утверждение проверяется как предсказание:
    ПРЕДСКАЗАНИЕ 1 -- при включённой границе вход отрезает поверхность
      от ткани, при выключенной не отрезает;
    ПРЕДСКАЗАНИЕ 2 -- отрезание вызвано АКТИВНОСТЬЮ, а не строением
      входа, то есть случится и при входе БЕЗ СТРОЕНИЯ;
    ПРЕДСКАЗАНИЕ 3 -- где поверхность отрезана, отклика вне неё нет, и
      читать нечего.
  * если предсказание 2 не сбудется (отрезает только строенный вход) --
    это будет означать, что разметка хранит именно СТРОЕНИЕ мира, и это
    гораздо более сильный результат, чем ожидаемый.
"""
import sys
from math import comb

import numpy as np

sys.path.insert(0, "code")
from sim_core import simulate

N = 80
SEEDS = list(range(1701, 1725))
SURF = 12
AMP = 0.4
COUPLING = 10.0
DT = 0.001
PROBE_MS = 400
PULSE_AT = 300         # после переходной динамики: у штатной пробы 0.5 с
DEADLINE = 30
TRIALS = 40
FLOOR = 0.02

BASE = dict(drive=0.8, homeostasis=False, gradual_growth=False,
            differentiation=0.5, coupling=COUPLING, contact_radius=0.25,
            wire_from=6.0, diff_by_distance=True, state_jitter=0.02,
            diff_radius=0.55)


def p_ge(k, n):
    return sum(comb(n, i) for i in range(k, n + 1)) / 2 ** n


def surface(pos):
    surf = np.argsort(pos[:, 0])[:SURF]
    o = surf[np.argsort(pos[surf, 1])]
    half = SURF // 2
    return o[:half], o[half:], surf, np.setdiff1d(np.arange(N), surf)


def unstructured(surf, rng, n_cycles=30):
    """Столько же узлов под током, но повторяющегося образа нет."""
    half = SURF // 2
    return [rng.choice(surf, size=half, replace=False) for _ in range(n_cycles)]


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


def response(net, pat, rest, noise):
    """Кто из НЕ-поверхностных узлов ответил в срок после импульса."""
    st = fresh(net)
    got = np.zeros(N, dtype=bool)
    for t in range(PROBE_MS):
        fired = step(st, net["weights"] * net["contacts"], noise[t],
                     pat if t == PULSE_AT else None)
        if PULSE_AT < t <= PULSE_AT + DEADLINE:
            got |= fired
    return got[rest]


def readable(net, p1, p2, rest, seed):
    rng = np.random.default_rng(seed)
    X, y = [], []
    for lab, pat in ((0, p1), (1, p2)):
        for _ in range(TRIALS):
            nz = 0.012 * rng.standard_normal((PROBE_MS, N))
            X.append(response(net, pat, rest, nz).astype(float))
            y.append(lab)
    X = np.array(X); y = np.array(y)
    frac = float(X.mean())
    if frac < FLOOR:
        return frac, None, None
    return frac, loo(X, y), loo(X, rng.permutation(y))


def loo(X, y):
    """Ближайший центр, проба выбрасывается по одной."""
    ok = 0
    for i in range(len(y)):
        m = np.ones(len(y), dtype=bool); m[i] = False
        c0 = X[m & (y == 0)].mean(axis=0)
        c1 = X[m & (y == 1)].mean(axis=0)
        d0 = np.linalg.norm(X[i] - c0); d1 = np.linalg.norm(X[i] - c1)
        ok += int((d1 < d0) == bool(y[i]))
    return ok / len(y)


def main():
    conds = ("БЕЗ ВХОДА", "СО СТРОЕНИЕМ", "БЕЗ СТРОЕНИЯ")
    res = {(c, b): {"link": [], "ds": [], "frac": [], "acc": [], "nul": []}
           for c in conds for b in (True, False)}
    for seed in SEEDS:
        pos = simulate(seed=seed, state_affinity=0.0, **BASE)["positions"]
        p1, p2, surf, rest = surface(pos)
        rng = np.random.default_rng(seed + 31)
        pats = {"БЕЗ ВХОДА": (None, 0.0),
                "СО СТРОЕНИЕМ": ([p1, p2], AMP),
                "БЕЗ СТРОЕНИЯ": (unstructured(surf, rng), AMP)}
        for c in conds:
            stim, amp = pats[c]
            for b in (True, False):
                net = simulate(seed=seed, state_affinity=(1.0 if b else 0.0),
                               stimulus=stim, stimulus_amp=amp, **BASE)
                C = net["contacts"] | net["contacts"].T
                r = res[(c, b)]
                r["link"].append(int(C[np.ix_(surf, rest)].sum()))
                r["ds"].append(float(abs(net["state_s"][surf].mean()
                                         - net["state_s"][rest].mean())))
                f, a, nl = readable(net, p1, p2, rest, seed + 77)
                r["frac"].append(f); r["acc"].append(a); r["nul"].append(nl)

    print(f"{len(SEEDS)} сидов, поверхность {SURF} узлов, образ {SURF // 2}, "
          f"добавка к входу {AMP}, проб на образ {TRIALS}\n")
    print(f"{'вход':<14} {'граница':<8} | {'связей наружу':>13} | "
          f"{'расхожд. s':>10} | {'отклик вне':>10} | {'точность':>9} | "
          f"{'перемешано':>10}")
    for c in conds:
        for b in (True, False):
            r = res[(c, b)]
            acc = [a for a in r["acc"] if a is not None]
            nul = [a for a in r["nul"] if a is not None]
            sa = f"{np.mean(acc):9.3f}" if acc else "  ОТКЛИКА"
            sn = f"{np.mean(nul):10.3f}" if nul else "       НЕТ"
            print(f"{c:<14} {'ВКЛ' if b else 'ВЫКЛ':<8} | "
                  f"{np.mean(r['link']):13.1f} | {np.mean(r['ds']):10.3f} | "
                  f"{np.mean(r['frac']):10.3f} | {sa} | {sn}")

    n = len(SEEDS)
    print("\nЧТЕНИЕ:")
    base = np.array(res[("БЕЗ ВХОДА", True)]["link"])
    for c in ("СО СТРОЕНИЕМ", "БЕЗ СТРОЕНИЯ"):
        on = np.array(res[(c, True)]["link"])
        off_in = np.array(res[(c, False)]["link"])
        off_no = np.array(res[("БЕЗ ВХОДА", False)]["link"])
        k = int((on < base).sum())
        print(f"  {c}, ГРАНИЦА ВКЛ: связей {base.mean():.1f} -> {on.mean():.1f}, "
              f"{k} из {n}, p = {p_ge(k, n):.4f}")
        print(f"  {c}, ГРАНИЦА ВЫКЛ: связей {off_no.mean():.1f} -> "
              f"{off_in.mean():.1f} (правило границы не действует)")
    cut_s = np.array(res[("СО СТРОЕНИЕМ", True)]["link"])
    cut_u = np.array(res[("БЕЗ СТРОЕНИЯ", True)]["link"])
    k2 = int((cut_u < base).sum())
    print(f"\n  ПРЕДСКАЗАНИЕ 2 (отрезает активность, а не строение): "
          f"{'сбылось' if p_ge(k2, n) < 0.05 else 'НЕ сбылось'}")
    ks = int((cut_s < cut_u).sum())
    print(f"  строенный режет сильнее бесстроенного: {ks} из {n}, "
          f"p = {p_ge(ks, n):.4f} "
          f"({cut_u.mean():.1f} -> {cut_s.mean():.1f})")


if __name__ == "__main__":
    main()

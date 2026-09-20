"""v0.57: стоит ли эта история чего-нибудь?

ОТКУДА. v0.56: у одной и той же ткани -- те же координаты, то же
расписание рождений -- при разном шуме ложится примерно половина одних и
тех же дальних путей, а половина своя. Это первый случай в проекте, когда
у ткани обнаружилась ИСТОРИЯ: часть её устройства не следует из начальных
условий.

Но найденная история пока только ЗАПИСАНА. Ткань помнит, куда шло
движение, -- и неизвестно, меняет ли эта память хоть что-нибудь в том,
что ткань делает. Память, ни на что не влияющая, -- это не история, а
след на песке.

ЗАМЫСЕЛ. Взять ОДНУ сеть и подменять в ней ТОЛЬКО РАСПОЛОЖЕНИЕ дальних
связей, оставляя всё прочее побитово тем же: те же узлы, те же ближние
контакты, то же ЧИСЛО дальних связей и те же их ВЕСА -- меняется лишь
где они лежат. Тогда любая разница в поведении -- это разница рисунка и
ничего больше (повторяющийся урок проекта: рисунок, а не величина).

Ткань прогоняется дважды, при разных сидах: прогон A и прогон B. Часть
дальних связей у них общая (v0.56 -- около половины), часть своя. Пусть
m -- сколько связей есть у A и нет у B. Тогда:

  СВОЙ ПУТЬ       -- сеть прогона A как есть;
  ЧУЖАЯ ИСТОРИЯ   -- эти m связей ПЕРЕНЕСЕНЫ туда, где их проложил
                     прогон B (то есть на связи, которые есть у B и нет
                     у A);
  СЛУЧАЙНЫЙ ПЕРЕНОС -- те же m связей перенесены на случайные дальние
                     пары.

ПЕРЕНОСИТСЯ ОДНО И ТО ЖЕ ЧИСЛО СВЯЗЕЙ В ОБОИХ УСЛОВИЯХ, и это главное в
устройстве опыта: иначе сравнивалась бы величина подмены, а не её место.
Общая часть путей у A и B при этом не трогается вовсе -- она остаётся на
месте во всех трёх условиях.

ЧТО ЧЕМ МЕРЯЕТСЯ. Поведение -- отпечаток отклика: на шесть неподвижных
образов (узлы, ближайшие к шести точкам квадрата, -- выбраны геометрией,
а значит общие у всех условий) записывается, кто из узлов откликнулся.
Расстояние между отпечатками -- средняя разность долей откликов.

ПОЛ ИЗМЕРЕНИЯ МЕРЯЕТСЯ, А НЕ ПРЕДПОЛАГАЕТСЯ (урок №42): та же самая сеть
пробуется двумя независимыми жеребьёвками шума, и расстояние между этими
двумя отпечатками -- то, что даёт один только шум. Все три сравнения
берут независимые жеребьёвки, поэтому вклад шума у них одинаков.

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * если СЛУЧАЙНЫЙ ПЕРЕНОС не выходит за пол измерения -- мера слепа к
    расположению связей вообще, и НИКАКОЙ вердикт не выносится;
  * история засчитывается как ДЕЙСТВУЮЩАЯ, если ЧУЖАЯ ИСТОРИЯ дальше
    пола у большинства тканей с биномиальным p < 0.05;
  * ВТОРОЙ, более острый вопрос -- где именно ложится чужая история
    ОТНОСИТЕЛЬНО случайного переноса той же величины. Три исхода, и все
    три содержательны: дальше (своя случайность ткани бьёт по более
    важным местам, чем произвол), ближе (разные истории одной ткани
    держатся одного семейства), вровень (место не отличимо от
    произвольного). Знаковый счёт по тканям, но вердикт печатается
    ТОЛЬКО при биномиальном p < 0.05, иначе так и пишется "не отличимо";
  * величины печатаются рядом с долей тканей (урок №36);
  * ЧИСЛО ТКАНЕЙ НАЗНАЧЕНО ПОД ВТОРОЙ ВОПРОС, А НЕ ПОД ЖЕЛАЕМЫЙ ОТВЕТ.
    Первый прогон шёл на 24 тканях, в счёт пошли 5 -- при пяти тканях
    наименьшее возможное p равно 0.031, и знаковый счёт 3:2 не значит
    ничего ни в одну сторону. Сидов стало 96 из расчёта на ~20 тканей в
    счёт. Расширение решено по ЧИСЛУ, до чтения направления, и записано
    здесь, чтобы это можно было проверить, а не принять на слово;
  * доля подменённых связей сообщается: без неё расстояние нечем
    измерить (проверка на насыщение -- scratch/v57_dose.py -- показала,
    что мера отзывается на ДОЛЮ подмены, а не на сам факт);
  * ОБА ИСХОДА СОДЕРЖАТЕЛЬНЫ. "История записана, но ни на что не влияет"
    -- такой же ответ, как и обратный, и заранее нежелательным не
    объявляется.

ПРОВЕРКИ В КОДЕ (не предположения):
  * ближняя часть сети побитово одна и та же у всех трёх условий;
  * число дальних связей и сумма их весов совпадают у всех трёх;
  * пол измерения строго больше нуля -- иначе шума нет и сравнивать не с
    чем.
"""
import sys
from math import comb

import numpy as np

sys.path.insert(0, "code")
import v37_self_built as v37
import v46_closed_loop as v46
from readout import probe_batch
from sim_core import simulate

N = 80
SEEDS = list(range(6701, 6797))
RADIUS = 0.25
COUPLING = 10.0
DT = 0.001
PROBE_MS = 400
PULSE_AT = 300
DEADLINE = 30
TRIALS = 60
NOISE = 0.012
MIN_LINKS = 5
ANCHORS = np.array([[0.2, 0.2], [0.5, 0.2], [0.8, 0.2],
                    [0.2, 0.8], [0.5, 0.8], [0.8, 0.8]])
PAT_SIZE = 4

BASE = {k: v for k, v in v37.GROWN.items()
        if k not in ("div_rate", "coupling")}


def p_ge(k, n):
    return sum(comb(n, i) for i in range(k, n + 1)) / 2 ** n


def far_mask(pos):
    d = np.linalg.norm(pos[:, None, :] - pos[None, :, :], axis=2)
    return d > RADIUS


def long_links(net, far):
    alive = np.isfinite(net["birth"])
    m = net["contacts"] & far & alive[:, None] & alive[None, :]
    return [(int(i), int(j)) for i, j in zip(*np.where(m))]


def patterns(pos, alive):
    """Образы заданы геометрией, поэтому у всех условий они одни и те же."""
    idx = np.where(alive)[0]
    out = []
    for a in ANCHORS:
        order = idx[np.argsort(np.linalg.norm(pos[idx] - a, axis=1))]
        out.append(order[:PAT_SIZE])
    return out


def fingerprint(W, st, pats, read, rng):
    rows = []
    for pat in pats:
        nz = NOISE * rng.standard_normal((TRIALS, PROBE_MS, N))
        got = probe_batch(W, st, nz, pat, read, COUPLING, DT, PULSE_AT,
                          DEADLINE, st["thr"], st["asc"])
        rows.append(got.mean(axis=0))
    return np.array(rows)


def dist(f1, f2):
    return float(np.abs(f1 - f2).mean())


def fresh(net):
    s = net["state"]
    return dict(v=s["v"].copy(), adapt=s["adaptation"].copy(),
                refr=s["refractory"].copy(), drive=s["drive"].copy(),
                thr=s["threshold"].copy(), asc=s["adapt_scale"].copy())


def run_variant(seed, pos, birth, fixed):
    return simulate(seed=seed, positions=pos, birth_times=birth,
                    coupling=COUPLING, stimulus=[v46.touch], stimulus_amp=0.4,
                    stimulus_period=0.2, duration=24.0, world=v46.live_world,
                    world_init=0.5, activity_memory=0.05, long_range_rate=3.0,
                    tract_pick="worn", long_range_weight=0.08, **fixed)


def main():
    floors, others, rands = [], [], []
    moved_share, sizes = [], []
    skipped = {"не доросла": 0, "мало дальних связей": 0}
    local_same = True
    counts_same = True
    fixed = {k: v for k, v in BASE.items() if k != "growth_by_division"}

    for seed in SEEDS:
        grown = simulate(seed=seed, div_rate=0.10, coupling=COUPLING,
                         duration=24.0, **BASE)
        if grown["born"] < N:
            skipped["не доросла"] += 1
            continue
        pos, birth = grown["positions"], grown["birth"]
        far = far_mask(pos)
        alive = np.isfinite(birth)

        a_net = run_variant(seed + 1000, pos, birth, fixed)
        b_net = run_variant(seed + 2000, pos, birth, fixed)
        la, lb = long_links(a_net, far), long_links(b_net, far)
        only_a = [e for e in la if e not in set(lb)]
        only_b = [e for e in lb if e not in set(la)]
        m = min(len(only_a), len(only_b))
        if len(la) < MIN_LINKS or m < MIN_LINKS:
            skipped["мало дальних связей"] += 1
            continue

        base = (a_net["weights"] * a_net["contacts"]).astype(float)
        w_of = {e: base[e] for e in la}
        local = base.copy()
        for i, j in la:                       # ближняя часть -- общая основа
            local[i, j] = 0.0

        rng = np.random.default_rng(seed + 57)
        av = np.where(alive)[0]
        cand = [(int(i), int(j)) for i in av for j in av
                if i != j and far[i, j] and base[i, j] == 0.0]
        # какие именно m связей переносятся -- решает жребий, а не порядок
        # номеров: иначе подмена была бы систематически смещена к узлам с
        # малыми номерами, и два условия сравнивались бы на разных местах
        src = [only_a[k] for k in rng.choice(len(only_a), m, replace=False)]
        dst = [only_b[k] for k in rng.choice(len(only_b), m, replace=False)]
        rnd = [cand[k] for k in rng.choice(len(cand), m, replace=False)]
        stay = [e for e in la if e not in set(src)]
        w_src = [w_of[e] for e in src]

        nets = {}
        for name, dest in (("own", src), ("other", dst), ("rand", rnd)):
            W = local.copy()
            for e in stay:
                W[e] = w_of[e]
            for e, w in zip(dest, w_src):
                W[e] = w
            nets[name] = W
            strip = W.copy()
            for e in stay + list(dest):
                strip[e] = 0.0
            if not np.array_equal(strip, local):
                local_same = False
            if (int((W > 0).sum()) != int((nets["own"] > 0).sum())
                    or abs(W.sum() - nets["own"].sum()) > 1e-12):
                counts_same = False

        st = fresh(a_net)
        pats = patterns(pos, alive)
        read = av
        f_own0 = fingerprint(nets["own"], st, pats, read,
                             np.random.default_rng(seed + 101))
        f_own1 = fingerprint(nets["own"], st, pats, read,
                             np.random.default_rng(seed + 202))
        f_oth1 = fingerprint(nets["other"], st, pats, read,
                             np.random.default_rng(seed + 303))
        f_rnd1 = fingerprint(nets["rand"], st, pats, read,
                             np.random.default_rng(seed + 404))
        floors.append(dist(f_own0, f_own1))
        others.append(dist(f_own0, f_oth1))
        rands.append(dist(f_own0, f_rnd1))
        sizes.append(len(la))
        moved_share.append(m / len(la))

    n = len(floors)
    drop = ", ".join(f"{v} {k}" for k, v in skipped.items())
    print(f"{len(SEEDS)} тканей ({n} в счёт, {sum(skipped.values())} "
          f"отброшено: {drop}), образов {len(ANCHORS)}, "
          f"проб на образ {TRIALS}")
    print(f"ближняя часть сети одна и та же у всех трёх условий: "
          f"{'ДА' if local_same else 'НЕТ -- сравнение не чистое'}")
    print(f"число дальних связей и сумма весов совпадают: "
          f"{'ДА' if counts_same else 'НЕТ -- сравнение не чистое'}\n")
    if n == 0:
        print("  мерить не на чем")
        return

    fl, ot, rd = np.array(floors), np.array(others), np.array(rands)
    print(f"дальних связей у ткани: {np.mean(sizes):.1f}, "
          f"переносится доля {np.mean(moved_share):.2f}\n")
    print(f"{'условие':<28} | {'расстояние':>10}")
    print(f"{'та же сеть, другой шум':<28} | {fl.mean():10.5f}")
    print(f"{'чужая история той же ткани':<28} | {ot.mean():10.5f}")
    print(f"{'случайный перенос того же':<28} | {rd.mean():10.5f}")

    k_r = int((rd > fl).sum())
    k_o = int((ot > fl).sum())
    k_x = int((ot > rd).sum())
    print(f"\nдальше пола: случайный перенос {k_r} из {n} "
          f"(p = {p_ge(k_r, n):.4f}), чужая история {k_o} из {n} "
          f"(p = {p_ge(k_o, n):.4f})")
    print(f"чужая история дальше случайного переноса: {k_x} из {n} "
          f"(p = {p_ge(k_x, n):.4f}), "
          f"ближе: {n - k_x} из {n} (p = {p_ge(n - k_x, n):.4f})")

    if not fl.mean() > 0:
        print("\n  ПОЛ ИЗМЕРЕНИЯ РАВЕН НУЛЮ -- шума нет, сравнивать не с чем")
        return
    if not (p_ge(k_r, n) < 0.05 and rd.mean() > fl.mean()):
        print("\n  МЕРА СЛЕПА К РАСПОЛОЖЕНИЮ СВЯЗЕЙ: даже случайный перенос "
              "не выходит за пол измерения; вердикт не выносится")
        return

    if p_ge(k_o, n) < 0.05 and ot.mean() > fl.mean():
        print("\n  ИСТОРИЯ ДЕЙСТВУЕТ: та же ткань с другой историей ведёт "
              "себя иначе, чем с собственной")
    else:
        print("\n  ИСТОРИЯ ЗАПИСАНА, НО НЕ ДЕЙСТВУЕТ: своё расположение "
              "дальних связей ткань различает не больше, чем шум пробы")

    rel = (ot.mean() - fl.mean()) / (rd.mean() - fl.mean())
    print(f"  чужая история / случайный перенос (сверх пола): {rel:.2f}")
    if p_ge(k_x, n) < 0.05:
        print("  И БЬЁТ СИЛЬНЕЕ ПРОИЗВОЛА: место, куда ткань кладёт путь "
              "сама, значит больше случайного")
    elif p_ge(n - k_x, n) < 0.05:
        print("  НО МЯГЧЕ ПРОИЗВОЛА: разные истории одной ткани держатся "
              "одного семейства")
    else:
        print("  от случайного переноса той же величины не отличимо")


if __name__ == "__main__":
    main()

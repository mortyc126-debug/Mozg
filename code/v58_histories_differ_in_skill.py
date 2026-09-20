"""v0.58: разные истории -- разные УМЕНИЯ или только разные отпечатки?

ОТКУДА. v0.57: та же ткань с другой историей ведёт себя иначе -- отклик на
один и тот же образ расходится втрое сильнее шума пробы. Но РАЗНИЦА ЕЩЁ НЕ
СПОСОБНОСТЬ. Два отклика могут расходиться как угодно и быть при этом
одинаково (не)годными для дела. Пока это не проверено, сказано лишь "ткани
разные", а не "одна лучше другой".

ПОЧЕМУ ЭТО ВАЖНО ДЛЯ ЦЕЛИ. Если истории различаются УМЕНИЕМ, у ткани есть
удачные и неудачные пути -- то есть появляется то, что вообще можно
улучшать. Если различаются только рисунком, никакого отбора здесь нет.

ЗАМЫСЕЛ. Одна и та же ткань -- те же координаты, то же расписание рождений
-- прогоняется при четырёх сидах. Это четыре её ИСТОРИИ: одинаковый
чертёж, разное прошлое. У каждой меряется умение.

  разброс умения ПО ИСТОРИЯМ  -- то, что даёт прошлое;
  разброс умения У ОДНОЙ ИЗ НИХ при четырёх жеребьёвках шума пробы -- пол
    измерения, то, что даёт одна только проба.

Пол измеряется, а не предполагается (урок №42), и берётся по тому же числу
образцов, что и разброс по историям, иначе сравнивались бы разные меры
разброса.

ЗАЧЕМ ЗДЕСЬ ЦЕЛАЯ ИСТОРИЯ, А НЕ ОДНИ ДАЛЬНИЕ ПУТИ. v0.57 переносил
дальние связи с места на место при прочем равном побитово -- и это было
верно для ЕГО вопроса ("важно ли место"). Здесь вопрос шире: различаются
ли умением прожитые жизни ткани целиком. Поэтому сравниваются сети как
они выросли, со всем, что в них разошлось.

ОТСЮДА ЖЕ И ВТОРОЙ ВОПРОС, БЕЗ КОТОРОГО ПЕРВЫЙ ЧИТАТЬ НЕЛЬЗЯ: если умение
и правда расходится, то из-за ЧИСЛА дальних связей или из-за их МЕСТА? Это
повторяющийся вопрос проекта -- величина или рисунок (v0.29, v0.41, v0.44,
v0.49). Поэтому у каждой истории записывается число дальних связей, и
считается, сходится ли порядок историй по умению с порядком по числу
связей (доля согласных пар, 0.5 -- никакой связи).

УМЕНИЕ. Задача v0.46-v0.47, при которой ткань и росла: касание на высоте
0.47 против 0.53, читается отклик дальних узлов (x > 0.50), которых
касание не трогает. Мера -- отделимость (code/readout.py), то есть
"сколько из состояния можно прочесть" (§2a).

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * УМЕНИЕ ЗАВИСИТ ОТ ИСТОРИИ, если разброс по историям выше шумового у
    большинства тканей с биномиальным p < 0.05;
  * оба края стерегутся (ошибка №39): если средняя точность вне
    промежутка 0.55-0.95, вердикт не выносится -- у края разбросу некуда
    деваться, и сравнение мерило бы потолок, а не историю;
  * перемешанные метки обязаны дать 0.42-0.58, иначе мера неисправна (№40);
  * величины печатаются рядом с долей тканей (урок №36), и размах умения
    сообщается в процентных пунктах: без него "зависит" не говорит,
    насколько;
  * доля согласных пар "умение против числа связей" сообщается ВСЕГДА, и
    вывод о величине против рисунка делается только если она выходит за
    0.40-0.60; иначе так и пишется "не отличимо от независимости";
  * ОБА ИСХОДА СОДЕРЖАТЕЛЬНЫ. "Истории различаются рисунком, но не
    умением" -- такой же ответ, как и обратный.

ДОБАВЛЕННАЯ ПРОВЕРКА, И ОНА ЧЕСТНО ПОСЛЕДУЮЩАЯ. Первый прогон дал согласие
0.617 при объявленном пороге 0.60 -- то есть вывод "дело в числе связей"
держался бы на переходе через порог шириной в полтора сотых. Ведомость
числит эту ошибку уже трижды (№36, №46, v0.56), и принимать такой переход
за ответ нельзя. Поэтому добавлена прямая проверка, РАЗДЕЛЯЮЩАЯ число и
место, и её правило объявлено ДО её запуска:

  * берутся пары историй одной ткани с РАВНЫМ числом дальних связей. У
    таких пар число объяснить разницу не может по построению;
  * если у них разница в умении всё равно выше шумовой -- МЕСТО ЗНАЧИТ
    САМО ПО СЕБЕ, помимо числа;
  * если равна шумовой -- всё, что даёт история, сводится к тому,
    СКОЛЬКО путей она проложила;
  * рядом печатается то же для пар с РАЗНЫМ числом связей, иначе не с чем
    сравнивать; и число таких пар, потому что при малом их числе вывод не
    выносится (меньше 30 пар -- не выносится).

ПРАВИЛО ВЫШЕ ОКАЗАЛОСЬ СЛИШКОМ СЛАБЫМ, и это тоже записано. Оно сравнивало
две средние величины БЕЗ ВСЯКОЙ ПРОВЕРКИ НА СЛУЧАЙНОСТЬ -- то есть
напечатало бы "место значит само по себе" при перевесе любой малости.
Перевес и вышел малый: 2.77 против 2.42 п.п. Недостающая проверка
добавлена и объявлена ДО того, как её исход прочитан: разница считается
ПО КАЖДОЙ ТКАНИ отдельно (средняя по её парам с равным числом связей
против средней по её шумовым парам), и засчитывается по знаку у
большинства тканей с биномиальным p < 0.05 -- так, как в этом проекте
проверяется всё остальное. Сама сравниваемая пара величин не менялась;
добавлена только проверка, которой правилу недоставало.

Прогон повторён целиком; числа первого прогона обязаны совпасть до
последнего знака -- модель детерминирована, и расхождение означало бы, что
добавленная проверка сдвинула поток случайных чисел.

ЧЕГО ЭТОТ ОПЫТ НЕ РЕШАЕТ. Он не говорит, КАКАЯ история лучше и почему;
только есть ли вообще между ними разница в деле.
"""
import sys
from math import comb

import numpy as np

sys.path.insert(0, "code")
import v31_learned_readability as v31
import v37_self_built as v37
import v46_closed_loop as v46
from readout import probe_batch, separability
from sim_core import simulate

N = 80
SEEDS = list(range(6701, 6901))
RADIUS = 0.25
COUPLING = 10.0
DT = 0.001
PROBE_MS = v31.PROBE_MS
PULSE_AT = v31.PULSE_AT
DEADLINE = v31.DEADLINE
TRIALS = 160
NOISE = 0.012
FLOOR = 0.005
LO, HI, XFAR = 0.47, 0.53, 0.50
HISTORIES = 4

BASE = {k: v for k, v in v37.GROWN.items()
        if k not in ("div_rate", "coupling")}


def p_ge(k, n):
    return sum(comb(n, i) for i in range(k, n + 1)) / 2 ** n


def far_mask(pos):
    d = np.linalg.norm(pos[:, None, :] - pos[None, :, :], axis=2)
    return d > RADIUS


def n_long(net, far):
    alive = np.isfinite(net["birth"])
    return int((net["contacts"] & far & alive[:, None] & alive[None, :]).sum())


def fresh(net):
    s = net["state"]
    return dict(v=s["v"].copy(), adapt=s["adaptation"].copy(),
                refr=s["refractory"].copy(), drive=s["drive"].copy(),
                thr=s["threshold"].copy(), asc=s["adapt_scale"].copy())


def skill(W, st, p1, p2, read, seed):
    rng = np.random.default_rng(seed)
    X, y = [], []
    for lab, pat in ((0, p1), (1, p2)):
        nz = NOISE * rng.standard_normal((TRIALS, PROBE_MS, N))
        X.append(probe_batch(W, st, nz, pat, read, COUPLING, DT, PULSE_AT,
                             DEADLINE, st["thr"], st["asc"]).astype(float))
        y += [lab] * TRIALS
    X = np.vstack(X); y = np.array(y)
    if float(X.mean()) < FLOOR:
        return None, None
    return (separability(X, y, seed + 5),
            separability(X, rng.permutation(y), seed + 6))


def run_variant(seed, pos, birth, fixed):
    return simulate(seed=seed, positions=pos, birth_times=birth,
                    coupling=COUPLING, stimulus=[v46.touch], stimulus_amp=0.4,
                    stimulus_period=0.2, duration=24.0, world=v46.live_world,
                    world_init=0.5, activity_memory=0.05, long_range_rate=3.0,
                    tract_pick="worn", long_range_weight=0.08, **fixed)


def concordance(a, b):
    """Доля согласных пар: 1 -- порядки совпадают, 0 -- противоположны."""
    ok = tot = 0
    for i in range(len(a)):
        for j in range(i + 1, len(a)):
            if a[i] == a[j] or b[i] == b[j]:
                continue
            tot += 1
            ok += (a[i] < a[j]) == (b[i] < b[j])
    return (ok, tot)


def main():
    sp_h, sp_n, levels, nulls, ranges = [], [], [], [], []
    links_spread, conc_ok, conc_tot = [], 0, 0
    pair_same, pair_diff, pair_noise = [], [], []
    per_tissue = []
    skipped = {"не доросла": 0, "мало узлов для чтения": 0, "нет отклика": 0}
    fixed = {k: v for k, v in BASE.items() if k != "growth_by_division"}

    for seed in SEEDS:
        grown = simulate(seed=seed, div_rate=0.10, coupling=COUPLING,
                         duration=24.0, **BASE)
        if grown["born"] < N:
            skipped["не доросла"] += 1
            continue
        pos, birth = grown["positions"], grown["birth"]
        far, alive = far_mask(pos), np.isfinite(birth)
        p1 = np.where(alive & v46.touch(pos, LO))[0]
        p2 = np.where(alive & v46.touch(pos, HI))[0]
        read = np.where(alive & (pos[:, 0] > XFAR))[0]
        if len(p1) < 3 or len(p2) < 3 or len(read) < 10:
            skipped["мало узлов для чтения"] += 1
            continue

        nets = [run_variant(seed + 1000 * (h + 1), pos, birth, fixed)
                for h in range(HISTORIES)]
        Ws = [(nt["weights"] * nt["contacts"]).astype(float) for nt in nets]
        st = fresh(nets[0])
        by_hist = [skill(W, st, p1, p2, read, seed + 100 + 7 * i)
                   for i, W in enumerate(Ws)]
        by_noise = [skill(Ws[0], st, p1, p2, read, seed + 500 + 7 * i)
                    for i in range(HISTORIES)]
        acc_h = [a for a, _ in by_hist]
        acc_n = [a for a, _ in by_noise]
        if any(a is None for a in acc_h + acc_n):
            skipped["нет отклика"] += 1
            continue

        nl = [n_long(nt, far) for nt in nets]
        t_same, t_noise = [], []
        for i in range(HISTORIES):
            for j in range(i + 1, HISTORIES):
                d = abs(acc_h[i] - acc_h[j])
                (pair_same if nl[i] == nl[j] else pair_diff).append(d)
                if nl[i] == nl[j]:
                    t_same.append(d)
                pair_noise.append(abs(acc_n[i] - acc_n[j]))
                t_noise.append(abs(acc_n[i] - acc_n[j]))
        if t_same:
            per_tissue.append((float(np.mean(t_same)), float(np.mean(t_noise))))
        ok, tot = concordance(nl, acc_h)
        conc_ok += ok; conc_tot += tot
        links_spread.append(float(np.std(nl, ddof=1)))
        sp_h.append(float(np.std(acc_h, ddof=1)))
        sp_n.append(float(np.std(acc_n, ddof=1)))
        ranges.append(float(max(acc_h) - min(acc_h)))
        levels.append(float(np.mean(acc_h)))
        nulls += [x for _, x in by_hist + by_noise if x is not None]

    n = len(sp_h)
    drop = ", ".join(f"{v} {k}" for k, v in skipped.items())
    print(f"{len(SEEDS)} тканей ({n} в счёт, {sum(skipped.values())} "
          f"отброшено: {drop}); историй {HISTORIES}, проб на образ {TRIALS}\n")
    if n == 0:
        print("  мерить не на чем")
        return

    sh, sn = np.array(sp_h), np.array(sp_n)
    lvl, rg = np.array(levels), np.array(ranges)
    nul = float(np.mean(nulls))
    k = int((sh > sn).sum())
    print(f"{'источник разброса умения':<26} | {'разброс':>8}")
    print(f"{'прошлое ткани':<26} | {sh.mean():8.4f}")
    print(f"{'один только шум пробы':<26} | {sn.mean():8.4f}")
    print(f"\nсредняя точность {lvl.mean():.3f}, перемешанные метки {nul:.3f}")
    print(f"размах умения по историям: {rg.mean() * 100:.2f} п.п.")
    print(f"дальних связей: разброс по историям {np.mean(links_spread):.1f}")
    conc = conc_ok / conc_tot if conc_tot else float("nan")
    print(f"согласие порядков 'больше связей -- выше умение': "
          f"{conc:.3f} ({conc_ok} из {conc_tot} пар)")
    print(f"\nразброс по историям выше шумового: {k} из {n}, "
          f"p = {p_ge(k, n):.4f}")

    if not (0.42 <= nul <= 0.58):
        print(f"\n  ПЕРЕМЕШАННЫЕ МЕТКИ {nul:.3f} -- мера неисправна, "
              "вердикт не выносится")
        return
    if not (0.55 <= lvl.mean() <= 0.95):
        print(f"\n  ТОЧНОСТЬ {lvl.mean():.3f} вне промежутка 0.55-0.95 -- "
              "у края разбросу некуда деваться, вердикт не выносится")
        return
    if p_ge(k, n) < 0.05 and sh.mean() > sn.mean():
        print("\n  УМЕНИЕ ЗАВИСИТ ОТ ИСТОРИИ: у одной и той же ткани есть "
              "удачные и неудачные прошлые")
    else:
        print("\n  ИСТОРИИ РАЗЛИЧАЮТСЯ РИСУНКОМ, НО НЕ УМЕНИЕМ: прошлое "
              "меняет отклик, но не то, сколько из него можно прочесть")
    if conc_tot and conc > 0.60:
        print(f"  И ЗАВИСИТ ОТ ВЕЛИЧИНЫ: чем больше дальних связей, тем "
              f"выше умение (согласие {conc:.3f})")
    elif conc_tot and conc < 0.40:
        print(f"  ПРИЧЁМ ОБРАТНО ЧИСЛУ СВЯЗЕЙ: чем их больше, тем умение "
              f"ниже (согласие {conc:.3f})")
    else:
        print(f"  число дальних связей умения не объясняет (согласие "
              f"{conc:.3f}, не отличимо от независимости)")

    ps, pd, pn = (np.array(pair_same), np.array(pair_diff),
                  np.array(pair_noise))
    print(f"\nЧИСЛО ИЛИ МЕСТО (пары историй одной ткани):")
    print(f"  разное число связей: |разница умения| {pd.mean() * 100:5.2f} "
          f"п.п. ({len(pd)} пар)")
    print(f"  РАВНОЕ число связей: |разница умения| "
          f"{(ps.mean() * 100 if len(ps) else float('nan')):5.2f} п.п. "
          f"({len(ps)} пар)")
    print(f"  один только шум:     |разница умения| {pn.mean() * 100:5.2f} "
          f"п.п. ({len(pn)} пар)")
    nt = len(per_tissue)
    kt = sum(1 for a, b in per_tissue if a > b)
    print(f"  по тканям: равное число связей расходится сильнее шума "
          f"{kt} из {nt}, p = {(p_ge(kt, nt) if nt else float('nan')):.4f}")
    if len(ps) < 30:
        print("  пар с равным числом связей меньше 30 -- вывод не выносится")
    elif nt and p_ge(kt, nt) < 0.05 and ps.mean() > pn.mean():
        print("  МЕСТО ЗНАЧИТ САМО ПО СЕБЕ: при равном числе связей умение "
              "всё равно расходится сильнее шума -- но во сколько раз "
              f"меньше, чем при разном: {pd.mean() / ps.mean():.1f}")
    else:
        print("  ЧТО ДАЁТ ИСТОРИЯ -- ЭТО ЧИСЛО ПУТЕЙ, А НЕ ИХ МЕСТО: при "
              "равном числе связей умение расходится не сильнее шума")


if __name__ == "__main__":
    main()

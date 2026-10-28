"""v0.59: переживает ли приобретённое период свободной активности?

ОТКУДА. Строка 3 критерия зачатка цифрового мозга (docs/RUDIMENT_SPEC.md).
Пункт числится открытым с v0.10, повторён в v0.11, и за 58 версий его не
мерили ни разу. Всё, что проект знает про след опыта -- v0.11 (+2.33 п.п.),
v0.22 (+43.85 п.п.), v0.31 (+9.27 п.п.), v0.58 (размах умения 11 п.п.), --
измерено СРАЗУ после обучения. Ткань, забывающая за десяток секунд, давала
бы ровно те же числа.

ПРАВИЛО ЧТЕНИЯ ОБЪЯВЛЕНО ДО ЗАПУСКА в docs/V059_SPEC.md и здесь не
пересказывается вольно, а исполняется буквально. Если исход неудобен
правилу -- записывается исход.

УСТРОЙСТВО. Ткань растёт делением из одного элемента, 24 с живёт под
касанием (задача v0.46-v0.58: высота 0.47 против 0.53), затем T секунд
живёт САМА -- без входа, но со всей динамикой, пластичностью и ростом
связей. Умение меряется при T = 0, 6, 24, 96.

ОПОРА СХЕМЫ ПРОВЕРЕНА ОТДЕЛЬНО (code/v59_identity.py и prefix-сверка):
ткань на 24-й секунде побитово одна и та же у прогонов разной общей длины,
поэтому T=0 и T=96 -- это ОДНА ткань в разные моменты, а не две похожие.

ТРИ ПУТИ, и вывод только при согласии первых двух:

  A (функциональный) -- умение, отделимость отклика дальних узлов.
  B (структурный)    -- доля следа, оставшаяся в весах. Декодера не знает
                        вовсе: след есть то, что опыт ДОБАВИЛ к весам
                        сверх близнеца, выросшего без касания.
  C (контроли)       -- близнец без опыта (решается ли задача геометрией
                        даром -- ошибка №39), перемешанные метки (№40),
                        здоровье ткани к концу свободного бега.

БЛИЗНЕЦ. Та же ткань, тот же сид, тот же мир, то же всё -- кроме
stimulus_amp = 0. Воздействие не тратит случайных чисел, поэтому расходятся
ветви только от того, что одну касались, а другую нет (проверено: обрыв
входа в нуле побитово равен прогону без входа).

НАЗВАННЫЙ ЗАРАНЕЕ СПУТНИК. Во время свободной активности пластичность и
рост дальних связей ПРОДОЛЖАЮТСЯ -- это и есть жизнь ткани. Число дальних
связей к концу будет выше, и оно сообщается рядом с умением.

МЕРА НЕ РАЗМНОЖАЕТСЯ ПО ФАЙЛАМ (урок №34): умение, пол и отбраковка взяты
из v0.58 вызовом, а не копией.
"""
import json
import sys
from math import comb

import numpy as np

sys.path.insert(0, "code")
import v37_self_built as v37
import v46_closed_loop as v46
import v58_histories_differ_in_skill as v58
from sim_core import simulate

SEEDS = list(range(7001, 7101))     # объявлено ДО запуска, по стоимости счёта
TS = (0.0, 6.0, 24.0, 96.0)         # секунд свободной активности
TRAIN = 24.0                        # длительность опыта
N = v58.N
COUPLING = v58.COUPLING
LO, HI, XFAR = v58.LO, v58.HI, v58.XFAR
NOISE_DRAWS = 4                     # жеребьёвок шума пробы для пола
ACC_LO, ACC_HI = 0.55, 0.95         # стражи краёв (ошибка №39)
SHUF_LO, SHUF_HI = 0.42, 0.58       # страж исправности меры (№40)

BASE = {k: v for k, v in v37.GROWN.items() if k not in ("div_rate", "coupling")}
FIXED = {k: v for k, v in BASE.items() if k != "growth_by_division"}


def p_ge(k, n):
    """Односторонний биномиальный: вероятность получить k и более из n."""
    return sum(comb(n, i) for i in range(k, n + 1)) / 2 ** n


def live(seed, pos, birth, t_free, amp):
    """Опыт длиной TRAIN, затем t_free секунд без входа."""
    return simulate(seed=seed, positions=pos, birth_times=birth,
                    coupling=COUPLING, stimulus=[v46.touch], stimulus_amp=amp,
                    stimulus_period=0.2, stimulus_until=TRAIN,
                    duration=TRAIN + t_free, world=v46.live_world,
                    world_init=0.5, activity_memory=0.05, long_range_rate=3.0,
                    tract_pick="worn", long_range_weight=0.08, **FIXED)


def wmat(net):
    return (net["weights"] * net["contacts"]).astype(float)


def proj(d, d0):
    """Доля следа d0, оставшаяся в d. 1 -- целиком, 0 -- ничего."""
    den = float((d0 * d0).sum())
    return float((d * d0).sum() / den) if den > 0 else np.nan


def one_tissue(seed, log):
    grown = simulate(seed=seed, div_rate=0.10, coupling=COUPLING,
                     duration=TRAIN, **BASE)
    if grown["born"] < N:
        return None, "не доросла"
    pos, birth = grown["positions"], grown["birth"]
    far, alive = v58.far_mask(pos), np.isfinite(birth)
    p1 = np.where(alive & v46.touch(pos, LO))[0]
    p2 = np.where(alive & v46.touch(pos, HI))[0]
    read = np.where(alive & (pos[:, 0] > XFAR))[0]
    if len(p1) < 3 or len(p2) < 3 or len(read) < 10:
        return None, "мало узлов для чтения"

    exp = [live(seed + 1000, pos, birth, t, 0.4) for t in TS]
    nai = [live(seed + 1000, pos, birth, t, 0.0) for t in TS]

    # общий контролируемый старт -- искусственная диагностическая
    # конструкция (v0.9), одна и та же для всех T: иначе сравнивалось бы
    # мгновенное состояние, а не то, что осталось в связях
    st = v58.fresh(exp[0])

    acc, shuf, resp = [], [], []
    for i, net in enumerate(exp):
        a, s = v58.skill(wmat(net), st, p1, p2, read, seed + 100 + 7 * i)
        if a is None:
            return None, "нет отклика"
        acc.append(a); shuf.append(s)
    acc_nai = []
    for i, net in enumerate(nai):
        a, _ = v58.skill(wmat(net), st, p1, p2, read, seed + 300 + 7 * i)
        acc_nai.append(a)          # None допустим: молчащая ткань -- тоже ответ

    # пол измерения: та же сеть T=0, разные жеребьёвки шума пробы (урок №42)
    floor = []
    for i in range(NOISE_DRAWS):
        a, _ = v58.skill(wmat(exp[0]), st, p1, p2, read, seed + 500 + 7 * i)
        if a is None:
            return None, "нет отклика"
        floor.append(a)

    d = [wmat(e) - wmat(n) for e, n in zip(exp, nai)]
    # СКОЛЬКО ИМПУЛЬСОВ ТКАНЬ ДАЛА ЗА СВОБОДНЫЙ ПЕРИОД -- прямо, а не через
    # частоту в последние 2 с. Эта строка добавлена ПОСЛЕ первого прогона:
    # частота в хвосте показывала ровный ноль, и по ней нельзя было отличить
    # «ткань замолкла» от «мера смотрит не туда». Добавление названо в
    # записи; оно способно только ОТМЕНИТЬ вердикт, но не выдать его.
    train_steps = int(round(TRAIN / exp[0]["dt"]))
    free_spikes = [int(net["spikes"][train_steps:].sum()) for net in exp]
    train_spikes = [int(net["spikes"][:train_steps].sum()) for net in exp]
    w0 = wmat(exp[0])
    rec = dict(
        seed=seed,
        acc=acc, shuf=shuf, acc_naive=[(-1.0 if a is None else a) for a in acc_nai],
        floor_spread=float(np.std(floor)), floor_vals=floor,
        r=[proj(dt, d[0]) for dt in d],
        dnorm=[float(np.sqrt((dt * dt).sum())) for dt in d],
        n_long=[v58.n_long(net, far) for net in exp],
        rate=[float(net["metrics"]["rate_hz"]) for net in exp],
        silent=[float(net["metrics"]["silent_fraction"]) for net in exp],
        free_spikes=free_spikes, train_spikes=train_spikes,
        w_changed=[int((wmat(net) != w0).sum()) for net in exp],
        new_contacts=[int(net["contacts"].sum() - exp[0]["contacts"].sum())
                      for net in exp],
        d0=d[0], dT=[dt for dt in d],
    )
    log(f"  seed {seed}: умение {[round(a,3) for a in acc]} "
        f"пол {rec['floor_spread']:.4f} r {[round(x,3) for x in rec['r']]} "
        f"дальних {rec['n_long']}")
    return rec, None


def main():
    out = open("scratch/v59_run.txt", "w", buffering=1)

    def log(s):
        print(s); out.write(s + "\n")

    log("v0.59: удержание следа во времени")
    log(f"сиды {SEEDS[0]}-{SEEDS[-1]} ({len(SEEDS)}), T = {list(TS)} с, "
        f"обучение {TRAIN} с")
    log("правило чтения объявлено до запуска -- docs/V059_SPEC.md\n")

    recs, skipped = [], {"не доросла": 0, "мало узлов для чтения": 0,
                         "нет отклика": 0}
    for seed in SEEDS:
        rec, why = one_tissue(seed, log)
        if rec is None:
            skipped[why] += 1
        else:
            recs.append(rec)

    log(f"\nтканей всего {len(SEEDS)}, в счёт {len(recs)}, отброшено: {skipped}")
    if not recs:
        log("считать нечего"); return

    np.savez_compressed(
        "data/v59_trace_retention.npz",
        **{k: np.array([r[k] for r in recs]) for k in
           ("seed", "acc", "shuf", "acc_naive", "floor_spread", "r",
            "dnorm", "n_long", "rate", "silent", "free_spikes",
            "train_spikes", "w_changed", "new_contacts")})

    # ---- стражи ----
    shuf_all = np.array([s for r in recs for s in r["shuf"]])
    log(f"\nСТРАЖ №40 (перемешанные метки): {shuf_all.mean():.4f} "
        f"[{shuf_all.min():.3f}, {shuf_all.max():.3f}] -- "
        f"{'ОК' if SHUF_LO <= shuf_all.mean() <= SHUF_HI else 'МЕРА НЕИСПРАВНА'}")

    keep = [r for r in recs if ACC_LO <= r["acc"][0] <= ACC_HI]
    log(f"СТРАЖ №39 (края): умение(0) в [{ACC_LO}, {ACC_HI}] у {len(keep)} "
        f"тканей из {len(recs)}; остальные не в счёт")
    if len(keep) < 10:
        log("тканей в счёт меньше десяти -- вердикт не выносится"); return

    acc = np.array([r["acc"] for r in keep])
    floor = float(np.mean([r["floor_spread"] for r in keep]))
    log(f"\nпол измерения f (разброс от одного шума пробы): {floor:.4f}")
    log(f"умение(0) в среднем: {acc[:, 0].mean():.4f}")

    nai = np.array([r["acc_naive"] for r in keep])
    nai0 = nai[:, 0][nai[:, 0] >= 0]
    log(f"КОНТРОЛЬ C1 (близнец без опыта, T=0): "
        f"{nai0.mean():.4f} по {len(nai0)} тканям "
        f"({(nai[:, 0] < 0).sum()} молчали) -- "
        f"{'задача НЕ решается даром' if nai0.mean() < 0.60 else 'ВНИМАНИЕ: решается геометрией'}")

    # ---- путь A ----
    log("\n=== ПУТЬ A: умение ===")
    log(f"{'T, с':>6} | {'умение':>7} | {'Δ(T)':>8} | {'ниже':>5} | "
        f"{'выше':>5} | {'p':>8} | {'|Δ|/f':>6} | вердикт")
    verdicts_a = {}
    for i, t in enumerate(TS):
        if i == 0:
            log(f"{t:>6.0f} | {acc[:, 0].mean():>7.4f} |    --    |    -- |"
                f"    -- |       -- |     -- | точка отсчёта")
            continue
        d = acc[:, i] - acc[:, 0]
        neg, pos_, tie = int((d < 0).sum()), int((d > 0).sum()), int((d == 0).sum())
        n = neg + pos_
        k = max(neg, pos_)
        p = p_ge(k, n) if n else 1.0
        sign_hit = (p < 0.05) and (neg > pos_)
        size_hit = abs(d.mean()) > floor
        if sign_hit and size_hit:
            v = "СЛЕД ОСЛАБЕВАЕТ"
        elif not sign_hit and not size_hit:
            v = "СЛЕД ДЕРЖИТСЯ"
        else:
            v = "НЕ РАЗРЕШЕНО"
        verdicts_a[t] = v
        log(f"{t:>6.0f} | {acc[:, i].mean():>7.4f} | {d.mean():>+8.4f} | "
            f"{neg:>5} | {pos_:>5} | {p:>8.5f} | {abs(d.mean())/floor:>6.2f} | {v}"
            + (f"  (ничьих {tie})" if tie else ""))

    # ---- путь B ----
    log("\n=== ПУТЬ B: доля следа в весах (декодера не знает) ===")
    r = np.array([r_["r"] for r_ in keep])
    dn = np.array([r_["dnorm"] for r_ in keep])
    # пустой отсчёт: тот же след, но мерянный по D(0) ДРУГОЙ ткани
    other = []
    for j, r_ in enumerate(keep):
        o = keep[(j + 1) % len(keep)]
        other.append([proj(dt, o["d0"]) for dt in r_["dT"]])
    other = np.array(other)
    # У ткани, чьи веса совпали с близнецом, следа нет вовсе: D(0) = 0, и
    # доля от нуля не определена. Такие ткани считаются отдельно, а не
    # портят среднее молчком (первая редакция печатала nan по всей строке).
    zero = np.isnan(r[:, 0])
    log(f"тканей без следа вовсе (веса опыта совпали с близнецом): "
        f"{int(zero.sum())} из {len(keep)} -- считаются отдельно")
    good = ~np.isnan(r).any(axis=1) & ~np.isnan(other).any(axis=1)
    log(f"{'T, с':>6} | {'r(T)':>8} | {'чужой':>8} | {'r-чужой':>8} | "
        f"{'выше':>5} | {'p':>8} | {'|D|/|D0|':>8} | вердикт")
    verdicts_b = {}
    for i, t in enumerate(TS):
        diff = (r[:, i] - other[:, i])[good]
        hi = int((diff > 0).sum())
        p = p_ge(hi, len(diff)) if len(diff) else 1.0
        v = "держится" if p < 0.05 else "РАСПАЛСЯ до чужого уровня"
        if i == 0:
            v = "точка отсчёта"
        verdicts_b[t] = v
        log(f"{t:>6.0f} | {np.nanmean(r[good, i]):>8.4f} | "
            f"{np.nanmean(other[good, i]):>8.4f} | "
            f"{diff.mean():>+8.4f} | {hi:>5} | {p:>8.5f} | "
            f"{np.nanmean(dn[good, i]/dn[good, 0]):>8.4f} | {v}")

    # ---- путь C: здоровье ----
    log("\n=== ПУТЬ C3: жила ли ткань в свободный период ===")
    nl = np.array([r_["n_long"] for r_ in keep], dtype=float)
    rt = np.array([r_["rate"] for r_ in keep])
    si = np.array([r_["silent"] for r_ in keep])
    fs = np.array([r_["free_spikes"] for r_ in keep], dtype=float)
    ts_ = np.array([r_["train_spikes"] for r_ in keep], dtype=float)
    wc = np.array([r_["w_changed"] for r_ in keep], dtype=float)
    nc = np.array([r_["new_contacts"] for r_ in keep], dtype=float)
    log(f"{'T, с':>6} | {'имп. обучение':>13} | {'имп. свободно':>13} | "
        f"{'весов изм.':>10} | {'связей +':>8} | {'дальних':>7} | "
        f"{'Гц (посл. 2 с)':>14} | {'молчат':>6}")
    for i, t in enumerate(TS):
        log(f"{t:>6.0f} | {ts_[:, i].mean():>13.1f} | {fs[:, i].mean():>13.2f} | "
            f"{wc[:, i].mean():>10.1f} | {nc[:, i].mean():>8.1f} | "
            f"{nl[:, i].mean():>7.1f} | {rt[:, i].mean():>14.4f} | "
            f"{si[:, i].mean():>6.3f}")

    # СТРАЖ, ДОБАВЛЕННЫЙ ПОСЛЕ ПЕРВОГО ПРОГОНА И НАЗВАННЫЙ В ЗАПИСИ.
    # Он способен только ОТМЕНИТЬ вердикт, но никогда его не выдать:
    # если свободной активности не было, то вопрос "переживает ли след
    # свободную активность" не задан, и любой ответ на него -- о другом.
    alive = fs[:, 1:].mean() >= 1.0
    log(f"\nСТРАЖ СВОБОДНОЙ АКТИВНОСТИ: за свободный период ткань даёт в "
        f"среднем {fs[:, 1:].mean():.2f} импульса "
        f"против {ts_[:, 0].mean():.0f} за обучение -- "
        f"{'активность есть' if alive else 'АКТИВНОСТИ НЕТ, ВОПРОС НЕ ЗАДАН'}")

    # ---- согласие путей ----
    log("\n=== СОГЛАСИЕ ПУТЕЙ (условие вывода) ===")
    for t in TS[1:]:
        a, b = verdicts_a[t], verdicts_b[t]
        a_weak = a == "СЛЕД ОСЛАБЕВАЕТ"
        b_weak = b.startswith("РАСПАЛСЯ")
        if not alive:
            s = ("ВЕРДИКТ НЕ ВЫНОСИТСЯ: свободной активности не было, "
                 f"и «{a.lower()}» относится к ткани, с которой ничего не "
                 "происходило")
        elif a == "НЕ РАЗРЕШЕНО":
            s = "A не разрешил -- вывод не выносится"
        elif a_weak == b_weak:
            s = f"СОГЛАСНЫ: {a.lower()} / структурно {b.lower()}"
        else:
            s = f"РАСХОЖДЕНИЕ: A говорит «{a}», B говорит «{b}» -- ВЫВОД НЕ ВЫНОСИТСЯ"
        log(f"  T = {t:>5.0f} с: {s}")

    log("\nМНОЖЕСТВЕННОСТЬ: проверено 3 значения T при пороге p < 0.05 каждое. "
        "Сообщается как есть, порог задним числом не правится.")
    log("Чего этот опыт НЕ говорит -- см. docs/V059_SPEC.md §7.")
    out.close()


if __name__ == "__main__":
    main()

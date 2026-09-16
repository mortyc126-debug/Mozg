"""v0.33: а не в ЗНАКЕ ли дело -- активность ПОМОГАЕТ связи вырасти.

ОТКУДА ВОПРОС. Правило "различие состояний МЕШАЕТ связи" проверялось пять
раз и ни разу ничему не помогло:
  v0.24 -- ухудшает след (0.899 -> 0.809);
  v0.25 -- областей независимыми не делает;
  v0.29 -- всё его действие сводится к прореживанию мостика, и любое
    такое же прореживание наугад даёт то же самое (p = 0.9999);
  v0.30 -- отрезает сенсорную поверхность от ткани;
  v0.32 -- если убрать активность из разметки, стена уходит, но разметка
    начинает резать поверхность поперёк (в своей области остаётся 54-69%
    поверхности), и прибавка читаемости не держится.
Общий знаменатель у всех пяти один: правило умеет только УБАВЛЯТЬ связи.

ЗАМЫСЕЛ. Добавлено встречное правило того же вида, но обратного знака:
пережитая активность ПОМОГАЕТ связи вырасти. Оба довода стоят в одной
скобке и складываются:
    p = 0.15 * (1 - state_affinity*|s_i - s_j| + activity_affinity*max(a_i, a_j))
Множителем это не работает по построению -- запись об ошибке №41.

Тогда становится доступна третья возможность, которой до сих пор не было.
Из трёх желаемых свойств раньше держались только два:
  (а) разметка СЛЕДУЕТ за активностью, то есть знает, где вход;
  (б) различие МЕШАЕТ связи -- то, ради чего разметка вводилась;
  (в) поверхность остаётся СВЯЗАННОЙ.
v0.30 имел (а)+(б) и терял (в): поверхность отрезана.
v0.32 имел (б)+(в) и терял (а): разметка слепа ко входу и режет его
поперёк.
Здесь проверяется (а)+(б)+(в) сразу.

СТРУКТУРНО это уже проверено при калибровке: при силе 1.0 связи
поверхности наружу 68.4 -- РОВНО уровень ткани без входа, -- и при этом
расхождение состояний поверхности и остальных 0.743, памяти об
активности 0.874. Поверхность одновременно размечена и связана, и
разметка знает, где она.

ЗДЕСЬ МЕРИТСЯ ГЛАВНОЕ: держится ли при этом прибавка читаемости.

УСЛОВИЯ -- те же три, что в v0.31 и v0.32, задача та же (перемежённые
образы).

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * сеть контактов здесь УЖЕ НЕ ОДНА И ТА ЖЕ: в том и смысл правила, что
    вход меняет проводку. Поэтому главным сравнением объявляется
    СО СТРОЕНИЕМ против БЕЗ СТРОЕНИЯ -- у них одинаковы и ток, и спайки,
    и, как следствие, память об активности, а значит и прибавка связей.
    Сравнение с БЕЗ ВХОДА сообщается, но вердикта не несёт: там плотность
    другая;
  * проверка плотности ИСПОЛНЯЕМАЯ (урок №37): если связей у СО
    СТРОЕНИЕМ и БЕЗ СТРОЕНИЯ расходится больше чем на 10%, вердикт не
    выносится вовсе;
  * оба края промежутка стерегутся (ошибка №39): контроль БЕЗ ВХОДА
    обязан лежать в 0.52-0.85;
  * перемешанные метки 0.42-0.58 (ошибка №40);
  * величина рядом с долей сидов (урок №36).
"""
import sys

import numpy as np

sys.path.insert(0, "code")
import v31_learned_readability as v31
from sim_core import simulate

N = v31.N
SEEDS = list(range(2201, 2225))
AMP = v31.AMP
PERIOD = v31.PERIOD

GROW = dict(drive=0.8, homeostasis=False, gradual_growth=False,
            coupling=v31.COUPLING, contact_radius=0.25,
            differentiation=0.5, state_affinity=1.0, diff_by_distance=True,
            diff_radius=0.55, state_jitter=0.02, wire_from=0.0,
            state_from_activity=1.0, activity_memory=0.05,
            activity_affinity=1.0)


def run(GROW=GROW, SEEDS=SEEDS, title=''):
    conds = ("БЕЗ ВХОДА", "СО СТРОЕНИЕМ", "БЕЗ СТРОЕНИЯ")
    res = {c: {"frac": [], "acc": [], "nul": [], "link": [], "deg": [],
               "ds": [], "da": []} for c in conds}
    paired = {c: [] for c in conds}
    skipped = 0
    for seed in SEEDS:
        pos = simulate(seed=seed, **GROW)["positions"]
        p1, p2, surf = v31.interleaved(pos)
        read = np.setdiff1d(np.arange(N), surf)
        rng = np.random.default_rng(seed + 31)
        cycles = int(round(12.0 / PERIOD))
        pats = {"БЕЗ ВХОДА": (None, 0.0),
                "СО СТРОЕНИЕМ": ([p1, p2], AMP),
                "БЕЗ СТРОЕНИЯ": (v31.unstructured(surf, rng, cycles), AMP)}
        row = {}
        for c in conds:
            stim, amp = pats[c]
            net = simulate(seed=seed, stimulus=stim, stimulus_amp=amp,
                           stimulus_period=PERIOD, **GROW)
            C = net["contacts"] | net["contacts"].T
            r = res[c]
            r["link"].append(int(C[np.ix_(surf, read)].sum()))
            r["deg"].append(float(C.sum(axis=1).mean()))
            r["ds"].append(float(abs(net["state_s"][surf].mean()
                                     - net["state_s"][read].mean())))
            r["da"].append(float(abs(net["state_a"][surf].mean()
                                     - net["state_a"][read].mean())))
            f, a, nl = v31.measure(net, p1, p2, read, seed + 77)
            r["frac"].append(f); r["acc"].append(a); r["nul"].append(nl)
            row[c] = a
        if any(row[c] is None for c in conds):
            skipped += 1
        else:
            for c in conds:
                paired[c].append(row[c])

    n = len(paired["БЕЗ ВХОДА"])
    print(f"{len(SEEDS)} сидов ({n} в счёт, {skipped} без отклика). "
          f"{title}\n")
    print(f"{'условие':<14} | {'связей наружу':>13} | {'соседей':>7} | "
          f"{'расх. s':>7} | {'расх. a':>7} | {'отклик':>7} | "
          f"{'точность':>8} | {'перемеш.':>8}")
    for c in conds:
        acc = [a for a in res[c]["acc"] if a is not None]
        nul = [a for a in res[c]["nul"] if a is not None]
        print(f"{c:<14} | {np.mean(res[c]['link']):13.1f} | "
              f"{np.mean(res[c]['deg']):7.2f} | {np.mean(res[c]['ds']):7.3f} | "
              f"{np.mean(res[c]['da']):7.3f} | {np.mean(res[c]['frac']):7.3f} | "
              f"{(np.mean(acc) if acc else float('nan')):8.3f} | "
              f"{(np.mean(nul) if nul else float('nan')):8.3f}")

    ds_ = np.mean(res["СО СТРОЕНИЕМ"]["deg"])
    du_ = np.mean(res["БЕЗ СТРОЕНИЯ"]["deg"])
    mismatch = abs(ds_ - du_) / du_
    print(f"\nплотность СО СТРОЕНИЕМ против БЕЗ СТРОЕНИЯ: "
          f"{ds_:.2f} против {du_:.2f}, расхождение {mismatch * 100:.2f}% "
          f"(порог 10%)")
    if n == 0:
        print("  отклика нет ни у одного сида -- мерить не на чем")
        return
    b = np.array(paired["БЕЗ ВХОДА"])
    s_ = np.array(paired["СО СТРОЕНИЕМ"])
    u = np.array(paired["БЕЗ СТРОЕНИЯ"])
    nul_all = np.mean([a for c in conds for a in res[c]["nul"] if a is not None])
    k1, k2 = int((s_ > b).sum()), int((s_ > u).sum())
    print(f"\nЧТЕНИЕ ({n} сидов):")
    print(f"  ГЛАВНОЕ -- выше БЕССТРОЕННОГО:  {k2} из {n}, "
          f"p = {v31.p_ge(k2, n):.4f} ({u.mean():.3f} -> {s_.mean():.3f}, "
          f"{(s_ - u).mean() * 100:+.2f} п.п.)")
    print(f"  справочно -- выше БЕЗ ВХОДА:    {k1} из {n}, "
          f"p = {v31.p_ge(k1, n):.4f} ({b.mean():.3f} -> {s_.mean():.3f}, "
          f"{(s_ - b).mean() * 100:+.2f} п.п.)")
    if mismatch > 0.10:
        print("  ПЛОТНОСТЬ НЕ ВЫРАВНЕНА -- вердикт не выносится")
    elif not (0.42 <= nul_all <= 0.58):
        print(f"  перемешанные метки {nul_all:.3f} -- мера неисправна")
    elif not (0.52 <= b.mean() <= 0.85):
        print(f"  контроль БЕЗ ВХОДА {b.mean():.3f} вне 0.52-0.85 -- "
              "вердикт не выносится")
    elif v31.p_ge(k2, n) < 0.05:
        print("  ВСТРЕЧНОЕ ПРАВИЛО ДЕРЖИТ ВСЁ ТРОЕ: разметка знает про вход, "
              "поверхность связана, читаемость растёт")
    else:
        print("  прибавка читаемости не держится и при встречном правиле")


if __name__ == "__main__":
    run(title="разметка следует за активностью, различие мешает связи, "
              "активность помогает")

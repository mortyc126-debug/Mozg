"""v0.32: держатся ли разметка и обучение у мира ВМЕСТЕ.

ОТКУДА ВОПРОС. Два измерения дали дополняющую пару и одно противоречие:
  v0.30 -- при включённом правиле границы вход ОТРЕЗАЕТ сенсорную
    поверхность от ткани (40.0 связей -> 0.6), и режет это сама
    активность, а не строение входа;
  v0.31 -- при ВЫКЛЮЧЕННОЙ границе ткань, выросшая под строенным входом,
    читается на 9.27 п.п. лучше, и помогает именно строение.
То есть ткань могла либо учиться у мира, либо иметь разметку,
управляющую проводкой, но не то и другое сразу.

ЧТО СДЕЛАНО. Разведены две службы величины s. В движок добавлены:
  state_from_activity -- множитель при собственной активности в правиле
    соперничества (1.0 -- прежнее поведение, 0.0 -- активность на
    состояние не влияет);
  activity_memory -- отдельная память об активности state_a.
Теперь s отвечает только на вопрос "с кем мне можно связываться", а
"насколько я был активен" живёт отдельно. Тождество при значениях по
умолчанию сохранено: 9 из 9.

В ткани так нельзя -- у клетки активность и поверхностные свойства
завязаны на одну биохимию. В цифровой системе это два числа
(PRINCIPLES §3).

ПОБОЧНО ВЫЯСНИЛОСЬ, и это упрощение. После разведения ФАЗИРОВКА РАЗВИТИЯ
БОЛЬШЕ НЕ НУЖНА: карта сходится одинаково при wire_from 0, 3 и 6 (доля
определившихся 0.936, баланс 0.506, согласие меток вблизи 0.840 -- во
всех трёх случаях одно и то же), а связей при wire_from = 0 больше
(12.07 против 9.29). Фазировка вводилась потому, что разметку сдвигала с
места только активность, и та в молчащей подложке приходила слишком
поздно. Убрав активность из правила, мы убрали и причину ждать.

УСЛОВИЯ -- те же три, что в v0.31, и та же задача с перемежёнными
образами. Отличие одно: граница ВКЛЮЧЕНА, а службы разведены.

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * структурно -- поверхность обязана остаться связанной: связей наружу
    при входе не меньше, чем без входа (разведочный прогон дал 40.9
    против 40.9, здесь проверяется на других сидах);
  * функционально -- те же пороги, что в v0.31: контроль БЕЗ ВХОДА в
    промежутке 0.52-0.85 (оба края, ошибка №39), перемешанные метки
    0.42-0.58 (ошибка №40), вердикт требует превосходства И над БЕЗ
    ВХОДА, И над БЕЗ СТРОЕНИЯ;
  * ВЕЛИЧИНА ПРИБАВКИ НЕ СРАВНИВАЕТСЯ С v0.31 НАПРЯМУЮ: там граница была
    выключена, и плотность связей другая. Сравнивать можно только ЗНАК:
    держится прибавка или исчезает;
  * если сеть контактов окажется НЕ одинаковой во всех трёх условиях,
    сравнение не чистое, и об этом сообщается отдельной строкой.
"""
import sys

import numpy as np

sys.path.insert(0, "code")
import v31_learned_readability as v31
from sim_core import simulate

N = v31.N
SEEDS = list(range(2001, 2025))
AMP = v31.AMP
PERIOD = v31.PERIOD

GROW = dict(drive=0.8, homeostasis=False, gradual_growth=False,
            coupling=v31.COUPLING, contact_radius=0.25,
            differentiation=0.5, state_affinity=1.0, diff_by_distance=True,
            diff_radius=0.55, state_jitter=0.02, wire_from=0.0,
            state_from_activity=0.0, activity_memory=0.05)


def main():
    conds = ("БЕЗ ВХОДА", "СО СТРОЕНИЕМ", "БЕЗ СТРОЕНИЯ")
    res = {c: {"frac": [], "acc": [], "nul": [], "link": [], "da": []}
           for c in conds}
    paired = {c: [] for c in conds}
    same_wiring = True
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
        ref_c, row = None, {}
        for c in conds:
            stim, amp = pats[c]
            net = simulate(seed=seed, stimulus=stim, stimulus_amp=amp,
                           stimulus_period=PERIOD, **GROW)
            if ref_c is None:
                ref_c = net["contacts"].copy()
            elif not np.array_equal(ref_c, net["contacts"]):
                same_wiring = False
            C = net["contacts"] | net["contacts"].T
            r = res[c]
            r["link"].append(int(C[np.ix_(surf, read)].sum()))
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
    print(f"{len(SEEDS)} сидов ({n} в счёт, {skipped} без отклика), "
          f"граница ВКЛЮЧЕНА, службы разведены, фазировки нет")
    print(f"сеть контактов одна и та же во всех условиях: "
          f"{'ДА' if same_wiring else 'НЕТ -- сравнение не чистое'}\n")
    print(f"{'условие':<14} | {'связей наружу':>13} | {'расхожд. a':>10} | "
          f"{'отклик':>7} | {'точность':>9} | {'перемешано':>10}")
    for c in conds:
        acc = [a for a in res[c]["acc"] if a is not None]
        nul = [a for a in res[c]["nul"] if a is not None]
        print(f"{c:<14} | {np.mean(res[c]['link']):13.1f} | "
              f"{np.mean(res[c]['da']):10.3f} | "
              f"{np.mean(res[c]['frac']):7.3f} | "
              f"{(np.mean(acc) if acc else float('nan')):9.3f} | "
              f"{(np.mean(nul) if nul else float('nan')):10.3f}")

    lb = np.array(res["БЕЗ ВХОДА"]["link"], dtype=float)
    ls = np.array(res["СО СТРОЕНИЕМ"]["link"], dtype=float)
    print(f"\nСТРУКТУРНО: поверхность связана как без входа? "
          f"{'ДА' if ls.mean() >= lb.mean() else 'НЕТ'} "
          f"({lb.mean():.1f} -> {ls.mean():.1f}); в v0.30 при неразведённых "
          f"службах было 40.0 -> 0.6")

    if n == 0:
        print("\n  отклика нет ни у одного сида -- мерить не на чем")
        return
    b = np.array(paired["БЕЗ ВХОДА"])
    s_ = np.array(paired["СО СТРОЕНИЕМ"])
    u = np.array(paired["БЕЗ СТРОЕНИЯ"])
    nul_all = np.mean([a for c in conds for a in res[c]["nul"] if a is not None])
    k1, k2 = int((s_ > b).sum()), int((s_ > u).sum())
    print(f"\nФУНКЦИОНАЛЬНО ({n} сидов):")
    print(f"  со строением выше БЕЗ ВХОДА:     {k1} из {n}, "
          f"p = {v31.p_ge(k1, n):.4f} ({b.mean():.3f} -> {s_.mean():.3f}, "
          f"{(s_ - b).mean() * 100:+.2f} п.п.)")
    print(f"  со строением выше БЕССТРОЕННОГО: {k2} из {n}, "
          f"p = {v31.p_ge(k2, n):.4f} ({u.mean():.3f} -> {s_.mean():.3f}, "
          f"{(s_ - u).mean() * 100:+.2f} п.п.)")
    if not (0.42 <= nul_all <= 0.58):
        print(f"  ПЕРЕМЕШАННЫЕ МЕТКИ ДАЛИ {nul_all:.3f} -- мера неисправна")
    elif not (0.52 <= b.mean() <= 0.85):
        print(f"  КОНТРОЛЬ БЕЗ ВХОДА {b.mean():.3f} вне промежутка 0.52-0.85 "
              "-- вердикт не выносится")
    elif v31.p_ge(k1, n) < 0.05 and v31.p_ge(k2, n) < 0.05:
        print("  РАЗМЕТКА И ОБУЧЕНИЕ У МИРА ДЕРЖАТСЯ ВМЕСТЕ")
    elif v31.p_ge(k1, n) < 0.05:
        print("  помогает активность, а не строение входа")
    else:
        print("  при включённой границе прибавка читаемости не держится")


if __name__ == "__main__":
    main()

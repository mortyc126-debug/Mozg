"""v0.51: предсказательная добавка, СОХРАНЯЮЩАЯ сумму входа.

ОТКУДА. v0.50 измерил посвязную добавку и нашёл у неё ВЫРОЖДЕННОЕ
решение: правило гонит syn к pred, а pred есть медленное среднее самого
syn, поэтому syn = 0 удовлетворяет ему идеально. Тишина предсказуема, и
ничто её не запрещало -- часть тканей в неё и сваливалась. Видно было по
расхождению среднего и знака: число спайков в среднем упало вдвое, а по
знаку меньше лишь у 33 сидов из 64.

ЧТО ИЗМЕНЕНО. После добавки восстанавливается СУММА входных весов узла.
Добавке разрешено менять, ОТКУДА приходит вход, и запрещено менять,
СКОЛЬКО его. Вырождение исчезает по построению: обнулить вход нельзя,
можно только перераспределить его между связями.

Это первый случай, когда правило проекта "значение имеет РИСУНОК, а не
ВЕЛИЧИНА" (v0.29, v0.41, v0.44, v0.49) применяется НАПЕРЁД -- к
устройству механизма, а не задним числом к объяснению неудачи.

Заодно разрешается столкновение двух прежних решений без отката ни
одного: молчащая подложка (v0.21) дала чистое чтение и сняла всякую цену
за молчание; сохранение суммы возвращает цену, не возвращая гомеостаз.

КАЛИБРОВКА подтвердила, что сделано именно это:

    сохранение | сила | вес сети | сдвиг весов | спайков | двиг.
    нет        |    0 |  14.9719 |      0.2807 |   440.1 |  57.3
    нет        | 1e-4 |  14.0571 |      0.9382 |   202.8 |  20.8
    да         | 1e-4 |  14.9775 |      0.6471 |   359.3 |  42.3

Без сохранения ткань съедает свой вход: суммарный вес падает на 6%,
активность вдвое. С сохранением вес держится до третьего знака,
активность почти цела, а сдвиг весов вдвое выше исходного -- пластичность
усилена, но сбежать в тишину ей больше некуда.

При большой силе (2e-3) немеют все ткани и с сохранением тоже:
перераспределение способно ослабить вход, даже не уменьшая суммы весов.
Поэтому взята рабочая точка 1e-4, где немых не прибавляется вовсе
(6 из 12 при силе 0 и 6 из 12 при 1e-4 -- это обычная доля бездействующих
тканей, найденная ещё в v0.48).

ХЕББОВСКАЯ ПЛАСТИЧНОСТЬ СОХРАНЕНА НЕТРОНУТОЙ (уточнение автора, §2b), и
скука читается описательно, а не как цена.
"""
import sys

import numpy as np

sys.path.insert(0, "code")
import v31_learned_readability as v31
import v37_self_built as v37
import v46_closed_loop as v46
import v47_loop_yoked as v47
from sim_core import simulate

N = v31.N
SEEDS = list(range(6301, 6381))
GAIN = 1e-4
MIN_EFFECT = 0.02

BASE = {k: v for k, v in v37.GROWN.items()
        if k not in ("div_rate", "coupling")}


def run(seed, gain):
    return simulate(seed=seed, stimulus=[v46.touch], stimulus_amp=0.4,
                    stimulus_period=0.2, duration=24.0, div_rate=0.10,
                    coupling=14.0, world=v46.live_world, world_init=0.5,
                    activity_memory=0.05, predict_per_link=gain,
                    predict_conserves_total=bool(gain), **BASE)


def main():
    keys = ("acc", "nul", "frac", "deg", "spread", "spikes", "motor")
    res = {c: {k: [] for k in keys} for c in ("БЕЗ ДОБАВКИ", "С ДОБАВКОЙ")}
    skipped = 0
    for seed in SEEDS:
        row = {}
        for name, g in (("БЕЗ ДОБАВКИ", 0.0), ("С ДОБАВКОЙ", GAIN)):
            net = run(seed, g)
            if not len(net["world"]):
                row[name] = None
                continue
            r = v47.read_net(net, seed)
            if r is None:
                row[name] = None
                continue
            u = net["world"][:, 1]
            row[name] = (r, float(np.std(u)), int(net["spikes"].sum()),
                         v46_motor(net))
        if any(v is None for v in row.values()):
            skipped += 1
            continue
        for name, ((f, ac, nl, deg), sp, sk, mo) in row.items():
            res[name]["frac"].append(f); res[name]["acc"].append(ac)
            res[name]["nul"].append(nl); res[name]["deg"].append(deg)
            res[name]["spread"].append(sp); res[name]["spikes"].append(sk)
            res[name]["motor"].append(mo)

    n = len(res["БЕЗ ДОБАВКИ"]["acc"])
    print(f"{len(SEEDS)} свежих сидов ({n} в счёт, {skipped} отброшено); "
          f"сила добавки {GAIN:g}\n")
    if n == 0:
        print("  мерить не на чем")
        return
    print(f"{'условие':<14} | {'соседей':>7} | {'разброс мира':>12} | "
          f"{'спайков':>8} | {'двиг.':>6} | {'отклик':>7} | {'точность':>8} | "
          f"{'перемеш.':>8}")
    for c in res:
        r = res[c]
        print(f"{c:<14} | {np.mean(r['deg']):7.2f} | {np.mean(r['spread']):12.4f} | "
              f"{np.mean(r['spikes']):8.1f} | {np.mean(r['motor']):6.1f} | "
              f"{np.mean(r['frac']):7.3f} | {np.mean(r['acc']):8.3f} | "
              f"{np.mean(r['nul']):8.3f}")

    A, B = res["БЕЗ ДОБАВКИ"], res["С ДОБАВКОЙ"]
    a = np.array(B["acc"]); b = np.array(A["acc"])
    nul_all = np.mean(A["nul"] + B["nul"])
    mism = abs(np.mean(B["deg"]) - np.mean(A["deg"])) / np.mean(A["deg"])
    k = int((a > b).sum()); p = v31.p_ge(k, n); d = (a - b).mean() * 100
    print(f"\nпроверки: плотность {mism * 100:.2f}%; "
          f"перемешанные метки {nul_all:.3f}")
    print(f"\nПОЛЬЗА ({n} сидов):")
    print(f"  с добавкой выше: {k} из {n}, p = {p:.4f} "
          f"({b.mean():.3f} -> {a.mean():.3f}, {d:+.2f} п.п.)")
    sign_ok = (d > 0) == (k > n / 2)
    if mism > 0.10 or not (0.42 <= nul_all <= 0.58):
        print("  проверки не пройдены -- вердикт не выносится")
    elif not (0.52 <= b.mean() <= 0.85):
        print(f"  контроль {b.mean():.3f} вне 0.52-0.85 -- вердикта нет")
    elif not sign_ok:
        print("  среднее и знак расходятся -- вердикт не выносится")
    elif abs(d) < MIN_EFFECT * 100:
        print(f"  разница меньше {MIN_EFFECT * 100:.0f} п.п. -- "
              "добавка с сохранением суммы на читаемость НЕ ВЛИЯЕТ")
    elif p < 0.05:
        print("  ПРИЗНАК УСПЕХА С СОХРАНЕНИЕМ СУММЫ ПОМОГАЕТ")
    else:
        print("  величина выше порога, но знак неустойчив")

    sa = np.array(A["spread"]); sb = np.array(B["spread"])
    ka = np.array(A["spikes"], float); kb = np.array(B["spikes"], float)
    k1 = int((sb < sa).sum()); k2 = int((kb < ka).sum())
    p1, p2 = v31.p_ge(k1, n), v31.p_ge(k2, n)
    print(f"\nГРАНИЦА -- ищет ли ткань скуку (предсказано в §2b до запуска):")
    print(f"  разброс мира МЕНЬШЕ с добавкой: {k1} из {n}, p = {p1:.4f} "
          f"({sa.mean():.4f} -> {sb.mean():.4f})")
    print(f"  спайков МЕНЬШЕ с добавкой:      {k2} из {n}, p = {p2:.4f} "
          f"({ka.mean():.1f} -> {kb.mean():.1f})")
    if p1 < 0.05 and p2 < 0.05:
        print("  ТКАНЬ ИЩЕТ СКУКУ -- предсказание §2b подтвердилось (описательно,\n  не как изъян: см. уточнение автора)")
    elif p1 < 0.05 or p2 < 0.05:
        print("  падает только одно из двух -- скука НЕ засчитывается")
    else:
        print("  скуки не обнаружено: предсказание §2b не подтвердилось")


def v46_motor(net):
    pos = net["positions"]
    alive = np.isfinite(net["birth"])
    far = alive & (pos[:, 0] > 0.60)
    return int(net["spikes"][:, far & (pos[:, 1] > 0.65)].sum()
               + net["spikes"][:, far & (pos[:, 1] < 0.35)].sum())


if __name__ == "__main__":
    main()

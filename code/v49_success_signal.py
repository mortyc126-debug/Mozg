"""v0.49: даёт ли что-нибудь ПРИЗНАК УСПЕХА -- и ищет ли ткань скуку.

ОТКУДА. v0.48: петля замкнута, работает механически, и НИЧЕГО НЕ ДАЁТ.
Причина названа устройством: пластичность ничем не направлена, она
усиливает всякое совпадение одинаково, и ткани нечем отличить удачное
движение от неудачного.

ПРИНЦИП, принятый в PRINCIPLES §2b: успех узла -- ПРЕДСКАЗУЕМОСТЬ его
собственного входа. Скорость пластичности умножается на
    1 + сила * (обычное удивление - нынешнее) / обычное удивление
с обрезкой в [0, 2]. Закрепляется то, после чего вход стал ОЖИДАЕМЕЕ
обычного; распускается то, после чего он стал неожиданнее.

Признак ЛОКАЛЕН: узел считает его сам, из своего же входа, без судьи,
знающего правильный ответ. Это выбор цифрового устройства вместо
биологического -- живой ткани такой сигнал доставляют отдельные системы
подкрепления, цифровой он даётся даром.

ЗДЕСЬ МЕРЯЕТСЯ ДВОЕ, и второе не менее важно первого.

  1. ПОЛЬЗА. Читается ли ткань с признаком успеха лучше, чем без него,
     при прочем равном.
  2. ГРАНИЦА, ОБЪЯВЛЕННАЯ ВМЕСТЕ С ПРИНЦИПОМ. §2b прямо предсказывает:
     ткань будет стремиться к предвидимому миру, то есть ИСКАТЬ СКУКУ --
     гасить непонятное, держаться освоенного. Признаки скуки:
     уменьшение разброса состояния мира и уменьшение собственной
     активности. Это предсказание объявлено ДО измерения, и если оно
     подтвердится, его надо записать как цену принципа, а не как изъян.

Калибровка показала, что ручка действует, но слабо: вес сети 14.3217 без
признака против 14.3243 с ним (0.02%), двигательных разрядов 37.5 против
36.5. Мало -- ещё не значит ничего: в v0.31 разница весов в 0.05% дала
+7.65 п.п. чтения. Поэтому мерится, а не подкручивается.

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * ПОЛЬЗА: порог 2 п.п. (урок №42), доля сидов с биномиальным p, среднее
    и знак читаются вместе -- при расхождении вердикт не выносится
    (урок из v0.47);
  * оба края: контроль вне 0.52-0.85 -- вердикта нет (№39);
  * перемешанные метки 0.42-0.58 (№40);
  * СКУКА засчитывается, если И разброс мира, И собственная активность
    падают, каждое с биномиальным p < 0.05. Одного из двух мало: падение
    только активности может быть простым ослаблением пластичности;
  * сиды свежие (5901-5980).
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
SEEDS = list(range(5901, 5981))
GAIN = 1.0
MIN_EFFECT = 0.02

BASE = {k: v for k, v in v37.GROWN.items()
        if k not in ("div_rate", "coupling")}


def run(seed, gain):
    return simulate(seed=seed, stimulus=[v46.touch], stimulus_amp=0.4,
                    stimulus_period=0.2, duration=24.0, div_rate=0.10,
                    coupling=14.0, world=v46.live_world, world_init=0.5,
                    activity_memory=0.05, success_from_prediction=gain, **BASE)


def main():
    keys = ("acc", "nul", "frac", "deg", "spread", "spikes", "motor")
    res = {c: {k: [] for k in keys} for c in ("БЕЗ ПРИЗНАКА", "С ПРИЗНАКОМ")}
    skipped = 0
    for seed in SEEDS:
        row = {}
        for name, g in (("БЕЗ ПРИЗНАКА", 0.0), ("С ПРИЗНАКОМ", GAIN)):
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

    n = len(res["БЕЗ ПРИЗНАКА"]["acc"])
    print(f"{len(SEEDS)} свежих сидов ({n} в счёт, {skipped} отброшено); "
          f"сила признака {GAIN:g}\n")
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

    A, B = res["БЕЗ ПРИЗНАКА"], res["С ПРИЗНАКОМ"]
    a = np.array(B["acc"]); b = np.array(A["acc"])
    nul_all = np.mean(A["nul"] + B["nul"])
    mism = abs(np.mean(B["deg"]) - np.mean(A["deg"])) / np.mean(A["deg"])
    k = int((a > b).sum()); p = v31.p_ge(k, n); d = (a - b).mean() * 100
    print(f"\nпроверки: плотность {mism * 100:.2f}%; "
          f"перемешанные метки {nul_all:.3f}")
    print(f"\nПОЛЬЗА ({n} сидов):")
    print(f"  с признаком выше: {k} из {n}, p = {p:.4f} "
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
              "признак успеха на читаемость НЕ ВЛИЯЕТ")
    elif p < 0.05:
        print("  ПРИЗНАК УСПЕХА ПОМОГАЕТ")
    else:
        print("  величина выше порога, но знак неустойчив")

    sa = np.array(A["spread"]); sb = np.array(B["spread"])
    ka = np.array(A["spikes"], float); kb = np.array(B["spikes"], float)
    k1 = int((sb < sa).sum()); k2 = int((kb < ka).sum())
    p1, p2 = v31.p_ge(k1, n), v31.p_ge(k2, n)
    print(f"\nГРАНИЦА -- ищет ли ткань скуку (предсказано в §2b до запуска):")
    print(f"  разброс мира МЕНЬШЕ с признаком: {k1} из {n}, p = {p1:.4f} "
          f"({sa.mean():.4f} -> {sb.mean():.4f})")
    print(f"  спайков МЕНЬШЕ с признаком:      {k2} из {n}, p = {p2:.4f} "
          f"({ka.mean():.1f} -> {kb.mean():.1f})")
    if p1 < 0.05 and p2 < 0.05:
        print("  ТКАНЬ ИЩЕТ СКУКУ -- цена принципа подтвердилась")
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

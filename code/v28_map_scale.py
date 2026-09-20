"""v0.28: у разметки есть МАСШТАБ, и он задаётся дальностью соперничества.

ОТКУДА ВОПРОС. v0.27 остановился на том, что вопрос "имеет ли значение
расположение" пока не задать: в занятом режиме отклик не локален, а в
молчащей подложке разметка сходилась позже, чем вырастали связи. Фазировка
(wire_from + diff_by_distance + state_jitter) это чинит. Но прежде чем
ставить задачу на расположение, надо проверить то, что четыре версии
подряд считались само собой: что разметка вообще ЛЕЖИТ В ПРОСТРАНСТВЕ.

Проверка была не сделана ни разу. v0.18 нашёл, что правило близости
режет связи между непохожими узлами; v0.24 -- что это ухудшает след;
v0.25 -- что области не становятся независимыми. Во всех трёх "граница"
считалась перегородкой В ПРОСТРАНСТВЕ, но мерилось только то, что она
режет связи ПО МЕТКЕ. А это разные вещи: метки могут быть рассыпаны
вперемешку, и тогда режется не место, а состав.

МЕРА. Согласие меток по расстоянию:
    a(d) = доля пар узлов на расстоянии d, у которых метка одинакова.
Мера читается по ФОРМЕ, а не по одному числу:
  * рассыпанная вперемешку метка   -- a(d) ~ 0.5 на всех расстояниях;
  * один сплошной ком              -- a(d) ~ 1 на всех расстояниях;
  * рисунок с масштабом            -- a(d) > 0.5 вблизи и a(d) < 0.5 на
    расстоянии порядка полуволны. Провал НИЖЕ случая -- то, чего не даёт
    ни ком, ни рассыпь, и именно он говорит, что рисунок периодический.
Масштаб = середина пояса, где a(d) минимальна.

ЧТО РАЗВЕДЕНО. Добавлен diff_radius: дальность соперничества отдельно от
contact_radius. Пока это была одна ручка, укрупнить рисунок можно было
только сгустив сеть. В ткани обе дальности задаёт одна диффузия; в
цифровой системе это два числа -- случай, где отход от биологического
устройства выигрыш, а не потеря (PRINCIPLES §3).

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска на ЭТИХ сидах:
  * разведочный прогон на сидах 1201-1210 уже был и показал провал ниже
    0.5; поэтому здесь берутся ДРУГИЕ сиды (1401-1420), и правило
    объявляется как предсказание, а не как пересказ увиденного;
  * рисунок засчитывается, только если ВСЕ три выполнены:
      (1) доля определившихся (|s-0.5| > 0.45) выше 0.80 -- иначе
          разметка не сошлась и мерить нечего;
      (2) баланс: доля s>0.5 в пределах 0.5 +- 0.15 -- иначе вырождение
          в один ком;
      (3) минимум a(d) НИЖЕ нижней границы перестановочного разброса.
  * ПРЕДСКАЗАНИЕ: масштаб (пояс минимума) растёт с diff_radius, а при
    слишком большой дальности рисунок вырождается в ком и пункт (1) или
    (2) отваливается. Если масштаб НЕ растёт -- предсказание не сбылось,
    и говорить о масштабе нельзя;
  * СТАРЫЕ ПРОТОКОЛЫ прогоняются той же мерой. Если у них рисунка нет,
    это не повод переписывать их числа: числа верны, неверно НАЗВАНИЕ
    "граница" -- она резала состав, а не место.

ПУСТОЙ ОТСЧЁТ. Перестановка: метки переставляются между позициями 200
раз, a(d) считается заново. Это ровно тот отсчёт, который отличает
"рисунок" от "меток поровну".
"""
import sys

import numpy as np

sys.path.insert(0, "code")
from sim_core import simulate

SEEDS = list(range(1401, 1421))
LAGS = ((0.00, 0.10), (0.10, 0.20), (0.20, 0.30), (0.30, 0.45), (0.45, 1.50))
MIDS = [0.05, 0.15, 0.25, 0.375, 0.60]
NPERM = 200
RADII = (0.15, 0.25, 0.35, 0.45, 0.55, 0.70, 0.90)

PHASED = dict(drive=0.8, homeostasis=False, gradual_growth=False,
              differentiation=0.5, coupling=10.0, state_affinity=1.0,
              contact_radius=0.25, wire_from=6.0, diff_by_distance=True,
              state_jitter=0.02)


def agreement(side, D):
    """a(d) по поясам расстояний."""
    n = len(side)
    same = side[:, None] == side[None, :]
    off = ~np.eye(n, dtype=bool)
    out = []
    for lo, hi in LAGS:
        m = off & (D >= lo) & (D < hi)
        out.append(float(same[m].mean()) if m.any() else np.nan)
    return np.array(out)


def perm_band(side, D, seed):
    """Нижняя граница разброса a(d) при переставленных метках."""
    rng = np.random.default_rng(seed)
    rows = [agreement(rng.permutation(side), D) for _ in range(NPERM)]
    return np.percentile(np.array(rows), 2.5, axis=0)


def one(kw, seed):
    r = simulate(seed=seed, **kw)
    s, pos = r["state_s"], r["positions"]
    D = np.linalg.norm(pos[:, None, :] - pos[None, :, :], axis=2)
    side = s > 0.5
    return (agreement(side, D), perm_band(side, D, seed + 900),
            float(np.mean(np.abs(s - 0.5) > 0.45)), float(side.mean()),
            float((r["contacts"] | r["contacts"].T).sum(axis=1).mean()))


def report(name, kw):
    a, lo, det, bal, deg = (np.array(x) for x in
                            zip(*(one(kw, s) for s in SEEDS)))
    a_m, lo_m = a.mean(axis=0), lo.mean(axis=0)
    k = int(np.nanargmin(a_m))
    ok_det, ok_bal = det.mean() > 0.80, abs(bal.mean() - 0.5) <= 0.15
    ok_dip = a_m[k] < lo_m[k]
    print(f"{name:<34} |" + "".join(f"{v:7.3f}" for v in a_m) +
          f" | опр. {det.mean():.2f} бал. {bal.mean():.2f} "
          f"сос. {deg.mean():5.2f} | "
          f"масштаб {MIDS[k]:.3f} {'РИСУНОК' if (ok_det and ok_bal and ok_dip) else '--'}"
          f"{'' if ok_det else ' [не сошлась]'}"
          f"{'' if ok_bal else ' [ком]'}"
          f"{'' if ok_dip else ' [нет провала]'}")
    return MIDS[k], (ok_det and ok_bal and ok_dip)


def main():
    print(f"{len(SEEDS)} сидов, перестановок {NPERM}; "
          f"согласие меток по поясам расстояний, случай = 0.5\n")
    head = "".join(f"{a:.2f}+".rjust(7) for a, _ in LAGS)
    print(f"{'протокол':<34} |{head} | проверки{'':<24} | вывод")

    print("\nСТАРЫЕ ПРОТОКОЛЫ (то, что версии 0.18-0.25 звали границей):")
    report("занятый, без фазировки", dict(
        differentiation=0.5, state_affinity=1.0, contact_radius=0.285))
    report("молчащий, без фазировки", dict(
        drive=0.8, homeostasis=False, gradual_growth=False,
        differentiation=0.5, coupling=10.0, state_affinity=1.0,
        contact_radius=0.285))

    print("\nФАЗИРОВАННЫЙ, дальность соперничества разведена с контактом:")
    scales, flags = [], []
    for dr in RADII:
        sc, ok = report(f"diff_radius {dr:.2f}", dict(diff_radius=dr, **PHASED))
        scales.append(sc); flags.append(ok)

    good = [(r, s) for r, s, f in zip(RADII, scales, flags) if f]
    print("\nЧТЕНИЕ:")
    if len(good) < 2:
        print("  рисунок засчитан меньше чем на двух дальностях -- "
              "о масштабе говорить нельзя")
        return
    rr = np.array([g[0] for g in good]); ss = np.array([g[1] for g in good])
    grows = bool(np.all(np.diff(ss) >= 0)) and ss[-1] > ss[0]
    print(f"  рисунок засчитан при дальностях: "
          f"{', '.join(f'{r:.2f}' for r in rr)}")
    print(f"  масштаб:                         "
          f"{', '.join(f'{s:.3f}' for s in ss)}")
    if grows:
        print("  МАСШТАБ РАСТЁТ С ДАЛЬНОСТЬЮ: предсказание сбылось, "
              "у разметки есть масштаб и он управляем")
    else:
        print("  масштаб не растёт монотонно -- предсказание не сбылось")
    dead = [r for r, f in zip(RADII, flags) if not f and r > rr.max()]
    if dead:
        print(f"  при дальности {dead[0]:.2f} и выше рисунок вырождается")


if __name__ == "__main__":
    main()

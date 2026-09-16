"""v0.41: выигрыш выросшей ткани -- от ИСТОРИИ роста или от ГЕОМЕТРИИ,
которую он оставляет.

ОТКУДА. v0.39: выросшее расположение читается лучше брошенного жребием
(+3.84 п.п., 57 из 91, p = 0.0103) при выравненных числе элементов,
площади, плотности и расписании рождений. Но выросшая ткань отличается от
брошенной двумя способами сразу -- РОВНОСТЬЮ укладки и СВЯЗНОСТЬЮ на
протяжении развития, -- и какой из них работает, было неизвестно.

v0.40 пытался развести их третьей тканью, уложенной ровно, но без истории.
Вердикт не вынесен: такая укладка не выравнивается по плотности (11.39
соседей против 13.07, расхождение 14.7% при пороге 10%). Зазор запрещает
сгустки, а сгустки поднимают число соседей в радиусе связи.

ЗДЕСЬ КОНТРОЛЬ ПОЛУЧЕН ПЕРЕМЕШИВАНИЕМ, А НЕ ПОСТРОЕНИЕМ. Чтобы отнять у
ткани историю роста, не нужно строить другое расположение -- достаточно
взять ТО ЖЕ САМОЕ и перемешать ПОРЯДОК РОЖДЕНИЯ:

  ВЫРОСШАЯ   -- координаты выросли делением, порядок рождения тот, каким
                они возникали: дочерний элемент всегда появляется рядом с
                уже существующим родителем, и ткань связна всё развитие;
  ПЕРЕМЕШАННОЕ РОЖДЕНИЕ -- ТЕ ЖЕ координаты, те же времена рождения, но
                розданные узлам вперемешку: ткань собирается из
                разрозненных кусков и срастается лишь к концу;
  КОМКОВАТАЯ -- координаты брошены жребием, времена рождения выросшей.

Совпадает у первых двух ВСЁ: координаты, число элементов, плотность
связей, ближайший сосед, набор времён рождения, поток случайных чисел.
Отличается ровно одно -- кто родился когда.

  ВЫРОСШАЯ против ПЕРЕМЕШАННОГО   -- чистое выделение ИСТОРИИ;
  ПЕРЕМЕШАННОЕ против КОМКОВАТОЙ  -- чистое выделение ГЕОМЕТРИИ
                                     (у обеих истории нет).
Два сравнения разбирают выигрыш v0.39 на две части без единого
невыравненного числа.

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * порог тот же: разница меньше 2 п.п. не читается (шум меры, урок №42);
  * исполняемые проверки: плотность между условиями не больше 10%, набор
    времён рождения совпадает, ближайший сосед у выросшей и перемешанной
    совпадает ТОЧНО (координаты те же), перемешанные метки 0.42-0.58;
  * сначала проверяется, воспроизводится ли v0.39 (выросшая против
    комковатой). Если нет -- читать нечего;
  * дальше обе части складываются: если выигрыш v0.39 раскладывается на
    историю и геометрию, их сумма должна быть близка к целому. Это
    сообщается как сходимость разложения, а не как вердикт;
  * сиды свежие (3701-3800).
"""
import sys

import numpy as np

sys.path.insert(0, "code")
import v31_learned_readability as v31
import v37_self_built as v37
from sim_core import simulate

N = v31.N
SEEDS = list(range(3701, 3801))
MIN_EFFECT = 0.02


def nn_mean(pos):
    d = np.linalg.norm(pos[:, None, :] - pos[None, :, :], axis=2)
    np.fill_diagonal(d, np.inf)
    return float(d.min(axis=1).mean())


def main():
    names = ("ВЫРОСШАЯ", "ПЕРЕМЕШАННОЕ РОЖДЕНИЕ", "КОМКОВАТАЯ")
    keys = ("acc", "nul", "frac", "deg", "birth", "nn")
    res = {c: {k: [] for k in keys} for c in names}
    skipped = 0
    for seed in SEEDS:
        g = simulate(seed=seed, **v37.GROWN)
        if g["born"] < N:
            skipped += 1
            continue
        pos = g["positions"][:N]
        base = {k: v for k, v in v37.GROWN.items()
                if k not in ("growth_by_division", "div_rate", "div_crowd")}
        rng = np.random.default_rng(seed + 4242)
        shuffled = rng.permutation(g["birth"])
        nets = {
            "ВЫРОСШАЯ": g,
            "ПЕРЕМЕШАННОЕ РОЖДЕНИЕ": simulate(
                seed=seed, positions=pos, birth_times=shuffled, **base),
            "КОМКОВАТАЯ": simulate(
                seed=seed, positions=v37.scattered_like(pos, N, seed),
                birth_times=g["birth"], **base),
        }
        row = {}
        for name, net in nets.items():
            p1, p2, surf = v31.interleaved(net["positions"])
            read = np.setdiff1d(np.arange(N), surf)
            C = net["contacts"] | net["contacts"].T
            f, a, nl = v31.measure(net, p1, p2, read, seed + 77)
            row[name] = (f, a, nl, float(C.sum(axis=1).mean()),
                         float(net["birth"].mean()),
                         nn_mean(net["positions"]))
        if any(v[1] is None for v in row.values()):
            skipped += 1
            continue
        for name, (f, a, nl, deg, b, d) in row.items():
            res[name]["frac"].append(f); res[name]["acc"].append(a)
            res[name]["nul"].append(nl); res[name]["deg"].append(deg)
            res[name]["birth"].append(b); res[name]["nn"].append(d)

    n = len(res["ВЫРОСШАЯ"]["acc"])
    print(f"{len(SEEDS)} свежих сидов ({n} в счёт, {skipped} отброшено)\n")
    print(f"{'ткань':<22} | {'соседей':>7} | {'бл. сосед':>9} | "
          f"{'рожд., с':>8} | {'отклик':>7} | {'точность':>8} | {'перемеш.':>8}")
    for c in names:
        print(f"{c:<22} | {np.mean(res[c]['deg']):7.2f} | "
              f"{np.mean(res[c]['nn']):9.4f} | {np.mean(res[c]['birth']):8.2f} | "
              f"{np.mean(res[c]['frac']):7.3f} | {np.mean(res[c]['acc']):8.3f} | "
              f"{np.mean(res[c]['nul']):8.3f}")
    if n == 0:
        print("\n  мерить не на чем")
        return

    acc = {c: np.array(res[c]["acc"]) for c in names}
    degs = [np.mean(res[c]["deg"]) for c in names]
    mism = (max(degs) - min(degs)) / min(degs)
    births = [np.mean(res[c]["birth"]) for c in names]
    nnd = abs(np.mean(res["ВЫРОСШАЯ"]["nn"])
              - np.mean(res["ПЕРЕМЕШАННОЕ РОЖДЕНИЕ"]["nn"]))
    nul_all = np.mean([x for c in names for x in res[c]["nul"]])
    print(f"\nпроверки: плотность {mism * 100:.2f}% (порог 10%); "
          f"рождение {min(births):.2f}-{max(births):.2f} с; "
          f"ближайший сосед выросшая/перемешанная различается на {nnd:.2e}; "
          f"перемешанные метки {nul_all:.3f}")
    ok = (mism <= 0.10 and (max(births) - min(births)) <= 0.01
          and nnd < 1e-9 and 0.42 <= nul_all <= 0.58)

    def pair(a, b):
        x, y = acc[a], acc[b]
        k = int((x > y).sum())
        return k, v31.p_ge(k, n), (x - y).mean() * 100

    print(f"\nЧТЕНИЕ ({n} сидов):")
    parts = {}
    for a, b, tag in (
            ("ВЫРОСШАЯ", "КОМКОВАТАЯ", "целое (повтор v0.39)"),
            ("ВЫРОСШАЯ", "ПЕРЕМЕШАННОЕ РОЖДЕНИЕ", "ИСТОРИЯ"),
            ("ПЕРЕМЕШАННОЕ РОЖДЕНИЕ", "КОМКОВАТАЯ", "ГЕОМЕТРИЯ")):
        k, p, d = pair(a, b)
        parts[tag] = (k, p, d)
        print(f"  {tag:<21}: {k} из {n}, p = {p:.4f}, {d:+.2f} п.п.")

    if not ok:
        print("\n  ПРОВЕРКИ НЕ ПРОЙДЕНЫ -- вердикт не выносится")
        return
    whole = parts["целое (повтор v0.39)"]
    if not (whole[2] >= MIN_EFFECT * 100 and whole[1] < 0.05):
        print("\n  v0.39 на свежих сидах не воспроизвёлся -- читать нечего")
        return
    hist, geom = parts["ИСТОРИЯ"], parts["ГЕОМЕТРИЯ"]
    s = hist[2] + geom[2]
    print(f"\n  сходимость разложения: {hist[2]:+.2f} + {geom[2]:+.2f} = "
          f"{s:+.2f} против целого {whole[2]:+.2f} п.п.")
    hw = hist[2] >= MIN_EFFECT * 100 and hist[1] < 0.05
    gw = geom[2] >= MIN_EFFECT * 100 and geom[1] < 0.05
    if hw and gw:
        print("  РАБОТАЮТ ОБЕ: и история роста, и оставленная им геометрия")
    elif hw:
        print("  РАБОТАЕТ ИСТОРИЯ РОСТА: той же геометрии без неё мало")
    elif gw:
        print("  РАБОТАЕТ ГЕОМЕТРИЯ: рост важен как СПОСОБ её получить, "
              "а не сам по себе")
    else:
        print("  ни одна часть порога не взяла, хотя целое взяло -- "
              "разложение не читается, нужна большая точность")


if __name__ == "__main__":
    main()

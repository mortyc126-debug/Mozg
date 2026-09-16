"""v0.40: что именно в выросшем расположении работает -- РОВНОСТЬ укладки
или ИСТОРИЯ роста.

ОТКУДА. v0.39 нашёл первое за весь проект преимущество расположения самого
по себе: выросшая ткань читается на +3.84 п.п. лучше брошенной жребием
при выравненных числе элементов, площади, плотности связей и расписании
рождений (57 из 91, p = 0.0103). Там же было записано, чего этот
результат НЕ говорит: выросшая ткань отличается от брошенной жребием как
минимум двумя называемыми способами.

  РОВНОСТЬ. Деление отводит дочерний элемент на заданный шаг и отвергает
    слишком тесное место, поэтому ткань разложена почти равномерно
    (ближайший сосед 0.0931 +- 0.0098), а жребий даёт сгустки и пустоты
    (0.0582 +- 0.0295).
  ИСТОРИЯ. Дочерний элемент всегда садится рядом с родителем, поэтому
    выросшая ткань связна НА ПРОТЯЖЕНИИ ВСЕГО развития. Рассыпанная
    становится связной только к концу: узел, рождённый в середине
    прогона, может оказаться вдали от всех уже рождённых.

ТРЕТЬЕ УСЛОВИЕ РАЗВОДИТ ИХ. Добавлена РОВНАЯ ткань: тот же круг, то же
число элементов, то же расписание рождений, но расположение брошено
жребием С ОБЯЗАТЕЛЬНЫМ ЗАЗОРОМ -- то есть ровное, но БЕЗ истории роста.
Зазор подобран так, чтобы совпала та величина, через которую ровность
входит в модель (урок №30): ближайший сосед. При зазоре 0.084 выходит
0.0945 +- 0.0090 против 0.0931 +- 0.0098 у выросшей.

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * ГЛАВНОЕ сравнение -- ВЫРОСШАЯ против РОВНОЙ:
      выше -- работает ИСТОРИЯ РОСТА, и тогда у роста есть содержание,
        которого нет ни у какой мгновенной укладки;
      не выше -- работает РОВНОСТЬ, и тогда результат v0.39 говорит о
        геометрии, а не о развитии. Это будет означать, что рост важен
        как СПОСОБ получить ровную укладку, а не сам по себе;
  * справочно повторяется сравнение v0.39 (выросшая против комковатой) --
    если оно не воспроизведётся на свежих сидах, читать нечего вовсе;
  * отдельно РОВНАЯ против КОМКОВАТОЙ -- прямая проверка ровности;
  * порог тот же: разница меньше 2 п.п. не читается (шум меры, урок №42);
  * исполняемые проверки: плотность 10%, расписание рождений совпадает,
    ближайший сосед у выросшей и ровной расходится не больше 5%,
    перемешанные метки 0.42-0.58;
  * сиды свежие (3501-3600).
"""
import sys

import numpy as np

sys.path.insert(0, "code")
import v31_learned_readability as v31
import v37_self_built as v37
from sim_core import simulate

N = v31.N
SEEDS = list(range(3501, 3601))
GAP = 0.084
MIN_EFFECT = 0.02


def even_like(pos, n, seed, gap=GAP):
    """Тот же круг, но с обязательным зазором: ровно, без истории роста."""
    c = pos.mean(axis=0)
    rad = float(np.max(np.linalg.norm(pos - c, axis=1)))
    rng = np.random.default_rng(seed + 909)
    out = np.empty((n, 2))
    k = tries = 0
    while k < n and tries < 400000:
        tries += 1
        p = c + rad * (2.0 * rng.random(2) - 1.0)
        if np.linalg.norm(p - c) > rad or np.any((p < 0) | (p > 1)):
            continue
        if k and np.min(np.linalg.norm(out[:k] - p, axis=1)) < gap:
            continue
        out[k] = p
        k += 1
    return out if k == n else None


def nn_mean(pos):
    d = np.linalg.norm(pos[:, None, :] - pos[None, :, :], axis=2)
    np.fill_diagonal(d, np.inf)
    return float(d.min(axis=1).mean())


def main():
    names = ("ВЫРОСШАЯ", "РОВНАЯ", "КОМКОВАТАЯ")
    keys = ("acc", "nul", "frac", "deg", "birth", "nn")
    res = {c: {k: [] for k in keys} for c in names}
    skipped = 0
    for seed in SEEDS:
        g = simulate(seed=seed, **v37.GROWN)
        if g["born"] < N:
            skipped += 1
            continue
        pos = g["positions"][:N]
        ev = even_like(pos, N, seed)
        if ev is None:
            skipped += 1
            continue
        base = {k: v for k, v in v37.GROWN.items()
                if k not in ("growth_by_division", "div_rate", "div_crowd")}
        nets = {
            "ВЫРОСШАЯ": g,
            "РОВНАЯ": simulate(seed=seed, positions=ev,
                               birth_times=g["birth"], **base),
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
    print(f"{'ткань':<12} | {'соседей':>7} | {'бл. сосед':>9} | {'рожд., с':>8} | "
          f"{'отклик':>7} | {'точность':>8} | {'перемеш.':>8}")
    for c in names:
        print(f"{c:<12} | {np.mean(res[c]['deg']):7.2f} | "
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
    nnm = abs(np.mean(res["ВЫРОСШАЯ"]["nn"]) - np.mean(res["РОВНАЯ"]["nn"])) \
        / np.mean(res["ВЫРОСШАЯ"]["nn"])
    nul_all = np.mean([x for c in names for x in res[c]["nul"]])
    print(f"\nпроверки: плотность {mism * 100:.2f}% (порог 10%); "
          f"рождение {min(births):.2f}-{max(births):.2f} с; "
          f"ближайший сосед выросшая/ровная расходится на {nnm * 100:.2f}% "
          f"(порог 5%); перемешанные метки {nul_all:.3f}")
    ok = (mism <= 0.10 and (max(births) - min(births)) <= 0.01
          and nnm <= 0.05 and 0.42 <= nul_all <= 0.58)

    def pair(a, b):
        x, y = acc[a], acc[b]
        k = int((x > y).sum())
        return k, v31.p_ge(k, n), (x - y).mean() * 100, y.mean(), x.mean()

    print(f"\nЧТЕНИЕ ({n} сидов):")
    for a, b, tag in (("ВЫРОСШАЯ", "РОВНАЯ", "ГЛАВНОЕ"),
                      ("ВЫРОСШАЯ", "КОМКОВАТАЯ", "повтор v0.39"),
                      ("РОВНАЯ", "КОМКОВАТАЯ", "ровность сама")):
        k, p, d, lo, hi = pair(a, b)
        print(f"  {tag:<13} {a} выше {b}: {k} из {n}, p = {p:.4f} "
              f"({lo:.3f} -> {hi:.3f}, {d:+.2f} п.п.)")

    if not ok:
        print("\n  ПРОВЕРКИ НЕ ПРОЙДЕНЫ -- вердикт не выносится")
        return
    k_rep, p_rep, d_rep, _, _ = pair("ВЫРОСШАЯ", "КОМКОВАТАЯ")
    if not (d_rep >= MIN_EFFECT * 100 and p_rep < 0.05):
        print("\n  результат v0.39 на свежих сидах не воспроизвёлся -- "
              "читать нечего")
        return
    k_m, p_m, d_m, _, _ = pair("ВЫРОСШАЯ", "РОВНАЯ")
    if d_m >= MIN_EFFECT * 100 and p_m < 0.05:
        print("\n  РАБОТАЕТ ИСТОРИЯ РОСТА: ровной укладки недостаточно")
    else:
        print("\n  РАБОТАЕТ РОВНОСТЬ УКЛАДКИ, а не история: рост важен как "
              "СПОСОБ получить ровную ткань, а не сам по себе")


if __name__ == "__main__":
    main()

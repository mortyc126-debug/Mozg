"""v0.42: даёт ли что-нибудь рост, СЛЕДУЮЩИЙ ЗА УПОТРЕБЛЕНИЕМ.

ОТКУДА. v0.41 показал, что история роста сама по себе пуста: выигрыш
выросшей ткани сводится целиком к ровности укладки (+4.48 п.п.), а
перемешивание порядка рождения не вредит (+1.18 п.п., p = 0.38). Но там
же записано исключение, которое проходит через весь проект: ОПЫТ
содержателен. Ткань, выросшая под строенным входом, читается лучше
(v0.31, v0.36).

Отсюда вопрос: а если рост будет идти ТУДА, ГДЕ ТКАНЬ ЗАДЕЙСТВОВАНА?
Тогда через процесс проходит содержание извне, и пустота истории из
v0.41 не обязана сохраниться.

ЧТО ЭТО ЗА МЕХАНИЗМ. `growth_from_activity` ускоряет деление тем узлам, у
которых выше память об активности. Измерено при калибровке: при силе 15 и
строенном входе узлов в области входа становится 38.1 против 34.4, а
средний x сдвигается с 0.485 до 0.459 -- ткань растёт в сторону мира.
Численность у всех одна (80), плотность связей расходится на 1.2%.

ДВА СПУТЫВАЮЩИХ ФАКТОРА СНЯТЫ ПО ПОСТРОЕНИЮ, а не выравниванием:
  * ОБРАЗ ВСЕГДА ИЗ 10 УЗЛОВ. Образ задан правилом по положению, и если
    брать всех, кто попал в область, то у ткани, выросшей в сторону
    входа, под током окажется больше узлов -- и отклик вырастет просто от
    силы воздействия. Поэтому из каждой полосы берутся РОВНО 10 самых
    крайних узлов;
  * ЧИТАЕТСЯ ВСЕГДА 40 УЗЛОВ -- сорок самых дальних от входа. Иначе у
    ткани, сдвинувшейся ко входу, читающая область оказалась бы меньше.

Различие сводится к одному: КАК РАЗЛОЖЕНЫ ОСТАЛЬНЫЕ узлы.

УСЛОВИЯ (2 x 2):
    рост РОВНЫЙ (growth_from_activity = 0) | рост ЗА УПОТРЕБЛЕНИЕМ (15)
  x вход СО СТРОЕНИЕМ | вход БЕЗ СТРОЕНИЯ

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * ГЛАВНОЕ: при строенном входе рост за употреблением против ровного.
    Выше на 2 п.п. и больше, с биномиальным p < 0.05 -- засчитывается;
  * ОБЯЗАТЕЛЬНЫЙ КОНТРОЛЬ: то же при БЕССТРОЕННОМ входе. Там ткань тоже
    растёт в сторону входа (активность та же), но расти ей НЕ ПОД ЧТО:
    повторяющегося образа нет. Если рост за употреблением помогает и
    там -- значит помогает не соответствие миру, а просто сгущение узлов
    у края, и так и записывается;
  * порог 2 п.п. -- шум меры (урок №42);
  * исполняемые проверки: плотность между условиями не больше 10%,
    численность одинакова, размер образа и читающей области одинаковы,
    перемешанные метки 0.42-0.58;
  * сиды свежие (4001-4100).
"""
import sys

import numpy as np

sys.path.insert(0, "code")
import v31_learned_readability as v31
import v37_self_built as v37
from sim_core import simulate

N = v31.N
SEEDS = list(range(4001, 4101))
XCUT, STRIPE, PAT, READ = 0.42, 0.05, 10, 40
GFA = 15.0
MIN_EFFECT = 0.02


def stripe_rule(parity):
    def f(pos):
        m = (pos[:, 0] < XCUT) & (np.floor(pos[:, 1] / STRIPE) % 2 == parity)
        idx = np.where(m)[0]
        if len(idx) <= PAT:
            return idx
        return idx[np.argsort(pos[idx, 0])[:PAT]]   # ровно PAT самых крайних
    return f


def unstructured_rule(rng):
    """Столько же узлов под током, но каждый раз другие."""
    def f(pos):
        idx = np.where(pos[:, 0] < XCUT)[0]
        if len(idx) <= PAT:
            return idx
        return rng.choice(idx, size=PAT, replace=False)
    return f


def main():
    conds = [("РОВНЫЙ", 0.0, "СО СТРОЕНИЕМ"), ("ЗА УПОТРЕБЛЕНИЕМ", GFA, "СО СТРОЕНИЕМ"),
             ("РОВНЫЙ", 0.0, "БЕЗ СТРОЕНИЯ"), ("ЗА УПОТРЕБЛЕНИЕМ", GFA, "БЕЗ СТРОЕНИЯ")]
    keys = ("acc", "nul", "frac", "deg", "npat", "born")
    res = {(g, v): {k: [] for k in keys} for g, _, v in conds}
    skipped = 0
    for seed in SEEDS:
        rng = np.random.default_rng(seed + 31)
        row = {}
        for gname, gfa, vname in conds:
            stim = ([stripe_rule(0), stripe_rule(1)] if vname == "СО СТРОЕНИЕМ"
                    else [unstructured_rule(rng) for _ in range(60)])
            net = simulate(seed=seed, stimulus=stim, stimulus_amp=v31.AMP,
                           stimulus_period=0.2, growth_from_activity=gfa,
                           activity_memory=0.05, **v37.GROWN)
            if net["born"] < N:
                row[(gname, vname)] = None
                continue
            pos = net["positions"]
            p1, p2 = stripe_rule(0)(pos), stripe_rule(1)(pos)
            read = np.argsort(pos[:, 0])[-READ:]
            C = net["contacts"] | net["contacts"].T
            f, a, nl = v31.measure(net, p1, p2, read, seed + 77)
            row[(gname, vname)] = (f, a, nl, float(C.sum(axis=1).mean()),
                                   0.5 * (len(p1) + len(p2)), int(net["born"]))
        if any(v is None or v[1] is None for v in row.values()):
            skipped += 1
            continue
        for key, (f, a, nl, deg, npat, born) in row.items():
            res[key]["frac"].append(f); res[key]["acc"].append(a)
            res[key]["nul"].append(nl); res[key]["deg"].append(deg)
            res[key]["npat"].append(npat); res[key]["born"].append(born)

    n = len(res[("РОВНЫЙ", "СО СТРОЕНИЕМ")]["acc"])
    print(f"{len(SEEDS)} свежих сидов ({n} в счёт, {skipped} отброшено); "
          f"образ {PAT} узлов, читается {READ} узлов\n")
    print(f"{'рост':<18} {'вход':<14} | {'выросло':>7} | {'соседей':>7} | "
          f"{'образ':>5} | {'отклик':>7} | {'точность':>8} | {'перемеш.':>8}")
    for g, _, v in conds:
        r = res[(g, v)]
        print(f"{g:<18} {v:<14} | {np.mean(r['born']):7.1f} | "
              f"{np.mean(r['deg']):7.2f} | {np.mean(r['npat']):5.1f} | "
              f"{np.mean(r['frac']):7.3f} | {np.mean(r['acc']):8.3f} | "
              f"{np.mean(r['nul']):8.3f}")
    if n == 0:
        print("\n  мерить не на чем")
        return

    degs = [np.mean(res[k]["deg"]) for k in res]
    mism = (max(degs) - min(degs)) / min(degs)
    pats = [np.mean(res[k]["npat"]) for k in res]
    nul_all = np.mean([x for k in res for x in res[k]["nul"]])
    print(f"\nпроверки: плотность {mism * 100:.2f}% (порог 10%); "
          f"образ {min(pats):.1f}-{max(pats):.1f} узлов; "
          f"перемешанные метки {nul_all:.3f}")
    ok = (mism <= 0.10 and (max(pats) - min(pats)) < 0.5
          and 0.42 <= nul_all <= 0.58)

    def pair(v):
        x = np.array(res[("ЗА УПОТРЕБЛЕНИЕМ", v)]["acc"])
        y = np.array(res[("РОВНЫЙ", v)]["acc"])
        k = int((x > y).sum())
        return k, v31.p_ge(k, n), (x - y).mean() * 100, y.mean(), x.mean()

    print(f"\nЧТЕНИЕ ({n} сидов):")
    out = {}
    for v, tag in (("СО СТРОЕНИЕМ", "ГЛАВНОЕ"), ("БЕЗ СТРОЕНИЯ", "КОНТРОЛЬ")):
        k, p, d, lo, hi = pair(v)
        out[v] = (k, p, d)
        print(f"  {tag:<9} {v}: за употреблением выше ровного "
              f"{k} из {n}, p = {p:.4f} ({lo:.3f} -> {hi:.3f}, {d:+.2f} п.п.)")
    if not ok:
        print("\n  ПРОВЕРКИ НЕ ПРОЙДЕНЫ -- вердикт не выносится")
        return
    ks, ps, dms = out["СО СТРОЕНИЕМ"]
    ku, pu, dmu = out["БЕЗ СТРОЕНИЯ"]
    win_s = dms >= MIN_EFFECT * 100 and ps < 0.05
    win_u = dmu >= MIN_EFFECT * 100 and pu < 0.05
    if win_s and not win_u:
        print("\n  РОСТ ЗА УПОТРЕБЛЕНИЕМ ПОМОГАЕТ, и только когда входу есть "
              "чему соответствовать")
    elif win_s and win_u:
        print("\n  помогает СГУЩЕНИЕ УЗЛОВ У КРАЯ, а не соответствие миру: "
              "выигрыш есть и там, где образа нет")
    else:
        print("\n  рост за употреблением читаемости не прибавляет")


if __name__ == "__main__":
    main()

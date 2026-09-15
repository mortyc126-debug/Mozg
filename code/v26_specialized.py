"""v0.26: ведут ли себя области ПО-РАЗНОМУ и полезно ли это.

Четыре измерения при рабочей силе связи (v0.22-v0.25) дали одно и то же:
работает только механизм, меняющий веса связей в зависимости от ЗАДАЧИ.
Выросшее расположение, состояния и границы функционально пусты. Причина
названа: организация, которую никто не ЧИТАЕТ, не имеет следствий -- у
каждого узла есть состояние, но ни одно правило поведения от состояния
не зависит, и узлы с разными состояниями ведут себя ОДИНАКОВО.

Здесь состояние впервые влияет на САМ УЗЕЛ: множитель адаптации
    adapt_scale = 1 + state_property * (2*s - 1)
Узел с s = 1 адаптируется сильнее -- отвечает на начало и замолкает;
с s = 0 слабее -- накапливает. Это пункт 6 карты по существу.

ЗАДАЧА выбрана так, чтобы разница поведения была ПОЛЕЗНА: различить
ОДИНОЧНЫЙ импульс и ПАЧКУ из трёх с шагом 20 мс, поданные в одно и то же
место. Для сильно адаптирующегося узла пачка почти неотличима от
одиночного (он замолкает после первого), для накапливающего -- отличима.
Ткань, где есть и те и другие, должна различать лучше однородной.

УСЛОВИЯ, 16 seed'ов, сила связи 4, дифференцировка 0.5 во всех:
  ОДИНАКОВЫЕ        -- state_property = 0, узлы неразличимы по поведению;
  СПЕЦИАЛИЗИРОВАННЫЕ -- state_property = 0.9, поведение следует состоянию;
  ПЕРЕМЕШАННЫЕ      -- те же значения множителя, но РАЗДАННЫЕ УЗЛАМ
                       СЛУЧАЙНО. Набор свойств тот же, соответствие
                       состоянию и месту разрушено.

Третье условие -- главный контроль. Без него нельзя отличить "полезна
специализация" от "полезна любая разнородность".

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * самопроверки (перемешанные метки, без передачи) около 0.5, иначе
    результат не читается;
  * средний множитель адаптации в условиях не должен расходиться больше
    чем на 10%, иначе сравнение мерит среднюю адаптацию, а не
    разнородность;
  * специализация засчитывается, если точность выше ОДИНАКОВЫХ не менее
    чем на 5/6 сидов И выше ПЕРЕМЕШАННЫХ не менее чем на 5/6;
  * если выше одинаковых, но не выше перемешанных -- полезна
    разнородность сама по себе, а не её расположение, и записывается
    именно это;
  * если не выше одинаковых -- специализация ничего не даёт.
"""
import sys
import numpy as np

sys.path.insert(0, "code")
from sim_core import simulate

N = 80
SEEDS = list(range(1101, 1141))   # 40; на 16 сидах интервал накрывал порог (урок №27)
ETA = 0.5
COUPLING = 4.0
PROP = 0.9
GROUP = 6
TRIALS = 40
DT = 0.001
STEPS = 900
PULSES = [500, 520, 540]
WIN = (560, 860)
BINS = 4


def pick_site(pos):
    return np.sort(np.argsort(np.linalg.norm(pos - np.array([0.5, 0.5]),
                                             axis=1))[:GROUP])


def run_probe(net, site, noise, n_pulses, transmission=True, ascale=None):
    st = net["state"]
    v = st["v"].copy(); syn = np.zeros(N)
    ad = st["adaptation"].copy(); rf = st["refractory"].copy()
    thr = st["threshold"].copy(); dr = st["drive"].copy()
    W = net["weights"]
    sc = st["adapt_scale"] if ascale is None else ascale
    fire_at = set(PULSES[:n_pulses])
    out = np.zeros((STEPS, N), dtype=bool)
    for t in range(STEPS):
        syn *= np.exp(-DT / 0.010); ad *= np.exp(-DT / 0.200)
        rf = np.maximum(0.0, rf - DT)
        avail = rf == 0.0
        cur = dr + syn - ad
        dv = (DT / 0.020) * (-v + cur)
        v[avail] += (dv + noise[t])[avail]
        fired = avail & (v >= thr)
        if t in fire_at:
            fired[site] = True
        out[t] = fired
        if transmission and fired.any():
            syn += COUPLING * W[:, fired].sum(axis=1)
        v[fired] = 0.0; rf[fired] = 0.005
        ad[fired] += 0.25 * sc[fired]
    return out


def features(sp, readers):
    seg = sp[WIN[0]:WIN[1]][:, readers]
    w = seg.shape[0] // BINS
    return seg[:w * BINS].reshape(BINS, w, -1).sum(axis=1).ravel().astype(float)


def cv_centroid(X, y, groups, folds=5):
    idx = np.arange(len(y)); ok = tot = 0
    for f in range(folds):
        te = idx[np.isin(groups, np.unique(groups)[f::folds])]
        tr = np.setdiff1d(idx, te)
        if len(np.unique(y[tr])) < 2:
            continue
        mu, sd = X[tr].mean(axis=0), X[tr].std(axis=0)
        sd = np.where(sd > 1e-9, sd, 1.0)
        Z = (X[tr] - mu) / sd
        c0, c1 = Z[y[tr] == 0].mean(axis=0), Z[y[tr] == 1].mean(axis=0)
        for i in te:
            z = (X[i] - mu) / sd
            ok += int(int(np.linalg.norm(z - c1) < np.linalg.norm(z - c0)) == y[i])
            tot += 1
    return ok / tot if tot else np.nan


def accuracy(net, site, readers, rng, transmission=True, shuffle=False, ascale=None):
    X, y, g = [], [], []
    for trial in range(TRIALS):
        noise = 0.012 * rng.standard_normal((STEPS, N))
        for lab, npul in ((0, 1), (1, 3)):
            sp = run_probe(net, site, noise, npul, transmission, ascale)
            X.append(features(sp, readers)); y.append(lab); g.append(trial)
    X, y, g = np.array(X), np.array(y), np.array(g)
    if shuffle:
        y = rng.permutation(y)
    return cv_centroid(X, y, g)


def main():
    conds = ["ОДИНАКОВЫЕ", "СПЕЦИАЛИЗИРОВАННЫЕ", "ПЕРЕМЕШАННЫЕ"]
    acc = {c: {"a": [], "shuf": [], "notr": [], "sc": []} for c in conds}
    for seed in SEEDS:
        base = simulate(seed=seed, drive=1.175, gradual_growth=False,
                        differentiation=ETA, coupling=COUPLING, state_property=0.0)
        spec = simulate(seed=seed, drive=1.175, gradual_growth=False,
                        differentiation=ETA, coupling=COUPLING, state_property=PROP)
        site = pick_site(base["positions"])
        readers = np.setdiff1d(np.arange(N), site)
        perm = np.random.default_rng(seed + 9).permutation(
            spec["state"]["adapt_scale"])
        for name, net, sc in (("ОДИНАКОВЫЕ", base, None),
                              ("СПЕЦИАЛИЗИРОВАННЫЕ", spec, None),
                              ("ПЕРЕМЕШАННЫЕ", spec, perm)):
            rg = np.random.default_rng(seed)
            acc[name]["a"].append(accuracy(net, site, readers, rg, ascale=sc))
            acc[name]["shuf"].append(accuracy(net, site, readers,
                                              np.random.default_rng(seed),
                                              shuffle=True, ascale=sc))
            acc[name]["notr"].append(accuracy(net, site, readers,
                                              np.random.default_rng(seed),
                                              transmission=False, ascale=sc))
            v = sc if sc is not None else net["state"]["adapt_scale"]
            acc[name]["sc"].append(float(np.mean(v)))

    print(f"{len(SEEDS)} seed'ов, сила связи {COUPLING:g}, "
          f"место {GROUP} узлов, читателей {N - GROUP}\n")
    ref_sc = np.mean(acc["ОДИНАКОВЫЕ"]["sc"])
    print("средний множитель адаптации (порог расхождения 10%):")
    for c in conds:
        m = np.mean(acc[c]["sc"])
        print(f"  {c:<20}: {m:.4f}  расхождение {abs(m-ref_sc)/ref_sc*100:5.2f}%")
    print("самопроверки (обязаны быть около 0.5):")
    for c in conds:
        print(f"  {c:<20}: перемешанные метки {np.mean(acc[c]['shuf']):.3f}, "
              f"без передачи {np.mean(acc[c]['notr']):.3f}")

    print(f"\n{'условие':<20} | {'точность':>17}")
    for c in conds:
        a = np.array(acc[c]["a"])
        print(f"{c:<20} | {a.mean():>7.3f} +- {a.std():.3f}")

    thr = int(np.ceil(len(SEEDS) * 5 / 6))
    base_a = np.array(acc["ОДИНАКОВЫЕ"]["a"])
    spec_a = np.array(acc["СПЕЦИАЛИЗИРОВАННЫЕ"]["a"])
    perm_a = np.array(acc["ПЕРЕМЕШАННЫЕ"]["a"])
    up_b = int((spec_a > base_a).sum()); up_p = int((spec_a > perm_a).sum())
    print(f"\nЧТЕНИЕ (порог {thr} из {len(SEEDS)}):")
    print(f"  специализация выше ОДИНАКОВЫХ:   {up_b} из {len(SEEDS)} "
          f"({base_a.mean():.3f} -> {spec_a.mean():.3f})")
    print(f"  специализация выше ПЕРЕМЕШАННЫХ: {up_p} из {len(SEEDS)} "
          f"({perm_a.mean():.3f} -> {spec_a.mean():.3f})")
    if up_b >= thr and up_p >= thr:
        print("  СПЕЦИАЛИЗАЦИЯ ПОЛЕЗНА: дело в расположении свойств, не только в их наличии")
    elif up_b >= thr:
        print("  полезна РАЗНОРОДНОСТЬ сама по себе, а не её расположение")
    else:
        print("  ПОРОГ НЕ ВЗЯТ: ни один из двух выводов не записывается.")
        print("  Это не то же, что «эффекта нет»: сообщаются доли и величины выше.")


if __name__ == "__main__":
    main()

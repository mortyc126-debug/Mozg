"""v0.25: делает ли граница области НЕЗАВИСИМЫМИ.

v0.24 показал, что при рабочей силе связи граница ВПЕРВЫЕ влияет на
работу сети -- но во вред: адресуемость падает с 0.899 до 0.809 на 11
сидах из 12. Механически это понятно: правило режет связи между
непохожими узлами, то есть пути, по которым импульс доходит до
остальных. Граница ИЗОЛИРУЕТ.

Отсюда следует, что мера была не та. Функция границы -- не в том, чтобы
сеть лучше читалась ЦЕЛИКОМ, а в том, чтобы области стали НЕЗАВИСИМЫ.
Глобальная адресуемость смешивает чтение внутри области и между
областями и потому показывает только потерю.

ЗАМЫСЕЛ. Два места стимуляции A и B выбираются ГЕОМЕТРИЧЕСКИ и рядом
(центры в 0.12 друг от друга -- порядка размера домена, измеренного в
v0.17). Они одни и те же в обоих условиях, поэтому задача одна и та же.
Читатели делятся по состоянию:
  СВОИ   -- узлы, чьё состояние совпадает с преобладающим у A и B;
  ЧУЖИЕ  -- узлы с противоположным состоянием.
Меряется точность различения A против B отдельно по своим и по чужим.

ПРЕДСКАЗАНИЕ, объявлено до запуска: граница повышает чтение СВОИМИ и
понижает чтение ЧУЖИМИ, то есть разность (свои минус чужие) растёт.
Если же падают обе -- граница просто портит связность и независимости
не даёт, и это записывается прямо.

ЧИСЛО ЧИТАТЕЛЕЙ ВЫРАВНЕНО. Иначе сравнение мерило бы количество
признаков, а не независимость: в обоих наборах и в обоих условиях
берётся одно и то же число читателей K, ближайших к центру своей
области. Это отдельная ловушка, названная заранее.

ПРАВИЛО ЧТЕНИЯ:
  * самопроверки (перемешанные метки, без передачи) обязаны быть около
    0.5, иначе результат не читается;
  * независимость засчитывается, если разность (свои минус чужие) у
    ГРАНИЦЫ выше, чем у КОНТРОЛЯ, не менее чем на 5/6 сидов;
  * если у границы падают обе точности -- записывается, что граница
    режет связность и независимости не даёт;
  * плотность выравнена как в v0.24; остаточное расхождение выводится
    до обсуждения.
"""
import sys
import numpy as np

sys.path.insert(0, "code")
from sim_core import simulate, probe

N = 80
SEEDS = list(range(1001, 1017))
ETA = 0.5
COUPLING = 4.0
GROUP = 4
K_READERS = 18
TRIALS = 40
DT = 0.001
DUR = 1.2
PULSE = int(0.5 / DT)
WIN = (PULSE + 20, PULSE + 220)
BINS = 4
CONDS = {"КОНТРОЛЬ": dict(state_affinity=0.0, contact_radius=0.25),
         "ГРАНИЦА":  dict(state_affinity=1.0, contact_radius=0.285)}


def pick_sites(pos):
    """Два места рядом, центры в 0.16 друг от друга, посередине области.

    B выбирается из узлов, НЕ вошедших в A. Первая редакция брала оба
    набора независимо и отбрасывала сид при пересечении -- при типичном
    расстоянии до соседа 0.06 и центрах в 0.12 пересечение случалось
    почти всегда, и из 16 сидов оставалось 3. Отсев по такому признаку
    ещё и смещает выборку.
    """
    a = np.argsort(np.linalg.norm(pos - np.array([0.42, 0.5]), axis=1))[:GROUP]
    rest = np.setdiff1d(np.arange(len(pos)), a)
    b = rest[np.argsort(np.linalg.norm(pos[rest] - np.array([0.58, 0.5]),
                                       axis=1))][:GROUP]
    return np.sort(a), np.sort(b)


def split_readers(s, pos, sites, k):
    """Свои -- совпадающие по состоянию с преобладающим у мест стимуляции."""
    own_state = np.mean(s[sites] > 0.5) >= 0.5
    same = (s > 0.5) == own_state
    same[sites] = False
    other = ~((s > 0.5) == own_state)
    other[sites] = False
    ctr = pos[sites].mean(axis=0)
    out = []
    for mask in (same, other):
        idx = np.where(mask)[0]
        if len(idx) < k:
            return None, None
        out.append(np.sort(idx[np.argsort(np.linalg.norm(pos[idx] - ctr, axis=1))][:k]))
    return out[0], out[1]


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


def accuracy(net, A, B, readers, rng, transmission=True, shuffle=False):
    X, y, g = [], [], []
    steps = int(DUR / DT)
    for trial in range(TRIALS):
        noise = 0.012 * rng.standard_normal((steps, N))
        for lab, grp in ((0, A), (1, B)):
            sp = probe(net, noise, grp, transmission=transmission,
                       stimulus=True, coupling=COUPLING)
            X.append(features(sp, readers)); y.append(lab); g.append(trial)
    X, y, g = np.array(X), np.array(y), np.array(g)
    if shuffle:
        y = rng.permutation(y)
    return cv_centroid(X, y, g)


def main():
    acc = {c: {"in": [], "out": [], "shuf": [], "notr": [], "deg": []}
           for c in CONDS}
    used = 0
    for seed in SEEDS:
        nets, sites = {}, None
        ok = True
        for c, kw in CONDS.items():
            r = simulate(seed=seed, drive=1.175, gradual_growth=False,
                         differentiation=ETA, coupling=COUPLING, **kw)
            nets[c] = r
            if sites is None:
                sites = pick_sites(r["positions"])
        if not ok:
            continue
        A, B = sites
        allsit = np.concatenate([A, B])
        splits = {}
        for c in CONDS:
            i_in, i_out = split_readers(nets[c]["state_s"], nets[c]["positions"],
                                        allsit, K_READERS)
            if i_in is None:
                ok = False
                break
            splits[c] = (i_in, i_out)
        if not ok:
            continue
        used += 1
        for c in CONDS:
            r = nets[c]
            i_in, i_out = splits[c]
            acc[c]["deg"].append(float(r["contacts"].sum(axis=1).mean()))
            acc[c]["in"].append(accuracy(r, A, B, i_in, np.random.default_rng(seed)))
            acc[c]["out"].append(accuracy(r, A, B, i_out, np.random.default_rng(seed)))
            acc[c]["shuf"].append(accuracy(r, A, B, i_in, np.random.default_rng(seed),
                                           shuffle=True))
            acc[c]["notr"].append(accuracy(r, A, B, i_in, np.random.default_rng(seed),
                                           transmission=False))

    print(f"сидов использовано {used} из {len(SEEDS)}; мест по {GROUP} узлов, "
          f"читателей по {K_READERS} в каждом наборе\n")
    ref = np.mean(acc["КОНТРОЛЬ"]["deg"])
    print("выравнивание плотности (порог 10%), до обсуждения:")
    for c in CONDS:
        d = np.mean(acc[c]["deg"])
        print(f"  {c:<9}: соседей {d:6.3f}  расхождение {abs(d-ref)/ref*100:5.2f}%")
    print("самопроверки (обязаны быть около 0.5):")
    for c in CONDS:
        print(f"  {c:<9}: перемешанные {np.mean(acc[c]['shuf']):.3f}, "
              f"без передачи {np.mean(acc[c]['notr']):.3f}")

    print(f"\n{'условие':<9} | {'читают СВОИ':>16} | {'читают ЧУЖИЕ':>16} | "
          f"{'разность':>10}")
    for c in CONDS:
        i = np.array(acc[c]["in"]); o = np.array(acc[c]["out"])
        print(f"{c:<9} | {i.mean():>7.3f} +- {i.std():.3f} | "
              f"{o.mean():>7.3f} +- {o.std():.3f} | {(i-o).mean():>+10.3f}")

    thr = int(np.ceil(used * 5 / 6))
    dc = np.array(acc["КОНТРОЛЬ"]["in"]) - np.array(acc["КОНТРОЛЬ"]["out"])
    db = np.array(acc["ГРАНИЦА"]["in"]) - np.array(acc["ГРАНИЦА"]["out"])
    up = int((db > dc).sum())
    print(f"\nЧТЕНИЕ (порог {thr} из {used}):")
    print(f"  разность (свои минус чужие) выше у ГРАНИЦЫ: {up} из {used} "
          f"({dc.mean():+.3f} -> {db.mean():+.3f}) -- "
          f"{'НЕЗАВИСИМОСТЬ ЕСТЬ' if up >= thr else 'НЕ ПОДТВЕРЖДЕНО'}")
    bi = np.array(acc["ГРАНИЦА"]["in"]); ci = np.array(acc["КОНТРОЛЬ"]["in"])
    bo = np.array(acc["ГРАНИЦА"]["out"]); co = np.array(acc["КОНТРОЛЬ"]["out"])
    print(f"  при этом: свои {ci.mean():.3f} -> {bi.mean():.3f} "
          f"({int((bi > ci).sum())} из {used} выше), "
          f"чужие {co.mean():.3f} -> {bo.mean():.3f} "
          f"({int((bo > co).sum())} из {used} выше)")
    if bi.mean() < ci.mean() and bo.mean() < co.mean():
        print("  ОБЕ упали: граница режет связность, независимости не даёт")


if __name__ == "__main__":
    main()

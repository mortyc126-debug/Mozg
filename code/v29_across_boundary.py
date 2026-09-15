"""v0.29: имеет ли значение МЕСТО относительно разметки -- на равном
расстоянии, в ОДНОЙ И ТОЙ ЖЕ ткани.

ОТКУДА ВОПРОС. Шесть измерений подряд (v0.22-v0.26) дали одно: работает
СОСТАВ, не работает РАСПОЛОЖЕНИЕ. Но во всех шести расположение менялось
ВМЕСТЕ с сетью: другое правило роста -- другая ткань, другая плотность,
и приходилось выравнивать плотность, теряя на этом половину чистоты
(уроки №30, №31, №37). v0.28 показал, что у разметки есть рисунок с
масштабом. Это позволяет задать вопрос иначе и гораздо чище.

ЗАМЫСЕЛ. Ткань ОДНА. Сеть одна, веса одни, плотность одна и та же -- ни
выравнивать, ни сравнивать нечего. Меняется ТОЛЬКО ТО, КУДА ПОДАНА
ЗАДАЧА:
    СВОЯ ОБЛАСТЬ  -- источник и цель в одной области разметки;
    ЧЕРЕЗ ГРАНИЦУ -- источник и цель по разные стороны.
Евклидово расстояние между местами в обоих условиях лежит в ОДНОМ
УЗКОМ ПОЯСЕ, отбор по поясу идёт до обучения.

Это устраняет разом всю группу ловушек "сравнивались две ткани": ткань
буквально одна и та же, отличается только адрес задачи.

ЗАДАЧА. Место = 3 ближайших друг к другу узла, все в одной области.
Обучение: импульс в A, через 10 мс импульс в B, период 400 мс, 12 с.
Проверка: импульс в A, отвечает ли B в срок 30 мс.
    попадание -- доля проб, где B ответил.
Отдельно, для истолкования, сообщается длина пути A->B по связям.

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * сид идёт в счёт, только если в нём нашлись ОБА условия в поясе
    расстояний; сиды без пары НЕ подставляются и их число сообщается;
  * поясов ДВА. Первый прогон шёл в одном поясе 0.20-0.32 и дал попадание
    0.160 против 0.016 -- разница верная, но обе величины у пола, а
    читать разницу между "почти никогда" и "никогда" -- ровно та ловушка,
    о которой предупреждает правило про пол ниже. Поэтому добавлен
    ближний пояс 0.12-0.22, где след успевает сложиться. Засчитывается,
    только если эффект держится в ОБОИХ;
  * пустой отсчёт -- ПЕРЕМЕШАННАЯ РАЗМЕТКА: те же позиции, те же
    контакты, но метки переставлены между узлами. Тогда "через границу"
    -- это адрес, ничего не значащий. Если разница держится и там,
    значит меряется не разметка, а расстояние или что-то ещё;
  * третье условие -- ТОНКИЙ МОСТИК: места СВОЕЙ области, но связи между
    ними случайно прорежены до того же числа, что у мостика через
    границу. Оно отвечает на вопрос, что именно делает граница: если
    прорежённый мостик работает так же плохо, как пограничный, дело в
    ЧИСЛЕ связей; если пограничный хуже -- дело ещё и в том, КАКИЕ это
    связи. Контроль обязателен: измерено, что мостик своей области -- 7.5
    связей из 9 возможных, пограничный -- 1.67, и без выравнивания
    сравнивалась бы толщина, а не место;
  * ЗАСЧИТЫВАЕТСЯ только если: попадание в СВОЕЙ области выше, чем
    ЧЕРЕЗ ГРАНИЦУ, по знаку у большинства сидов (биномиальный p < 0.05)
    И на перемешанной разметке этого нет;
  * величина эффекта сообщается в процентных пунктах рядом с долей
    сидов -- урок №36: доля сидов без величины ничего не значит;
  * если попадание в ОБОИХ условиях ниже 0.15 или выше 0.85, вердикт не
    выносится: пол и потолок неразличимы с отсутствием эффекта.
"""
import sys
from math import comb

import numpy as np

sys.path.insert(0, "code")
from sim_core import simulate

N = 80
SEEDS = list(range(1501, 1525))
DIFF_RADIUS = 0.55         # выбран в v0.28 по масштабу рисунка
SITE = 3
BANDS = ((0.12, 0.22), (0.20, 0.32))   # пояса расстояний между местами
COUPLING = 10.0
DRIVE = 0.8
LAG = 10
PERIOD = 400
TRAIN_MS = 12000
PROBE_MS = 300
PULSE_AT = 50
DEADLINE = 30
TRIALS = 30
DT = 0.001
ETA_W = 0.0002

GROW = dict(drive=DRIVE, homeostasis=False, gradual_growth=False,
            differentiation=0.5, coupling=COUPLING, state_affinity=1.0,
            contact_radius=0.25, wire_from=6.0, diff_by_distance=True,
            state_jitter=0.02, diff_radius=DIFF_RADIUS)


def p_ge(k, n):
    return sum(comb(n, i) for i in range(k, n + 1)) / 2 ** n


def sites(pos, side):
    """Места: узел и два ближайших к нему, все в одной области."""
    D = np.linalg.norm(pos[:, None, :] - pos[None, :, :], axis=2)
    out = []
    for i in range(N):
        g = np.argsort(D[i])[:SITE]
        if side[g].min() == side[g].max():
            out.append((np.sort(g), pos[g].mean(axis=0), bool(side[i])))
    return out


def choose(pos, side, band):
    """Пара мест в своей области и пара через границу, в одном поясе."""
    st = sites(pos, side)
    same, cross = [], []
    for a in range(len(st)):
        for b in range(a + 1, len(st)):
            ga, ca, sa = st[a]
            gb, cb, sb = st[b]
            if set(ga.tolist()) & set(gb.tolist()):
                continue
            d = float(np.linalg.norm(ca - cb))
            if not (band[0] <= d < band[1]):
                continue
            (same if sa == sb else cross).append((d, ga, gb))
    if not same or not cross:
        return None
    # из каждого условия берётся по одному, с наиболее близким расстоянием
    same.sort(key=lambda z: z[0]); cross.sort(key=lambda z: z[0])
    ds = np.array([z[0] for z in same]); dc = np.array([z[0] for z in cross])
    j = np.clip(np.searchsorted(dc, ds), 0, len(dc) - 1)
    gap = np.minimum(np.abs(dc[j] - ds),
                     np.abs(dc[np.maximum(j - 1, 0)] - ds))
    i = int(np.argmin(gap))
    j2 = int(min(range(len(dc)), key=lambda q: abs(dc[q] - ds[i])))
    return same[i], cross[j2], float(abs(ds[i] - dc[j2]))


def fresh(net):
    s = net["state"]
    return dict(v=s["v"].copy(), syn=np.zeros(N), adapt=s["adaptation"].copy(),
                refr=s["refractory"].copy(), thr=s["threshold"].copy(),
                drive=s["drive"].copy(), asc=s["adapt_scale"].copy())


def step(st, W, nrow, forced=None):
    st["syn"] *= np.exp(-DT / 0.010); st["adapt"] *= np.exp(-DT / 0.200)
    st["refr"] = np.maximum(0.0, st["refr"] - DT)
    avail = st["refr"] == 0.0
    cur = st["drive"] + st["syn"] - st["adapt"]
    dv = (DT / 0.020) * (-st["v"] + cur)
    st["v"][avail] += (dv + nrow)[avail]
    fired = avail & (st["v"] >= st["thr"])
    if forced is not None:
        fired[forced] = True
    if fired.any():
        st["syn"] += COUPLING * W[:, fired].sum(axis=1)
    st["v"][fired] = 0.0; st["refr"][fired] = 0.005
    st["adapt"][fired] += 0.25 * st["asc"][fired]
    return fired


def train(net, C, A, B, seed):
    W = net["weights"].copy() * C
    st = fresh(net)
    rng = np.random.default_rng(seed)
    noise = 0.012 * rng.standard_normal((TRAIN_MS, N))
    trace = np.zeros(N)
    for t in range(TRAIN_MS):
        ph = t % PERIOD
        forced = A if ph == 0 else (B if ph == LAG else None)
        fired = step(st, W, noise[t], forced)
        trace *= np.exp(-DT / 0.020)
        if fired.any():
            W[fired, :] += ETA_W * trace[None, :] * C[fired, :]
            W[:, fired] -= 1.05 * ETA_W * trace[:, None] * C[:, fired]
            np.clip(W, 0.0, 0.08, out=W)
            tot = W.sum(axis=1)
            W *= np.minimum(1.0, 0.6 / np.maximum(tot, 1e-12))[:, None]
        trace[fired] += 1.0
    return W


def hits(net, W, A, B, seed):
    rng = np.random.default_rng(seed)
    got = []
    for _ in range(TRIALS):
        nz = 0.012 * rng.standard_normal((PROBE_MS, N))
        st = fresh(net)
        ok = False
        for t in range(PROBE_MS):
            fired = step(st, W, nz[t], A if t == PULSE_AT else None)
            if PULSE_AT < t <= PULSE_AT + DEADLINE and fired[B].any():
                ok = True
                break
        got.append(ok)
    return float(np.mean(got))


def bridge(C, A, B):
    return int(C[np.ix_(A, B)].sum())


def thinned(C, A, B, keep, seed):
    """Копия сети, где мостик A-B прорежен наугад до keep связей."""
    C2 = C.copy()
    ij = [(i, j) for i in A for j in B if C[i, j]]
    extra = len(ij) - keep
    if extra <= 0:
        return C2
    rng = np.random.default_rng(seed + 303)
    for k in rng.choice(len(ij), size=extra, replace=False):
        i, j = ij[k]
        C2[i, j] = C2[j, i] = 0.0
    return C2


def path_len(C, A, B):
    """Длина пути по связям между множествами A и B (волной)."""
    seen = np.zeros(N, dtype=bool); seen[A] = True
    front = seen.copy()
    for d in range(1, N):
        front = (C[front].sum(axis=0) > 0) & ~seen
        if not front.any():
            return float("inf")
        seen |= front
        if seen[B].any():
            return d
    return float("inf")


def main():
    print(f"дальность соперничества {DIFF_RADIUS}, радиус связи 0.25, "
          f"мест по {SITE} узла, проб {TRIALS}\n")
    verdicts = []
    for band in BANDS:
        real = {"same": [], "cross": [], "dsame": [], "dcross": [],
                "thin": [], "bsame": [], "bcross": [], "bthin": []}
        perm = {"same": [], "cross": []}
        skipped = 0
        for seed in SEEDS:
            net = simulate(seed=seed, **GROW)
            pos = net["positions"]
            side = net["state_s"] > 0.5
            C = (net["contacts"] | net["contacts"].T).astype(float)
            rng = np.random.default_rng(seed + 11)
            pick = choose(pos, side, band)
            pick_p = choose(pos, rng.permutation(side), band)
            if pick is None or pick_p is None:
                skipped += 1
                continue
            (_, sa, sb), (_, ca, cb), _ = pick
            real["same"].append(hits(net, train(net, C, sa, sb, seed), sa, sb,
                                     seed + 70))
            real["cross"].append(hits(net, train(net, C, ca, cb, seed), ca, cb,
                                      seed + 70))
            real["dsame"].append(path_len(C, sa, sb))
            real["dcross"].append(path_len(C, ca, cb))
            nb_s, nb_c = bridge(C, sa, sb), bridge(C, ca, cb)
            real["bsame"].append(nb_s); real["bcross"].append(nb_c)
            Ct = thinned(C, sa, sb, nb_c, seed)
            real["thin"].append(hits(net, train(net, Ct, sa, sb, seed),
                                     sa, sb, seed + 70))
            real["bthin"].append(bridge(Ct, sa, sb))
            (_, pa, pb), (_, qa, qb), _ = pick_p
            perm["same"].append(hits(net, train(net, C, pa, pb, seed), pa, pb,
                                     seed + 70))
            perm["cross"].append(hits(net, train(net, C, qa, qb, seed), qa, qb,
                                      seed + 70))
        n = len(real["same"])
        print(f"ПОЯС {band[0]:.2f}-{band[1]:.2f}: {n} сидов в счёт, "
              f"{skipped} пропущено")
        if n == 0:
            print("  мерить не на чем\n")
            continue
        s_ = np.array(real["same"]); c_ = np.array(real["cross"])
        ps = np.array(perm["same"]); pc = np.array(perm["cross"])
        print(f"  {'':<20} | {'своя':>8} | {'через границу':>14} | разница")
        print(f"  {'настоящая разметка':<20} | {s_.mean():8.3f} | "
              f"{c_.mean():14.3f} | {(s_ - c_).mean() * 100:+.2f} п.п.")
        print(f"  {'перемешанная':<20} | {ps.mean():8.3f} | "
              f"{pc.mean():14.3f} | {(ps - pc).mean() * 100:+.2f} п.п.")
        t_ = np.array(real["thin"])
        print(f"  {'тонкий мостик':<20} | {t_.mean():8.3f} | "
              f"{'':>14} | {(s_ - t_).mean() * 100:+.2f} п.п. от своей")
        print(f"  {'длина пути':<20} | "
              f"{np.mean(np.array(real['dsame'], dtype=float)):8.2f} | "
              f"{np.mean(np.array(real['dcross'], dtype=float)):14.2f} |")
        print(f"  {'связей в мостике':<20} | {np.mean(real['bsame']):8.2f} | "
              f"{np.mean(real['bcross']):14.2f} | "
              f"тонкий {np.mean(real['bthin']):.2f}")
        kt = int((t_ > c_).sum())
        print(f"  тонкий выше пограничного: {kt} из {n}, "
              f"p = {p_ge(kt, n):.4f}")
        k, kp = int((s_ > c_).sum()), int((ps > pc).sum())
        print(f"  настоящая:    {k} из {n}, p = {p_ge(k, n):.4f}")
        print(f"  перемешанная: {kp} из {n}, p = {p_ge(kp, n):.4f}")
        lo, hi = min(s_.mean(), c_.mean()), max(s_.mean(), c_.mean())
        if hi < 0.15 or lo > 0.85:
            ok = None
            print("  пол или потолок -- вердикт не выносится\n")
        else:
            ok = p_ge(k, n) < 0.05 and p_ge(kp, n) >= 0.05
            print(f"  {'место имеет значение' if ok else 'разницы нет либо она есть и на перемешанной'}")
            if ok:
                print("  механизм: " + ("граница режет больше, чем число связей -- "
                      "прорежённый мостик своей области работает лучше пограничного"
                      if p_ge(kt, n) < 0.05 else
                      "вся разница в ЧИСЛЕ связей мостика -- прорежённый мостик "
                      "работает не лучше пограничного"))
            print()
        verdicts.append((band, ok, float(s_.mean()), float(c_.mean())))

    print("ЧТЕНИЕ ПО ДВУМ ПОЯСАМ:")
    good = [v for v in verdicts if v[1]]
    if len(good) == len(BANDS) and good:
        print("  МЕСТО ОТНОСИТЕЛЬНО РАЗМЕТКИ ИМЕЕТ ЗНАЧЕНИЕ -- эффект держится "
              "на обоих расстояниях, в том числе вдали от пола")
    elif good:
        b = good[0][0]
        print(f"  эффект засчитан только в поясе {b[0]:.2f}-{b[1]:.2f}; "
              f"на другом расстоянии не держится -- читать осторожно")
    else:
        print("  ни в одном поясе вердикт не вынесен")


if __name__ == "__main__":
    main()

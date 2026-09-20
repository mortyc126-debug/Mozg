"""v0.59, путь A': функциональная проверка БЕЗ ДЕКОДЕРА.

ЗАЧЕМ. Путь A стоит на декодере (ближайший центр). Если умение просядет,
это может значить и что отклик обеднел, и что декодеру стало труднее при
том же отклике. Проект уже разделял эти случаи -- v0.11 фаза 2.

ПРАВИЛО ОБЪЯВЛЕНО в docs/V059_SPEC.md §5-бис, и объявлено ДО того, как
прочитано хоть одно число основного прогона (проверяемо по истории git).

МЕРА. Классификатора нет вовсе:

    S(T) = среднее по узлам |доля откликов на LO − доля откликов на HI|
    N(T) = та же величина между ДВУМЯ ПОЛОВИНАМИ проб ОДНОГО касания
    q(T) = S(T) / N(T)

Половины равны по числу проб с основным сравнением -- иначе пол считался
бы при другом числе проб.

ТКАНИ БЕРУТСЯ ТЕ ЖЕ, что попали в счёт основного прогона (список читается
из data/v59_trace_retention.npz), и пересчитываются тем же кодом с теми же
сидами. Разные наборы тканей сравнивать нельзя.
"""
import sys
from math import comb

import numpy as np

sys.path.insert(0, "code")
import v46_closed_loop as v46
import v58_histories_differ_in_skill as v58
import v59_trace_retention as v59
from readout import probe_batch
from sim_core import simulate

TRIALS = v58.TRIALS


def p_ge(k, n):
    return sum(comb(n, i) for i in range(k, n + 1)) / 2 ** n


def patterns(W, st, pat, read, seed):
    """Две независимые половины проб одного касания, по TRIALS в каждой."""
    rng = np.random.default_rng(seed)
    nz = v58.NOISE * rng.standard_normal((2 * TRIALS, v58.PROBE_MS, v58.N))
    X = probe_batch(W, st, nz, pat, read, v58.COUPLING, v58.DT, v58.PULSE_AT,
                    v58.DEADLINE, st["thr"], st["asc"]).astype(float)
    return X[:TRIALS].mean(axis=0), X[TRIALS:].mean(axis=0)


def one_tissue(seed):
    grown = simulate(seed=seed, div_rate=0.10, coupling=v59.COUPLING,
                     duration=v59.TRAIN, **v59.BASE)
    pos, birth = grown["positions"], grown["birth"]
    alive = np.isfinite(birth)
    p1 = np.where(alive & v46.touch(pos, v59.LO))[0]
    p2 = np.where(alive & v46.touch(pos, v59.HI))[0]
    read = np.where(alive & (pos[:, 0] > v59.XFAR))[0]

    nets = [v59.live(seed + 1000, pos, birth, t, 0.4) for t in v59.TS]
    st = v58.fresh(nets[0])
    q, S, F = [], [], []
    for i, net in enumerate(nets):
        W = v59.wmat(net)
        a1, b1 = patterns(W, st, p1, read, seed + 700 + 11 * i)
        a2, b2 = patterns(W, st, p2, read, seed + 800 + 11 * i)
        s = float(np.abs(a1 - a2).mean())
        f = float((np.abs(a1 - b1).mean() + np.abs(a2 - b2).mean()) / 2)
        S.append(s); F.append(f)
        q.append(s / f if f > 0 else np.nan)
    return q, S, F


def main():
    d = np.load("data/v59_trace_retention.npz")
    seeds = [int(s) for s in d["seed"]]
    acc0 = d["acc"][:, 0]
    keep = [s for s, a in zip(seeds, acc0)
            if v59.ACC_LO <= a <= v59.ACC_HI]
    out = open("scratch/v59_nodecoder.txt", "w", buffering=1)

    def log(s):
        print(s); out.write(s + "\n")

    log("v0.59, путь A': проверка БЕЗ ДЕКОДЕРА")
    log(f"ткани -- те же, что в счёте основного прогона: {len(keep)} из "
        f"{len(seeds)} прошедших пробу\n")

    Q, Ss, Fs = [], [], []
    for seed in keep:
        q, s, f = one_tissue(seed)
        Q.append(q); Ss.append(s); Fs.append(f)
        log(f"  seed {seed}: q {[round(x, 3) for x in q]}")
    Q = np.array(Q); Ss = np.array(Ss); Fs = np.array(Fs)
    np.savez_compressed("data/v59_nodecoder.npz", seed=np.array(keep),
                        q=Q, S=Ss, F=Fs)

    log(f"\n{'T, с':>6} | {'сигнал S':>9} | {'пол N':>8} | {'q=S/N':>7} | "
        f"{'Δq':>8} | {'ниже':>5} | {'выше':>5} | {'p':>8} | вердикт")
    for i, t in enumerate(v59.TS):
        if i == 0:
            log(f"{t:>6.0f} | {Ss[:, 0].mean():>9.5f} | {Fs[:, 0].mean():>8.5f} | "
                f"{Q[:, 0].mean():>7.3f} |    --    |    -- |    -- |       -- | "
                f"точка отсчёта")
            continue
        dq = Q[:, i] - Q[:, 0]
        lo, hi = int((dq < 0).sum()), int((dq > 0).sum())
        n = lo + hi
        p = p_ge(max(lo, hi), n) if n else 1.0
        sign_hit = (p < 0.05) and (lo > hi)
        size_hit = abs(dq.mean()) > dq.std()
        if sign_hit and size_hit:
            v = "ОСЛАБЕВАЕТ по A'"
        elif not sign_hit and not size_hit:
            v = "ДЕРЖИТСЯ по A'"
        else:
            v = "НЕ РАЗРЕШЕНО"
        log(f"{t:>6.0f} | {Ss[:, i].mean():>9.5f} | {Fs[:, i].mean():>8.5f} | "
            f"{Q[:, i].mean():>7.3f} | {dq.mean():>+8.3f} | {lo:>5} | {hi:>5} | "
            f"{p:>8.5f} | {v}")
    log("\nq = 1 означает, что разные касания различаются не сильнее, чем"
        " одно и то же касание само с собой.")
    out.close()


if __name__ == "__main__":
    main()

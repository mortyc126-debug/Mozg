"""v0.11 фаза 3, шаг 2: ПРИЧИННАЯ проверка -- объясняет ли блок весов
источник->цель наблюдённую разницу латентности?

Корреляция dW с U1 (+0.70) получена на тех же данных и сама по себе
причинности не устанавливает. Здесь -- прямое вмешательство, в
традиции контролей v0.1 (transmission=False): берём НЕСОВПАДАЮЩУЮ по
порядку ветвь и пересаживаем ей блок весов совпадающей ветви.

Условия (все на одной и той же несовпадающей ветви, кроме последнего):
  mis        -- несовпадающая ветвь как есть
  tw         -- + веса совпадающей ветви в блоке ИСТОЧНИК->ЦЕЛЬ,
                ТОЛЬКО по контактам, общим для обеих ветвей
                (топология не меняется => чистый вклад ВЕСОВ)
  tf         -- + веса И контакты совпадающей ветви в том же блоке
                (веса + топология вместе)
  ctrl_rev   -- КОНТРОЛЬ СПЕЦИФИЧНОСТИ: пересаживается блок ОБРАТНОГО
                направления (ЦЕЛЬ->ИСТОЧНИК), не тот путь, по которому
                идёт проба. Ожидание: эффекта на латентность нет.
  match      -- совпадающая ветвь как есть (верхняя точка отсчёта)

ПРЕДСКАЗАНИЕ ЗАФИКСИРОВАНО ДО ЗАПУСКА: если блок весов причинно
объясняет U1, то латентность в tw сдвигается от mis В СТОРОНУ match,
а ctrl_rev остаётся near mis. Если tw не сдвигается -- U1 порождается
не этим блоком, и объяснение "быстрее из-за усиленного пути" неверно.

Тестовые шумы 980-1019 -- свежие.
"""
import pickle
import time

import numpy as np

from v05_functional import make_noise, probe
from v09_functional_probe import build_common_start_state
from v11_measures import first_spike_latency, CENSORED

TEST_SEEDS = list(range(980, 1020))
PROBE_STEPS = 200
SNAPSHOT_TIME = 96.0
N = 80


def transplant(W_dst, C_dst, W_src, C_src, tgt, src, include_topology):
    """Пересадка блока W[tgt, src] из донора в получателя."""
    W = W_dst.copy(); C = C_dst.copy()
    ii = np.ix_(tgt, src)
    if include_topology:
        W[ii] = W_src[ii]
        C[ii] = C_src[ii]
    else:
        common = C_dst[ii] & C_src[ii]
        blk = W[ii].copy()
        blk[common] = W_src[ii][common]
        W[ii] = blk
    return W, C


def mean_latency(state, W, noises, stim_g, obs_g):
    vals = []
    for nz in noises:
        base, _ = probe(state, W, nz, True, None)
        stim, _ = probe(state, W, nz, True, stim_g)
        lb = first_spike_latency(base, obs_g)
        ls = first_spike_latency(stim, obs_g)
        if lb == CENSORED or ls == CENSORED:
            continue
        vals.append(float(ls - lb))
    return float(np.mean(vals)), len(vals)


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    with open("v11_train_full.pkl", "rb") as f:
        T = pickle.load(f)
    noises = [make_noise(s, PROBE_STEPS, N) for s in TEST_SEEDS]

    acc = {c: [] for c in ("mis", "tw", "tf", "ctrl_rev", "match")}
    t0 = time.time()
    n_cens = 0
    n_tot = 0

    for key, rec in T["results"].items():
        if key[3] != "M1_plasticity_weakest":
            continue
        sel, geom, growth, mech, rep = key
        gA, gB = rec["group_A"], rec["group_B"]
        v06 = D06["snapshots"][geom][growth][SNAPSHOT_TIME]["state"]

        for direction, (src_g, tgt_g) in (("ab", (gA, gB)), ("ba", (gB, gA))):
            matched_br = "AB" if direction == "ab" else "BA"
            mismatched_br = "BA" if direction == "ab" else "AB"

            st_m, W_m, C_m = build_common_start_state(v06, rec[matched_br])
            st_x, W_x, C_x = build_common_start_state(v06, rec[mismatched_br])

            variants = {
                "mis": (W_x, C_x),
                "tw": transplant(W_x, C_x, W_m, C_m, tgt_g, src_g, False),
                "tf": transplant(W_x, C_x, W_m, C_m, tgt_g, src_g, True),
                # контроль специфичности -- обратный блок ЦЕЛЬ->ИСТОЧНИК
                "ctrl_rev": transplant(W_x, C_x, W_m, C_m, src_g, tgt_g, False),
                "match": (W_m, C_m),
            }
            for name, (Wv, _Cv) in variants.items():
                state = st_m if name == "match" else st_x
                v, n_ok = mean_latency(state, Wv, noises, src_g, tgt_g)
                acc[name].append(v)
                n_cens += len(TEST_SEEDS) - n_ok
                n_tot += len(TEST_SEEDS)

    res = {k: np.array(v) for k, v in acc.items()}
    print(f"ячеек: {len(res['mis'])} (36 комбинаций x 2 направления)")
    print(f"цензурировано: {n_cens}/{n_tot}\n")
    print("средняя парная латентность (мс), МЕНЬШЕ = быстрее:")
    for k in ("mis", "ctrl_rev", "tw", "tf", "match"):
        print(f"  {k:9s}: {res[k].mean():+.4f}")

    base = res["mis"].mean(); target = res["match"].mean()
    span = base - target
    print(f"\nразрыв mis - match = {span:+.4f} мс (это и есть U1 на новых шумах)")
    if abs(span) > 1e-12:
        for k in ("tw", "tf", "ctrl_rev"):
            closed = (base - res[k].mean()) / span
            print(f"  {k:9s} закрывает {closed*100:+.1f}% разрыва")

    print("\nпопарно по ячейкам (доля ячеек, где вмешательство ускорило):")
    for k in ("tw", "tf", "ctrl_rev"):
        d = res["mis"] - res[k]
        print(f"  {k:9s}: среднее {d.mean():+.4f}  быстрее в "
              f"{(d>0).sum()}/{len(d)} ячейках")

    np.savez("v11_intervention.npz", **res)
    print(f"\nвремя: {time.time()-t0:.1f} c -> v11_intervention.npz")


if __name__ == "__main__":
    main()

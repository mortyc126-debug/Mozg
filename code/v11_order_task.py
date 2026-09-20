"""v0.11 фаза 2: задача РАСПОЗНАВАНИЯ ПОРЯДКА.

Задача с объективно правильным ответом: по растру ответа сети
определить, КАКАЯ последовательность была предъявлена -- A->B или B->A.
Правильный ответ задан протоколом стимуляции, не сетью.

ПРЕДСКАЗАНИЯ ЗАФИКСИРОВАНЫ ДО ЗАПУСКА:
  U2a = точность(M1, обученная) - точность(M3, без пластичности).
        Предсказание: > 0, если след полезен для различения порядка.
  U2b = 1/2[(acc_ABсеть на AB-пробах - acc_BAсеть на AB-пробах)
          + (acc_BAсеть на BA-пробах - acc_ABсеть на BA-пробах)]
        Предсказание: > 0, если лучше распознаётся ИМЕННО выученный
        порядок (перекрёстная форма, как у U1 и структурного C в v0.8).

ОБЯЗАТЕЛЬНЫЙ КОНТРОЛЬ: те же признаки с ПЕРЕМЕШАННЫМИ метками обязаны
дать случайный уровень. Признаков много (2400) при 80 пробах, поэтому
доверять можно только тому, что переживает этот контроль и
перекрёстную проверку с удержанием ЦЕЛОГО тестового шума (обе пробы
одного шума уходят в проверку вместе -- иначе один и тот же шум
оказался бы и в обучении, и в проверке).

Тестовые шумы 930-969 -- свежие, не пересекаются ни с 900-902
(v0.9/v0.10, разведка), ни с 910-919 (фаза 1).
"""
import pickle
import time

import numpy as np

from v05_functional import make_noise
from v09_functional_probe import build_common_start_state
from v11_sequence_probe import sequence_probe, build_order_schedule
from v11_measures import linear_decoder_cv, bin_raster

TEST_SEEDS = list(range(930, 970))
PROBE_STEPS = 200
T0_MS = 50
LAG_MS = 10
BIN_MS = 5
SNAPSHOT_TIME = 96.0
N = 80
MECHS = ("M1_plasticity_weakest", "M3_no_plasticity_weakest")


# ИСПРАВЛЕНИЕ (см. RESULTS_LEDGER пункт 20): первая версия признаков
# включала САМ АРТЕФАКТ СТИМУЛЯЦИИ -- принудительные импульсы пишутся в
# растр, поэтому "кто сработал на отметке t0" есть прямая метка класса.
# Задача решалась тривиально: точность 1.0000 ВЕЗДЕ, включая контроль
# M3 без пластичности. Обнаружено по ceiling на контроле.
FEATURE_START_MS = T0_MS + LAG_MS + 1   # строго ПОСЛЕ обоих импульсов


def features_with_artifact(spikes, gA, gB):
    """ДЕФЕКТНЫЙ вариант, сохранён для документирования причины."""
    return bin_raster(spikes[T0_MS:], BIN_MS).ravel()


def features(spikes, gA, gB):
    """Признаки: только НЕ стимулированные узлы, только окно строго
    ПОСЛЕ обоих принудительных импульсов. Декодируется отклик сети,
    а не сам факт подачи стимула."""
    keep = np.setdiff1d(np.arange(spikes.shape[1]),
                        np.concatenate([np.asarray(gA), np.asarray(gB)]))
    return bin_raster(spikes[FEATURE_START_MS:][:, keep], BIN_MS).ravel()


def per_class_accuracy(X, y, groups):
    """Точность отдельно по каждому классу, с той же перекрёстной
    проверкой leave-one-group-out."""
    X = np.asarray(X, float); y = np.asarray(y, float); groups = np.asarray(groups)
    hit = {1.0: 0, -1.0: 0}; tot = {1.0: 0, -1.0: 0}
    for g in np.unique(groups):
        tr, te = groups != g, groups == g
        mu = X[tr].mean(axis=0)
        A = np.hstack([X[tr] - mu, np.ones((tr.sum(), 1))])
        w, *_ = np.linalg.lstsq(A, y[tr], rcond=None)
        pred = np.sign(np.hstack([X[te] - mu, np.ones((te.sum(), 1))]) @ w)
        pred[pred == 0] = 1.0
        for cls in (1.0, -1.0):
            m = y[te] == cls
            hit[cls] += int((pred[m] == cls).sum()); tot[cls] += int(m.sum())
    return {c: (hit[c] / tot[c] if tot[c] else np.nan) for c in hit}


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    with open("v11_train_full.pkl", "rb") as f:
        T = pickle.load(f)
    noises = {s: make_noise(s, PROBE_STEPS, N) for s in TEST_SEEDS}

    rng_shuf = np.random.default_rng(4242)
    out = {}
    t0 = time.time()
    total_collisions = 0
    n_probes = 0
    m3_identical_checks = 0

    for key, rec in T["results"].items():
        sel, geom, growth, mech, rep = key
        if mech not in MECHS:
            continue
        gA, gB = rec["group_A"], rec["group_B"]
        v06_state = D06["snapshots"][geom][growth][SNAPSHOT_TIME]["state"]

        per_branch = {}
        rasters = {}
        for br in ("AB", "BA"):
            state, W, contacts = build_common_start_state(v06_state, rec[br])
            X, Xa, y, g = [], [], [], []
            for gi, seed in enumerate(TEST_SEEDS):
                for order, lab in (("AB", 1.0), ("BA", -1.0)):
                    first, second = (gA, gB) if order == "AB" else (gB, gA)
                    sched = build_order_schedule(first, second, T0_MS, LAG_MS)
                    sp, coll, _ = sequence_probe(state, W, contacts,
                                                 noises[seed], sched)
                    total_collisions += coll
                    n_probes += 1
                    X.append(features(sp, gA, gB))
                    Xa.append(features_with_artifact(sp, gA, gB))
                    y.append(lab); g.append(gi)
                    rasters[(br, seed, order)] = sp
            acc, n_te = linear_decoder_cv(X, y, g)
            acc_shuf, _ = linear_decoder_cv(X, rng_shuf.permutation(y), g)
            pc = per_class_accuracy(X, y, g)
            acc_art, _ = linear_decoder_cv(Xa, y, g)   # дефектный вариант
            per_branch[br] = {"acc": acc, "acc_shuffled": acc_shuf,
                              "acc_AB_trials": pc[1.0], "acc_BA_trials": pc[-1.0],
                              "acc_with_artifact": acc_art, "n_test": n_te}

        # M3: ветви обязаны быть идентичны (веса и контакты равны)
        if mech == "M3_no_plasticity_weakest":
            for seed in TEST_SEEDS[:5]:
                for order in ("AB", "BA"):
                    if not np.array_equal(rasters[("AB", seed, order)],
                                          rasters[("BA", seed, order)]):
                        raise AssertionError(f"M3 растры ветвей разошлись: {key}")
            m3_identical_checks += 1

        U2b = 0.5 * ((per_branch["AB"]["acc_AB_trials"] - per_branch["BA"]["acc_AB_trials"])
                     + (per_branch["BA"]["acc_BA_trials"] - per_branch["AB"]["acc_BA_trials"]))
        out[key] = {"branches": per_branch, "U2b": U2b,
                    "acc_mean": 0.5 * (per_branch["AB"]["acc"] + per_branch["BA"]["acc"]),
                    "acc_shuf_mean": 0.5 * (per_branch["AB"]["acc_shuffled"]
                                            + per_branch["BA"]["acc_shuffled"]),
                    "acc_artifact_mean": 0.5 * (per_branch["AB"]["acc_with_artifact"]
                                                + per_branch["BA"]["acc_with_artifact"])}

    res = {"results": out, "test_seeds": TEST_SEEDS, "t0_ms": T0_MS,
           "lag_ms": LAG_MS, "bin_ms": BIN_MS, "probe_steps": PROBE_STEPS,
           "total_collisions": total_collisions, "n_probes": n_probes,
           "m3_identical_checks": m3_identical_checks,
           "feature_start_ms": FEATURE_START_MS,
           "features_exclude_stimulated_nodes": True,
           "code_version": "v0.11 phase2 order task (artifact-corrected)",
           "runtime_seconds": time.time() - t0}
    with open("v11_order_task_clean.pkl", "wb") as f:
        pickle.dump(res, f)

    print(f"проб: {n_probes}  коллизий natural+forced: {total_collisions}")
    print(f"M3 проверок идентичности ветвей: {m3_identical_checks}")
    print(f"время: {res['runtime_seconds']:.1f} c -> v11_order_task_clean.pkl")


if __name__ == "__main__":
    main()

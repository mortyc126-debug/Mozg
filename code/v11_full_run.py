"""v0.11 фаза 1: три меры полезности на обученных сетях v11_train.py.

Проба -- v05_functional.py::probe (одиночный импульс при t=0), окно
200мс, НЕ изменено относительно v0.9/v0.10 (решение: окно не трогаем,
иначе ломается сравнимость -- ловушка №2).

Общий контролируемый старт -- ТОТ ЖЕ, что в v0.9 (build_common_start_
state): v/adaptation/refractory/threshold/drive из снимка v0.6 t=96с
(ДО опыта), syn=0; веса и контакты -- конечные, приобретённые.

ТЕСТОВЫЕ ШУМЫ СВЕЖИЕ: 910..919. Шумы 900/901/902 израсходованы на
v0.9/v0.10 и на разведку -- подтверждать на них нельзя (раздел 7
V011_SPEC.md).

ОБЛАСТЬ НАБЛЮДЕНИЯ объявлена заранее: основная -- вся сеть (80 узлов),
вторичная -- группа-цель. Причина в V011_SPEC.md Р3.
"""
import pickle
import time

import numpy as np

from v05_functional import make_noise, probe
from v09_functional_probe import build_common_start_state
from v11_measures import (latency_paired, crossed_contrast,
                          response_reliability, bin_raster, linear_decoder_cv)

TEST_SEEDS = [910, 911, 912, 913, 914, 915, 916, 917, 918, 919]
PROBE_MS = 200
PROBE_STEPS = PROBE_MS
SNAPSHOT_TIME = 96.0
BIN_MS = 5
N = 80


def run_pair(state, W, noise, stim_nodes):
    base, _ = probe(state, W, noise, transmission=True, stimulate_nodes=None)
    stim, _ = probe(state, W, noise, transmission=True, stimulate_nodes=stim_nodes)
    return base, stim


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    with open("v11_train_full.pkl", "rb") as f:
        T = pickle.load(f)

    noises = {s: make_noise(s, PROBE_STEPS, N) for s in TEST_SEEDS}
    out = {}
    t0 = time.time()
    n_censored = 0
    n_lat = 0
    m3_exact = 0

    for key, rec in T["results"].items():
        sel, geom, growth, mech, rep = key
        gA, gB = rec["group_A"], rec["group_B"]
        v06_state = D06["snapshots"][geom][growth][SNAPSHOT_TIME]["state"]

        st = {}
        for br in ("AB", "BA"):
            s, W, c = build_common_start_state(v06_state, rec[br])
            st[br] = (s, W, c)

        # общий старт обязан совпадать между ветвями
        for k_s in st["AB"][0]:
            assert np.array_equal(st["AB"][0][k_s], st["BA"][0][k_s]), k_s

        lat = {}        # lat[(branch, direction)] = средняя парная латентность
        rel = {}        # rel[(branch, direction)] = надёжность
        dec_rows = {"AB": [], "BA": []}   # признаки для декодера
        dec_lab = {"AB": [], "BA": []}
        dec_grp = {"AB": [], "BA": []}
        raw = {}

        for direction, (stim_g, obs_g) in (("ab", (gA, gB)), ("ba", (gB, gA))):
            for br in ("AB", "BA"):
                s, W, _ = st[br]
                lat_vals, stim_rasters = [], []
                for gi, seed in enumerate(TEST_SEEDS):
                    base, stim = run_pair(s, W, noises[seed], stim_g)
                    v, ok = latency_paired(base, stim, obs_g)
                    n_lat += 1
                    if ok:
                        lat_vals.append(v)
                    else:
                        n_censored += 1
                    stim_rasters.append(stim)

                    # U2: признаки -- бинированный растр ВСЕЙ сети
                    feat = bin_raster(stim, BIN_MS).ravel()
                    dec_rows[br].append(feat)
                    dec_lab[br].append(1.0 if direction == "ab" else -1.0)
                    dec_grp[br].append(gi)

                lat[(br, direction)] = float(np.mean(lat_vals)) if lat_vals else np.nan
                rel[(br, direction)] = response_reliability(stim_rasters, obs_g)
                raw[(br, direction)] = np.array(
                    [r[:, obs_g] for r in stim_rasters], dtype=bool)

        # U1 -- латентность, перекрёстная форма, МЕНЬШЕ = лучше
        U1, U1_A, U1_B = crossed_contrast(
            lat[("AB", "ab")], lat[("BA", "ab")],
            lat[("BA", "ba")], lat[("AB", "ba")], lower_is_better=True)

        # U3 -- надёжность, МЕНЬШЕ (разброс) = лучше
        U3, U3_A, U3_B = crossed_contrast(
            rel[("AB", "ab")], rel[("BA", "ab")],
            rel[("BA", "ba")], rel[("AB", "ba")], lower_is_better=True)

        # U2 -- декодирование "какая группа стимулирована", held-out по шумам
        acc = {}
        for br in ("AB", "BA"):
            a, n_te = linear_decoder_cv(dec_rows[br], dec_lab[br], dec_grp[br])
            acc[br] = a

        # M3 -- технический контроль: ветви обязаны совпадать ТОЧНО
        if mech == "M3_no_plasticity_weakest":
            for direction in ("ab", "ba"):
                if not np.array_equal(raw[("AB", direction)], raw[("BA", direction)]):
                    raise AssertionError(f"M3 растры не совпали: {key} {direction}")
            if not (U1 == 0.0 and U3 == 0.0):
                raise AssertionError(f"M3 контраст не ноль: {key} U1={U1} U3={U3}")
            m3_exact += 1

        out[key] = {"U1": U1, "U1_A": U1_A, "U1_B": U1_B,
                    "U3": U3, "U3_A": U3_A, "U3_B": U3_B,
                    "acc_AB_net": acc["AB"], "acc_BA_net": acc["BA"],
                    "latency": lat, "reliability": rel}

    res = {"results": out, "test_seeds": TEST_SEEDS, "probe_ms": PROBE_MS,
           "bin_ms": BIN_MS, "snapshot_time_source": SNAPSHOT_TIME,
           "observation_primary": "whole_network_for_decoder/target_group_for_U1_U3",
           "n_latency_probes": n_lat, "n_censored": n_censored,
           "m3_exact_controls_passed": m3_exact,
           "groups": T["groups"], "selection_seeds": T["selection_seeds"],
           "code_version": "v0.11 phase1 measures",
           "runtime_seconds": time.time() - t0}
    with open("v11_measures_full.pkl", "wb") as f:
        pickle.dump(res, f)

    print(f"комбинаций: {len(out)}  время: {res['runtime_seconds']:.1f} c")
    print(f"латентностей посчитано: {n_lat}, цензурировано: {n_censored} "
          f"({n_censored/max(n_lat,1):.3%})")
    print(f"M3 точных контролей пройдено: {m3_exact}")
    print("сохранено: v11_measures_full.pkl")


if __name__ == "__main__":
    main()

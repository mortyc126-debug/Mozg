"""
v0.9 полный запуск: 432 парные проверки.
72 обученных экземпляра v0.8 (3 геометрии x 2 истории роста x 2 повтора
обучения x 3 механизма x 2 порядка AB/BA) x 2 направления (A->B, B->A)
x 3 тестовых шума (900,901,902) = 432 пары "стимул/фон".

Для каждой пары (seed, growth, repeat, mechanism): общий контролируемый
старт из v06 снимка (v/adaptation/refractory/threshold/drive идентичны
AB/BA, syn=0), веса/контакты -- КОНЕЧНЫЕ из соответствующей траектории
v0.8 AB или BA. Электрическая динамика v05_functional.py::probe (та же
проверенная семантика, единственный путь обработки импульса).

Для M3 (без пластичности) на каждой соответствующей паре AB/BA
повторяются точные проверки весов, контактов и растров (согласовано
как сильный контроль реализации).
"""
import numpy as np
import pickle
import time

from v05_functional import DT, make_noise
from v09_functional_probe import (
    build_common_start_state, run_direction_probe, compute_R, compute_D,
    check_full_graph_and_weights_match,
)

CODE_VERSION = "v09_full_run.py (432 pairs)"

with open("v08_experience_full.pkl", "rb") as f:
    D08 = pickle.load(f)
with open("v06_extended_growth_full.pkl", "rb") as f:
    D06 = pickle.load(f)

GEOMETRY_SEEDS = [11, 22, 33]
GROWTH_CONDITIONS = ["Только бюджет", "Совместное"]
REPEATS = [0, 1]
MECHANISMS = ["M1_plasticity_weakest", "M2_plasticity_random", "M3_no_plasticity_weakest"]
SNAPSHOT_TIME = 96.0

GROUP_A = D08["group_A"]
GROUP_B = D08["group_B"]

TEST_SEEDS = [900, 901, 902]
PROBE_DURATION_MS = 200
PROBE_STEPS = int(round(PROBE_DURATION_MS / 1000 / DT))
BIN_MS = 5

# verify group_A/group_B consistency across ALL stored records before using
# the top-level value (explicitly requested: don't assume for future experiments)
def verify_groups_consistent_across_records(D08):
    for key, r in D08["results"].items():
        pass  # v0.8 does not store per-trajectory groups separately;
              # groups were fixed as a single top-level value by construction
              # of v08_full_run.py (GROUP_A/GROUP_B module-level constants
              # passed identically to every run_experience_trajectory call).
              # No per-record group storage exists to cross-check against --
              # documented as a known limitation, not silently assumed true.
    return True


def compute_metrics_for_pair(state, W, noise, stim_group, obs_group):
    base, stim = run_direction_probe(state, W, noise, stim_group, obs_group)
    R = compute_R(base, stim, obs_group, bin_ms=BIN_MS)

    n_obs = len(obs_group)
    window_width = int(round(0.050 / DT))
    F_windows, R_windows = [], []
    for w_start_ms in (0, 50, 100, 150):
        start_step = int(round(w_start_ms / 1000 / DT))
        end_step = start_step + window_width
        b_w = base[start_step:end_step][:, obs_group]
        s_w = stim[start_step:end_step][:, obs_group]
        R_windows.append((s_w.sum() - b_w.sum()) / n_obs)
        F_windows.append(np.any(b_w != s_w, axis=0).mean())

    F_200 = np.any(base[:, obs_group] != stim[:, obs_group], axis=0).mean()
    R_200 = sum(R_windows)
    baseline_rate_hz = base[:, obs_group].sum() / n_obs / (PROBE_DURATION_MS / 1000)
    stimulated_rate_hz = stim[:, obs_group].sum() / n_obs / (PROBE_DURATION_MS / 1000)

    return {
        "baseline_spikes": base, "stimulated_spikes": stim, "R_bins": R,
        "R_windows": R_windows, "F_windows": F_windows,
        "R_200": R_200, "F_200": F_200,
        "baseline_rate_hz": baseline_rate_hz, "stimulated_rate_hz": stimulated_rate_hz,
    }


def main():
    t_start = time.time()
    results = {}
    n_pairs = 0

    v06_states = {
        (seed, growth): D06["snapshots"][seed][growth][SNAPSHOT_TIME]["state"]
        for seed in GEOMETRY_SEEDS for growth in GROWTH_CONDITIONS
    }

    for seed in GEOMETRY_SEEDS:
        for growth in GROWTH_CONDITIONS:
            v06_state = v06_states[(seed, growth)]
            threshold_ref = v06_state["threshold"].copy()

            for repeat in REPEATS:
                for mech in MECHANISMS:
                    traj_ab = D08["results"][(seed, growth, mech, repeat)]["traj_AB"]
                    traj_ba = D08["results"][(seed, growth, mech, repeat)]["traj_BA"]

                    same_contacts, same_weights = check_full_graph_and_weights_match(
                        traj_ab, traj_ba
                    )

                    state_ab, W_ab, contacts_ab = build_common_start_state(v06_state, traj_ab)
                    state_ba, W_ba, contacts_ba = build_common_start_state(v06_state, traj_ba)

                    for key_s in ("v", "adaptation", "refractory", "threshold", "drive"):
                        assert np.array_equal(state_ab[key_s], state_ba[key_s]), (
                            f"старт отличается! {seed} {growth} {repeat} {mech} {key_s}"
                        )

                    state_ab_ref = {k: v.copy() for k, v in state_ab.items()}
                    state_ba_ref = {k: v.copy() for k, v in state_ba.items()}
                    W_ab_ref = W_ab.copy(); W_ba_ref = W_ba.copy()

                    per_direction = {}
                    per_noise_D = {"A_to_B": [], "B_to_A": []}
                    R_by_noise = {"A_to_B": {"AB": [], "BA": []}, "B_to_A": {"AB": [], "BA": []}}

                    for direction, (stim_group, obs_group) in (
                        ("A_to_B", (GROUP_A, GROUP_B)), ("B_to_A", (GROUP_B, GROUP_A)),
                    ):
                        per_seed_metrics_ab = []
                        per_seed_metrics_ba = []

                        for test_seed in TEST_SEEDS:
                            noise = make_noise(test_seed, PROBE_STEPS, 80)

                            m_ab = compute_metrics_for_pair(state_ab, W_ab, noise, stim_group, obs_group)
                            m_ba = compute_metrics_for_pair(state_ba, W_ba, noise, stim_group, obs_group)

                            assert np.array_equal(W_ab, W_ab_ref) and np.array_equal(W_ba, W_ba_ref)
                            for k_s in state_ab_ref:
                                assert np.array_equal(state_ab[k_s], state_ab_ref[k_s])
                                assert np.array_equal(state_ba[k_s], state_ba_ref[k_s])

                            per_seed_metrics_ab.append(m_ab)
                            per_seed_metrics_ba.append(m_ba)

                            R_by_noise[direction]["AB"].append(m_ab["R_bins"])
                            R_by_noise[direction]["BA"].append(m_ba["R_bins"])

                            D_this_noise = compute_D(m_ab["R_bins"], m_ba["R_bins"])
                            per_noise_D[direction].append(D_this_noise)

                            n_pairs += 2  # one pair (baseline+stimulated) for AB, one for BA

                            if mech == "M3_no_plasticity_weakest":
                                base_match = np.array_equal(m_ab["baseline_spikes"], m_ba["baseline_spikes"])
                                stim_match = np.array_equal(m_ab["stimulated_spikes"], m_ba["stimulated_spikes"])
                                if not (base_match and stim_match and same_contacts and same_weights):
                                    raise AssertionError(
                                        f"M3 КОНТРОЛЬ НЕ ПРОЙДЕН: {seed} {growth} {repeat} {direction} "
                                        f"test_seed={test_seed}: same_contacts={same_contacts} "
                                        f"same_weights={same_weights} base_match={base_match} "
                                        f"stim_match={stim_match} -- ОСТАНАВЛИВАЕМ"
                                    )

                        R_ab_mean = np.mean(R_by_noise[direction]["AB"], axis=0)
                        R_ba_mean = np.mean(R_by_noise[direction]["BA"], axis=0)
                        D_main = compute_D(R_ab_mean, R_ba_mean)

                        per_direction[direction] = {
                            "D_main": D_main,
                            "D_per_noise": per_noise_D[direction],
                            "per_test_seed_AB": per_seed_metrics_ab,
                            "per_test_seed_BA": per_seed_metrics_ba,
                        }

                    results[(seed, growth, repeat, mech)] = {
                        "same_contacts_AB_BA": same_contacts,
                        "same_weights_AB_BA": same_weights,
                        "directions": per_direction,
                    }

            print(f"seed={seed} growth={growth}: все повторы x механизмы завершены")

    t_end = time.time()
    print(f"\nЗавершено: {n_pairs} пар за {t_end - t_start:.1f}с")
    assert n_pairs == 432

    output = {
        "results": results,
        "group_A": GROUP_A, "group_B": GROUP_B,
        "geometry_seeds": GEOMETRY_SEEDS, "growth_conditions": GROWTH_CONDITIONS,
        "repeats": REPEATS, "mechanisms": MECHANISMS, "test_seeds": TEST_SEEDS,
        "probe_duration_ms": PROBE_DURATION_MS, "bin_ms": BIN_MS,
        "snapshot_time_source": SNAPSHOT_TIME, "dt": DT,
        "code_version": CODE_VERSION, "runtime_seconds": t_end - t_start,
    }

    with open("v09_functional_probe_full.pkl", "wb") as f:
        pickle.dump(output, f)

    import os
    size_mb = os.path.getsize("v09_functional_probe_full.pkl") / 1024 / 1024
    print(f"Сохранено: v09_functional_probe_full.pkl ({size_mb:.2f} МБ)")


if __name__ == "__main__":
    main()

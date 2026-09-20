"""
v0.10 полный запуск: обучение M0 (24 траектории) + функциональная
проверка (144 пары) + сравнение с v0.9 (D_M1-D_M0, D_M2-D_M0).

Этап 1: 3 геометрии x 2 истории роста x 2 повтора x 2 порядка (AB/BA),
  M0 = пластичность включена, перестройка выключена (rewire_policy=
  "none" из v10_no_rewiring.py). Те же исходные сети/группы/воздействия/
  электрические шумы, что v0.8 M1/M2/M3.

Этап 2: 24 обученных экземпляра x 2 направления x 3 тестовых шума,
  протокол v0.9 (общий старт из v06 снимка, syn=0, замороженные
  параметры, 200мс, D по 5мс окнам).

Этап 3: парные контрасты с D_M1/D_M2 из v09_functional_probe_full.pkl
  -- проверка совпадения ключей/групп/старта/шумов перед сравнением.
"""
import numpy as np
import pickle
import time

from v10_no_rewiring import run_experience_trajectory, summarize_stim_log
from v05_functional import DT, make_noise
from v09_functional_probe import (
    build_common_start_state, run_direction_probe, compute_R, compute_D,
    check_full_graph_and_weights_match,
)

CODE_VERSION = "v10_full_run.py (M0 control: plasticity without rewiring)"

with open("v06_extended_growth_full.pkl", "rb") as f:
    D06 = pickle.load(f)
with open("v08_experience_full.pkl", "rb") as f:
    D08 = pickle.load(f)
with open("v09_functional_probe_full.pkl", "rb") as f:
    D09 = pickle.load(f)

GEOMETRY_SEEDS = [11, 22, 33]
GROWTH_CONDITIONS = ["Только бюджет", "Совместное"]
REPEATS = [0, 1]
SNAPSHOT_TIME = 96.0

GROUP_A = D08["group_A"]
GROUP_B = D08["group_B"]

# --- consistency checks vs v0.9 before using it for comparison ---
assert np.array_equal(D09["group_A"], GROUP_A), "group_A не совпадает между v0.8/v0.9!"
assert np.array_equal(D09["group_B"], GROUP_B), "group_B не совпадает между v0.8/v0.9!"
assert D09["test_seeds"] == [900, 901, 902], "test_seeds v0.9 неожиданные!"
assert D09["bin_ms"] == 5, "bin_ms v0.9 неожиданный!"
assert D09["snapshot_time_source"] == SNAPSHOT_TIME, "snapshot_time_source не совпадает!"
print("OK: группы, тестовые шумы, snapshot_time_source, bin_ms согласованы с v0.9")

DURATION = 24.0
REWIRE_INTERVAL = 0.5
SEQUENCE_PERIOD = 0.4
FIRST_PULSE_TIME = 0.2
LAG = 0.010
GROUP_SIZE = 5

REWIRE_SEEDS = [42, 43]
NOISE_SEEDS = [1000, 1001]

TEST_SEEDS = [900, 901, 902]
PROBE_DURATION_MS = 200
PROBE_STEPS = int(round(PROBE_DURATION_MS / 1000 / DT))
BIN_MS = 5


def main():
    t_start = time.time()

    # --- Stage 1: train M0 trajectories ---
    m0_trajectories = {}
    n_trained = 0

    for seed in GEOMETRY_SEEDS:
        for growth in GROWTH_CONDITIONS:
            snap = D06["snapshots"][seed][growth][SNAPSHOT_TIME]
            initial_contacts = snap["contacts"]
            initial_weights = snap["weights"]
            initial_state = snap["state"]
            distance = snap["distance"]
            threshold_ref = initial_state["threshold"].copy()
            in_degree_ref = initial_contacts.sum(axis=1)

            for repeat in REPEATS:
                rewire_seed = REWIRE_SEEDS[repeat]
                noise_seed = NOISE_SEEDS[repeat]

                traj_ab = run_experience_trajectory(
                    initial_contacts, initial_weights, initial_state, distance,
                    order="AB", plasticity_enabled=True, rewire_policy="none",
                    group_A=GROUP_A, group_B=GROUP_B,
                    duration=DURATION, rewire_interval=REWIRE_INTERVAL,
                    sequence_period=SEQUENCE_PERIOD, first_pulse_time=FIRST_PULSE_TIME,
                    lag=LAG, rewire_seed=rewire_seed, noise_seed=noise_seed,
                )
                traj_ba = run_experience_trajectory(
                    initial_contacts, initial_weights, initial_state, distance,
                    order="BA", plasticity_enabled=True, rewire_policy="none",
                    group_A=GROUP_A, group_B=GROUP_B,
                    duration=DURATION, rewire_interval=REWIRE_INTERVAL,
                    sequence_period=SEQUENCE_PERIOD, first_pulse_time=FIRST_PULSE_TIME,
                    lag=LAG, rewire_seed=rewire_seed, noise_seed=noise_seed,
                )
                n_trained += 2

                # per-trajectory checks
                for order_label, traj in (("AB", traj_ab), ("BA", traj_ba)):
                    assert np.array_equal(traj["contacts"], initial_contacts), (
                        f"граф изменился в M0! {seed} {growth} {repeat} {order_label}"
                    )
                    assert np.array_equal(traj["contacts"].sum(axis=1), in_degree_ref)
                    assert np.array_equal(traj["state"]["threshold"], threshold_ref)

                assert np.array_equal(traj_ab["contacts"], traj_ba["contacts"]), (
                    f"contacts_AB != contacts_BA в M0! {seed} {growth} {repeat}"
                )

                summ_ab = summarize_stim_log(traj_ab["stim_log"], GROUP_SIZE)
                summ_ba = summarize_stim_log(traj_ba["stim_log"], GROUP_SIZE)
                assert summ_ab["n_assigned_node_spikes"] == summ_ba["n_assigned_node_spikes"]

                # electrical noise consistency vs v0.8 M1: rewire event step
                # schedule (timing) must match (M0 marks them as no-ops)
                traj_m1_ab_ref = D08["results"][(seed, growth, "M1_plasticity_weakest", repeat)]["traj_AB"]
                m0_steps = [e["step"] for e in traj_ab["event_log"]]
                m1_steps = [e["step"] for e in traj_m1_ab_ref["event_log"]]
                assert m0_steps == m1_steps, (
                    f"расписание отметок перестройки не совпадает M0 vs M1! {seed} {growth} {repeat}"
                )

                m0_trajectories[(seed, growth, repeat)] = {"AB": traj_ab, "BA": traj_ba}

            print(f"seed={seed} growth={growth}: M0 обучение (2 повтора x 2 порядка) завершено")

    t_stage1 = time.time()
    print(f"\nЭтап 1 завершён: {n_trained} траекторий M0 за {t_stage1 - t_start:.1f}с")
    assert n_trained == 24

    # --- Stage 2: functional probe on M0 trajectories ---
    functional_results = {}
    n_pairs = 0

    for seed in GEOMETRY_SEEDS:
        for growth in GROWTH_CONDITIONS:
            v06_state = D06["snapshots"][seed][growth][SNAPSHOT_TIME]["state"]

            for repeat in REPEATS:
                traj_ab = m0_trajectories[(seed, growth, repeat)]["AB"]
                traj_ba = m0_trajectories[(seed, growth, repeat)]["BA"]

                same_contacts, same_weights = check_full_graph_and_weights_match(traj_ab, traj_ba)
                assert same_contacts, f"M0: contacts_AB != contacts_BA на пробе! {seed} {growth} {repeat}"

                state_ab, W_ab, _ = build_common_start_state(v06_state, traj_ab)
                state_ba, W_ba, _ = build_common_start_state(v06_state, traj_ba)

                for key_s in ("v", "adaptation", "refractory", "threshold", "drive"):
                    assert np.array_equal(state_ab[key_s], state_ba[key_s])

                state_ab_ref = {k: v.copy() for k, v in state_ab.items()}
                state_ba_ref = {k: v.copy() for k, v in state_ba.items()}
                W_ab_ref = W_ab.copy(); W_ba_ref = W_ba.copy()

                per_direction = {}
                for direction, (stim_group, obs_group) in (
                    ("A_to_B", (GROUP_A, GROUP_B)), ("B_to_A", (GROUP_B, GROUP_A)),
                ):
                    R_by_noise_ab, R_by_noise_ba = [], []
                    per_noise_D = []

                    for test_seed in TEST_SEEDS:
                        noise = make_noise(test_seed, PROBE_STEPS, 80)

                        base_ab, stim_ab = run_direction_probe(state_ab, W_ab, noise, stim_group, obs_group)
                        base_ba, stim_ba = run_direction_probe(state_ba, W_ba, noise, stim_group, obs_group)

                        assert np.array_equal(W_ab, W_ab_ref) and np.array_equal(W_ba, W_ba_ref)
                        for k_s in state_ab_ref:
                            assert np.array_equal(state_ab[k_s], state_ab_ref[k_s])
                            assert np.array_equal(state_ba[k_s], state_ba_ref[k_s])

                        R_ab = compute_R(base_ab, stim_ab, obs_group, bin_ms=BIN_MS)
                        R_ba = compute_R(base_ba, stim_ba, obs_group, bin_ms=BIN_MS)
                        R_by_noise_ab.append(R_ab)
                        R_by_noise_ba.append(R_ba)
                        per_noise_D.append(compute_D(R_ab, R_ba))

                        n_pairs += 2  # one pair for AB, one for BA

                    R_ab_mean = np.mean(R_by_noise_ab, axis=0)
                    R_ba_mean = np.mean(R_by_noise_ba, axis=0)
                    D_main = compute_D(R_ab_mean, R_ba_mean)

                    per_direction[direction] = {"D_main": D_main, "D_per_noise": per_noise_D}

                functional_results[(seed, growth, repeat)] = {
                    "same_contacts_AB_BA": same_contacts,
                    "same_weights_AB_BA": same_weights,
                    "directions": per_direction,
                }

    t_stage2 = time.time()
    print(f"Этап 2 завершён: {n_pairs} пар за {t_stage2 - t_stage1:.1f}с")
    assert n_pairs == 144

    # --- Stage 3: contrasts with v0.9 (D_M1 - D_M0, D_M2 - D_M0) ---
    contrasts = {}
    for seed in GEOMETRY_SEEDS:
        for growth in GROWTH_CONDITIONS:
            for repeat in REPEATS:
                D0 = functional_results[(seed, growth, repeat)]["directions"]
                D1 = D09["results"][(seed, growth, repeat, "M1_plasticity_weakest")]["directions"]
                D2 = D09["results"][(seed, growth, repeat, "M2_plasticity_random")]["directions"]

                row = {}
                for direction in ("A_to_B", "B_to_A"):
                    d_m0 = D0[direction]["D_main"]
                    d_m1 = D1[direction]["D_main"]
                    d_m2 = D2[direction]["D_main"]
                    row[direction] = {
                        "D_M0": d_m0, "D_M1": d_m1, "D_M2": d_m2,
                        "delta_weakest": d_m1 - d_m0,
                        "delta_random": d_m2 - d_m0,
                    }
                contrasts[(seed, growth, repeat)] = row

    t_end = time.time()
    print(f"Этап 3 (контрасты) завершён. Итого за {t_end - t_start:.1f}с")

    output = {
        "m0_trajectories": m0_trajectories,
        "functional_results": functional_results,
        "contrasts": contrasts,
        "group_A": GROUP_A, "group_B": GROUP_B,
        "geometry_seeds": GEOMETRY_SEEDS, "growth_conditions": GROWTH_CONDITIONS,
        "repeats": REPEATS, "test_seeds": TEST_SEEDS,
        "duration": DURATION, "rewire_interval": REWIRE_INTERVAL,
        "bin_ms": BIN_MS, "snapshot_time_source": SNAPSHOT_TIME, "dt": DT,
        "code_version": CODE_VERSION, "runtime_seconds": t_end - t_start,
    }

    with open("v10_m0_control_full.pkl", "wb") as f:
        pickle.dump(output, f)

    import os
    size_mb = os.path.getsize("v10_m0_control_full.pkl") / 1024 / 1024
    print(f"Сохранено: v10_m0_control_full.pkl ({size_mb:.2f} МБ)")


if __name__ == "__main__":
    main()

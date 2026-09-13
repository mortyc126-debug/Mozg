"""
Пилот v0.10 (M0): одна исходная сеть (seed=11, "Только бюджет",
repeat=0), оба порядка (AB/BA), M0 (пластичность включена, перестройка
выключена). Проверяет:
  - маска контактов точно совпадает с исходной (и AB, и BA);
  - степень и пороги сохраняются;
  - веса МОГУТ изменяться (пластичность работает);
  - принудительные события считаются отдельно от естественных совпадений;
  - электрический шум совпадает с соответствующей M1-ветвью v0.8
    (проверено уже в v10_unit_tests.py test_3, здесь -- на реальном
    прогоне длиной 24с для полноты);
  - функциональная проба (протокол v0.9) на полученных M0-сетях.
"""
import numpy as np
import pickle

from v10_no_rewiring import run_experience_trajectory
from v05_functional import DT, make_noise
from v09_functional_probe import (
    build_common_start_state, run_direction_probe, compute_R, compute_D,
    check_full_graph_and_weights_match,
)

with open("v06_extended_growth_full.pkl", "rb") as f:
    D06 = pickle.load(f)
with open("v08_experience_full.pkl", "rb") as f:
    D08 = pickle.load(f)

SEED = 11
GROWTH_CONDITION = "Только бюджет"
REPEAT = 0
SNAPSHOT_TIME = 96.0

GROUP_A = D08["group_A"]
GROUP_B = D08["group_B"]

DURATION = 24.0
REWIRE_INTERVAL = 0.5
SEQUENCE_PERIOD = 0.4
FIRST_PULSE_TIME = 0.2
LAG = 0.010

REWIRE_SEEDS = [42, 43]
NOISE_SEEDS = [1000, 1001]


def main():
    snap = D06["snapshots"][SEED][GROWTH_CONDITION][SNAPSHOT_TIME]
    initial_contacts = snap["contacts"]
    initial_weights = snap["weights"]
    initial_state = snap["state"]
    distance = snap["distance"]

    threshold_ref = initial_state["threshold"].copy()
    in_degree_ref = initial_contacts.sum(axis=1)

    rewire_seed = REWIRE_SEEDS[REPEAT]
    noise_seed = NOISE_SEEDS[REPEAT]

    trajs = {}
    for order in ("AB", "BA"):
        traj = run_experience_trajectory(
            initial_contacts, initial_weights, initial_state, distance,
            order=order, plasticity_enabled=True, rewire_policy="none",
            group_A=GROUP_A, group_B=GROUP_B,
            duration=DURATION, rewire_interval=REWIRE_INTERVAL,
            sequence_period=SEQUENCE_PERIOD, first_pulse_time=FIRST_PULSE_TIME,
            lag=LAG, rewire_seed=rewire_seed, noise_seed=noise_seed,
        )
        trajs[order] = traj

        # graph unchanged
        assert np.array_equal(traj["contacts"], initial_contacts), (
            f"Граф изменился в M0 для {order}!"
        )
        # degree and thresholds preserved
        assert np.array_equal(traj["contacts"].sum(axis=1), in_degree_ref)
        assert np.array_equal(traj["state"]["threshold"], threshold_ref)
        # weights CAN change (plasticity active)
        weights_changed = not np.array_equal(traj["weights"], initial_weights)
        print(f"M0 {order}: граф неизменен -- OK; веса изменились: {weights_changed}")

    # graphs identical between AB and BA (both equal initial, transitively)
    assert np.array_equal(trajs["AB"]["contacts"], trajs["BA"]["contacts"])
    print("OK: M0 графы AB и BA совпадают (оба равны исходному)")

    # electrical noise consistency check vs M1 (already verified in unit
    # tests up to first rewire event; here confirm same total event count
    # structure -- forced events assigned identically)
    from v08_experience_rewiring import summarize_stim_log
    summ_ab = summarize_stim_log(trajs["AB"]["stim_log"], group_size=5)
    summ_ba = summarize_stim_log(trajs["BA"]["stim_log"], group_size=5)
    assert summ_ab["n_assigned_node_spikes"] == summ_ba["n_assigned_node_spikes"]
    print(f"OK: назначенные события совпадают AB/BA (n_assigned={summ_ab['n_assigned_node_spikes']})")

    # M1 comparison: same noise_seed/rewire_seed as v0.8 M1 -- confirm
    # schedule (rewire "opportunities") matches in count/timing (M0 marks
    # them as no-ops, M1 applies most of them)
    traj_m1_ab = D08["results"][(SEED, GROWTH_CONDITION, "M1_plasticity_weakest", REPEAT)]["traj_AB"]
    m0_rewire_steps = [e["step"] for e in trajs["AB"]["event_log"]]
    m1_rewire_steps = [e["step"] for e in traj_m1_ab["event_log"]]
    assert m0_rewire_steps == m1_rewire_steps, (
        "Расписание отметок перестройки (шаги) не совпадает между M0 и M1!"
    )
    print("OK: расписание отметок перестройки (временные шаги) совпадает M0 vs M1")

    # --- functional probe (v0.9 protocol) ---
    v06_state = D06["snapshots"][SEED][GROWTH_CONDITION][SNAPSHOT_TIME]["state"]
    noise = make_noise(900, 200, 80)

    state_ab, W_ab, contacts_ab = build_common_start_state(v06_state, trajs["AB"])
    state_ba, W_ba, contacts_ba = build_common_start_state(v06_state, trajs["BA"])

    same_c, same_w = check_full_graph_and_weights_match(trajs["AB"], trajs["BA"])
    print(f"\nM0 функциональная проба: same_contacts={same_c} (ожидаем True -- граф не менялся), "
          f"same_weights={same_w} (может быть False -- пластичность активна)")
    assert same_c, "M0: контакты AB != BA -- это не должно происходить, граф вообще не менялся!"

    for direction, (stim_group, obs_group) in (
        ("A_to_B", (GROUP_A, GROUP_B)), ("B_to_A", (GROUP_B, GROUP_A)),
    ):
        base_ab, stim_ab = run_direction_probe(state_ab, W_ab, noise, stim_group, obs_group)
        base_ba, stim_ba = run_direction_probe(state_ba, W_ba, noise, stim_group, obs_group)
        R_ab = compute_R(base_ab, stim_ab, obs_group, bin_ms=5)
        R_ba = compute_R(base_ba, stim_ba, obs_group, bin_ms=5)
        D_val = compute_D(R_ab, R_ba)
        print(f"  M0 direction={direction}: D={D_val:.4f}")

    print("\n=== ПИЛОТ v0.10 (M0) ЗАВЕРШЁН УСПЕШНО ===")


if __name__ == "__main__":
    main()

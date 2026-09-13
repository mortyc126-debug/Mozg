"""
Пилот v0.8 (версия 2, после исправления семантики совпадающих событий
-- см. v08_unit_tests.py): одна исходная сеть, все шесть ветвей,
короткий прогон для проверки инвариантов ПЕРЕД полным набором.
"""
import numpy as np
import pickle

from v08_experience_rewiring import run_experience_trajectory

with open("v06_extended_growth_full.pkl", "rb") as f:
    D06 = pickle.load(f)

SEED = 11
GROWTH_CONDITION = "Только бюджет"
SNAPSHOT_TIME = 96.0

GROUP_A = np.array([3, 6, 9, 54, 60])
GROUP_B = np.array([21, 34, 44, 46, 77])

BRANCHES = [
    (True, "weakest", "main: plasticity + weakest"),
    (True, "random", "control_selection: plasticity + random"),
    (False, "weakest", "control_plasticity: no plasticity + weakest"),
]

DURATION = 2.0
REWIRE_INTERVAL = 0.5
SEQUENCE_PERIOD = 0.4
FIRST_PULSE_TIME = 0.2
LAG = 0.010

REWIRE_SEED = 42
NOISE_SEED = 1000


def main():
    snap = D06["snapshots"][SEED][GROWTH_CONDITION][SNAPSHOT_TIME]
    initial_contacts = snap["contacts"]
    initial_weights = snap["weights"]
    initial_state = snap["state"]
    distance = snap["distance"]

    threshold_ref = initial_state["threshold"].copy()
    in_degree_ref = initial_contacts.sum(axis=1)

    results = {}

    for plasticity, policy, label in BRANCHES:
        for order in ("AB", "BA"):
            traj = run_experience_trajectory(
                initial_contacts, initial_weights, initial_state, distance,
                order=order, plasticity_enabled=plasticity, rewire_policy=policy,
                group_A=GROUP_A, group_B=GROUP_B,
                duration=DURATION, rewire_interval=REWIRE_INTERVAL,
                sequence_period=SEQUENCE_PERIOD, first_pulse_time=FIRST_PULSE_TIME,
                lag=LAG, rewire_seed=REWIRE_SEED, noise_seed=NOISE_SEED,
            )
            results[(plasticity, policy, order)] = traj

            n_assigned = len(traj["stim_log"])
            n_overlap = sum(e["n_overlap_with_natural"] > 0 for e in traj["stim_log"])
            n_added_to_natural = sum(
                len(e["nodes"]) - e["n_overlap_with_natural"] for e in traj["stim_log"]
            )
            print(f"\n--- {label}, order={order} ---")
            print(f"  n_events_assigned={n_assigned}  "
                  f"n_timestamps_with_overlap={n_overlap}  "
                  f"n_nodes_added_beyond_natural={n_added_to_natural}")
            print(f"  n_rewire_events_applied={sum(1 for e in traj['event_log'] if e.get('status')=='applied')}")

            assert np.array_equal(traj["state"]["threshold"], threshold_ref), (
                f"threshold изменился! {label} {order}"
            )
            in_degree_final = traj["contacts"].sum(axis=1)
            assert np.array_equal(in_degree_final, in_degree_ref), (
                f"входящая степень изменилась! {label} {order}"
            )

    print("\nOK: пороги и входящая степень неизменны во всех 6 ветвях")

    for plasticity, policy, label in BRANCHES:
        n_ab = len(results[(plasticity, policy, "AB")]["stim_log"])
        n_ba = len(results[(plasticity, policy, "BA")]["stim_log"])
        assert n_ab == n_ba, f"разное НАЗНАЧЕННОЕ число импульсов AB={n_ab} BA={n_ba} для {label}"
    print("OK: одинаковое НАЗНАЧЕННОЕ число внешних импульсов между AB и BA во всех ветвях")

    def structural_signature(traj):
        return [
            (e.get("receiver"), e.get("old_source"), e.get("new_source"), e.get("status"))
            for e in traj["event_log"]
        ]

    traj_ab = results[(True, "random", "AB")]
    traj_ba = results[(True, "random", "BA")]
    sig_ab = structural_signature(traj_ab)
    sig_ba = structural_signature(traj_ba)
    print(f"\nControl (a) random+plasticity: AB structural events == BA: {sig_ab == sig_ba}")
    assert sig_ab == sig_ba, "КОНТРОЛЬ (а) НЕ ПРОЙДЕН!"

    traj_ab2 = results[(False, "weakest", "AB")]
    traj_ba2 = results[(False, "weakest", "BA")]
    sig_ab2 = structural_signature(traj_ab2)
    sig_ba2 = structural_signature(traj_ba2)
    print(f"Control (b) weakest+no-plasticity: AB structural events == BA: {sig_ab2 == sig_ba2}")
    assert sig_ab2 == sig_ba2, "КОНТРОЛЬ (б) НЕ ПРОЙДЕН!"

    print("\nOK: оба структурных контроля пройдены (AB==BA структурно, как ожидалось)")

    traj_main_ab = results[(True, "weakest", "AB")]
    traj_main_ba = results[(True, "weakest", "BA")]
    sig_main_ab = structural_signature(traj_main_ab)
    sig_main_ba = structural_signature(traj_main_ba)
    print(f"\nОсновная ветвь (weakest+plasticity): AB структурно == BA: {sig_main_ab == sig_main_ba} "
          f"(НЕ являются ожиданием результата на этом шаге)")

    # explicit collision check: at least one timestamp had BOTH rewire and stim scheduled
    rewire_steps = set(e["step"] for e in traj_main_ab["event_log"])
    stim_steps = set(e["step"] for e in traj_main_ab["stim_log"])
    collisions = rewire_steps & stim_steps
    print(f"\nКоллизии перестройка+стимул в этом пилоте (2с): {sorted(collisions)}")

    pilot_record = {
        "seed": SEED, "growth_condition": GROWTH_CONDITION,
        "group_A": GROUP_A, "group_B": GROUP_B,
        "results": {str(k): v for k, v in results.items()},
    }
    with open("v08_pilot_record.pkl", "wb") as f:
        pickle.dump(pilot_record, f)
    with open("v08_pilot_record.pkl", "rb") as f:
        reloaded = pickle.load(f)
    assert np.array_equal(
        reloaded["results"][str((True, "weakest", "AB"))]["spikes"],
        traj_main_ab["spikes"],
    )
    print("OK: сохранение/загрузка согласованы")

    print("\n=== ПИЛОТ v0.8 (версия 2) ЗАВЕРШЁН УСПЕШНО ===")


if __name__ == "__main__":
    main()

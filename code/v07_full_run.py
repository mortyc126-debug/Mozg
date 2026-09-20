"""
v0.7 полный запуск: 3 геометрии x 2 истории роста x 3 политики x
2 повтора (шум+расписание) = 36 траекторий, 24с каждая, замена каждые
0.5с (48 возможностей замены на траекторию).

Снимки на t=0, 12, 24с (снимок ПОСЛЕ запланированной на эту отметку
замены). Электрическая динамика: v05_functional.py::frozen_step
(рост/пластичность/нормировка/пороги выключены; адаптация, рефрактерность,
передача включены). Перестройка -- ЕДИНСТВЕННЫЙ механизм изменения связей
в этом эксперименте.
"""
import numpy as np
import pickle
import time

from v07_rewiring import run_rewiring_trajectory, verify_invariants

CODE_VERSION = "v07_full_run.py (structural rewiring, 36 trajectories)"

with open("v06_extended_growth_full.pkl", "rb") as f:
    D06 = pickle.load(f)

GEOMETRY_SEEDS = [11, 22, 33]
GROWTH_CONDITIONS = ["Только бюджет", "Совместное"]
POLICIES = ["none", "random", "weakest"]
REPEATS = [0, 1]  # two pre-chosen noise/schedule realizations

DURATION = 24.0
REWIRE_INTERVAL = 0.5
SNAPSHOT_TIME = 96.0  # source snapshot from v0.6

# Pre-chosen seeds for the two repeats (fixed, not re-drawn per trajectory)
REWIRE_SEEDS = [42, 43]
NOISE_SEEDS = [1000, 1001]


def summarize_trajectory(initial_contacts, initial_weights, result):
    """Structural + dynamic summary for one trajectory."""
    from v06_structural_summary import jaccard

    applied_events = [e for e in result["event_log"] if e.get("status") == "applied"]
    n_events_applied = len(applied_events)
    n_control_marks_no_op = len([
        e for e in result["event_log"] if e.get("status") == "policy_none_no_op"
    ])
    n_events_skipped_no_candidates = len([
        e for e in result["event_log"]
        if e.get("status") in ("skipped_no_eligible_receiver", "skipped_no_candidates_or_no_sources")
    ])

    receivers_touched = [e["receiver"] for e in applied_events]
    unique_receivers = len(set(receivers_touched))

    created_edges = [(e["receiver"], e["new_source"]) for e in applied_events]
    removed_edges = [(e["receiver"], e["old_source"]) for e in applied_events]
    unique_created = len(set(created_edges))
    unique_removed = len(set(removed_edges))

    # Two DISTINCT phenomena (not interchangeable, per spec):
    #   (a) re-removal of a recently-created contact: edge just created by
    #       an EARLIER event in this trajectory gets removed again later
    #   (b) restoration of a previously-removed contact: edge (receiver,
    #       source) that existed at t=0 (or was created and removed once
    #       already), gets recreated
    created_so_far = set()   # edges added since trajectory start, currently present due to rewiring
    ever_removed = set()     # edges removed at least once during this trajectory
    re_removed_recent = 0
    restored_previously_removed = 0
    for e in applied_events:
        edge_removed = (e["receiver"], e["old_source"])
        edge_created = (e["receiver"], e["new_source"])

        if edge_removed in created_so_far:
            re_removed_recent += 1
        created_so_far.discard(edge_removed)
        ever_removed.add(edge_removed)

        if edge_created in ever_removed:
            restored_previously_removed += 1
        created_so_far.add(edge_created)

    j_final_vs_initial = jaccard(initial_contacts, result["contacts"])

    lengths_transferred = [e["new_length"] for e in applied_events]
    weights_transferred = [e["transferred_weight"] for e in applied_events]

    final_spikes = result["spikes"]
    tail = final_spikes[-int(round(2.0 / 0.001)):]
    rates = tail.sum(axis=0) / 2.0
    silent_fraction = float(np.mean(rates == 0))
    rate_hz = float(rates.mean())

    return {
        "n_events_applied": n_events_applied,
        "n_control_marks_no_op": n_control_marks_no_op,
        "n_events_skipped_no_candidates": n_events_skipped_no_candidates,
        "unique_receivers_touched": unique_receivers,
        "unique_created_edges": unique_created,
        "unique_removed_edges": unique_removed,
        "re_removed_recently_created": re_removed_recent,
        "restored_previously_removed": restored_previously_removed,
        "jaccard_final_vs_initial": j_final_vs_initial,
        "n_edges_differing_final_vs_initial": int(
            np.logical_xor(initial_contacts, result["contacts"]).sum()
        ),
        "mean_new_length": float(np.mean(lengths_transferred)) if lengths_transferred else np.nan,
        "mean_transferred_weight": float(np.mean(weights_transferred)) if weights_transferred else np.nan,
        "final_rate_hz": rate_hz,
        "final_silent_fraction": silent_fraction,
    }


def main():
    t_start = time.time()
    results = {}
    n_trajectories = 0

    for seed in GEOMETRY_SEEDS:
        for growth_cond in GROWTH_CONDITIONS:
            snap = D06["snapshots"][seed][growth_cond][SNAPSHOT_TIME]
            initial_contacts = snap["contacts"]
            initial_weights = snap["weights"]
            initial_state = snap["state"]
            distance = snap["distance"]

            for policy in POLICIES:
                for repeat_idx in REPEATS:
                    rewire_seed = REWIRE_SEEDS[repeat_idx]
                    noise_seed = NOISE_SEEDS[repeat_idx]

                    traj = run_rewiring_trajectory(
                        initial_contacts, initial_weights, initial_state, distance,
                        policy=policy, duration=DURATION, rewire_interval=REWIRE_INTERVAL,
                        rewire_seed=rewire_seed, noise_seed=noise_seed,
                    )

                    ok, checks = verify_invariants(initial_contacts, initial_weights, traj)
                    if not ok:
                        raise AssertionError(
                            f"Инварианты нарушены: seed={seed} growth={growth_cond} "
                            f"policy={policy} repeat={repeat_idx}: {checks}"
                        )

                    summary = summarize_trajectory(initial_contacts, initial_weights, traj)

                    key = (seed, growth_cond, policy, repeat_idx)
                    results[key] = {
                        "geometry_seed": seed,
                        "growth_condition": growth_cond,
                        "policy": policy,
                        "repeat_index": repeat_idx,
                        "rewire_seed": rewire_seed,
                        "noise_seed": noise_seed,
                        "event_log": traj["event_log"],
                        "snapshots": traj["snapshots"],
                        "spikes": traj["spikes"],
                        "invariant_checks": checks,
                        "summary": summary,
                    }
                    n_trajectories += 1

            print(f"seed={seed} growth={growth_cond}: все 3 политики x 2 повтора завершены")

    t_end = time.time()
    print(f"\nЗавершено: {n_trajectories} траекторий за {t_end - t_start:.1f}с")
    assert n_trajectories == 36

    output = {
        "results": results,
        "geometry_seeds": GEOMETRY_SEEDS,
        "growth_conditions": GROWTH_CONDITIONS,
        "policies": POLICIES,
        "repeats": REPEATS,
        "duration": DURATION,
        "rewire_interval": REWIRE_INTERVAL,
        "snapshot_time_source": SNAPSHOT_TIME,
        "rewire_seeds": REWIRE_SEEDS,
        "noise_seeds": NOISE_SEEDS,
        "dt": 0.001,
        "code_version": CODE_VERSION,
        "runtime_seconds": t_end - t_start,
    }

    with open("v07_rewiring_full.pkl", "wb") as f:
        pickle.dump(output, f)

    import os
    size_mb = os.path.getsize("v07_rewiring_full.pkl") / 1024 / 1024
    print(f"Сохранено: v07_rewiring_full.pkl ({size_mb:.2f} МБ)")


if __name__ == "__main__":
    main()

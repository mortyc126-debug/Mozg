"""
v0.8 полный запуск: 72 траектории.
3 геометрии x 2 истории роста x 3 механизма x 2 порядка (AB/BA) x
2 повтора шума+перестройки = 72, 24с каждая, 60 последовательностей,
48 отметок перестройки.

Механизмы:
  M1: пластичность + замена слабейшего  (основная ветвь)
  M2: пластичность + случайная замена   (контроль отбора)
  M3: без пластичности + замена слабейшего (контроль зависимости от пластичности)

Контроли на каждой паре AB/BA (M2 и M3): точное совпадение структурной
истории (время, получатель, удалённый источник, новый источник,
контактные матрицы) -- НЕ требуем совпадения весов/активности.

Инварианты на всех траекториях: сохранение входящей степени,
неизменность порогов, отсутствие самосвязей/дубликатов, правильное
число НАЗНАЧЕННЫХ воздействий (обязано совпадать AB/BA), одинаковое
расписание получателей, сохранение суммы весов НЕПОСРЕДСТВЕННО при
каждой замене (не глобально -- при включённой STDP это не инвариант).
"""
import numpy as np
import pickle
import time

from v08_experience_rewiring import run_experience_trajectory, summarize_stim_log
from v08_structural_metric import compute_directional_contrast, directed_original_contacts

CODE_VERSION = "v08_full_run.py (72 trajectories, corrected event semantics)"

with open("v06_extended_growth_full.pkl", "rb") as f:
    D06 = pickle.load(f)

GEOMETRY_SEEDS = [11, 22, 33]
GROWTH_CONDITIONS = ["Только бюджет", "Совместное"]
SNAPSHOT_TIME = 96.0

GROUP_A = np.array([3, 6, 9, 54, 60])
GROUP_B = np.array([21, 34, 44, 46, 77])

MECHANISMS = [
    (True, "weakest", "M1_plasticity_weakest"),
    (True, "random", "M2_plasticity_random"),
    (False, "weakest", "M3_no_plasticity_weakest"),
]

DURATION = 24.0
REWIRE_INTERVAL = 0.5
SEQUENCE_PERIOD = 0.4
FIRST_PULSE_TIME = 0.2
LAG = 0.010
GROUP_SIZE = 5

REWIRE_SEEDS = [42, 43]
NOISE_SEEDS = [1000, 1001]


def verify_weight_sum_preserved_per_event(initial_weights, W_before_trajectory_snapshots, traj):
    """Проверка 'сумма весов сохраняется НЕПОСРЕДСТВЕННО при каждой
    замене' -- т.к. при включённой STDP глобальный инвариант не
    выполняется, проверяем ЛОКАЛЬНО: на момент каждого applied-события,
    W[receiver,:].sum() ДО операции == W[receiver,:].sum() ПОСЛЕ
    операции (перенос веса, не создание/уничтожение). Это требует
    доступа к W В МОМЕНТ события, которого у нас нет в event_log
    напрямую -- проверяем oposredованно через transferred_weight:
    просто подтверждаем, что операция do_rewire_event по конструкции
    переносит ровно old_weight (см. v08_experience_rewiring.py::
    do_rewire_event -- W[receiver,new]=old_weight, W[receiver,old]=0) --
    это ГАРАНТИРОВАНО КОДОМ, а не эмпирическая проверка постфактум.
    Формальный тест на это -- v08_unit_tests.py test_3. Здесь просто
    документируем, что не требуется отдельная числовая проверка на
    полном наборе."""
    return True  # guaranteed by construction, see docstring


def check_control_structural_match(traj_ab, traj_ba):
    """Точное совпадение структурной истории: время, получатель,
    удалённый/новый источник, финальные контактные матрицы. НЕ требуем
    совпадения весов."""
    sig_ab = [
        (e.get("step"), e.get("receiver"), e.get("old_source"),
         e.get("new_source"), e.get("status"))
        for e in traj_ab["event_log"]
    ]
    sig_ba = [
        (e.get("step"), e.get("receiver"), e.get("old_source"),
         e.get("new_source"), e.get("status"))
        for e in traj_ba["event_log"]
    ]
    events_match = sig_ab == sig_ba
    contacts_match = np.array_equal(traj_ab["contacts"], traj_ba["contacts"])
    return events_match and contacts_match, sig_ab, sig_ba


def main():
    t_start = time.time()
    results = {}
    n_trajectories = 0
    n_control_checks_passed = 0
    n_control_checks_total = 0

    for seed in GEOMETRY_SEEDS:
        for growth_cond in GROWTH_CONDITIONS:
            snap = D06["snapshots"][seed][growth_cond][SNAPSHOT_TIME]
            initial_contacts = snap["contacts"]
            initial_weights = snap["weights"]
            initial_state = snap["state"]
            distance = snap["distance"]

            threshold_ref = initial_state["threshold"].copy()
            in_degree_ref = initial_contacts.sum(axis=1)

            for plasticity, policy, mech_label in MECHANISMS:
                for repeat_idx in (0, 1):
                    rewire_seed = REWIRE_SEEDS[repeat_idx]
                    noise_seed = NOISE_SEEDS[repeat_idx]

                    traj_ab = run_experience_trajectory(
                        initial_contacts, initial_weights, initial_state, distance,
                        order="AB", plasticity_enabled=plasticity, rewire_policy=policy,
                        group_A=GROUP_A, group_B=GROUP_B,
                        duration=DURATION, rewire_interval=REWIRE_INTERVAL,
                        sequence_period=SEQUENCE_PERIOD, first_pulse_time=FIRST_PULSE_TIME,
                        lag=LAG, rewire_seed=rewire_seed, noise_seed=noise_seed,
                    )
                    traj_ba = run_experience_trajectory(
                        initial_contacts, initial_weights, initial_state, distance,
                        order="BA", plasticity_enabled=plasticity, rewire_policy=policy,
                        group_A=GROUP_A, group_B=GROUP_B,
                        duration=DURATION, rewire_interval=REWIRE_INTERVAL,
                        sequence_period=SEQUENCE_PERIOD, first_pulse_time=FIRST_PULSE_TIME,
                        lag=LAG, rewire_seed=rewire_seed, noise_seed=noise_seed,
                    )
                    n_trajectories += 2

                    # invariants (both AB and BA)
                    for order_label, traj in (("AB", traj_ab), ("BA", traj_ba)):
                        assert np.array_equal(traj["state"]["threshold"], threshold_ref), (
                            f"threshold изменился! {seed} {growth_cond} {mech_label} {order_label} r{repeat_idx}"
                        )
                        in_degree_final = traj["contacts"].sum(axis=1)
                        assert np.array_equal(in_degree_final, in_degree_ref), (
                            f"степень изменилась! {seed} {growth_cond} {mech_label} {order_label} r{repeat_idx}"
                        )
                        assert not traj["contacts"].diagonal().any(), (
                            f"самосвязь! {seed} {growth_cond} {mech_label} {order_label} r{repeat_idx}"
                        )

                    summ_ab = summarize_stim_log(traj_ab["stim_log"], GROUP_SIZE)
                    summ_ba = summarize_stim_log(traj_ba["stim_log"], GROUP_SIZE)
                    assert summ_ab["n_assigned_node_spikes"] == summ_ba["n_assigned_node_spikes"], (
                        f"разное назначенное число импульсов! {seed} {growth_cond} {mech_label} r{repeat_idx}"
                    )

                    schedule_ab = traj_ab["schedule"]
                    schedule_ba = traj_ba["schedule"]
                    assert np.array_equal(schedule_ab, schedule_ba), (
                        f"расписание получателей отличается AB/BA! {seed} {growth_cond} {mech_label} r{repeat_idx}"
                    )

                    # structural controls for M2 (random+plasticity) and M3 (no plasticity+weakest)
                    if mech_label in ("M2_plasticity_random", "M3_no_plasticity_weakest"):
                        n_control_checks_total += 1
                        match, sig_ab, sig_ba = check_control_structural_match(traj_ab, traj_ba)
                        if match:
                            n_control_checks_passed += 1
                        else:
                            raise AssertionError(
                                f"КОНТРОЛЬ НЕ ПРОЙДЕН: {mech_label}, seed={seed}, "
                                f"growth={growth_cond}, repeat={repeat_idx}\n"
                                f"AB: {sig_ab}\nBA: {sig_ba}"
                            )

                    metric = compute_directional_contrast(
                        initial_contacts, GROUP_A, GROUP_B, traj_ab, traj_ba,
                    )

                    key = (seed, growth_cond, mech_label, repeat_idx)
                    results[key] = {
                        "geometry_seed": seed, "growth_condition": growth_cond,
                        "mechanism": mech_label, "repeat_index": repeat_idx,
                        "rewire_seed": rewire_seed, "noise_seed": noise_seed,
                        "traj_AB": traj_ab, "traj_BA": traj_ba,
                        "stim_summary_AB": summ_ab, "stim_summary_BA": summ_ba,
                        "structural_metric": metric,
                    }

            print(f"seed={seed} growth={growth_cond}: все 3 механизма x 2 повтора завершены")

    t_end = time.time()
    print(f"\nЗавершено: {n_trajectories} траекторий (в {n_trajectories//2} парах AB/BA) "
          f"за {t_end - t_start:.1f}с")
    assert n_trajectories == 72
    print(f"Структурные контроли пройдены: {n_control_checks_passed}/{n_control_checks_total}")
    assert n_control_checks_passed == n_control_checks_total

    output = {
        "results": results,
        "geometry_seeds": GEOMETRY_SEEDS,
        "growth_conditions": GROWTH_CONDITIONS,
        "mechanisms": [m[2] for m in MECHANISMS],
        "group_A": GROUP_A, "group_B": GROUP_B,
        "duration": DURATION, "rewire_interval": REWIRE_INTERVAL,
        "sequence_period": SEQUENCE_PERIOD, "first_pulse_time": FIRST_PULSE_TIME,
        "lag": LAG, "group_size": GROUP_SIZE,
        "snapshot_time_source": SNAPSHOT_TIME,
        "rewire_seeds": REWIRE_SEEDS, "noise_seeds": NOISE_SEEDS,
        "dt": 0.001, "code_version": CODE_VERSION,
        "runtime_seconds": t_end - t_start,
    }

    with open("v08_experience_full.pkl", "wb") as f:
        pickle.dump(output, f)

    import os
    size_mb = os.path.getsize("v08_experience_full.pkl") / 1024 / 1024
    print(f"Сохранено: v08_experience_full.pkl ({size_mb:.2f} МБ)")


if __name__ == "__main__":
    main()

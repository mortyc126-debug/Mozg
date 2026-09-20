"""
Unit-тесты v0.10: проверяют, что добавление rewire_policy="none" НЕ
затронуло путь STDP/электрической динамики, и что M0-траектория ведёт
себя согласно спецификации (граф не меняется, шум идентичен
соответствующей M1/M2 ветви v0.8, степень/пороги сохраняются).
"""
import numpy as np
import pickle
from v10_no_rewiring import run_experience_trajectory as run_v10
from v08_experience_rewiring import run_experience_trajectory as run_v08


def test_1_none_policy_never_changes_graph():
    """При rewire_policy='none' граф должен остаться ИДЕНТИЧНЫМ исходному
    на всей траектории (проверяем конечное состояние -- по построению
    do_rewire_event никогда не вызывается)."""
    with open("v06_extended_growth_full.pkl", "rb") as f:
        d06 = pickle.load(f)
    snap = d06["snapshots"][11]["Только бюджет"][96.0]

    traj = run_v10(
        snap["contacts"], snap["weights"], snap["state"], snap["distance"],
        order="AB", plasticity_enabled=True, rewire_policy="none",
        group_A=np.array([3, 6, 9, 54, 60]), group_B=np.array([21, 34, 44, 46, 77]),
        duration=2.0, rewire_interval=0.5, sequence_period=0.4,
        first_pulse_time=0.2, lag=0.010, rewire_seed=42, noise_seed=1000,
    )
    assert np.array_equal(traj["contacts"], snap["contacts"]), (
        "Граф изменился при rewire_policy='none'!"
    )
    n_noop = sum(1 for e in traj["event_log"] if e.get("status") == "policy_none_no_op")
    assert n_noop == len(traj["event_log"]), (
        "Не все события перестройки помечены как policy_none_no_op!"
    )
    print(f"Тест 1 (none policy никогда не меняет граф, {n_noop} событий-неопераций) -- ПРОЙДЕН")


def test_2_electrical_dynamics_identical_to_v08_when_policy_matches():
    """Электрическая динамика (растры, веса на выходе -- до учёта
    перестройки) должна быть ИДЕНТИЧНА между v10_no_rewiring.run_experience
    _trajectory и v08_experience_rewiring.run_experience_trajectory при
    ОДИНАКОВОЙ политике (например 'weakest'), т.к. код скопирован без
    изменений кроме ветки 'none'. Это проверяет, что копирование модуля
    не внесло скрытых расхождений в STDP/электрический путь."""
    with open("v06_extended_growth_full.pkl", "rb") as f:
        d06 = pickle.load(f)
    snap = d06["snapshots"][11]["Только бюджет"][96.0]

    kwargs = dict(
        initial_contacts=snap["contacts"], initial_weights=snap["weights"],
        initial_state=snap["state"], distance=snap["distance"],
        order="AB", plasticity_enabled=True, rewire_policy="weakest",
        group_A=np.array([3, 6, 9, 54, 60]), group_B=np.array([21, 34, 44, 46, 77]),
        duration=2.0, rewire_interval=0.5, sequence_period=0.4,
        first_pulse_time=0.2, lag=0.010, rewire_seed=42, noise_seed=1000,
    )
    traj_v08 = run_v08(**kwargs)
    traj_v10 = run_v10(**kwargs)

    assert np.array_equal(traj_v08["spikes"], traj_v10["spikes"]), (
        "Растры отличаются между v08 и v10 при одинаковой политике!"
    )
    assert np.array_equal(traj_v08["weights"], traj_v10["weights"]), (
        "Веса отличаются между v08 и v10 при одинаковой политике!"
    )
    assert np.array_equal(traj_v08["contacts"], traj_v10["contacts"]), (
        "Контакты отличаются между v08 и v10 при одинаковой политике!"
    )
    sig_v08 = [(e.get("step"), e.get("receiver"), e.get("old_source"),
                e.get("new_source"), e.get("status")) for e in traj_v08["event_log"]]
    sig_v10 = [(e.get("step"), e.get("receiver"), e.get("old_source"),
                e.get("new_source"), e.get("status")) for e in traj_v10["event_log"]]
    assert sig_v08 == sig_v10, "Журналы событий перестройки отличаются между v08 и v10!"
    print("Тест 2 (v10 идентичен v08 при policy='weakest' -- путь STDP не затронут) -- ПРОЙДЕН")


def test_3_electrical_noise_independent_of_rewire_policy():
    """Электрический шум (и, следовательно, natural_fired на каждом шаге
    ДО применения перестройки) должен быть идентичен между M0 (none) и
    M1 (weakest) траекториями с тем же noise_seed -- т.к. rng_noise_gen
    полностью независим от rng_event_choice (используется только внутри
    do_rewire_event, который не вызывается в M0)."""
    with open("v06_extended_growth_full.pkl", "rb") as f:
        d06 = pickle.load(f)
    snap = d06["snapshots"][11]["Только бюджет"][96.0]

    common = dict(
        initial_contacts=snap["contacts"], initial_weights=snap["weights"],
        initial_state=snap["state"], distance=snap["distance"],
        order="AB", plasticity_enabled=True,
        group_A=np.array([3, 6, 9, 54, 60]), group_B=np.array([21, 34, 44, 46, 77]),
        duration=2.0, rewire_interval=0.5, sequence_period=0.4,
        first_pulse_time=0.2, lag=0.010, rewire_seed=42, noise_seed=1000,
    )
    traj_m0 = run_v10(rewire_policy="none", **common)
    traj_m1 = run_v10(rewire_policy="weakest", **common)

    # Natural activity should differ ONLY where the graph has already
    # diverged due to rewiring (M1) -- but electrical noise itself is
    # identical. We verify this indirectly: BEFORE the first rewiring
    # event (t < 0.5s, i.e. steps < 500), contacts haven't diverged yet
    # (M1's first rewire happens at step 500), so activity up to that
    # point should be IDENTICAL between M0 and M1.
    assert np.array_equal(traj_m0["spikes"][:500], traj_m1["spikes"][:500]), (
        "Активность ДО первого события перестройки отличается между M0 и M1 -- "
        "шум или начальные условия расходятся независимо от перестройки!"
    )
    print("Тест 3 (электрический шум независим от политики перестройки, "
          "проверено до первого расхождения графа) -- ПРОЙДЕН")


if __name__ == "__main__":
    test_1_none_policy_never_changes_graph()
    test_2_electrical_dynamics_identical_to_v08_when_policy_matches()
    test_3_electrical_noise_independent_of_rewire_policy()
    print("\n=== ВСЕ UNIT-ТЕСТЫ v0.10 ПРОЙДЕНЫ ===")

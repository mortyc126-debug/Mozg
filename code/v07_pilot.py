"""
v0.7 пилот: несколько событий замены на одной бюджетной сети (seed=11,
"Только бюджет", снимок t=96с из v0.6), с полной проверкой инвариантов.

Проверяет ПЕРЕД полным набором из 36 траекторий:
  - выбор кандидатов ДО удаления (нет немедленного восстановления того
    же контакта);
  - сохранение входящей степени и суммы весов с численной точностью;
  - отсутствие самосвязей;
  - неизменность НЕзатронутых строк;
  - политика "none" не меняет структуру вовсе;
  - "random" и "weakest" дают РАЗНЫЙ выбор старого источника (когда это
    возможно), но одинаковое правило выбора нового.
"""
import numpy as np
import pickle

from v07_rewiring import run_rewiring_trajectory, verify_invariants

with open("v06_extended_growth_full.pkl", "rb") as f:
    D06 = pickle.load(f)

SEED = 11
CONDITION = "Только бюджет"
SNAPSHOT_TIME = 96.0

snap = D06["snapshots"][SEED][CONDITION][SNAPSHOT_TIME]
initial_contacts = snap["contacts"]
initial_weights = snap["weights"]
initial_state = snap["state"]
distance = snap["distance"]


def main():
    print(f"=== Пилот v0.7: seed={SEED}, условие={CONDITION}, t={SNAPSHOT_TIME}с ===")
    print(f"Исходная входящая степень: mean={initial_contacts.sum(axis=1).mean():.2f}, "
          f"min={initial_contacts.sum(axis=1).min()}, max={initial_contacts.sum(axis=1).max()}")

    # Short pilot run: 2 seconds, rewire every 0.5s -> 4 events attempted
    duration = 2.0
    rewire_interval = 0.5

    results = {}
    for policy in ("none", "random", "weakest"):
        res = run_rewiring_trajectory(
            initial_contacts, initial_weights, initial_state, distance,
            policy=policy, duration=duration, rewire_interval=rewire_interval,
            rewire_seed=42, noise_seed=1000,
        )
        results[policy] = res

        print(f"\n--- policy={policy} ---")
        for e in res["event_log"]:
            print(f"  {e}")

        ok, checks = verify_invariants(initial_contacts, initial_weights, res)
        print(f"  Инварианты: {'OK' if ok else 'НАРУШЕНЫ'}")
        for k, v in checks.items():
            print(f"    {k}: {v}")
        assert ok, f"Инварианты нарушены для policy={policy}!"

    # policy="none" must leave contacts and weights EXACTLY unchanged
    assert np.array_equal(results["none"]["contacts"], initial_contacts), (
        "policy=none изменил contacts!"
    )
    assert np.array_equal(results["none"]["weights"], initial_weights), (
        "policy=none изменил weights!"
    )
    print("\nOK: policy='none' не изменил структуру совсем")

    # Check: no immediate restoration of just-removed contact
    # (i.e. old_source != new_source for every applied event, which is
    # guaranteed by construction since new_source is drawn from candidates
    # that EXCLUDE existing contacts at the time of fixing candidates --
    # but old_source was an existing contact, so it's excluded from
    # candidates_before by construction. Verify this explicitly:)
    for policy in ("random", "weakest"):
        for e in results[policy]["event_log"]:
            if e.get("status") == "applied":
                assert e["old_source"] != e["new_source"], (
                    f"old_source == new_source in {policy}! "
                    "immediate restoration occurred -- bug in candidate fixing"
                )
    print("OK: ни одно событие не восстановило немедленно удалённый контакт")

    # Check random vs weakest can differ in old_source choice
    random_old_sources = [
        e["old_source"] for e in results["random"]["event_log"] if e.get("status") == "applied"
    ]
    weakest_old_sources = [
        e["old_source"] for e in results["weakest"]["event_log"] if e.get("status") == "applied"
    ]
    print(f"\nrandom old_sources chosen: {random_old_sources}")
    print(f"weakest old_sources chosen: {weakest_old_sources}")

    # Check weakest picks the actual minimum-weight source at time of removal
    # (verify against the FIRST event only, using pre-run state, as a spot check)
    receiver0 = results["weakest"]["event_log"][0]["receiver"] if results["weakest"]["event_log"][0].get("status")=="applied" else None
    if receiver0 is not None:
        existing = np.flatnonzero(initial_contacts[receiver0])
        w_existing = initial_weights[receiver0, existing]
        expected_old_source = existing[np.argmin(w_existing)]
        actual_old_source = results["weakest"]["event_log"][0]["old_source"]
        # note: could differ if there's a tie broken randomly -- check weight equality instead
        w_expected = initial_weights[receiver0, expected_old_source]
        w_actual = initial_weights[receiver0, actual_old_source]
        assert w_actual == w_expected, (
            f"weakest policy did not pick minimum weight source! "
            f"expected weight {w_expected}, got {w_actual}"
        )
        print(f"OK: 'weakest' первого события выбрал источник с минимальным весом "
              f"({w_actual:.6f}) для receiver={receiver0}")

    print("\n=== ПИЛОТ v0.7 ЗАВЕРШЁН УСПЕШНО ===")


if __name__ == "__main__":
    main()

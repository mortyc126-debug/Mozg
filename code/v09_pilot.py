"""
v0.9 пилот: одна геометрия (seed=11), одна история роста ("Только
бюджет"), один повтор обучения (repeat=0), все 3 механизма, оба
порядка (AB/BA), оба направления (A->B наблюдение, B->A наблюдение),
один тестовый шум (test_seed=900). Итого 12 парных проверок (3 mechanisms
x 2 directions x 2 orders = 12, каждая пара = baseline+stimulated).

Проверяет:
  - одинаковость стартовых состояний AB/BA (v/adaptation/refractory/
    threshold/drive идентичны, syn=0 в обеих);
  - неизменность весов/контактов/порогов во время проб;
  - контроль M3: W_AB==W_BA, contacts_AB==contacts_BA (структурные
    истории совпали в v0.8 -- если тут не совпадёт, это ошибка
    сопоставления), И baseline_AB==baseline_BA, stimulated_AB==
    stimulated_BA (при одинаковом старте и одинаковом графе/весах,
    один и тот же шум должен дать идентичный результат);
  - save/load.
Метрика D уже проверена на искусственных примерах в v09_functional_probe.py.
"""
import numpy as np
import pickle

from v05_functional import DT, make_noise
from v09_functional_probe import build_common_start_state, run_direction_probe, compute_R, compute_D

with open("v08_experience_full.pkl", "rb") as f:
    D08 = pickle.load(f)
with open("v06_extended_growth_full.pkl", "rb") as f:
    D06 = pickle.load(f)

SEED = 11
GROWTH_CONDITION = "Только бюджет"
REPEAT = 0
SNAPSHOT_TIME = 96.0

GROUP_A = D08["group_A"]
GROUP_B = D08["group_B"]

MECHANISMS = ["M1_plasticity_weakest", "M2_plasticity_random", "M3_no_plasticity_weakest"]
TEST_SEED = 900
PROBE_DURATION_MS = 200
PROBE_STEPS = int(round(PROBE_DURATION_MS / 1000 / DT))


def main():
    v06_state = D06["snapshots"][SEED][GROWTH_CONDITION][SNAPSHOT_TIME]["state"]
    threshold_ref = v06_state["threshold"].copy()

    noise = make_noise(TEST_SEED, PROBE_STEPS, 80)
    noise_ref = noise.copy()

    results = {}

    for mech in MECHANISMS:
        traj_ab = D08["results"][(SEED, GROWTH_CONDITION, mech, REPEAT)]["traj_AB"]
        traj_ba = D08["results"][(SEED, GROWTH_CONDITION, mech, REPEAT)]["traj_BA"]

        state_ab, W_ab, contacts_ab = build_common_start_state(v06_state, traj_ab)
        state_ba, W_ba, contacts_ba = build_common_start_state(v06_state, traj_ba)

        # --- check: common start identical across AB/BA (except syn, which is 0 in both) ---
        for key in ("v", "adaptation", "refractory", "threshold", "drive"):
            assert np.array_equal(state_ab[key], state_ba[key]), (
                f"стартовое состояние '{key}' отличается между AB/BA для {mech}!"
            )
        assert np.array_equal(state_ab["syn"], np.zeros(80)) and np.array_equal(state_ba["syn"], np.zeros(80))
        print(f"\n--- {mech} ---")
        print("OK: общий старт (v/adaptation/refractory/threshold/drive) идентичен AB/BA, syn=0 в обеих")

        state_ab_ref = {k: v.copy() for k, v in state_ab.items()}
        state_ba_ref = {k: v.copy() for k, v in state_ba.items()}
        W_ab_ref = W_ab.copy(); W_ba_ref = W_ba.copy()

        for direction, (stim_group, obs_group) in (
            ("A_to_B", (GROUP_A, GROUP_B)),
            ("B_to_A", (GROUP_B, GROUP_A)),
        ):
            base_ab, stim_ab = run_direction_probe(state_ab, W_ab, noise, stim_group, obs_group)
            base_ba, stim_ba = run_direction_probe(state_ba, W_ba, noise, stim_group, obs_group)

            # verify weights/contacts/threshold/noise untouched by probe()
            assert np.array_equal(W_ab, W_ab_ref) and np.array_equal(W_ba, W_ba_ref), (
                f"веса изменились во время проб! {mech} {direction}"
            )
            for key in state_ab_ref:
                assert np.array_equal(state_ab[key], state_ab_ref[key]), (
                    f"стартовое состояние AB изменилось после проб! {mech} {direction} {key}"
                )
                assert np.array_equal(state_ba[key], state_ba_ref[key]), (
                    f"стартовое состояние BA изменилось после проб! {mech} {direction} {key}"
                )
            assert np.array_equal(noise, noise_ref), "noise массив изменился!"

            R_ab = compute_R(base_ab, stim_ab, obs_group, bin_ms=5)
            R_ba = compute_R(base_ba, stim_ba, obs_group, bin_ms=5)
            D_val = compute_D(R_ab, R_ba)

            results[(mech, direction)] = {
                "baseline_AB": base_ab, "stimulated_AB": stim_ab,
                "baseline_BA": base_ba, "stimulated_BA": stim_ba,
                "R_AB": R_ab, "R_BA": R_ba, "D": D_val,
            }
            print(f"  direction={direction}: D={D_val:.4f}")

        # --- M3 control: weights/contacts should be IDENTICAL AB/BA (structural
        #     histories matched in v0.8), and therefore baseline/stimulated too ---
        if mech == "M3_no_plasticity_weakest":
            w_match = np.array_equal(W_ab, W_ba)
            c_match = np.array_equal(contacts_ab, contacts_ba)
            print(f"  КОНТРОЛЬ M3: W_AB==W_BA: {w_match}  contacts_AB==contacts_BA: {c_match}")
            assert w_match, "M3: веса AB != BA -- структурная история не совпала как ожидалось в v0.8!"
            assert c_match, "M3: контакты AB != BA!"

            for direction in ("A_to_B", "B_to_A"):
                r = results[(mech, direction)]
                base_match = np.array_equal(r["baseline_AB"], r["baseline_BA"])
                stim_match = np.array_equal(r["stimulated_AB"], r["stimulated_BA"])
                print(f"    {direction}: baseline_AB==baseline_BA: {base_match}  "
                      f"stimulated_AB==stimulated_BA: {stim_match}")
                if not (base_match and stim_match):
                    raise AssertionError(
                        f"М3 КОНТРОЛЬ НЕ ПРОЙДЕН для {direction}: ответы AB/BA различаются "
                        f"при идентичном старте, весах и контактах -- ОСТАНАВЛИВАЕМ основной "
                        f"анализ, требуется разобрать причину перед продолжением!"
                    )
            print("  OK: М3 контроль пройден полностью (веса, контакты, оба направления ответов)")

    # save/load roundtrip
    pilot_record = {"seed": SEED, "growth_condition": GROWTH_CONDITION, "repeat": REPEAT,
                     "test_seed": TEST_SEED, "results": results}
    with open("v09_pilot_record.pkl", "wb") as f:
        pickle.dump(pilot_record, f)
    with open("v09_pilot_record.pkl", "rb") as f:
        reloaded = pickle.load(f)
    assert np.array_equal(
        reloaded["results"][("M1_plasticity_weakest", "A_to_B")]["baseline_AB"],
        results[("M1_plasticity_weakest", "A_to_B")]["baseline_AB"],
    )
    print("\nOK: сохранение/загрузка согласованы")

    print("\n=== ПИЛОТ v0.9 ЗАВЕРШЁН УСПЕШНО ===")


if __name__ == "__main__":
    main()

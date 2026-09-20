"""
Пилот функционального теста v0.7: одна пара на снимке t=24с из
v07_rewiring_full.pkl -- БЕЗ дополнительного прогрева (согласовано:
тест меряет реакцию непосредственно после истории перестройки).

Проверяет совместимость снимков v0.7 с v05_functional.py::probe и
неизменность структуры/весов во время проб, прежде чем запускать
полный набор 324 пар.
"""
import numpy as np
import pickle
from v05_functional import DT, make_noise, probe

with open("v07_rewiring_full.pkl", "rb") as f:
    D07 = pickle.load(f)

STIM_NODES = np.array([17, 54, 63])  # same stim set as v0.5/v0.6 protocol
TEST_SEED = 900


def main():
    key = (11, "Только бюджет", "random", 0)
    snap24 = D07["results"][key]["snapshots"][24.0]
    W = snap24["weights"]
    state = snap24["state"]
    W_ref = W.copy()
    threshold_ref = state["threshold"].copy()

    N = W.shape[0]
    noise = make_noise(TEST_SEED, 200, N)
    noise_ref = noise.copy()

    baseline_spikes, _ = probe(state, W, noise, transmission=True, stimulate_nodes=None)
    stimulated_spikes, _ = probe(state, W, noise, transmission=True, stimulate_nodes=STIM_NODES)

    # verify no mutation of source data
    assert np.array_equal(W, W_ref), "веса изменились во время проб!"
    assert np.array_equal(state["threshold"], threshold_ref), "threshold изменился!"
    assert np.array_equal(noise, noise_ref), "noise массив изменился!"
    print("OK: снимок t=24с и noise не изменились во время проб")

    observe_mask = np.ones(N, dtype=bool)
    observe_mask[STIM_NODES] = False
    n_observed = observe_mask.sum()

    window_width = int(round(0.050 / DT))
    R_windows, F_windows = [], []
    for w_start_ms in (0, 50, 100, 150):
        start_step = int(round(w_start_ms / 1000 / DT))
        end_step = start_step + window_width
        b = baseline_spikes[start_step:end_step, observe_mask]
        s = stimulated_spikes[start_step:end_step, observe_mask]
        R = (s.sum() - b.sum()) / n_observed
        F = np.any(b != s, axis=0).mean()
        R_windows.append(R)
        F_windows.append(F)
        print(f"window {w_start_ms}-{w_start_ms+50}ms: R={R:.5f} F={F:.4f}")

    R_200 = sum(R_windows)
    F_200 = np.any(
        baseline_spikes[:, observe_mask] != stimulated_spikes[:, observe_mask], axis=0
    ).mean()
    print(f"R_200={R_200:.5f}  F_200={F_200:.4f}")

    print("\n=== ПИЛОТ ФУНКЦИОНАЛЬНОГО ТЕСТА v0.7 ЗАВЕРШЁН УСПЕШНО ===")


if __name__ == "__main__":
    main()

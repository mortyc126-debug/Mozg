import pickle
import numpy as np

from regime_map import DT
from v04_regional import build_variant_networks
from v04_localization import (
    get_warmed_checkpoint, probe_from_checkpoint, select_region_stimulus_nodes,
)


def measure_full_response(baseline, stimulated, region_id, stimulated_nodes, dt=DT):
    n_regions = int(region_id.max() + 1)
    window_width = int(round(0.050 / dt))
    steps_200ms = 4 * window_width

    result = {}
    for r in range(n_regions):
        region_mask = region_id == r
        observe_mask = region_mask.copy()
        observe_mask[stimulated_nodes] = False

        n_observed = observe_mask.sum()
        if n_observed == 0:
            result[r] = None
            continue

        windows_R = []
        windows_F = []
        for w_idx in range(4):
            start = w_idx * window_width
            end = start + window_width
            b = baseline[start:end, observe_mask]
            s = stimulated[start:end, observe_mask]

            R = (s.sum() - b.sum()) / n_observed
            F = np.any(b != s, axis=0).mean()

            windows_R.append(R)
            windows_F.append(F)

        b_full = baseline[:steps_200ms, observe_mask]
        s_full = stimulated[:steps_200ms, observe_mask]
        F_200 = np.any(b_full != s_full, axis=0).mean()
        R_200 = sum(windows_R)

        result[r] = {
            "n_observed": int(n_observed),
            "R_windows": windows_R,
            "F_windows": windows_F,
            "R_200": R_200,
            "F_200": F_200,
        }

    return result


def recompute_full(
    development_seed=11, n_regions=4, grid=(2, 2),
    drive_scalar=1.25, gain=4.0,
    warm_seeds=(700, 701, 702, 703, 704),
    test_seeds=(800, 801, 802, 803, 804),
    n_per_region=3,
):
    variants, region_id, positions = build_variant_networks(
        development_seed=development_seed, n_regions=n_regions, grid=grid,
    )
    stim_sets = select_region_stimulus_nodes(
        region_id, n_per_region=n_per_region, seed=9000
    )

    raw_data = {name: {} for name in variants}

    for variant_name, v in variants.items():
        network = v["network"]
        W = network["weights"]
        N = W.shape[0]

        print("Processing variant:", variant_name)

        checkpoints = {}
        for warm_seed in warm_seeds:
            checkpoint, drive = get_warmed_checkpoint(
                network, drive_scalar=drive_scalar, gain=gain,
                warm_duration=12.0, seed=warm_seed,
            )
            checkpoints[warm_seed] = (checkpoint, drive)

        for source_region, stim_nodes in stim_sets.items():
            for warm_seed in warm_seeds:
                checkpoint, drive = checkpoints[warm_seed]

                for test_seed in test_seeds:
                    test_rng = np.random.default_rng(test_seed)
                    steps = int(round(0.200 / DT))
                    noise = (
                        0.012 * np.sqrt(DT / 0.001)
                        * test_rng.standard_normal((steps, N))
                    )

                    baseline = probe_from_checkpoint(
                        checkpoint, W, drive, gain, noise,
                        stimulate_nodes=None,
                    )
                    stimulated = probe_from_checkpoint(
                        checkpoint, W, drive, gain, noise,
                        stimulate_nodes=stim_nodes,
                    )

                    response = measure_full_response(
                        baseline, stimulated, region_id, stim_nodes,
                    )

                    for target_region, res in response.items():
                        if res is None:
                            continue
                        key = (source_region, target_region, warm_seed, test_seed)
                        raw_data[variant_name][key] = res

    return raw_data, stim_sets, region_id


if __name__ == "__main__":
    raw_data, stim_sets, region_id = recompute_full()

    with open("/home/claude/sim/v04_final_data.pkl", "wb") as f:
        pickle.dump({
            "raw_data": raw_data,
            "stim_sets": stim_sets,
            "region_id": region_id,
        }, f)
    print("Saved: v04_final_data.pkl")

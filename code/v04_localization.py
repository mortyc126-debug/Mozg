import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from regime_map import DT, copy_state
from v03_rhythm_origin import advance_v03
from v04_regional import build_variant_networks


def get_warmed_checkpoint(
    network, drive_scalar=1.25, gain=4.0, warm_duration=12.0, seed=700,
):
    W = network["weights"]
    N = W.shape[0]

    state = {
        key: network["state"][key].copy()
        for key in ("v", "syn", "adaptation", "refractory", "threshold")
    }
    state["syn"].fill(0.0)

    original_drive = network["state"]["drive"]
    drive = drive_scalar * original_drive / original_drive.mean()

    rng = np.random.default_rng(seed)
    steps = int(round(warm_duration / DT))
    noise = 0.012 * np.sqrt(DT / 0.001) * rng.standard_normal((steps, N))

    for step in range(steps):
        advance_v03(state, W, drive, gain, noise[step])

    return state, drive


def force_spikes(state, W, nodes):
    state["v"][nodes] = 0.0
    state["refractory"][nodes] = 0.005
    state["adaptation"][nodes] += 0.25
    state["syn"] += W[:, nodes].sum(axis=1)


def probe_from_checkpoint(checkpoint, W, drive, gain, noise, stimulate_nodes=None):
    state = copy_state(checkpoint)
    N = W.shape[0]
    steps = len(noise)

    if stimulate_nodes is not None:
        force_spikes(state, W, stimulate_nodes)

    spikes = np.zeros((steps, N), dtype=bool)
    for step in range(steps):
        spikes[step] = advance_v03(state, W, drive, gain, noise[step])

    return spikes


def select_region_stimulus_nodes(region_id, n_per_region=3, seed=9000):
    rng = np.random.default_rng(seed)
    n_regions = int(region_id.max() + 1)
    stim_sets = {}
    for r in range(n_regions):
        nodes = np.flatnonzero(region_id == r)
        if len(nodes) < n_per_region:
            raise ValueError(
                f"Region {r} has only {len(nodes)} nodes, "
                f"fewer than requested {n_per_region}."
            )
        chosen = rng.choice(nodes, size=n_per_region, replace=False)
        stim_sets[r] = np.sort(chosen)
    return stim_sets


def measure_region_response(baseline, stimulated, region_id, stimulated_nodes, dt=DT):
    n_regions = int(region_id.max() + 1)
    window_width = int(round(0.050 / dt))

    result = {}
    for r in range(n_regions):
        region_mask = region_id == r
        observe_mask = region_mask.copy()
        observe_mask[stimulated_nodes] = False

        n_observed = observe_mask.sum()
        if n_observed == 0:
            result[r] = None
            continue

        base_r = baseline[:, observe_mask]
        stim_r = stimulated[:, observe_mask]

        windows = []
        for w_start in range(0, 200, 50):
            start_step = int(round(w_start / 1000 / dt))
            end_step = start_step + window_width
            b = base_r[start_step:end_step]
            s = stim_r[start_step:end_step]

            delta_count = (s.sum() - b.sum()) / n_observed

            windows.append({
                "window_start_ms": w_start,
                "delta_spikes_per_node": delta_count,
            })

        result[r] = {"n_observed": int(n_observed), "windows": windows}

    return result


def run_localization_test(
    development_seed=11, n_regions=4, grid=(2, 2),
    drive_scalar=1.25, gain=4.0,
    warm_seeds=(700, 701, 702, 703, 704, 705, 706, 707, 708, 709),
    test_seeds=(800, 801, 802, 803, 804, 805, 806, 807, 808, 809),
    n_per_region=3,
):
    variants, region_id, positions = build_variant_networks(
        development_seed=development_seed, n_regions=n_regions, grid=grid,
    )

    stim_sets = select_region_stimulus_nodes(
        region_id, n_per_region=n_per_region, seed=9000
    )

    print("Stimulated nodes per region (same across all variants):")
    for r, nodes in stim_sets.items():
        print(f"  region {r}: {nodes}")

    all_results = {}

    for variant_name, v in variants.items():
        network = v["network"]
        W = network["weights"]
        N = W.shape[0]

        print(f"\n{'='*70}")
        print(f"Variant: {variant_name}")
        print(f"{'='*70}")

        early_matrix = np.zeros((n_regions, n_regions))
        late_matrices = [np.zeros((n_regions, n_regions)) for _ in range(3)]
        n_trials = len(warm_seeds) * len(test_seeds)

        for source_region, stim_nodes in stim_sets.items():
            for warm_seed in warm_seeds:
                checkpoint, drive = get_warmed_checkpoint(
                    network, drive_scalar=drive_scalar, gain=gain,
                    warm_duration=12.0, seed=warm_seed,
                )

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

                    response = measure_region_response(
                        baseline, stimulated, region_id, stim_nodes,
                    )

                    for target_region, res in response.items():
                        if res is None:
                            continue
                        early_matrix[source_region, target_region] += (
                            res["windows"][0]["delta_spikes_per_node"] / n_trials
                        )
                        for k in range(3):
                            late_matrices[k][source_region, target_region] += (
                                res["windows"][k + 1]["delta_spikes_per_node"]
                                / n_trials
                            )

        all_results[variant_name] = {
            "early_matrix": early_matrix,
            "late_matrices": late_matrices,
        }

        print("\nEarly response matrix (0-50ms), rows=source, cols=target:")
        print(np.array2string(early_matrix, precision=5, suppress_small=True))

        diag = np.diag(early_matrix)
        off_diag_mask = ~np.eye(n_regions, dtype=bool)
        off_diag_mean = early_matrix[off_diag_mask].mean()
        print(f"\nMean diagonal (within) response: {diag.mean():.5f}")
        print(f"Mean off-diagonal (between) response: {off_diag_mean:.5f}")
        if off_diag_mean != 0:
            print(f"Within/between ratio: {diag.mean()/off_diag_mean:.3f}")

    return all_results, stim_sets, region_id


def measure_region_response_signed(baseline, stimulated, region_id, stimulated_nodes, dt=DT):
    """
    Явная спецификация метрики:
    R = (сумма импульсов стимулированного прогона
         - сумма импульсов фонового прогона) / число наблюдаемых
        узлов области, в окне 0-50мс, ИСКЛЮЧАЯ непосредственно
        стимулированные узлы. Подписанная величина (не абсолютная).
    Возвращает словарь {region: R} только для окна 0-50мс,
    без агрегации по вариантам -- сырое единичное измерение.
    """
    n_regions = int(region_id.max() + 1)
    window_width = int(round(0.050 / dt))

    result = {}
    for r in range(n_regions):
        region_mask = region_id == r
        observe_mask = region_mask.copy()
        observe_mask[stimulated_nodes] = False

        n_observed = observe_mask.sum()
        if n_observed == 0:
            result[r] = None
            continue

        b = baseline[:window_width, observe_mask]
        s = stimulated[:window_width, observe_mask]

        result[r] = (s.sum() - b.sum()) / n_observed

    return result


def run_localization_test_paired(
    development_seed=11, n_regions=4, grid=(2, 2),
    drive_scalar=1.25, gain=4.0,
    warm_seeds=(700, 701, 702, 703, 704),
    test_seeds=(800, 801, 802, 803, 804),
    n_per_region=3,
):
    """
    Исправленная версия:
    - stim_sets выбираются один раз, общие для всех вариантов
      (как и раньше -- это уже было корректно);
    - прогрев выполняется ОДИН РАЗ на (вариант, warm_seed),
      НЕ зависит от источника стимуляции, и переиспользуется
      для всех 4 источников (устраняет лишний пересчёт и
      обеспечивает четыре источника из одного и того же
      состояния для честного сравнения источников);
    - состояния прогрева СВОИ для каждого варианта (веса разные
      -> состояние после прогрева тоже разное) -- это
      сознательный выбор: измеряем эффект весов при их
      естественном фоновом режиме, а не при искусственно
      навязанном чужом состоянии. Это отдельный вопрос от
      "то же состояние для всех вариантов" -- явно фиксируем,
      что здесь используется первый вариант.
    - сохраняются СЫРЫЕ измерения R(source, target, warm_seed,
      test_seed, variant) для последующего парного анализа
      D = R_variant - R_baseline на одинаковых
      (source, target, warm_seed, test_seed).
    """
    variants, region_id, positions = build_variant_networks(
        development_seed=development_seed, n_regions=n_regions, grid=grid,
    )

    stim_sets = select_region_stimulus_nodes(
        region_id, n_per_region=n_per_region, seed=9000
    )

    print("Stimulated nodes per region (identical across all variants):")
    for r, nodes in stim_sets.items():
        print(f"  region {r}: {nodes}")

    # raw_data[variant_name][(source, target, warm_seed, test_seed)] = R
    raw_data = {name: {} for name in variants}

    for variant_name, v in variants.items():
        network = v["network"]
        W = network["weights"]
        N = W.shape[0]

        print(f"\nProcessing variant: {variant_name}")

        # Прогрев ОДИН РАЗ на warm_seed, независимо от источника.
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

                    response = measure_region_response_signed(
                        baseline, stimulated, region_id, stim_nodes,
                    )

                    for target_region, R in response.items():
                        if R is None:
                            continue
                        key = (source_region, target_region, warm_seed, test_seed)
                        raw_data[variant_name][key] = R

    return raw_data, stim_sets, region_id, variants


if __name__ == "__main__":
    raw_data, stim_sets, region_id, variants = run_localization_test_paired()

    import pickle
    with open("/home/claude/sim/v04_raw_paired_data.pkl", "wb") as f:
        pickle.dump({
            "raw_data": raw_data,
            "stim_sets": stim_sets,
            "region_id": region_id,
        }, f)
    print("\nSaved: v04_raw_paired_data.pkl")

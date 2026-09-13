import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sim_core import simulate
from regime_map import DT
from v03_rhythm_origin import free_dynamics_run, analyze_free_dynamics
from v03_cyclic_shift import cyclic_shift_control


def recover_positions(seed):
    rng = np.random.default_rng(seed)
    N = 80
    positions = rng.uniform(0, 1, size=(N, 2))
    return positions


def assign_regions(positions, n_regions=4, grid=(2, 2)):
    assert grid[0] * grid[1] == n_regions

    x_bins = np.linspace(0, 1, grid[0] + 1)
    y_bins = np.linspace(0, 1, grid[1] + 1)

    x_idx = np.clip(
        np.digitize(positions[:, 0], x_bins) - 1, 0, grid[0] - 1
    )
    y_idx = np.clip(
        np.digitize(positions[:, 1], y_bins) - 1, 0, grid[1] - 1
    )

    region_id = x_idx * grid[1] + y_idx
    return region_id


def rebias_weights(W, contacts, region_id, bias_factor, total_input_cap=0.6):
    """
    Перераспределяет СУЩЕСТВУЮЩИЙ входной вес каждого получателя
    между внутриобластными и межобластными источниками, сохраняя
    суммарный вход этого узла неизменным (не просто домножает
    один компонент, что могло бы менять суммарное возбуждение,
    если бы построчная нормировка не срабатывала).

    Для каждого получателя i:
      within_sum_i, between_sum_i -- исходные суммы весов входов
      из своей и из чужих областей.
      Новые доли распределяются в отношении
      (bias_factor * within_sum_i) : between_sum_i,
      затем масштабируются так, чтобы
      new_within_sum_i + new_between_sum_i == within_sum_i + between_sum_i
      (то есть суммарный вход i не меняется).
      Индивидуальные веса внутри каждой группы масштабируются
      пропорционально их исходным значениям.
    """
    N = W.shape[0]
    same_region = region_id[:, None] == region_id[None, :]

    within_mask = contacts & same_region
    between_mask = contacts & ~same_region

    W_new = W.copy()

    for i in range(N):
        within_sources = within_mask[i]
        between_sources = between_mask[i]

        within_sum = W[i, within_sources].sum()
        between_sum = W[i, between_sources].sum()
        total = within_sum + between_sum

        if total <= 0:
            continue

        weighted_within = bias_factor * within_sum
        denom = weighted_within + between_sum

        if denom <= 0:
            continue

        target_within = total * weighted_within / denom
        target_between = total - target_within

        if within_sum > 0:
            scale_within = target_within / within_sum
            W_new[i, within_sources] = W[i, within_sources] * scale_within
        if between_sum > 0:
            scale_between = target_between / between_sum
            W_new[i, between_sources] = W[i, between_sources] * scale_between

    np.clip(W_new, 0.0, 0.08, out=W_new)

    # Финальная проверка/подстраховка: если клиппинг сдвинул
    # сумму, всё равно применяем прежнюю построчную нормировку
    # как последний рубеж (как в исходной модели).
    total_input = W_new.sum(axis=1)
    W_new *= np.minimum(
        1.0, total_input_cap / np.maximum(total_input, 1e-12)
    )[:, None]

    return W_new


def summarize_connectivity(W, contacts, region_id):
    same_region = region_id[:, None] == region_id[None, :]

    within_mask = contacts & same_region
    between_mask = contacts & ~same_region

    within_contacts = within_mask.sum()
    between_contacts = between_mask.sum()

    within_weight = W[within_mask].sum()
    between_weight = W[between_mask].sum()

    return {
        "within_contacts": int(within_contacts),
        "between_contacts": int(between_contacts),
        "within_weight_sum": float(within_weight),
        "between_weight_sum": float(between_weight),
        "within_weight_mean": (
            float(W[within_mask].mean()) if within_contacts else float("nan")
        ),
        "between_weight_mean": (
            float(W[between_mask].mean()) if between_contacts else float("nan")
        ),
    }


VARIANTS = {
    "Исходная (bias=1.0)": 1.0,
    "Внутриобластная (bias=2.0)": 2.0,
    "Межобластная (bias=0.5)": 0.5,
}


def build_variant_networks(development_seed=11, n_regions=4, grid=(2, 2)):
    initial = simulate(seed=development_seed)
    positions = recover_positions(development_seed)
    region_id = assign_regions(positions, n_regions=n_regions, grid=grid)

    W = initial["weights"]
    contacts = initial["contacts"]

    variants = {}
    for name, bias in VARIANTS.items():
        W_variant = rebias_weights(W, contacts, region_id, bias)
        conn_summary = summarize_connectivity(W_variant, contacts, region_id)

        variant_network = dict(initial)
        variant_network["weights"] = W_variant

        variants[name] = {
            "network": variant_network,
            "bias": bias,
            "connectivity": conn_summary,
        }

    return variants, region_id, positions


def measure_regional_dynamics(
    network, region_id, drive_scalar=1.25, gain=4.0,
    duration=14.0, measure_duration=10.0, seed=600,
):
    spikes = free_dynamics_run(
        network, drive_scalar=drive_scalar, gain=gain,
        duration=duration, measure_duration=measure_duration,
        seed=seed,
    )

    overall = analyze_free_dynamics(spikes)

    n_regions = int(region_id.max() + 1)

    within_results = []
    for r in range(n_regions):
        mask = region_id == r
        if mask.sum() < 3:
            continue
        sub_spikes = spikes[:, mask]
        result = cyclic_shift_control(
            sub_spikes, DT, fine_dt=0.005, n_shuffles=50, seed=42
        )
        within_results.append(result)

    region_series_bool = np.zeros((spikes.shape[0], n_regions), dtype=bool)
    for r in range(n_regions):
        mask = region_id == r
        region_series_bool[:, r] = spikes[:, mask].any(axis=1)

    between_result = cyclic_shift_control(
        region_series_bool, DT, fine_dt=0.005, n_shuffles=50, seed=43,
    )

    return {
        "overall": overall,
        "within_region": within_results,
        "between_region": between_result,
        "n_regions": n_regions,
    }


def main():
    print("=" * 70)
    print("VERSION 0.4: REGIONAL CONNECTIVITY")
    print("=" * 70)

    variants, region_id, positions = build_variant_networks(
        development_seed=11, n_regions=4, grid=(2, 2)
    )

    print("\nNodes per region:")
    for r in range(4):
        print(f"  region {r}: {np.sum(region_id == r)} nodes")

    print("\n--- Connectivity check (contacts must be unchanged) ---")
    for name, v in variants.items():
        c = v["connectivity"]
        print(
            f"{name}: within_contacts={c['within_contacts']}, "
            f"between_contacts={c['between_contacts']}, "
            f"within_weight_sum={c['within_weight_sum']:.3f}, "
            f"between_weight_sum={c['between_weight_sum']:.3f}, "
            f"within_mean_w={c['within_weight_mean']:.5f}, "
            f"between_mean_w={c['between_weight_mean']:.5f}"
        )

    ref_contacts = variants["Исходная (bias=1.0)"]["network"]["contacts"]
    for name, v in variants.items():
        assert np.array_equal(v["network"]["contacts"], ref_contacts), (
            f"Contacts changed in variant {name}"
        )
    print("\nOK: contact structure identical across variants.")

    print("\n" + "=" * 70)
    print("DYNAMICS PER VARIANT")
    print("=" * 70)

    all_dynamics = {}
    for name, v in variants.items():
        print(f"\n--- {name} ---")
        result = measure_regional_dynamics(
            v["network"], region_id,
            drive_scalar=1.25, gain=4.0,
            duration=14.0, measure_duration=10.0, seed=600,
        )
        all_dynamics[name] = result

        overall = result["overall"]
        print(
            f"  Overall rate: {overall['mean_rate_hz']:.2f}Hz, "
            f"population_cv={overall['population_cv']:.3f}, "
            f"period={overall['rhythm_period_ms']}"
        )

        within = result["within_region"]
        within_q = [r["q_ratio"] for r in within]
        print(
            f"  Within-region Q ({len(within)} regions): "
            f"{np.round(within_q, 2)}, mean={np.mean(within_q):.2f}"
        )

        between = result["between_region"]
        print(
            f"  Between-region Q: {between['q_ratio']:.2f}, "
            f"p={between['p_value']:.4f}"
        )

    return variants, region_id, all_dynamics


if __name__ == "__main__":
    variants, region_id, all_dynamics = main()

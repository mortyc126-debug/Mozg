import pickle
import numpy as np

with open("/home/claude/sim/v04_raw_paired_data.pkl", "rb") as f:
    saved = pickle.load(f)

raw_data = saved["raw_data"]
stim_sets = saved["stim_sets"]
region_id = saved["region_id"]

VARIANT_BASELINE = "Исходная (bias=1.0)"
VARIANT_WITHIN = "Внутриобластная (bias=2.0)"
VARIANT_BETWEEN = "Межобластная (bias=0.5)"

n_regions = int(region_id.max() + 1)

print("=" * 70)
print("СПЕЦИФИКАЦИЯ МЕТРИКИ")
print("=" * 70)
print(
    "R = (сумма импульсов стимулированного прогона - сумма импульсов\n"
    "     фонового прогона) / число наблюдаемых узлов области,\n"
    "     окно 0-50мс, стимулированные узлы исключены из наблюдения,\n"
    "     подписанная величина (не абсолютная).\n"
    "D_variant = R_variant - R_baseline, для ОДИНАКОВЫХ\n"
    "     (source, target, warm_seed, test_seed).\n"
)

all_keys = set(raw_data[VARIANT_BASELINE].keys())
for name in (VARIANT_WITHIN, VARIANT_BETWEEN):
    all_keys &= set(raw_data[name].keys())

print(f"Общих ключей во всех трёх вариантах: {len(all_keys)}")

contrasts = {VARIANT_WITHIN: {}, VARIANT_BETWEEN: {}}

for variant_name in (VARIANT_WITHIN, VARIANT_BETWEEN):
    for key in all_keys:
        d = raw_data[variant_name][key] - raw_data[VARIANT_BASELINE][key]
        contrasts[variant_name][key] = d

print("\n" + "=" * 70)
print("1. КАЖДОЕ НАПРАВЛЕНИЕ ОТДЕЛЬНО")
print("=" * 70)

for variant_name in (VARIANT_WITHIN, VARIANT_BETWEEN):
    print(f"\n--- D = {variant_name} - {VARIANT_BASELINE} ---")
    for source in range(n_regions):
        for target in range(n_regions):
            vals = np.array([
                contrasts[variant_name][k]
                for k in all_keys if k[0] == source and k[1] == target
            ])
            is_diag = source == target
            print(
                f"  {source}->{target} ({'within' if is_diag else 'between'}): "
                f"n={len(vals)}, mean={vals.mean():+.5f}, "
                f"std={vals.std():.5f}, "
                f"range=[{vals.min():+.5f}, {vals.max():+.5f}]"
            )

print("\n" + "=" * 70)
print("2. STATE x TEST-NOISE MATRIX (one representative direction)")
print("=" * 70)

warm_seeds = sorted(set(k[2] for k in all_keys))
test_seeds = sorted(set(k[3] for k in all_keys))

for variant_name in (VARIANT_WITHIN, VARIANT_BETWEEN):
    print(f"\n{variant_name}, direction 0->1 (between-region):")
    matrix = np.full((len(warm_seeds), len(test_seeds)), np.nan)
    for i, ws in enumerate(warm_seeds):
        for j, ts in enumerate(test_seeds):
            key = (0, 1, ws, ts)
            if key in contrasts[variant_name]:
                matrix[i, j] = contrasts[variant_name][key]
    print(np.array2string(matrix, precision=4, suppress_small=True))
    finite = matrix[np.isfinite(matrix)]
    same_sign = (
        (finite > 0).sum() if finite.mean() > 0 else (finite < 0).sum()
    )
    print(
        f"  Sign consistency: {same_sign}/{finite.size} cells share the "
        f"sign of the mean ({finite.mean():+.5f})"
    )

print("\n" + "=" * 70)
print("3. AVERAGE ACROSS WITHIN vs BETWEEN DIRECTIONS (equal weight each)")
print("=" * 70)

summary_table = []

for variant_name in (VARIANT_WITHIN, VARIANT_BETWEEN):
    diag_direction_means = []
    offdiag_direction_means = []

    for source in range(n_regions):
        for target in range(n_regions):
            vals = np.array([
                contrasts[variant_name][k]
                for k in all_keys if k[0] == source and k[1] == target
            ])
            direction_mean = vals.mean()
            if source == target:
                diag_direction_means.append(direction_mean)
            else:
                offdiag_direction_means.append(direction_mean)

    diag_direction_means = np.array(diag_direction_means)
    offdiag_direction_means = np.array(offdiag_direction_means)

    print(f"\n{variant_name} - {VARIANT_BASELINE}:")
    print(
        f"  Diagonal directions (n={len(diag_direction_means)}): "
        f"mean={diag_direction_means.mean():+.5f}, "
        f"std across directions={diag_direction_means.std():.5f}"
    )
    print(
        f"  Off-diagonal directions (n={len(offdiag_direction_means)}): "
        f"mean={offdiag_direction_means.mean():+.5f}, "
        f"std across directions={offdiag_direction_means.std():.5f}"
    )
    n_positive_offdiag = (offdiag_direction_means > 0).sum()
    print(
        f"  Of {len(offdiag_direction_means)} off-diagonal directions, "
        f"positive: {n_positive_offdiag}"
    )

    summary_table.append({
        "comparison": f"{variant_name} - {VARIANT_BASELINE}",
        "diag_mean": diag_direction_means.mean(),
        "diag_std_across_directions": diag_direction_means.std(),
        "offdiag_mean": offdiag_direction_means.mean(),
        "offdiag_std_across_directions": offdiag_direction_means.std(),
        "n_offdiag_positive": int(n_positive_offdiag),
        "n_offdiag_total": len(offdiag_direction_means),
    })

print("\n" + "=" * 70)
print("SUMMARY TABLE")
print("=" * 70)
print(
    f"{'Comparison':<35} {'Diag diff':>12} {'Between diff':>14} "
    f"{'Heterogeneity (std)':>20}"
)
for row in summary_table:
    print(
        f"{row['comparison']:<35} {row['diag_mean']:>+12.5f} "
        f"{row['offdiag_mean']:>+14.5f} "
        f"{row['offdiag_std_across_directions']:>20.5f}"
    )

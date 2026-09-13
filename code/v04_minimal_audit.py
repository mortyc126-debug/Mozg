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

all_keys = set(raw_data[VARIANT_BASELINE].keys())
for name in (VARIANT_WITHIN, VARIANT_BETWEEN):
    all_keys &= set(raw_data[name].keys())

warm_seeds = sorted(set(k[2] for k in all_keys))
test_seeds = sorted(set(k[3] for k in all_keys))

print("=" * 70)
print("MINIMAL AUDIT: DECOMPOSING D=0 INTO COMPONENTS")
print("=" * 70)
print(f"Keys: {len(all_keys)}, warm_seeds={warm_seeds}, test_seeds={test_seeds}\n")

for source in range(n_regions):
    for target in range(n_regions):
        keys_this_direction = sorted(
            [k for k in all_keys if k[0] == source and k[1] == target],
            key=lambda k: (k[2], k[3]),
        )

        r_base = np.array([
            raw_data[VARIANT_BASELINE][k] for k in keys_this_direction
        ], dtype=float)
        r_within = np.array([
            raw_data[VARIANT_WITHIN][k] for k in keys_this_direction
        ], dtype=float)
        r_between = np.array([
            raw_data[VARIANT_BETWEEN][k] for k in keys_this_direction
        ], dtype=float)

        assert r_base.shape == r_within.shape == r_between.shape
        assert np.isfinite(r_base).all()
        assert np.isfinite(r_within).all()
        assert np.isfinite(r_between).all()

        d_within = r_within - r_base
        d_between = r_between - r_base

        assert np.isclose(
            d_within.mean(), r_within.mean() - r_base.mean(),
            rtol=1e-10, atol=1e-12,
        )
        assert np.isclose(
            d_between.mean(), r_between.mean() - r_base.mean(),
            rtol=1e-10, atol=1e-12,
        )

        base_zero = np.isclose(r_base, 0.0, atol=1e-12)
        within_zero = np.isclose(r_within, 0.0, atol=1e-12)
        between_zero = np.isclose(r_between, 0.0, atol=1e-12)

        equal_bw = np.isclose(r_within, r_base, atol=1e-12)
        equal_bb = np.isclose(r_between, r_base, atol=1e-12)

        is_diag = source == target
        label = "within" if is_diag else "between"

        print(f"{source}->{target} ({label}), n={len(keys_this_direction)}:")
        print(
            f"  mean R: base={r_base.mean():+.5f}, "
            f"bias2.0={r_within.mean():+.5f}, "
            f"bias0.5={r_between.mean():+.5f}"
        )
        print(
            f"  vs bias=2.0: both zero={np.sum(base_zero & within_zero)}, "
            f"equal nonzero={np.sum(equal_bw & ~base_zero)}, "
            f"different={np.sum(~equal_bw)}"
        )
        print(
            f"  vs bias=0.5: both zero={np.sum(base_zero & between_zero)}, "
            f"equal nonzero={np.sum(equal_bb & ~base_zero)}, "
            f"different={np.sum(~equal_bb)}"
        )
        print()

print("=" * 70)
print("SUMMARY: HOW MANY DIRECTIONS HAVE AT LEAST ONE DIFFERING TRIAL")
print("=" * 70)

for compare_name, variant_name in (
    ("bias=2.0 vs base", VARIANT_WITHIN),
    ("bias=0.5 vs base", VARIANT_BETWEEN),
):
    n_directions_with_diff = 0
    n_directions_total = 0
    n_diag_with_diff = 0
    n_offdiag_with_diff = 0

    for source in range(n_regions):
        for target in range(n_regions):
            keys_this_direction = [
                k for k in all_keys if k[0] == source and k[1] == target
            ]
            r_base = np.array(
                [raw_data[VARIANT_BASELINE][k] for k in keys_this_direction]
            )
            r_variant = np.array(
                [raw_data[variant_name][k] for k in keys_this_direction]
            )
            equal = np.isclose(r_variant, r_base, atol=1e-12)
            has_diff = (~equal).any()

            n_directions_total += 1
            if has_diff:
                n_directions_with_diff += 1
                if source == target:
                    n_diag_with_diff += 1
                else:
                    n_offdiag_with_diff += 1

    print(
        f"{compare_name}: {n_directions_with_diff}/{n_directions_total} "
        f"directions have at least one differing trial "
        f"(diagonal: {n_diag_with_diff}/4, off-diagonal: {n_offdiag_with_diff}/12)"
    )

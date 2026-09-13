import pickle
import numpy as np

with open("/home/claude/sim/v04_all_windows_data.pkl", "rb") as f:
    saved = pickle.load(f)

raw_data = saved["raw_data"]
region_id = saved["region_id"]

VARIANT_BASELINE = "Исходная (bias=1.0)"
VARIANT_WITHIN = "Внутриобластная (bias=2.0)"
VARIANT_BETWEEN = "Межобластная (bias=0.5)"

n_regions = int(region_id.max() + 1)

all_keys = set(raw_data[VARIANT_BASELINE].keys())
for name in (VARIANT_WITHIN, VARIANT_BETWEEN):
    all_keys &= set(raw_data[name].keys())

print("Keys:", len(all_keys))


def collect(variant_name, source, target, window_idx, field):
    keys = [k for k in all_keys if k[0] == source and k[1] == target]
    return np.array([
        raw_data[variant_name][k][window_idx][field] for k in keys
    ], dtype=float)


print("R BY WINDOW")
for source in range(n_regions):
    for target in range(n_regions):
        label = "within" if source == target else "between"
        lb = [collect(VARIANT_BASELINE, source, target, w, "R").mean() for w in range(4)]
        lw = [collect(VARIANT_WITHIN, source, target, w, "R").mean() for w in range(4)]
        lm = [collect(VARIANT_BETWEEN, source, target, w, "R").mean() for w in range(4)]
        print(source, "->", target, label, "base", np.round(lb, 5), "bias2", np.round(lw, 5), "bias0.5", np.round(lm, 5))

print("changed_fraction BY WINDOW")
for source in range(n_regions):
    for target in range(n_regions):
        label = "within" if source == target else "between"
        lb = [collect(VARIANT_BASELINE, source, target, w, "changed_fraction").mean() for w in range(4)]
        lw = [collect(VARIANT_WITHIN, source, target, w, "changed_fraction").mean() for w in range(4)]
        lm = [collect(VARIANT_BETWEEN, source, target, w, "changed_fraction").mean() for w in range(4)]
        print(source, "->", target, label, "base", np.round(lb, 4), "bias2", np.round(lw, 4), "bias0.5", np.round(lm, 4))

print("RATES WINDOW 50-100ms")
for source in range(n_regions):
    for target in range(n_regions):
        label = "within" if source == target else "between"
        b_rate = collect(VARIANT_BASELINE, source, target, 1, "baseline_rate_hz")
        s_rate = collect(VARIANT_BASELINE, source, target, 1, "stimulated_rate_hz")
        print(source, "->", target, label, "base_hz", round(b_rate.mean(), 2), "stim_hz", round(s_rate.mean(), 2))

print("SUMMARY NONZERO R")
for variant_name in (VARIANT_BASELINE, VARIANT_WITHIN, VARIANT_BETWEEN):
    n_nz = 0
    for source in range(n_regions):
        for target in range(n_regions):
            any_nz = any(
                not np.allclose(collect(variant_name, source, target, w, "R"), 0.0, atol=1e-12)
                for w in range(4)
            )
            if any_nz:
                n_nz += 1
    print(variant_name, n_nz, "/16")

print("SUMMARY NONZERO changed_fraction")
for variant_name in (VARIANT_BASELINE, VARIANT_WITHIN, VARIANT_BETWEEN):
    n_nz = 0
    for source in range(n_regions):
        for target in range(n_regions):
            any_nz = any(
                not np.allclose(collect(variant_name, source, target, w, "changed_fraction"), 0.0, atol=1e-12)
                for w in range(4)
            )
            if any_nz:
                n_nz += 1
    print(variant_name, n_nz, "/16")

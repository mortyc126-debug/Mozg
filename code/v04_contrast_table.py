import pickle
import numpy as np

with open("/home/claude/sim/v04_final_data.pkl", "rb") as f:
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


def direction_mean(variant_name, source, target, field, window_idx=None):
    keys = [k for k in all_keys if k[0] == source and k[1] == target]
    if window_idx is None:
        vals = [raw_data[variant_name][k][field] for k in keys]
    else:
        vals = [raw_data[variant_name][k][field][window_idx] for k in keys]
    return np.mean(vals)


def build_matrix(variant_name, field, window_idx=None):
    m = np.zeros((n_regions, n_regions))
    for source in range(n_regions):
        for target in range(n_regions):
            m[source, target] = direction_mean(variant_name, source, target, field, window_idx)
    return m


def within_between_means(matrix):
    diag = np.diag(matrix)
    off_mask = ~np.eye(n_regions, dtype=bool)
    return diag.mean(), matrix[off_mask].mean(), diag, matrix[off_mask]


print("MATRICES F_200")
for variant_name in (VARIANT_BASELINE, VARIANT_WITHIN, VARIANT_BETWEEN):
    m = build_matrix(variant_name, "F_200")
    print(variant_name)
    print(np.array2string(m, precision=4, suppress_small=True))

print("MATRICES R_200")
for variant_name in (VARIANT_BASELINE, VARIANT_WITHIN, VARIANT_BETWEEN):
    m = build_matrix(variant_name, "R_200")
    print(variant_name)
    print(np.array2string(m, precision=5, suppress_small=True))

print("MAIN CONTRAST TABLE")
f_base = build_matrix(VARIANT_BASELINE, "F_200")
r_base = build_matrix(VARIANT_BASELINE, "R_200")

for name, variant_name in (("bias=0.5-1", VARIANT_BETWEEN), ("bias=2-1", VARIANT_WITHIN)):
    f_var = build_matrix(variant_name, "F_200")
    r_var = build_matrix(variant_name, "R_200")

    df = f_var - f_base
    dr = r_var - r_base

    dfw, dfb, dfw_all, dfb_all = within_between_means(df)
    drw, drb, drw_all, drb_all = within_between_means(dr)

    print(name, "dF_within", round(dfw, 5), "dF_between", round(dfb, 5),
          "dR_within", round(drw, 5), "dR_between", round(drb, 5))
    print("  dF within per direction:", np.round(dfw_all, 4))
    print("  dF between per direction:", np.round(dfb_all, 4))
    print("  dR within per direction:", np.round(drw_all, 5))
    print("  dR between per direction:", np.round(drb_all, 5))

print("PER-WINDOW F CONTRAST")
for name, variant_name in (("bias=0.5-1", VARIANT_BETWEEN), ("bias=2-1", VARIANT_WITHIN)):
    for w_idx, w_label in enumerate(["0-50", "50-100", "100-150", "150-200"]):
        f_var_w = build_matrix(variant_name, "F_windows", w_idx)
        f_base_w = build_matrix(VARIANT_BASELINE, "F_windows", w_idx)
        df_w = f_var_w - f_base_w
        wm, bm, _, _ = within_between_means(df_w)
        print(name, w_label, "dF_within", round(wm, 5), "dF_between", round(bm, 5))

print("SANITY CHECK")
sample_key = next(iter(all_keys))
res = raw_data[VARIANT_BASELINE][sample_key]
sum_windows = sum(res["F_windows"])
print("sample", sample_key, "F_200", round(res["F_200"], 4), "sum_windows", round(sum_windows, 4))
print("F_200<=sum:", res["F_200"] <= sum_windows + 1e-12)

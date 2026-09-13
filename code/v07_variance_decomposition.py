"""
Точное разложение дисперсии парных контрастов F_200 (v0.7) на
внутригрупповую и межгрупповую компоненты, где группа = (geometry_seed,
growth_condition) -- ОБА повтора перестройки (repeat_index 0 и 1)
объединены в одну группу, как согласовано.

ИСПРАВЛЯЕТ первоначальную ошибку в интерпретации (см. RESULTS_LEDGER.md
пункт 16 критических находок): сравнение std напрямую БЕЗ возведения в
квадрат и без формального разложения через суммы квадратов даёт
неверную/непроверяемую оценку доли дисперсии. Здесь используется:

  total_variance  = within_variance + between_variance   (точное тождество)
  within_variance = sum_g( n_g * var(group_g) ) / n_total
  between_variance = sum_g( n_g * (mean(group_g) - overall_mean)^2 ) / n_total

Это ОПИСАТЕЛЬНОЕ разложение сохранённой выборки, не оценка независимых
причинных вкладов и не SEM.
"""
import pickle
import numpy as np
from collections import defaultdict


def paired_diffs_grouped(results, by_key, policy_a, policy_b):
    """Группирует парные разности F_200(policy_a) - F_200(policy_b) по
    (geometry_seed, growth_condition), объединяя оба repeat_index."""
    groups = defaultdict(list)
    for r in results:
        if r["policy"] != policy_a:
            continue
        key_b = (r["geometry_seed"], r["growth_condition"], policy_b,
                  r["repeat_index"], r["stim_set_index"], r["test_seed"])
        if key_b in by_key:
            diff = r["F_200"] - by_key[key_b]["F_200"]
            groups[(r["geometry_seed"], r["growth_condition"])].append(diff)
    return {k: np.array(v) for k, v in groups.items()}


def exact_decomposition(groups_dict):
    """Точное разложение дисперсии через суммы квадратов (см. docstring
    модуля). Возвращает dict с total/within/between variance и std, и их
    долями. Проверяет тождество total = within + between явным assert."""
    groups = list(groups_dict.values())
    all_values = np.concatenate(groups)
    overall_mean = all_values.mean()
    n_total = len(all_values)

    total_variance = np.mean((all_values - overall_mean) ** 2)

    within_variance = sum(
        len(g) * np.mean((g - g.mean()) ** 2) for g in groups
    ) / n_total

    between_variance = sum(
        len(g) * (g.mean() - overall_mean) ** 2 for g in groups
    ) / n_total

    assert np.isclose(total_variance, within_variance + between_variance), (
        "нарушено тождество разложения дисперсии -- ошибка в расчёте"
    )

    within_share = within_variance / total_variance if total_variance > 0 else np.nan
    between_share = between_variance / total_variance if total_variance > 0 else np.nan

    return {
        "n_total": n_total,
        "n_groups": len(groups),
        "group_sizes": [len(g) for g in groups],
        "overall_mean": float(overall_mean),
        "total_variance": float(total_variance),
        "within_variance": float(within_variance),
        "between_variance": float(between_variance),
        "within_share": float(within_share),
        "between_share": float(between_share),
        "total_std": float(np.sqrt(total_variance)),
        "within_std": float(np.sqrt(within_variance)),
        "between_std": float(np.sqrt(between_variance)),
    }


def main():
    with open("v07_functional_full_324.pkl", "rb") as f:
        d = pickle.load(f)

    by_key = {}
    for r in d["results"]:
        k = (r["geometry_seed"], r["growth_condition"], r["policy"],
             r["repeat_index"], r["stim_set_index"], r["test_seed"])
        by_key[k] = r

    for label, (a, b) in [("random - none", ("random", "none")),
                            ("weakest - none", ("weakest", "none")),
                            ("weakest - random", ("weakest", "random"))]:
        groups = paired_diffs_grouped(d["results"], by_key, a, b)
        dec = exact_decomposition(groups)
        print(f"\n{label}:")
        print(f"  n_total={dec['n_total']}  n_groups={dec['n_groups']}  "
              f"group_sizes={dec['group_sizes']}")
        print(f"  overall_mean={dec['overall_mean']:+.4f}")
        print(f"  total_std={dec['total_std']:.4f}  "
              f"within_std={dec['within_std']:.4f}  "
              f"between_std={dec['between_std']:.4f}")
        print(f"  within_share={dec['within_share']:.3f}  "
              f"between_share={dec['between_share']:.3f}")


if __name__ == "__main__":
    main()

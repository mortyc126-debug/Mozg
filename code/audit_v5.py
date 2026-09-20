import numpy as np

from v05_growth_rules import simulate_with_growth_rule


def audit_structure(seed=11, max_in_degree=12, distance_limit=0.25):
    net_budget = simulate_with_growth_rule(
        seed=seed, growth_rule="budget_length", max_in_degree=max_in_degree,
    )
    net_baseline = simulate_with_growth_rule(
        seed=seed, growth_rule="distance_only",
    )

    distance = net_budget["distance"]
    N = distance.shape[0]

    within_range = (distance < distance_limit)
    np.fill_diagonal(within_range, False)
    eligible_neighbors = within_range.sum(axis=1)

    contacts_budget = net_budget["contacts"]
    in_degree_budget = contacts_budget.sum(axis=1)

    capacity = np.minimum(max_in_degree, eligible_neighbors)
    unfilled = capacity - in_degree_budget

    print("Seed", seed, "audit of budget_length rule K=", max_in_degree)
    print("Total nodes:", N)
    print("Nodes with in_degree == K:", int((in_degree_budget == max_in_degree).sum()))
    print(
        "Nodes with in_degree < K and eligible >= K:",
        int(((in_degree_budget < max_in_degree) & (eligible_neighbors >= max_in_degree)).sum()),
    )
    print(
        "Nodes with in_degree == eligible_neighbors < K:",
        int(((in_degree_budget == eligible_neighbors) & (eligible_neighbors < max_in_degree)).sum()),
    )
    print("Mean eligible_neighbors:", round(eligible_neighbors.mean(), 2))
    print("Mean capacity:", round(capacity.mean(), 2))
    print("Mean unfilled:", round(unfilled.mean(), 2))
    print(
        "Unfilled dist min/25/median/75/max:",
        unfilled.min(),
        round(np.percentile(unfilled, 25), 1),
        round(np.median(unfilled), 1),
        round(np.percentile(unfilled, 75), 1),
        unfilled.max(),
    )

    threshold_budget = net_budget["state"]["threshold"]
    threshold_baseline = net_baseline["state"]["threshold"]
    weight_sum_budget = net_budget["weights"].sum(axis=1)
    weight_sum_baseline = net_baseline["weights"].sum(axis=1)

    print("Thresholds budget_length mean/std:", round(threshold_budget.mean(), 4), round(threshold_budget.std(), 4))
    print("Thresholds distance_only mean/std:", round(threshold_baseline.mean(), 4), round(threshold_baseline.std(), 4))
    print("Weight sum budget_length mean/std:", round(weight_sum_budget.mean(), 4), round(weight_sum_budget.std(), 4))
    print("Weight sum distance_only mean/std:", round(weight_sum_baseline.mean(), 4), round(weight_sum_baseline.std(), 4))

    return {
        "eligible_neighbors": eligible_neighbors,
        "in_degree_budget": in_degree_budget,
        "capacity": capacity,
        "unfilled": unfilled,
    }


if __name__ == "__main__":
    for seed in (11, 22, 33):
        audit_structure(seed=seed)
        print()

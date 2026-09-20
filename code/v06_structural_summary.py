"""
v0.6: структурная сводка снимков продлённого развития.

Ёмкость сети (см. согласованную спецификацию):
  Без бюджета: C_i = n_i (число допустимых соседей по строгому критерию
    расстояния distance < 0.25, при i != j -- считаем НАПРАВЛЕННЫЕ
    контакты, без учёта достижимости узла по maturity/ready в разные
    моменты времени, т.к. допустимость определяется только геометрией).
  С бюджетом:  C_i = min(max_in_degree, n_i).
  C = sum_i C_i.

ВАЖНО: это ёмкость по ГЕОМЕТРИИ (distance < 0.25, i != j), она не
учитывает, что часть узлов ещё не "ready" в момент t=12с/24с/... --
это верхняя граница, достижимая при бесконечном времени и вероятности
образования > 0 для каждой допустимой пары. Обосновано тем же
допущением, что и в согласованной спецификации ("при конечном наборе
допустимых контактов... штраф длины в пределе может лишь задерживать").

Индекс Жаккара:
  J(E1, E2) = |E1 ∩ E2| / |E1 ∪ E2|, где E1/E2 -- множества направленных
  рёбер (i,j) с contacts[i,j]=True. Соглашение для пустого объединения:
  J = 1.0 (два пустых графа считаются идентичными).
"""
import numpy as np


def compute_capacity(distance, max_in_degree=None):
    """
    distance: (N,N) матрица расстояний.
    max_in_degree: если задан -- применяется бюджет (min(K, n_i));
                   если None -- ёмкость без бюджета (n_i).
    Возвращает (C_total: int, C_per_node: np.array[N] int, n_eligible_per_node: np.array[N] int).
    """
    N = distance.shape[0]
    eligible = (distance < 0.25).copy()
    np.fill_diagonal(eligible, False)
    n_eligible_per_node = eligible.sum(axis=1)

    if max_in_degree is not None:
        c_per_node = np.minimum(max_in_degree, n_eligible_per_node)
    else:
        c_per_node = n_eligible_per_node.copy()

    return int(c_per_node.sum()), c_per_node, n_eligible_per_node


def jaccard(contacts_a, contacts_b):
    """Индекс Жаккара между двумя булевыми матрицами направленных рёбер.
    J=1.0 если оба графа пусты (соглашение, см. docstring модуля)."""
    inter = np.logical_and(contacts_a, contacts_b).sum()
    union = np.logical_or(contacts_a, contacts_b).sum()
    if union == 0:
        return 1.0
    return float(inter) / float(union)


def structural_summary(snapshot, use_budget, max_in_degree=12):
    """
    snapshot: net_dict как возвращает simulate_v05_snapshots (один момент).
    Возвращает dict с показателями структурной сводки.
    """
    contacts = snapshot["contacts"]
    weights = snapshot["weights"]
    distance = snapshot["distance"]
    threshold = snapshot["state"]["threshold"]

    n_contacts = int(contacts.sum())
    cap_total, cap_per_node, n_eligible_per_node = compute_capacity(
        distance, max_in_degree=max_in_degree if use_budget else None
    )
    fill_fraction = n_contacts / cap_total if cap_total > 0 else np.nan

    in_degree = contacts.sum(axis=1)
    unfilled_capacity = cap_per_node - in_degree  # per-node, can be 0 if at cap

    contact_lengths = distance[contacts] if n_contacts > 0 else np.array([])

    total_input_weight = weights.sum(axis=1)  # per-node sum of incoming weights

    return {
        "t_snapshot": snapshot["t_snapshot"],
        "n_contacts": n_contacts,
        "capacity_total": cap_total,
        "fill_fraction": fill_fraction,
        "in_degree_per_node": in_degree.copy(),
        "n_eligible_per_node": n_eligible_per_node.copy(),
        "unfilled_capacity_per_node": unfilled_capacity.copy(),
        "contact_lengths": contact_lengths.copy(),
        "mean_contact_length": contact_lengths.mean() if n_contacts > 0 else np.nan,
        "total_input_weight_per_node": total_input_weight.copy(),
        "threshold_per_node": threshold.copy(),
        "n_new_contacts_last_second": snapshot["n_new_contacts_last_second"],
        "normalization_events": snapshot["normalization_events"],
        "rate_hz": snapshot["metrics"]["rate_hz"],
        "silent_fraction": snapshot["metrics"]["silent_fraction"],
        "population_cv": snapshot["metrics"]["population_cv"],
    }

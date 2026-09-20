"""
v0.8: основной структурный показатель -- направленное сохранение
исходных контактов между группами A и B.

S_{A->B}(traj) = доля исходных контактов вида (получатель in B,
                 источник in A) [т.е. A->B в терминах "откуда сигнал
                 идёт"], присутствующих в КОНЕЧНОМ графе траектории.
S_{B->A}(traj) = аналогично для (получатель in A, источник in B).

C = 1/2 * [ (S_{A->B}^{AB} - S_{A->B}^{BA}) + (S_{B->A}^{BA} - S_{B->A}^{AB}) ]

Положительное C: опыт AB сохраняет A->B лучше, чем опыт BA (и наоборот
для B->A) -- то есть порядок опыта соответствует направлению
сохранённых контактов.

Дополнительно различаем для каждого исходного контакта (получатель,
источник):
  - present_at_end: bool
  - never_removed: bool (присутствовал на протяжении ВСЕЙ траектории,
    ни разу не был снят события do_rewire_event)
  - removed_then_restored: bool (был снят хотя бы раз, но восстановлен
    к концу -- "present_at_end and not never_removed")
"""
import numpy as np


def directed_original_contacts(initial_contacts, group_A, group_B):
    """Возвращает списки (receiver, source) исходных направленных
    контактов для двух направлений."""
    A_to_B = [
        (int(r), int(s)) for r in group_B for s in group_A
        if initial_contacts[r, s]
    ]
    B_to_A = [
        (int(r), int(s)) for r in group_A for s in group_B
        if initial_contacts[r, s]
    ]
    return A_to_B, B_to_A


def contact_fate(edge_list, event_log, final_contacts):
    """Для списка исходных рёбер [(receiver,source),...] возвращает
    dict[(receiver,source) -> {"present_at_end","never_removed",
    "removed_then_restored"}], используя event_log траектории (в
    хронологическом порядке -- do_rewire_event события со статусом
    "applied")."""
    removed_at_least_once = set()
    for e in event_log:
        if e.get("status") != "applied":
            continue
        edge_removed = (e["receiver"], e["old_source"])
        if edge_removed in set(edge_list):
            removed_at_least_once.add(edge_removed)

    result = {}
    for edge in edge_list:
        r, s = edge
        present = bool(final_contacts[r, s])
        never_removed = edge not in removed_at_least_once
        removed_then_restored = present and not never_removed
        result[edge] = {
            "present_at_end": present,
            "never_removed": never_removed,
            "removed_then_restored": removed_then_restored,
        }
    return result


def compute_S(edge_list, event_log, final_contacts):
    """Доля исходных рёбер (из edge_list), присутствующих в final_contacts."""
    if len(edge_list) == 0:
        return np.nan, {}
    fates = contact_fate(edge_list, event_log, final_contacts)
    n_present = sum(f["present_at_end"] for f in fates.values())
    S = n_present / len(edge_list)
    return S, fates


def compute_directional_contrast(
    initial_contacts, group_A, group_B,
    traj_AB, traj_BA,
):
    """traj_AB, traj_BA -- результаты run_experience_trajectory для
    одной исходной сети и одного механизма (тот же plasticity/policy),
    отличающиеся только order. Возвращает dict с S_AB_AtoB, S_AB_BtoA,
    S_BA_AtoB, S_BA_BtoA, C, и fates для аудита."""
    A_to_B_edges, B_to_A_edges = directed_original_contacts(
        initial_contacts, group_A, group_B
    )

    S_AB_AtoB, fates_AB_AtoB = compute_S(A_to_B_edges, traj_AB["event_log"], traj_AB["contacts"])
    S_AB_BtoA, fates_AB_BtoA = compute_S(B_to_A_edges, traj_AB["event_log"], traj_AB["contacts"])
    S_BA_AtoB, fates_BA_AtoB = compute_S(A_to_B_edges, traj_BA["event_log"], traj_BA["contacts"])
    S_BA_BtoA, fates_BA_BtoA = compute_S(B_to_A_edges, traj_BA["event_log"], traj_BA["contacts"])

    C = 0.5 * ((S_AB_AtoB - S_BA_AtoB) + (S_BA_BtoA - S_AB_BtoA))

    return {
        "n_A_to_B_original": len(A_to_B_edges),
        "n_B_to_A_original": len(B_to_A_edges),
        "S_AB_AtoB": S_AB_AtoB, "S_AB_BtoA": S_AB_BtoA,
        "S_BA_AtoB": S_BA_AtoB, "S_BA_BtoA": S_BA_BtoA,
        "C": C,
        "fates_AB_AtoB": fates_AB_AtoB, "fates_AB_BtoA": fates_AB_BtoA,
        "fates_BA_AtoB": fates_BA_AtoB, "fates_BA_BtoA": fates_BA_BtoA,
    }

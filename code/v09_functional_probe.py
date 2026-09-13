"""
v0.9: функциональная проба на сохранённых сетях v0.8 (совокупное
проявление приобретённых весов и контактов, БЕЗ нового обучения).

Общий контролируемый старт (диагностический сброс, НЕ имитация
естественного пробуждения): v/adaptation/refractory/threshold/drive
берутся из снимка v0.6 (t=96с, ДО начала опыта v0.8) -- ОДИНАКОВЫ для
всех сопоставляемых ветвей AB/BA данной исходной сети/механизма. syn
ОБНУЛЯЕТСЯ в обеих ветвях. Веса и маска контактов -- КОНЕЧНЫЕ,
приобретённые в ходе соответствующей траектории v0.8 (различны между
AB и BA -- это и есть проверяемое отличие).

Электрическая динамика -- v05_functional.py::frozen_step (та же
проверенная семантика, что в v0.5-v0.7 -- НЕ создаём второй путь
обработки импульса). Рост/STDP/перестройка/пороги выключены; адаптация/
рефрактерность/передача включены; gain=1 (current=drive+syn-adaptation).
"""
import numpy as np

from v05_functional import DT, frozen_step, copy_state, make_noise, probe, force_spikes


def check_full_graph_and_weights_match(traj_ab, traj_ba):
    """Проверяет напрямую (не через показатель C, который описывает
    только исходные A-B/B-A контакты), совпадают ли ПОЛНЫЕ контактные
    матрицы и веса между AB и BA. C=0 НЕ гарантирует same_contacts=True
    -- могут быть различия контактов ВНЕ групп A/B при этом же C=0."""
    same_contacts = bool(np.array_equal(traj_ab["contacts"], traj_ba["contacts"]))
    same_weights = bool(np.array_equal(traj_ab["weights"], traj_ba["weights"]))
    return same_contacts, same_weights


def build_common_start_state(v06_snapshot_state, v08_traj):
    """Строит общее стартовое состояние: v/adaptation/refractory/
    threshold/drive из v06_snapshot_state (общие для AB/BA), syn=0,
    веса/контакты -- из v08_traj (конечные, специфичные для этой ветви).
    Возвращает (state_dict, weights, contacts)."""
    state = {
        "v": v06_snapshot_state["v"].copy(),
        "adaptation": v06_snapshot_state["adaptation"].copy(),
        "refractory": v06_snapshot_state["refractory"].copy(),
        "threshold": v06_snapshot_state["threshold"].copy(),
        "drive": v06_snapshot_state["drive"].copy(),
        "syn": np.zeros_like(v06_snapshot_state["v"]),  # explicit reset, diagnostic
    }
    weights = v08_traj["weights"].copy()
    contacts = v08_traj["contacts"].copy()
    return state, weights, contacts


def run_direction_probe(state, weights, noise, stimulate_nodes, observe_nodes):
    """Один прогон 'без воздействия' / 'с воздействием' пара для
    заданного направления (stimulate_nodes -> считываем observe_nodes).
    Возвращает (baseline_spikes[steps,N], stimulated_spikes[steps,N]).
    Используем v05_functional.py::probe напрямую -- проверенная
    семантика, единственный путь обработки импульса."""
    baseline_spikes, _ = probe(state, weights, noise, transmission=True,
                                stimulate_nodes=None)
    stimulated_spikes, _ = probe(state, weights, noise, transmission=True,
                                  stimulate_nodes=stimulate_nodes)
    return baseline_spikes, stimulated_spikes


def compute_R(baseline_spikes, stimulated_spikes, observe_nodes, bin_ms=5, dt=DT):
    """R[i,k] = N_stim[i,k] - N_baseline[i,k] для узла i из observe_nodes,
    временной bin k (bin_ms мс каждый). Возвращает R (n_observe, n_bins)."""
    bin_steps = int(round(bin_ms / 1000 / dt))
    total_steps = baseline_spikes.shape[0]
    n_bins = total_steps // bin_steps

    b = baseline_spikes[:n_bins * bin_steps, observe_nodes]
    s = stimulated_spikes[:n_bins * bin_steps, observe_nodes]

    b_binned = b.reshape(n_bins, bin_steps, len(observe_nodes)).sum(axis=1).T  # (n_observe, n_bins)
    s_binned = s.reshape(n_bins, bin_steps, len(observe_nodes)).sum(axis=1).T

    R = s_binned.astype(int) - b_binned.astype(int)
    return R


def compute_D(R_AB_mean, R_BA_mean):
    """D = mean_{i,k} |R_AB[i,k] - R_BA[i,k]|. R_*_mean уже усреднены по
    тестовым шумам (see spec: 'сначала усредняем R по трём тестовым
    шумам, затем вычисляем D')."""
    return float(np.mean(np.abs(R_AB_mean - R_BA_mean)))

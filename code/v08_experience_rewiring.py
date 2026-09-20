"""
v0.8: опыт-зависимая перестройка. Совмещает пластичность весов (точное
правило STDP из v5f.py::simulate_v05, БЕЗ роста/нормировки-порога) и
перестройку контактов (v07_rewiring.py) с принудительной стимуляцией
последовательностей A->B / B->A.

ВЕРСИЯ 2 -- уточнённый протокол шага (см. обсуждение в чате): естественный
и принудительный импульс одного узла на одной временной отметке НЕ
обрабатываются как два отдельных пакета STDP/передачи/сброса. Вместо
этого:

  1. Интегрировать электрическую динамику до времени t (без STDP/
     передачи/сброса) -> natural_fired.
  2. Определить forced_fired, назначенные на t (из расписания
     стимуляции).
  3. fired = natural_fired | forced_fired.
  4. Один раз обработать ВЕСЬ fired: STDP (если включена) по следам ДО
     этого пакета, ограничения весов, передача (syn += W[:,fired].sum),
     сброс v/refractory/adaptation, обновление trace.
  5. Перестройка, назначенная на t (использует граф ДО замены для шага
     4, новый граф действует со следующего пакета).
  6. Снимок/запись, если назначены на t.

Это НАМЕРЕННОЕ уточнение порядка относительно раннего черновика этого
модуля (который делал electrical_step с немедленной STDP/передачей/
сбросом, а затем ОТДЕЛЬНО force_spikes с ещё одним вызовом STDP --
это давало ДВОЙНУЮ обработку при совпадении времени принудительного и
естественного импульса одного узла, и создавало искусственный порядок
"раньше/позже" между разными узлами, сработавшими на одной отметке).
Старые результаты v0.5-v0.7 не затронуты -- эта проблема специфична для
v0.8, где впервые естественная активность и принудительная стимуляция
сосуществуют в одном прогоне с активной пластичностью.
"""
import numpy as np

DT = 0.001
ETA_STDP = 0.0002
STDP_ASYMMETRY = 1.05
W_MIN, W_MAX = 0.0, 0.08
INPUT_CAP = 0.6


def copy_state(net_state):
    return {
        "v": net_state["v"].copy(),
        "syn": net_state["syn"].copy(),
        "adaptation": net_state["adaptation"].copy(),
        "refractory": net_state["refractory"].copy(),
        "threshold": net_state["threshold"].copy(),
        "drive": net_state["drive"].copy(),
        "trace": (net_state["trace"].copy() if "trace" in net_state
                  else np.zeros_like(net_state["v"])),
    }


def eligible_mask(distance, radius=0.25):
    N = distance.shape[0]
    m = (distance < radius).copy()
    np.fill_diagonal(m, False)
    return m


def build_fixed_schedule(rng_schedule, initial_contacts, eligible, n_events):
    missing = eligible & ~initial_contacts
    n_candidates = missing.sum(axis=1)
    eligible_receivers = np.flatnonzero(n_candidates > 0)
    if len(eligible_receivers) == 0:
        return np.array([], dtype=int)
    return rng_schedule.choice(eligible_receivers, size=n_events, replace=True)


def do_rewire_event(rng_choice, contacts, W, distance, eligible, receiver, policy):
    """Идентично v07_rewiring.py::do_rewire_event. Кандидаты фиксируются
    ДО удаления."""
    candidates_before = np.flatnonzero(eligible[receiver] & ~contacts[receiver])
    if len(candidates_before) == 0:
        return None
    existing_sources = np.flatnonzero(contacts[receiver])
    if len(existing_sources) == 0:
        return None

    if policy == "random":
        old_source = int(rng_choice.choice(existing_sources))
    elif policy == "weakest":
        weights_existing = W[receiver, existing_sources]
        min_w = weights_existing.min()
        tied = existing_sources[weights_existing == min_w]
        old_source = int(rng_choice.choice(tied))
    else:
        raise ValueError(f"unknown policy {policy}")

    new_source = int(rng_choice.choice(candidates_before))

    old_weight = float(W[receiver, old_source])
    old_length = float(distance[receiver, old_source])
    new_length = float(distance[receiver, new_source])

    W[receiver, old_source] = 0.0
    contacts[receiver, old_source] = False
    W[receiver, new_source] = old_weight
    contacts[receiver, new_source] = True

    return {
        "receiver": receiver, "old_source": old_source, "new_source": new_source,
        "transferred_weight": old_weight, "old_length": old_length,
        "new_length": new_length,
    }


def integrate_electrical(state, noise):
    """Шаг 1: интегрирование электрической динамики БЕЗ STDP/передачи/
    сброса -- только затухания и обновление v, определение natural_fired.
    Мутирует state (syn/adaptation/refractory/trace затухания, v -- для
    available узлов), НЕ трогает W, НЕ делает сброс fired узлов (это
    происходит позже, в process_fired_batch, вместе с forced_fired)."""
    v = state["v"]; syn = state["syn"]; adaptation = state["adaptation"]
    refractory = state["refractory"]; threshold = state["threshold"]
    drive = state["drive"]; trace = state["trace"]

    syn *= np.exp(-DT / 0.010)
    adaptation *= np.exp(-DT / 0.200)
    refractory[:] = np.maximum(0.0, refractory - DT)
    trace *= np.exp(-DT / 0.020)

    available = (refractory == 0.0)
    current = drive + syn - adaptation  # maturity=1 for all nodes (mature snapshots)

    dv = (DT / 0.020) * (-v + current)
    v[available] += (dv + noise)[available]

    natural_fired = available & (v >= threshold)
    return natural_fired


def process_fired_batch(state, W, contacts, fired_mask, plasticity_enabled):
    """Шаг 4: ОДИН РАЗ обрабатывает объединённую маску (natural | forced):
    STDP (если включена) по следам ДО этого пакета, ограничения весов,
    передача, сброс v/refractory/adaptation, обновление trace. Форсированные
    узлы обходят проверку refractory/available по построению (маска уже
    объединена до вызова) -- согласовано: "принудительный импульс может
    обходить рефрактерность"."""
    if not np.any(fired_mask):
        return

    trace = state["trace"]

    if plasticity_enabled:
        W[fired_mask, :] += ETA_STDP * trace[None, :] * contacts[fired_mask, :]
        W[:, fired_mask] -= STDP_ASYMMETRY * ETA_STDP * trace[:, None] * contacts[:, fired_mask]
        np.clip(W, W_MIN, W_MAX, out=W)
        total_input = W.sum(axis=1)
        W *= np.minimum(1.0, INPUT_CAP / np.maximum(total_input, 1e-12))[:, None]

    state["syn"] += W[:, fired_mask].sum(axis=1)
    state["v"][fired_mask] = 0.0
    state["refractory"][fired_mask] = 0.005
    state["adaptation"][fired_mask] += 0.25
    trace[fired_mask] += 1.0


def summarize_stim_log(stim_log, group_size):
    """Агрегирует журнал стимуляции в единицы измерения, согласованные
    в спецификации: n_sequences (число ПОЛНЫХ последовательностей
    A->B или B->A, т.е. пар (first,second) предъявлений), n_forced_
    timestamps (число отдельных временных отметок форсированной
    стимуляции -- по одной на группу за предъявление, т.е. 2 на
    последовательность), n_assigned_node_spikes (= n_forced_timestamps
    * group_size), n_overlap_node_events, n_added_node_spikes."""
    n_forced_timestamps = len(stim_log)
    n_sequences = n_forced_timestamps // 2  # each sequence = 1 "first" + 1 "second" timestamp
    n_assigned_node_spikes = sum(e["n_assigned_node_spikes"] for e in stim_log)
    n_overlap_node_events = sum(e["n_overlap_node_events"] for e in stim_log)
    n_added_node_spikes = sum(e["n_added_node_spikes"] for e in stim_log)
    assert n_assigned_node_spikes == n_added_node_spikes + n_overlap_node_events
    return {
        "n_sequences": n_sequences,
        "n_forced_timestamps": n_forced_timestamps,
        "n_assigned_node_spikes": n_assigned_node_spikes,
        "n_overlap_node_events": n_overlap_node_events,
        "n_added_node_spikes": n_added_node_spikes,
    }


def run_experience_trajectory(
    initial_contacts, initial_weights, initial_state, distance,
    order,  # "AB" or "BA"
    plasticity_enabled, rewire_policy,
    group_A, group_B,
    duration, rewire_interval, sequence_period, first_pulse_time, lag,
    rewire_seed, noise_seed,
    radius=0.25,
):
    N = initial_contacts.shape[0]
    contacts = initial_contacts.copy()
    W = initial_weights.copy()
    state = copy_state(initial_state)

    eligible = eligible_mask(distance, radius=radius)

    rng_schedule = np.random.default_rng(rewire_seed)
    rng_event_choice = np.random.default_rng(rewire_seed + 500000)
    rng_noise_gen = np.random.default_rng(noise_seed)

    total_steps = int(round(duration / DT))
    rewire_every_steps = int(round(rewire_interval / DT))
    n_rewire_events = total_steps // rewire_every_steps
    schedule = build_fixed_schedule(rng_schedule, initial_contacts, eligible, n_rewire_events)

    noise = 0.012 * rng_noise_gen.standard_normal((total_steps, N))

    first_node, second_node = (group_A, group_B) if order == "AB" else (group_B, group_A)

    period_steps = int(round(sequence_period / DT))
    first_pulse_step = int(round(first_pulse_time / DT))
    lag_steps = int(round(lag / DT))
    assert 0 < lag_steps < period_steps, "лаг должен быть внутри периода"

    spikes = np.zeros((total_steps, N), dtype=bool)
    event_log = []
    stim_log = []

    rewire_event_idx = 0

    for step in range(total_steps):
        completed_steps = step + 1

        # 1-2. natural + forced fired for this timestamp
        natural_fired = integrate_electrical(state, noise[step])

        forced_mask = np.zeros(N, dtype=bool)
        forced_group_label = None
        if completed_steps >= first_pulse_step:
            offset = completed_steps - first_pulse_step
            if offset % period_steps == 0:
                forced_mask[first_node] = True
                forced_group_label = "first"
            elif offset % period_steps == lag_steps:
                forced_mask[second_node] = True
                forced_group_label = "second"

        # 3. union
        fired = natural_fired | forced_mask
        spikes[step] = natural_fired  # recorded raster = NATURAL activity only,
                                       # forced pulses logged separately in stim_log
                                       # (see summary note below)

        if forced_group_label is not None:
            overlap_nodes = (group_A if forced_group_label == "first" and order == "AB"
                              else group_B if forced_group_label == "first" and order == "BA"
                              else group_B if forced_group_label == "second" and order == "AB"
                              else group_A)
            overlap_node_mask = natural_fired[overlap_nodes]
            n_overlap_nodes = int(overlap_node_mask.sum())
            stim_log.append({
                "step": completed_steps, "t": completed_steps * DT,
                "group": forced_group_label, "nodes": overlap_nodes.tolist(),
                "n_assigned_node_spikes": len(overlap_nodes),
                "n_overlap_node_events": n_overlap_nodes,
                "n_added_node_spikes": len(overlap_nodes) - n_overlap_nodes,
            })

        # 4. process the UNION exactly once
        process_fired_batch(state, W, contacts, fired, plasticity_enabled)

        # 5. rewiring (fixed interval) -- AFTER this timestamp's pulse batch,
        #    uses the graph as it stood for step 4 (new graph active from
        #    next timestamp onward)
        if completed_steps % rewire_every_steps == 0:
            receiver = (int(schedule[rewire_event_idx])
                        if rewire_event_idx < len(schedule) else None)
            rewire_event_idx += 1
            if receiver is None:
                event_log.append({"step": completed_steps, "t": completed_steps*DT,
                                   "status": "skipped_no_eligible_receiver"})
            else:
                result = do_rewire_event(rng_event_choice, contacts, W, distance,
                                          eligible, receiver, rewire_policy)
                if result is None:
                    event_log.append({"step": completed_steps, "t": completed_steps*DT,
                                       "status": "skipped_no_candidates_or_no_sources",
                                       "receiver": receiver})
                else:
                    result.update({"step": completed_steps, "t": completed_steps*DT,
                                    "status": "applied"})
                    event_log.append(result)

    return {
        "contacts": contacts.copy(),
        "weights": W.copy(),
        "state": {k: v.copy() for k, v in state.items()},
        "event_log": event_log,
        "stim_log": stim_log,
        "spikes": spikes,
        "schedule": schedule.copy(),
    }

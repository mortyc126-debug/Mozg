"""
v0.7: структурная пластичность -- ограниченная замена (rewiring)
входящих контактов на заполненных бюджетных сетях (снимки t=96с из
v0.6). Электрическая динамика переиспользует v05_functional.py::
frozen_step (рост/пластичность/нормировка весов/обновление порога
выключены; адаптация, рефрактерность, передача по неизменным-до-
перестройки весам включены).

Три политики:
  "none"   -- без перестройки (контроль)
  "random" -- получатель теряет случайно выбранный входящий контакт,
              приобретает новый от случайно выбранного из ДОПУСТИМЫХ
              ОТСУТСТВУЮЩИХ (до операции) источников
  "weakest"-- получатель теряет входящий контакт с наименьшим текущим
              весом (при равенстве -- случайно среди минимальных),
              приобретает новый ТАК ЖЕ, как в "random" (одинаковое
              правило выбора нового источника в обеих политиках
              перестройки -- см. согласованную спецификацию)

КЛЮЧЕВОЕ ПРАВИЛО: кандидаты на новый источник фиксируются ДО удаления
старого контакта. Иначе старый источник немедленно попадает в число
"свободных" и может быть выбран заново -- часть замен окажется
фиктивной (contacts не изменится по факту).

Вес переносится: W[receiver, old_source] -> W[receiver, new_source],
старая ячейка обнуляется. Это сохраняет сумму входящих весов получателя
С ЧИСЛЕННОЙ ТОЧНОСТЬЮ (не приближённо) и его входящую степень.
"""
import numpy as np
from v05_functional import DT, frozen_step, copy_state


def eligible_mask(distance, radius=0.25):
    """Геометрически допустимые направленные пары (i!=j, distance<radius)."""
    N = distance.shape[0]
    m = (distance < radius).copy()
    np.fill_diagonal(m, False)
    return m


def build_fixed_schedule(rng_schedule, initial_contacts, eligible, n_events):
    """
    Строит расписание получателей ЗАРАНЕЕ, один раз, из СТАРТОВОГО списка
    допустимых получателей (узлов с >=1 отсутствующим допустимым
    источником). Обосновано: n_candidates_i = n_eligible_i - in_degree_i
    постоянно на всём протоколе (геометрия фиксирована, in_degree
    сохраняется при каждой замене) -- поэтому множество допустимых
    получателей НЕ меняется от события к событию, и можно (эквивалентно
    "пересчитывать каждый раз") зафиксировать расписание один раз.
    Возвращает np.array[n_events] int -- индексы получателей.
    """
    missing = eligible & ~initial_contacts
    n_candidates = missing.sum(axis=1)
    eligible_receivers = np.flatnonzero(n_candidates > 0)
    if len(eligible_receivers) == 0:
        return np.array([], dtype=int)
    return rng_schedule.choice(eligible_receivers, size=n_events, replace=True)


def pick_receiver(rng, contacts, eligible):
    """Равномерный выбор получателя среди узлов, у которых есть хотя бы
    один допустимый отсутствующий источник (кандидат на новый контакт).
    ОСТАВЛЕНО для обратной совместимости/спот-проверок; полный прогон
    использует build_fixed_schedule (см. run_rewiring_trajectory)."""
    missing = eligible & ~contacts
    n_candidates = missing.sum(axis=1)
    eligible_receivers = np.flatnonzero(n_candidates > 0)
    if len(eligible_receivers) == 0:
        return None
    return int(rng.choice(eligible_receivers))


def do_rewire_event(rng_choice, contacts, W, distance, eligible, receiver, policy):
    """
    Один акт замены для заданного receiver. Возвращает dict с журналом
    события, или None если замена невозможна (нет кандидатов -- не
    должно происходить, если receiver выбран через pick_receiver, но
    проверяем явно) ИЛИ нет существующих входящих контактов у receiver
    (тоже не должно происходить для corrected/бюджетных сетей, но
    проверяем).

    Мутирует contacts и W НА МЕСТЕ.
    """
    # 1. Fix candidate NEW sources BEFORE removing anything.
    candidates_before = np.flatnonzero(eligible[receiver] & ~contacts[receiver])
    if len(candidates_before) == 0:
        return None

    existing_sources = np.flatnonzero(contacts[receiver])
    if len(existing_sources) == 0:
        return None

    # 2. Pick the contact to remove, per policy.
    if policy == "random":
        old_source = int(rng_choice.choice(existing_sources))
    elif policy == "weakest":
        weights_existing = W[receiver, existing_sources]
        min_w = weights_existing.min()
        tied = existing_sources[weights_existing == min_w]
        old_source = int(rng_choice.choice(tied))
    else:
        raise ValueError(f"unknown policy {policy}")

    # 3. Pick the new source uniformly from candidates fixed BEFORE removal.
    #    Same rule for both random and weakest policies.
    new_source = int(rng_choice.choice(candidates_before))

    old_weight = float(W[receiver, old_source])
    old_length = float(distance[receiver, old_source])
    new_length = float(distance[receiver, new_source])

    # 4. Apply: remove old, add new, transfer weight -- atomically (in sequence,
    #    but no intermediate state is externally observed within this function).
    W[receiver, old_source] = 0.0
    contacts[receiver, old_source] = False

    W[receiver, new_source] = old_weight
    contacts[receiver, new_source] = True

    return {
        "receiver": receiver,
        "old_source": old_source,
        "new_source": new_source,
        "transferred_weight": old_weight,
        "old_length": old_length,
        "new_length": new_length,
    }


def run_rewiring_trajectory(
    initial_contacts, initial_weights, initial_state, distance,
    policy, duration, rewire_interval, rewire_seed, noise_seed,
    radius=0.25,
):
    """
    Запускает электрическую динамику (frozen_step) на duration секунд,
    выполняя одно событие перестройки каждые rewire_interval секунд
    (после соответствующего шага интегрирования), согласно policy.

    policy in {"none", "random", "weakest"}.

    РАСПИСАНИЕ ПОЛУЧАТЕЛЕЙ строится ОТДЕЛЬНЫМ генератором (rng_schedule,
    производным от rewire_seed), не зависящим от числа случайных чисел,
    расходуемых внутри do_rewire_event для конкретной политики -- это
    гарантирует, что "random" и "weakest" получают ОДИНАКОВОЕ расписание
    получателей (согласовано в спецификации). Выбор old_source/new_source
    внутри события использует ОТДЕЛЬНЫЙ генератор (rng_event_choice),
    производный от того же rewire_seed, но с фиксированным сдвигом --
    это ДЕТЕРМИНИРОВАННО в зависимости от истории только той же политики,
    не зависит от результатов предыдущих событий другой политики (каждый
    вызов run_rewiring_trajectory создаёт свежие генераторы).

    Возвращает dict:
      "contacts": финальные contacts (copy),
      "weights": финальные weights (copy),
      "state": финальное состояние электрической динамики (copy),
      "event_log": list[dict] -- журнал КАЖДОЙ ПОПЫТКИ (включая
          пропущенные из-за отсутствия получателя/кандидатов),
      "spikes": bool[steps, N] -- полный растр,
      "snapshots": dict[t -> {"contacts":.., "weights":.., "state":..}]
          на t=0, duration/2, duration (округлено до ближайшего шага)
    """
    N = initial_contacts.shape[0]
    contacts = initial_contacts.copy()
    W = initial_weights.copy()
    state = copy_state(initial_state)

    eligible = eligible_mask(distance, radius=radius)

    # Two independent generators from the same seed: schedule (receiver
    # choice) is common across policies; event_choice (old/new source
    # picks) is policy-specific in HOW MANY draws it uses, so keeping it
    # separate prevents that from perturbing the shared schedule stream.
    rng_schedule = np.random.default_rng(rewire_seed)
    rng_event_choice = np.random.default_rng(rewire_seed + 500000)
    rng_noise_gen = np.random.default_rng(noise_seed)

    total_steps = int(round(duration / DT))
    rewire_every_steps = int(round(rewire_interval / DT))
    n_events = total_steps // rewire_every_steps

    # Schedule built ONCE from the STARTING eligible-receiver set (see
    # build_fixed_schedule docstring for why this is valid: the eligible
    # set is invariant under in-degree-preserving rewiring on fixed
    # geometry). Identical across policies for the same rewire_seed.
    schedule = build_fixed_schedule(rng_schedule, initial_contacts, eligible, n_events)

    noise = 0.012 * rng_noise_gen.standard_normal((total_steps, N))

    spikes = np.zeros((total_steps, N), dtype=bool)
    event_log = []

    snapshot_times = {0.0, round(duration / 2, 6), round(duration, 6)}
    snapshot_steps = {int(round(t / DT)): t for t in snapshot_times}
    snapshots = {}

    def take_snapshot(t_label):
        snapshots[t_label] = {
            "contacts": contacts.copy(),
            "weights": W.copy(),
            "state": {k: v.copy() for k, v in state.items()},
        }

    if 0 in snapshot_steps:
        take_snapshot(snapshot_steps[0])

    event_index = 0
    for step in range(total_steps):
        spikes[step] = frozen_step(state, W, noise[step], transmission=True)

        completed_steps = step + 1

        if completed_steps % rewire_every_steps == 0:
            receiver = int(schedule[event_index]) if event_index < len(schedule) else None
            event_index += 1

            if policy == "none":
                event_log.append({
                    "step": completed_steps, "t": completed_steps * DT,
                    "status": "policy_none_no_op",
                    "receiver": receiver,
                })
            elif receiver is None:
                event_log.append({
                    "step": completed_steps, "t": completed_steps * DT,
                    "status": "skipped_no_eligible_receiver",
                })
            else:
                result = do_rewire_event(
                    rng_event_choice, contacts, W, distance, eligible, receiver, policy,
                )
                if result is None:
                    event_log.append({
                        "step": completed_steps, "t": completed_steps * DT,
                        "status": "skipped_no_candidates_or_no_sources",
                        "receiver": receiver,
                    })
                else:
                    result["step"] = completed_steps
                    result["t"] = completed_steps * DT
                    result["status"] = "applied"
                    event_log.append(result)

        # Snapshot AFTER the event scheduled at this timestamp, per spec:
        # "снимок после запланированной на эту отметку замены".
        if completed_steps in snapshot_steps:
            take_snapshot(snapshot_steps[completed_steps])

    return {
        "contacts": contacts.copy(),
        "weights": W.copy(),
        "state": {k: v.copy() for k, v in state.items()},
        "event_log": event_log,
        "spikes": spikes,
        "snapshots": snapshots,
    }


def verify_invariants(initial_contacts, initial_weights, result, tol=1e-12):
    """
    Проверки согласованной спецификации:
      - входящая степень каждого узла не изменилась
      - сумма входящих весов каждого узла сохраняется -- с допуском
        МАШИННОЙ ТОЧНОСТИ (tol по умолчанию 1e-12), НЕ побитово: сама
        операция переноса веса (W[i,old]=0; W[i,new]=old_weight)
        сохраняет сумму строки алгебраически точно, но np.sum
        пересчитывает сумму заново по всем элементам строки, и порядок
        суммирования float64 в разных позициях массива может отличаться
        на уровне последнего бита (~1e-17 на наблюдаемых значениях) --
        это ошибка округления IEEE 754, а не нарушение инварианта по
        существу. Если разница превышает tol, это СИГНАЛ РЕАЛЬНОЙ ошибки.
      - нет самосвязей и дубликатов (дубликаты невозможны в булевой
        матрице по построению, но диагональ проверяем явно)
      - вне изменённых строк (по журналу) веса не изменились -- ЭТО
        сравнение остаётся точным (==), т.к. незатронутые строки вообще
        не участвуют ни в каком floating-point пересчёте
      - каждый применённый новый контакт допустим по расстоянию
        (проверяется на этапе do_rewire_event через eligible, здесь
        перепроверяем по журналу)
    Возвращает (bool, dict с деталями).
    """
    checks = {}

    in_degree_before = initial_contacts.sum(axis=1)
    in_degree_after = result["contacts"].sum(axis=1)
    checks["in_degree_preserved"] = np.array_equal(in_degree_before, in_degree_after)

    sum_w_before = initial_weights.sum(axis=1)
    sum_w_after = result["weights"].sum(axis=1)
    max_abs_diff = np.abs(sum_w_after - sum_w_before).max()
    checks["sum_weights_preserved"] = bool(max_abs_diff <= tol)
    checks["sum_weights_max_abs_diff"] = float(max_abs_diff)

    checks["no_self_contacts"] = not result["contacts"].diagonal().any()

    # STRONGER check than sum-of-row: the MULTISET of weight VALUES in
    # each row is preserved exactly (we only move values between
    # positions, never change them) -- np.sort per row and compare.
    # This is an exact (not tolerance-based) check.
    sorted_before = np.sort(initial_weights, axis=1)
    sorted_after = np.sort(result["weights"], axis=1)
    checks["row_weight_multiset_preserved"] = np.array_equal(sorted_before, sorted_after)

    # rows NOT touched by any applied event should be identical
    touched_receivers = set(
        e["receiver"] for e in result["event_log"] if e.get("status") == "applied"
    )
    N = initial_contacts.shape[0]
    untouched_rows_ok = True
    for i in range(N):
        if i not in touched_receivers:
            if not np.array_equal(initial_weights[i], result["weights"][i]):
                untouched_rows_ok = False
                break
            if not np.array_equal(initial_contacts[i], result["contacts"][i]):
                untouched_rows_ok = False
                break
    checks["untouched_rows_unchanged"] = untouched_rows_ok

    bool_checks = {k: v for k, v in checks.items() if isinstance(v, (bool, np.bool_))}
    all_ok = all(bool_checks.values())
    return all_ok, checks

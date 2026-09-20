"""
Функциональный тест версии 0.5: замороженная динамика поверх сохранённых
сетей из v05_four_conditions.pkl.

Электрический шаг скопирован из v5f.py::simulate_v05 БЕЗ блоков роста,
пластичности, нормировки весов и обновления порогов. Формула и порядок
операций проверены построчно против v5f.py.

dt зафиксирован на 0.001 -- см. assert ниже. Амплитуда шума
0.012 * standard_normal(N) без множителя sqrt(dt/0.001), т.к. dt всегда
0.001 в этом протоколе (см. согласованную спецификацию).

Шум генерируется ЗАРАНЕЕ как явный массив (steps, N) и передаётся в
probe()/run_free_dynamics_with_weights() извне -- это гарантирует
идентичный шум между сопоставляемыми baseline/stimulated прогонами
без зависимости от порядка вызовов или состояния общего RNG-объекта.
"""
import numpy as np

DT = 0.001


def frozen_step(state, W, noise, transmission=True):
    """
    Один шаг замороженной электрической динамики.
    state -- dict с ключами v, syn, adaptation, refractory, threshold, drive
    (изменяется на месте). W -- веса (НЕ изменяются здесь).
    noise -- готовый вектор шума для этого шага (N,).
    Возвращает fired (bool, N).

    transmission=False отключает вклад syn в current И передачу новых
    импульсов в syn -- контроль "нет пути воздействия".
    """
    assert DT == 0.001

    v = state["v"]
    syn = state["syn"]
    adaptation = state["adaptation"]
    refractory = state["refractory"]
    threshold = state["threshold"]
    drive = state["drive"]

    # 1. Затухание
    syn *= np.exp(-DT / 0.010)
    adaptation *= np.exp(-DT / 0.200)
    refractory[:] = np.maximum(0.0, refractory - DT)

    # 2. Доступные узлы (все узлы alive/ready по построению сохранённого
    #    состояния -- см. проверку зрелости перед пилотом)
    available = (refractory == 0.0)

    # 3. current -- maturity=1 для всех узлов (t_save=12s >> 5.5s, проверено)
    syn_term = syn if transmission else 0.0
    current = drive + syn_term - adaptation

    # 4. Обновление потенциала (noise передан извне)
    dv = (DT / 0.020) * (-v + current)
    v[available] += (dv + noise)[available]

    # 5. fired
    fired = available & (v >= threshold)

    # 6. Передача (если transmission)
    if transmission and np.any(fired):
        syn += W[:, fired].sum(axis=1)

    # 7. Сброс
    v[fired] = 0.0
    refractory[fired] = 0.005
    adaptation[fired] += 0.25

    return fired


def copy_state(net_state):
    """Копия состояния сети из pkl (RNG не хранится в state)."""
    return {
        "v": net_state["v"].copy(),
        "syn": net_state["syn"].copy(),
        "adaptation": net_state["adaptation"].copy(),
        "refractory": net_state["refractory"].copy(),
        "threshold": net_state["threshold"].copy(),
        "drive": net_state["drive"].copy(),
    }


def make_noise(seed, steps, N):
    """Единый шумовой массив (steps, N), генерируется один раз и
    переиспользуется во всех прогонах, где шум должен совпадать."""
    rng = np.random.default_rng(seed)
    return 0.012 * rng.standard_normal((steps, N))


def run_free_dynamics_with_weights(net_state, W, seed, duration, transmission=True):
    """Дополнительный свободный прогон поверх сохранённого состояния v0.5.
    seed определяет шумовую реализацию этого прогона."""
    state = copy_state(net_state)
    steps = int(round(duration / DT))
    noise = make_noise(seed, steps, len(state["v"]))
    for step in range(steps):
        frozen_step(state, W, noise[step], transmission=transmission)
    return state


def force_spikes(state, W, nodes, transmission=True):
    """Принудительный импульс в t=0, до интегрирования. Соответствует
    v04_localization.py::force_spikes, с явным флагом transmission."""
    state["v"][nodes] = 0.0
    state["refractory"][nodes] = 0.005
    state["adaptation"][nodes] += 0.25
    if transmission:
        state["syn"] += W[:, nodes].sum(axis=1)


def probe(checkpoint, W, noise, transmission=True, stimulate_nodes=None):
    """Запись растра на len(noise) шагов из копии checkpoint.
    noise -- заранее сгенерированный массив (steps, N), ОДИНАКОВЫЙ между
    сопоставляемыми baseline/stimulated вызовами (см. make_noise).
    Не изменяет checkpoint (работает на копии) и не изменяет noise.
    Если stimulate_nodes задан -- принудительный импульс применяется
    первым, ДО первого шага интегрирования пробного окна."""
    state = copy_state(checkpoint)
    N = W.shape[0]
    steps = noise.shape[0]

    if stimulate_nodes is not None:
        force_spikes(state, W, stimulate_nodes, transmission=transmission)

    spikes = np.zeros((steps, N), dtype=bool)
    for step in range(steps):
        spikes[step] = frozen_step(state, W, noise[step], transmission=transmission)

    return spikes, state

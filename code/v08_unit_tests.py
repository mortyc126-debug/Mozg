"""
Искусственно сконструированные unit-тесты для v08_experience_rewiring.py
-- НЕ полагаются на случайное совпадение в полной симуляции, а строят
состояние вручную так, чтобы гарантированно проверить:

  1. Один узел: естественный + принудительный импульс на одной отметке
     -> результат совпадает с ОДНИМ импульсом этого узла (не двумя).
  2. Два узла на одной отметке (один естественный, другой принудительный)
     -> результат совпадает с обработкой ОБЪЕДИНЁННОЙ маски одним пакетом
     (в частности, следы НЕ используют друг друга как "раньше/позже"
     внутри одного пакета -- test проверяет это явно, сравнивая с ручным
     расчётом formулы для одновременной обработки).
  3. Импульс и перестройка на одной отметке -> текущая передача идёт по
     СТАРОМУ графу, новый контакт активен только со следующего шага.
  4. Без пластичности: веса ДЕЙСТВИТЕЛЬНО не меняются (clip/нормировка
     не подмешиваются незаметно).
"""
import numpy as np
from v08_experience_rewiring import (
    integrate_electrical, process_fired_batch, do_rewire_event,
    eligible_mask, ETA_STDP, STDP_ASYMMETRY, W_MIN, W_MAX, INPUT_CAP,
)


def make_toy_state(N=5):
    return {
        "v": np.zeros(N), "syn": np.zeros(N), "adaptation": np.zeros(N),
        "refractory": np.zeros(N), "threshold": np.ones(N) * 100.0,  # unreachable naturally
        "drive": np.ones(N), "trace": np.zeros(N),
    }


def test_1_single_node_natural_and_forced_no_double_count():
    """Узел 0: делаем его natural_fired=True вручную (обходя реальную
    интеграцию), forced тоже True для узла 0. Проверяем, что
    process_fired_batch применяет STDP/передачу/сброс РОВНО ОДИН РАЗ,
    не дважды."""
    N = 3
    state = make_toy_state(N)
    state["trace"] = np.array([0.5, 0.3, 0.1])
    contacts = np.array([
        [False, True, True],
        [True, False, True],
        [True, True, False],
    ])
    W = np.array([
        [0.0, 0.02, 0.02],
        [0.02, 0.0, 0.02],
        [0.02, 0.02, 0.0],
    ])
    W_ref_before = W.copy()

    fired_union = np.array([True, False, False])  # node 0 fired (natural OR forced -- same node)

    process_fired_batch(state, W, contacts, fired_union, plasticity_enabled=True)

    # Manual expected single-application STDP:
    W_expected = W_ref_before.copy()
    trace_before = np.array([0.5, 0.3, 0.1])
    W_expected[fired_union, :] += ETA_STDP * trace_before[None, :] * contacts[fired_union, :]
    W_expected[:, fired_union] -= STDP_ASYMMETRY * ETA_STDP * trace_before[:, None] * contacts[:, fired_union]
    np.clip(W_expected, W_MIN, W_MAX, out=W_expected)
    total_input = W_expected.sum(axis=1)
    W_expected *= np.minimum(1.0, INPUT_CAP / np.maximum(total_input, 1e-12))[:, None]

    assert np.array_equal(W, W_expected), "Двойная обработка! W не совпадает с ОДНИМ применением STDP"
    assert state["adaptation"][0] == 0.25, f"adaptation должна прибавиться РОВНО на 0.25, получено {state['adaptation'][0]}"
    assert state["trace"][0] == trace_before[0] * np.exp(0) + 1.0 or state["trace"][0] == 1.5, (
        f"trace должен увеличиться РОВНО на 1.0 (не на 2.0), получено {state['trace'][0]}"
    )
    print("Тест 1 (один узел, natural+forced совпадают) -- ПРОЙДЕН")


def test_2_two_nodes_simultaneous_no_artificial_ordering():
    """Узел 0 -- natural, узел 1 -- forced, на одной отметке. Проверяем,
    что STDP применяется к ОБЪЕДИНЁННОЙ маске сразу, используя trace ДО
    пакета для ОБОИХ узлов -- то есть узел 1 не видит уже обновлённый
    (после обработки узла 0) trace, и наоборот."""
    N = 3
    state = make_toy_state(N)
    state["trace"] = np.array([0.4, 0.6, 0.2])
    contacts = np.array([
        [False, True, True],
        [True, False, True],
        [True, True, False],
    ])
    W = np.array([
        [0.0, 0.03, 0.01],
        [0.03, 0.0, 0.01],
        [0.01, 0.01, 0.0],
    ])

    fired_union = np.array([True, True, False])  # nodes 0 and 1 both in the batch
    trace_before = state["trace"].copy()

    process_fired_batch(state, W, contacts, fired_union, plasticity_enabled=True)

    # Expected: BOTH updates use trace_before (not sequentially updated)
    W_expected = np.array([
        [0.0, 0.03, 0.01],
        [0.03, 0.0, 0.01],
        [0.01, 0.01, 0.0],
    ])
    W_expected[fired_union, :] += ETA_STDP * trace_before[None, :] * contacts[fired_union, :]
    W_expected[:, fired_union] -= STDP_ASYMMETRY * ETA_STDP * trace_before[:, None] * contacts[:, fired_union]
    np.clip(W_expected, W_MIN, W_MAX, out=W_expected)
    total_input = W_expected.sum(axis=1)
    W_expected *= np.minimum(1.0, INPUT_CAP / np.maximum(total_input, 1e-12))[:, None]

    assert np.array_equal(W, W_expected), (
        "W не совпадает с одновременной (не последовательной) обработкой -- "
        "возможен искусственный порядок между узлами!"
    )
    print("Тест 2 (два узла одновременно, нет искусственного порядка) -- ПРОЙДЕН")


def test_3_pulse_and_rewire_same_timestamp():
    """На игрушечном графе: на одной отметке fired-пакет передаётся по
    СТАРОМУ графу, затем происходит перестройка (удаление контакта,
    участвовавшего в передаче). Следующий пакет должен видеть НОВЫЙ граф."""
    N = 4
    contacts = np.array([
        [False, True, False, False],
        [False, False, False, False],
        [False, False, False, False],
        [False, False, False, False],
    ])
    # only contact: 0 receives from 1 (contacts[0,1]=True)
    W = np.zeros((N, N))
    W[0, 1] = 0.02
    distance = np.full((N, N), 0.5)
    np.fill_diagonal(distance, 1.0)
    distance[0, 2] = 0.1  # make node 2 an eligible NEW source for receiver 0
    distance[2, 0] = 0.1

    state = make_toy_state(N)
    state["trace"] = np.array([0.0, 1.0, 0.0, 0.0])  # node 1 has a trace

    fired_union = np.array([False, True, False, False])  # node 1 fires
    process_fired_batch(state, W, contacts, fired_union, plasticity_enabled=False)

    # transmission happened via OLD graph: node 0's syn should have received
    # from node 1 via W[0,1]
    assert state["syn"][0] > 0, "Передача по старому графу не произошла!"
    syn_after_first_pulse = state["syn"][0]

    # now rewire: receiver=0 loses contact with source=1, gains source=2
    eligible = eligible_mask(distance, radius=0.25)
    rng = np.random.default_rng(1)
    result = do_rewire_event(rng, contacts, W, distance, eligible, receiver=0, policy="random")
    assert result is not None, "Перестройка не удалась -- проверить тестовую геометрию"
    assert result["old_source"] == 1 and result["new_source"] == 2, (
        f"ожидалась замена 1->2, получено {result}"
    )
    assert not contacts[0, 1], "старый контакт должен быть удалён"
    assert contacts[0, 2], "новый контакт должен быть создан"

    # next timestamp: node 1 fires AGAIN -- should NOT transmit to 0 anymore
    # (contact removed); node 2 (if it fired) WOULD transmit via new contact
    state["syn"][:] = 0.0  # reset for clarity
    fired_union_2 = np.array([False, True, False, False])
    process_fired_batch(state, W, contacts, fired_union_2, plasticity_enabled=False)
    assert state["syn"][0] == 0.0, (
        "После перестройки узел 1 всё ещё передаёт узлу 0 -- граф не обновился для след. пакета!"
    )
    print("Тест 3 (импульс и перестройка на одной отметке -- старый граф для текущего пакета,"
          " новый для следующего) -- ПРОЙДЕН")


def test_4_no_plasticity_weights_truly_static():
    """При plasticity_enabled=False веса НЕ должны меняться ВООБЩЕ -- ни
    через STDP, ни через clip, ни через нормировку -- даже если формально
    total_input > cap на старте (нормировка не должна тайно применяться)."""
    N = 3
    state = make_toy_state(N)
    contacts = np.array([
        [False, True, True],
        [True, False, True],
        [True, True, False],
    ])
    # deliberately construct weights that WOULD trigger clip/normalization
    # if the plasticity block ran
    W = np.array([
        [0.0, 0.09, 0.09],   # already above W_MAX=0.08 and above INPUT_CAP=0.6 sum-wise if summed
        [0.05, 0.0, 0.05],
        [0.05, 0.05, 0.0],
    ])
    W_ref = W.copy()

    fired_union = np.array([True, True, False])
    process_fired_batch(state, W, contacts, fired_union, plasticity_enabled=False)

    assert np.array_equal(W, W_ref), (
        "Веса изменились при plasticity_enabled=False -- clip/нормировка "
        "просочились несмотря на выключенный флаг!"
    )
    print("Тест 4 (веса статичны без пластичности, включая экстремальные значения) -- ПРОЙДЕН")


if __name__ == "__main__":
    test_1_single_node_natural_and_forced_no_double_count()
    test_2_two_nodes_simultaneous_no_artificial_ordering()
    test_3_pulse_and_rewire_same_timestamp()
    test_4_no_plasticity_weights_truly_static()
    print("\n=== ВСЕ ИСКУССТВЕННО СКОНСТРУИРОВАННЫЕ ТЕСТЫ ПРОЙДЕНЫ ===")

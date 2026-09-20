"""v0.11 фаза 2: доказательство, что последовательностная проба НЕ
является вторым путём обработки импульса, плюс тесты на коллизии.

S1 -- ПОБИТОВАЯ эквивалентность машинерии v0.8 (plasticity=False)
      и проверенной пробы v05_functional.py::probe на РЕАЛЬНЫХ
      сохранённых сетях, без принудительных импульсов и с одиночным
      импульсом при t=0.
S2-S4 -- сконструированные тесты коллизий (ловушка №17).
"""
import pickle

import numpy as np

from v05_functional import make_noise, probe, copy_state
from v11_sequence_probe import sequence_probe, build_order_schedule, make_seq_state

N = 80
STEPS = 200


def _load_case():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    with open("v11_train_full.pkl", "rb") as f:
        T = pickle.load(f)
    key = (100, 11, "Только бюджет", "M1_plasticity_weakest", 0)
    rec = T["results"][key]
    v06 = D06["snapshots"][11]["Только бюджет"][96.0]["state"]
    state = {k: v06[k].copy() for k in ("v", "adaptation", "refractory",
                                        "threshold", "drive")}
    state["syn"] = np.zeros_like(v06["v"])
    return state, rec["AB"]["weights"], rec["AB"]["contacts"], rec


def s1_bitwise_equivalence():
    """Без принудительных импульсов и с импульсом при t=0 обе реализации
    обязаны дать ПОБИТОВО один растр (np.array_equal, без допуска)."""
    state, W, contacts, rec = _load_case()
    n_checked = 0
    for seed in (910, 911, 912):
        noise = make_noise(seed, STEPS, N)

        # (а) свободный прогон, без стимуляции
        ref, _ = probe(copy_state(state), W, noise, transmission=True,
                       stimulate_nodes=None)
        new, coll, _ = sequence_probe(state, W, contacts, noise, schedule={})
        assert coll == 0
        assert np.array_equal(ref, new), f"расхождение без стимула, seed={seed}"
        n_checked += 1

        # (б) одиночный импульс при t=0 -- probe() подаёт его ДО первого
        #     шага, поэтому эквивалент расписания -- предварительный
        #     force на копии состояния, затем свободный прогон
        from v05_functional import force_spikes
        gA = rec["group_A"]
        st_pre = make_seq_state(state)
        force_spikes(st_pre, W, gA, transmission=True)
        new2, coll2, _ = sequence_probe(st_pre, W, contacts, noise, schedule={})
        ref2, _ = probe(copy_state(state), W, noise, transmission=True,
                        stimulate_nodes=gA)
        assert coll2 == 0
        assert np.array_equal(ref2, new2), f"расхождение с импульсом, seed={seed}"
        n_checked += 1
    print(f"  S1 ПОБИТОВАЯ эквивалентность с проверенной пробой: OK "
          f"({n_checked} сверок, np.array_equal без допуска)")


def s2_collision_same_node():
    """Узел одновременно natural и forced НЕ должен учитываться дважды:
    сброс/адаптация/передача применяются РОВНО один раз."""
    state, W, contacts, _ = _load_case()
    # сделаем узел 0 гарантированно сработавшим естественно
    st = make_seq_state(state)
    st["v"][:] = 0.0
    st["v"][0] = st["threshold"][0] + 1.0
    st["refractory"][:] = 0.0
    st["adaptation"][:] = 0.0
    noise = np.zeros((1, N))

    a = make_seq_state(st)
    sp_a, coll_a, _ = sequence_probe(a, W, contacts, noise, schedule={0: np.array([0])})
    b = make_seq_state(st)
    sp_b, coll_b, _ = sequence_probe(b, W, contacts, noise, schedule={})

    assert coll_a == 1, f"коллизия должна быть обнаружена, получено {coll_a}"
    assert coll_b == 0
    assert np.array_equal(sp_a, sp_b), "растр не должен зависеть от дубля"
    print(f"  S2 коллизия natural+forced на одном узле (обнаружена, "
          f"двойного учёта нет): OK")


def s3_collision_different_nodes():
    """Разные узлы, natural и forced на одной отметке -- обрабатываются
    ОДНИМ пакетом, без искусственного порядка 'раньше/позже'."""
    state, W, contacts, _ = _load_case()
    st = make_seq_state(state)
    st["v"][:] = 0.0
    st["v"][0] = st["threshold"][0] + 1.0
    st["refractory"][:] = 0.0
    noise = np.zeros((1, N))

    x = make_seq_state(st)
    sp, coll, fin = sequence_probe(x, W, contacts, noise, schedule={0: np.array([1])})
    assert coll == 0, "разные узлы -- это НЕ коллизия"
    assert sp[0, 0] and sp[0, 1], "оба узла должны быть в маске одного шага"
    # передача обязана содержать вклад ОБОИХ источников
    expected = W[:, [0, 1]].sum(axis=1)
    # syn стартовал нулевым => после шага syn == вклад объединённой маски
    assert np.array_equal(x["syn"], np.zeros_like(x["syn"])), "проба обязана не мутировать вход"
    assert np.allclose(fin["syn"], expected), "передача не от объединённой маски"
    print("  S3 natural и forced на разных узлах -- один пакет: OK")


def s4_weights_static():
    """Пластичность выключена => веса НЕ меняются ни на один бит."""
    state, W, contacts, rec = _load_case()
    W0 = W.copy()
    noise = make_noise(910, STEPS, N)
    sched = build_order_schedule(rec["group_A"], rec["group_B"], 50, 10)
    sequence_probe(state, W, contacts, noise, sched)
    assert np.array_equal(W, W0), "веса изменились при выключенной пластичности"
    print("  S4 веса статичны при выключенной пластичности: OK")


def main():
    print("=== v0.11 фаза 2: тесты последовательностной пробы ===")
    s1_bitwise_equivalence()
    s2_collision_same_node()
    s3_collision_different_nodes()
    s4_weights_static()
    print("ВСЕ ТЕСТЫ ПРОЙДЕНЫ")


if __name__ == "__main__":
    main()

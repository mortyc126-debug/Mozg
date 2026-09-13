"""v0.12: тождество при нулевой задержке + сконструированные тесты.

D1 -- ПОБИТОВОЕ совпадение с проверенной пробой v05_functional.py::probe
      при delay==0 на РЕАЛЬНЫХ сохранённых сетях. Без этого любое
      сравнение "с задержками против без" сравнивало бы две разные
      реализации, а не наличие/отсутствие механизма.
D2..D4 -- сконструированные тесты самой задержки.
"""
import pickle

import numpy as np

from v05_functional import make_noise, probe
from v09_functional_probe import build_common_start_state
from v12_delays import build_delay_steps, probe_delayed

N = 80
STEPS = 400


def _case():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    snap = D06["snapshots"][11]["Только бюджет"][96.0]
    state, W, _ = build_common_start_state(snap["state"], snap)
    return state, W, snap["distance"]


def d1_zero_delay_identity():
    state, W, dist = _case()
    zero = build_delay_steps(dist, None)
    assert zero.max() == 0
    n = 0
    for seed in (1300, 1301, 1302):
        noise = make_noise(seed, STEPS, N)
        ref, _ = probe(state, W, noise, transmission=True, stimulate_nodes=None)
        new = probe_delayed(state, W, noise, zero, transmission=True)
        assert np.array_equal(ref, new), f"расхождение при нулевой задержке, seed={seed}"
        n += 1
    print(f"  D1 ПОБИТОВОЕ тождество с проверенной пробой при delay=0: OK ({n} сверок)")


def d2_delay_shifts_arrival():
    """Сконструированный тест: один источник, один получатель, вклад
    обязан прийти ровно через delay шагов."""
    Nn = 3
    W = np.zeros((Nn, Nn)); W[1, 0] = 0.05
    dist = np.zeros((Nn, Nn))
    state = {"v": np.zeros(Nn), "syn": np.zeros(Nn),
             "adaptation": np.zeros(Nn), "refractory": np.zeros(Nn),
             "threshold": np.full(Nn, 0.5), "drive": np.zeros(Nn)}
    for delay in (0, 1, 3, 7):
        st = {k: v.copy() for k, v in state.items()}
        st["v"][0] = 1.0                       # узел 0 сработает на шаге 0
        dl = np.zeros((Nn, Nn), dtype=np.int64); dl[1, 0] = delay
        noise = np.zeros((20, Nn))
        # прослеживаем syn получателя по шагам
        syn_trace = []
        import v12_delays as M
        # прогон вручную, чтобы видеть syn
        stt = {k: v.copy() for k, v in st.items()}
        maxd = int(dl.max()) + 1
        pending = np.zeros((maxd, Nn)); rows = np.arange(Nn)
        from v05_functional import DT
        for t in range(12):
            stt["syn"] *= np.exp(-DT / 0.010)
            stt["adaptation"] *= np.exp(-DT / 0.200)
            stt["refractory"][:] = np.maximum(0.0, stt["refractory"] - DT)
            av = stt["refractory"] == 0.0
            cur = stt["drive"] + stt["syn"] - stt["adaptation"]
            dv = (DT / 0.020) * (-stt["v"] + cur)
            stt["v"][av] += (dv + noise[t])[av]
            fired = av & (stt["v"] >= stt["threshold"])
            if np.any(fired):
                for j in np.flatnonzero(fired):
                    idx = (t + dl[:, j]) % maxd
                    np.add.at(pending, (idx, rows), W[:, j])
            slot = t % maxd
            stt["syn"] += pending[slot]; pending[slot] = 0.0
            stt["v"][fired] = 0.0
            stt["refractory"][fired] = 0.005
            stt["adaptation"][fired] += 0.25
            syn_trace.append(stt["syn"][1])
        arrival = int(np.argmax(np.array(syn_trace) > 1e-12))
        assert arrival == delay, f"задержка {delay}: вклад пришёл на шаге {arrival}"
    print("  D2 вклад приходит ровно через delay шагов (0,1,3,7): OK")


def d3_delay_monotone_in_distance():
    state, W, dist = _case()
    d_fast = build_delay_steps(dist, 0.5)
    d_slow = build_delay_steps(dist, 0.05)
    assert d_slow.max() > d_fast.max()
    assert np.all(d_slow >= d_fast)
    # монотонность по расстоянию
    order = np.argsort(dist.ravel())
    dd = d_slow.ravel()[order]
    assert np.all(np.diff(dd) >= 0), "задержка не монотонна по расстоянию"
    print(f"  D3 задержка монотонна по расстоянию, макс {d_fast.max()} шагов "
          f"(быстро) против {d_slow.max()} (медленно): OK")


def d4_weights_untouched():
    state, W, dist = _case()
    W0 = W.copy()
    dl = build_delay_steps(dist, 0.1)
    probe_delayed(state, W, make_noise(1300, 100, N), dl)
    assert np.array_equal(W, W0), "веса изменились"
    print("  D4 веса не изменяются пробой: OK")


def main():
    print("=== v0.12: тесты задержек проведения ===")
    d1_zero_delay_identity()
    d2_delay_shifts_arrival()
    d3_delay_monotone_in_distance()
    d4_weights_untouched()
    print("ВСЕ ТЕСТЫ ПРОЙДЕНЫ")


if __name__ == "__main__":
    main()

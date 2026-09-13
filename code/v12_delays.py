"""v0.12 шаг 2: задержки проведения.

Обоснование механизма -- не произвольный выбор: проверка требования №8
(v0.12 шаг 1) показала, что пространственного распространения НЕТ, и
причина следует из MODEL_SPEC п.9 -- передача мгновенная, источника
временного порядка нет. Задержки проведения это ровно тот недостающий
механизм.

СЕМАНТИКА. Импульс узла j, произошедший на шаге t, добавляется к syn
получателя i не на шаге t, а на шаге t + delay[i,j], где
    delay[i,j] = round(distance[i,j] / speed)   (шаг = 1мс)
Остальная динамика НЕ меняется: затухания, порог, сброс, адаптация,
рефрактерность -- те же, что в v05_functional.py::frozen_step.

ТОЖДЕСТВО ПРИ НУЛЕВОЙ ЗАДЕРЖКЕ. При delay==0 везде реализация обязана
ПОБИТОВО совпасть с проверенной пробой v05_functional.py::probe. Это
проверяется в v12_delay_tests.py, а не предполагается -- тот же приём,
что для ядра M0 против v0.8.

Стимуляция в этой версии НЕ поддерживается (stimulate_nodes отсутствует):
проверка волн идёт на свободном прогоне, а непроверенный путь подачи
импульса создавать незачем (ловушка №17).
"""
import numpy as np

from v05_functional import DT, copy_state


def build_delay_steps(distance, speed_units_per_ms):
    """Задержки в шагах (=мс). speed=None или inf -> все задержки нулевые
    (режим тождества с исходной пробой)."""
    if speed_units_per_ms is None or not np.isfinite(speed_units_per_ms):
        return np.zeros_like(distance, dtype=np.int64)
    if speed_units_per_ms <= 0:
        raise ValueError("скорость должна быть положительной")
    d = np.rint(distance / speed_units_per_ms).astype(np.int64)
    np.fill_diagonal(d, 0)
    return d


def probe_delayed(checkpoint, W, noise, delay_steps, transmission=True):
    """Свободный прогон с задержками проведения. Возвращает растр
    (steps, N) bool. Не изменяет checkpoint и noise."""
    state = copy_state(checkpoint)
    N = W.shape[0]
    steps = noise.shape[0]
    assert DT == 0.001

    maxd = int(delay_steps.max()) + 1
    pending = np.zeros((maxd, N), dtype=float)
    rows = np.arange(N)
    spikes = np.zeros((steps, N), dtype=bool)

    v = state["v"]; syn = state["syn"]; adaptation = state["adaptation"]
    refractory = state["refractory"]; threshold = state["threshold"]
    drive = state["drive"]

    for t in range(steps):
        # 1. затухания -- как в frozen_step
        syn *= np.exp(-DT / 0.010)
        adaptation *= np.exp(-DT / 0.200)
        refractory[:] = np.maximum(0.0, refractory - DT)

        available = (refractory == 0.0)
        syn_term = syn if transmission else 0.0
        current = drive + syn_term - adaptation
        dv = (DT / 0.020) * (-v + current)
        v[available] += (dv + noise[t])[available]
        fired = available & (v >= threshold)

        # 6. передача -- ЕДИНСТВЕННОЕ отличие: вклад кладётся в очередь
        #    на шаг t+delay[i,j], затем применяется очередь текущего шага.
        #    При delay==0 вклад попадает в очередь текущего шага и
        #    применяется немедленно => тождественно syn += W[:,fired].sum(1)
        if transmission and np.any(fired):
            for j in np.flatnonzero(fired):
                idx = (t + delay_steps[:, j]) % maxd
                np.add.at(pending, (idx, rows), W[:, j])
        if transmission:
            slot = t % maxd
            syn += pending[slot]
            pending[slot] = 0.0

        # 7. сброс
        v[fired] = 0.0
        refractory[fired] = 0.005
        adaptation[fired] += 0.25

        spikes[t] = fired

    return spikes

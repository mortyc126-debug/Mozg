"""v0.11 фаза 2: проба с предъявлением ПОСЛЕДОВАТЕЛЬНОСТИ внутри окна.

Зачем: U2 фазы 1 оказался неинформативен по конструкции -- задача
"какая группа стимулирована" не адресует ПОРЯДОК, а именно порядок
был выучен в v0.8. Здесь задача -- распознать, КАКОЙ ПОРЯДОК предъявлен.

ГЛАВНЫЙ РИСК -- ловушка №17: принудительный импульс ВНУТРИ окна может
совпасть на одной временной отметке с естественным импульсом того же
или другого узла. Поэтому НОВЫЙ путь обработки импульса НЕ пишется:
используется ЗАФИКСИРОВАННАЯ машинерия v0.8 (integrate_electrical +
process_fired_batch), которая объединяет natural_fired и forced_fired
в ОДНУ маску до единственного вызова обработки и была проверена 4
сконструированными тестами в v0.8.

Эквивалентность этой машинерии (при plasticity_enabled=False) пробе
v05_functional.py::probe доказывается ПОБИТОВО в v11_sequence_tests.py,
а не предполагается.
"""
import numpy as np

from v05_functional import DT
from v08_experience_rewiring import integrate_electrical, process_fired_batch


def make_seq_state(state):
    """Состояние для машинерии v0.8: та же электрика + trace (нужен
    сигнатуре process_fired_batch; при выключенной STDP ни на что не
    влияет, что и проверяется тестом эквивалентности)."""
    s = {k: np.asarray(v).copy() for k, v in state.items()}
    if "trace" not in s:
        s["trace"] = np.zeros_like(s["v"])
    return s


def sequence_probe(state, W, contacts, noise, schedule):
    """Прогон окна len(noise) шагов с расписанием принудительных импульсов.

    schedule -- dict {номер_шага: массив индексов узлов}. На каждом шаге
    forced_fired строится из расписания, объединяется с natural_fired,
    и объединённая маска обрабатывается ОДНИМ вызовом
    process_fired_batch (пластичность выключена).

    Возвращает (spikes[steps,N] bool, n_collisions, final_state), где
    n_collisions -- число случаев, когда узел оказался ОДНОВРЕМЕННО
    natural и forced на одной отметке. Это число ОБЯЗАНО сообщаться:
    по ловушке №17 именно такие совпадения были источником
    систематической ошибки. Работает на КОПИИ состояния (переданный
    state не мутируется), поэтому итоговое состояние возвращается
    явно -- иначе его невозможно проверить тестом.
    """
    s = make_seq_state(state)
    N = W.shape[0]
    steps = noise.shape[0]
    spikes = np.zeros((steps, N), dtype=bool)
    n_collisions = 0

    for step in range(steps):
        natural = integrate_electrical(s, noise[step])
        forced = np.zeros(N, dtype=bool)
        if step in schedule:
            forced[schedule[step]] = True
        n_collisions += int(np.count_nonzero(natural & forced))
        fired = natural | forced
        process_fired_batch(s, W, contacts, fired, plasticity_enabled=False)
        spikes[step] = fired

    return spikes, n_collisions, s


def build_order_schedule(group_first, group_second, t0_ms, lag_ms):
    """Расписание предъявления последовательности: первая группа на
    шаге t0_ms, вторая через lag_ms. dt=1мс => шаг == мс."""
    assert DT == 0.001
    return {int(t0_ms): np.asarray(group_first),
            int(t0_ms + lag_ms): np.asarray(group_second)}

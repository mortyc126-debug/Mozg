"""Тождество после вынесения позиций и радиуса контакта в параметры.

В sim_core.simulate добавлены positions и contact_radius. При значениях
по умолчанию (positions=None, contact_radius=0.25) поведение обязано
совпасть с прежним ПОБИТОВО -- иначе сравнение расположений мерило бы
заодно и изменение движка.

Жеребьёвка случайных позиций выполняется в любом случае, даже когда
координаты заданы снаружи: пропуск сдвинул бы весь последующий поток
случайных чисел (drive и далее), и сравнение мерило бы не геометрию,
а другой поток. Это проверяется отдельно: при явной передаче тех же
самых случайных позиций результат обязан совпасть с прежним тоже.

Сверка без допуска: np.array_equal.
"""
import importlib.util
import sys
import numpy as np

sys.path.insert(0, "code")
import sim_core as new

spec = importlib.util.spec_from_file_location(
    "sim_core_old",
    "/tmp/claude-0/-home-user-Mozg/7258b5ee-e02b-5a2f-b06e-06bb773e12c0/scratchpad/sim_core_pristine.py",
)
old = importlib.util.module_from_spec(spec)
spec.loader.exec_module(old)


def snap(res):
    """Всё, что вернула simulate, в сравнимом виде."""
    if isinstance(res, tuple):
        return [np.asarray(x) if not isinstance(x, list) else np.asarray(
            [list(d.values()) if isinstance(d, dict) else d for d in x],
            dtype=object) for x in res]
    return [np.asarray(res)]


def same(a, b):
    if len(a) != len(b):
        return False
    for x, y in zip(a, b):
        if x.dtype == object or y.dtype == object:
            if repr(x) != repr(y):
                return False
        elif not np.array_equal(x, y):
            return False
    return True


ok = 0
tot = 0
for seed in (42, 7, 2024):
    a = snap(old.simulate(seed=seed))
    b = snap(new.simulate(seed=seed))
    tot += 1
    good = same(a, b)
    ok += good
    print(f"  seed {seed}: значения по умолчанию -- "
          f"{'ТОЧНОЕ СОВПАДЕНИЕ' if good else 'РАСХОЖДЕНИЕ'}")

    # те же самые случайные позиции, переданные явно
    pos = np.random.default_rng(seed).uniform(0, 1, size=(80, 2))
    c = snap(new.simulate(seed=seed, positions=pos))
    tot += 1
    good = same(a, c)
    ok += good
    print(f"  seed {seed}: те же позиции переданы явно -- "
          f"{'ТОЧНОЕ СОВПАДЕНИЕ' if good else 'РАСХОЖДЕНИЕ'}")

print(f"\nтождество: {ok} из {tot}")
sys.exit(0 if ok == tot else 1)

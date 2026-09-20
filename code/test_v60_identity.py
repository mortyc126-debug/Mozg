"""Проверки соединения ткани с миром тактов (v60).

Главная -- тождество при полном бюджете: без него всякое расхождение
дальше можно списать на дефицит, а можно на мою ошибку в переписанном
цикле, и разобрать будет нельзя.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import v37_self_built as v37
from sim_core import simulate, free_run_snapshots
from v60_tick_tissue import free_run_tick

BASE = {k: v for k, v in v37.GROWN.items() if k not in ("div_rate", "coupling")}
fails = 0


def check(name, ok, note=""):
    global fails
    print(f"{' ok  ' if ok else 'ПРОВАЛ'} {name}" + (f"  {note}" if note else ""))
    if not ok:
        fails += 1


def same(a, b):
    for s1, s2 in zip(a, b):
        if s1["t"] != s2["t"]:
            return False
        for k in s1["state"]:
            if not np.array_equal(s1["state"][k], s2["state"][k]):
                return False
    return True


for seed in (1, 2, 3):
    g = simulate(seed=seed, div_rate=0.10, coupling=10.0, duration=24.0, **BASE)
    N = g["weights"].shape[0]

    a = free_run_snapshots(g, seed=5000)
    b = free_run_tick(g, seed=5000, budget=float(N), earn="поровну", coupling=1.0)
    check(f"сид {seed} (N={N}): при полном бюджете и дележе поровну -- та же ткань, побитово",
          same(a, b))

    # пустой отсчёт к тождеству: при скудном бюджете миры обязаны разойтись,
    # иначе тождество доказывает лишь, что бюджет ни на что не влияет (№49)
    c = free_run_tick(g, seed=5000, budget=float(N) / 4, earn="поровну", coupling=1.0)
    check(f"сид {seed}: при бюджете вчетверо меньшем миры РАСХОДЯТСЯ", not same(a, c))

    # воздействие при нулевой амплитуде не смеет менять ничего
    d = free_run_tick(g, seed=5000, budget=float(N), earn="поровну", coupling=1.0,
                      touch=[np.arange(min(8, N))], touch_amp=0.0)
    check(f"сид {seed}: касание нулевой силы ни на что не влияет", same(b, d))

    # А вот это -- НЕ проверка, а измерение, и оно тут важнее проверок.
    # Правило «слышно» делит такты по тому, сколько нейрон доставил другим.
    # Если ткань молчит, доставлять нечего, доли у всех равны, и правило
    # вырождается в «поровну». Печатается как факт, в обе стороны.
    # Сила передачи. Сверять её в НЕТРОНУТОЙ ткани нельзя: там нет ни
    # одного спайка, строка передачи не исполняется, и множителю нечего
    # менять -- проверка была бы пустой (ошибка №49). Поэтому сверка
    # идёт под касанием, где спайки есть.
    tn = [np.arange(min(8, N))]
    f1 = free_run_tick(g, seed=5000, budget=float(N), earn="поровну", coupling=1.0,
                       touch=tn, touch_amp=3.0)
    f10 = free_run_tick(g, seed=5000, budget=float(N), earn="поровну", coupling=10.0,
                        touch=tn, touch_amp=3.0)
    check(f"сид {seed}: под касанием сила передачи 10 расходится с силой 1",
          not same(f1, f10))

    e = free_run_tick(g, seed=5000, budget=float(N), earn="слышно", base=0.05, coupling=10.0)
    b10 = free_run_tick(g, seed=5000, budget=float(N), earn="поровну", coupling=10.0)
    degenerate = same(b10, e)
    print(f"       измерение: правило 'слышно' "
          f"{'ВЫРОЖДАЕТСЯ в поровну -- ткань молчит, слышать некого' if degenerate else 'отличается от поровну'}")

print(f"\nпровалено проверок: {fails}" if fails else "\nвсе проверки пройдены")
sys.exit(1 if fails else 0)

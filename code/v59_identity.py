"""Тождество при stimulus_until = None -- сверка с НЕТРОНУТЫМ ядром.

Без этого сравнение "с обрывом входа против без" сравнивало бы две разные
реализации, а не наличие обрыва. Сверяется полное наблюдаемое состояние:
импульсы, веса, контакты, разметка, пороги, след мира.

Запуск: python3 code/v59_identity.py <путь-к-нетронутому-sim_core.py>
"""
import importlib.util
import sys

import numpy as np

sys.path.insert(0, "code")
import v37_self_built as v37
import v46_closed_loop as v46
from sim_core import simulate as sim_new


def load(path):
    spec = importlib.util.spec_from_file_location("sim_old", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.simulate


def snapshot(r):
    return {
        "spikes": r["spikes"], "weights": r["weights"],
        "contacts": r["contacts"], "state_s": r["state_s"],
        "threshold": r["state"]["threshold"], "v": r["state"]["v"],
        "world": r["world"], "born": np.array([r["born"]]),
    }


def same(a, b):
    return all(np.array_equal(a[k], b[k]) for k in a)


def main():
    if len(sys.argv) < 2:
        print("нужен путь к нетронутому sim_core.py"); return 1
    sim_old = load(sys.argv[1])

    BASE = {k: v for k, v in v37.GROWN.items() if k not in ("div_rate", "coupling")}
    fixed = {k: v for k, v in BASE.items() if k != "growth_by_division"}
    bad = 0
    for seed in (6701, 6702, 6703):
        grown = sim_new(seed=seed, div_rate=0.10, coupling=10.0, duration=24.0, **BASE)
        g_old = sim_old(seed=seed, div_rate=0.10, coupling=10.0, duration=24.0, **BASE)
        ok = same(snapshot(grown), snapshot(g_old))
        print(f"  рост ткани       seed {seed}: {'ТОЧНОЕ СОВПАДЕНИЕ' if ok else 'РАСХОЖДЕНИЕ'}")
        bad += not ok

        pos, birth = grown["positions"], grown["birth"]
        kw = dict(positions=pos, birth_times=birth, coupling=10.0,
                  stimulus=[v46.touch], stimulus_amp=0.4, stimulus_period=0.2,
                  duration=24.0, world=v46.live_world, world_init=0.5,
                  activity_memory=0.05, long_range_rate=3.0,
                  tract_pick="worn", long_range_weight=0.08, **fixed)
        a = sim_new(seed=seed + 1000, **kw)          # новый код, параметр по умолчанию
        b = sim_old(seed=seed + 1000, **kw)          # нетронутое ядро
        ok = same(snapshot(a), snapshot(b))
        print(f"  опыт с миром     seed {seed}: {'ТОЧНОЕ СОВПАДЕНИЕ' if ok else 'РАСХОЖДЕНИЕ'}")
        bad += not ok

        # обрыв ЗА пределами прогона обязан быть равен отсутствию обрыва
        c = sim_new(seed=seed + 1000, stimulus_until=999.0, **kw)
        ok = same(snapshot(a), snapshot(c))
        print(f"  обрыв за концом  seed {seed}: {'ТОЧНОЕ СОВПАДЕНИЕ' if ok else 'РАСХОЖДЕНИЕ'}")
        bad += not ok

        # обрыв в нуле обязан быть равен прогону вовсе без воздействия
        d = sim_new(seed=seed + 1000, stimulus_until=0.0, **kw)
        kw0 = dict(kw); kw0["stimulus_amp"] = 0.0
        e = sim_new(seed=seed + 1000, **kw0)
        ok = same(snapshot(d), snapshot(e))
        print(f"  обрыв в нуле     seed {seed}: {'ТОЧНОЕ СОВПАДЕНИЕ' if ok else 'РАСХОЖДЕНИЕ'}")
        bad += not ok

    print(f"\n{'ВСЕ 12 СВЕРОК ПРОЙДЕНЫ' if bad == 0 else f'РАСХОЖДЕНИЙ: {bad}'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

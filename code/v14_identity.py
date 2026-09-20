"""Тождество движка после вынесения параметров (v0.14, v0.15, v0.16).

В sim_core.simulate и simulate_with_snapshots добавлены параметры
positions, contact_radius, drive и differentiation, а в возвращаемый
словарь -- ключ state_s. При значениях по умолчанию каждая вычисляемая
величина обязана совпасть с архивной ПОБИТОВО.

СРАВНЕНИЕ ПО КЛЮЧАМ, а не словаря целиком. Первая редакция сравнивала
словарь через repr и после добавления ключа state_s дала 0 из 6 --
притом что все вычисляемые величины совпадали. Расхождением считался сам
факт нового выхода. Разобрано и исправлено: сверяются все ключи,
присутствующие в ОБЕИХ версиях, а новые ключи проверяются отдельно на
инертность (при выключенном механизме s обязана быть ровно 0.5 у всех).

Сверка без допуска: np.array_equal.
"""
import importlib.util
import sys
import numpy as np

sys.path.insert(0, "code")
import sim_core as new

PRISTINE = ("/tmp/claude-0/-home-user-Mozg/"
            "7258b5ee-e02b-5a2f-b06e-06bb773e12c0/scratchpad/sim_core_pristine.py")
spec = importlib.util.spec_from_file_location("sim_core_old", PRISTINE)
old = importlib.util.module_from_spec(spec)
spec.loader.exec_module(old)

SKIP = {"dt"}


def cmp_dicts(a, b, label):
    """Сверить все ключи, общие для обеих версий."""
    bad = []
    for k in sorted(set(a) & set(b) - SKIP):
        x, y = a[k], b[k]
        if isinstance(x, dict):
            for kk in sorted(set(x) & set(y)):
                if not np.array_equal(np.asarray(x[kk]), np.asarray(y[kk])):
                    bad.append(f"{k}.{kk}")
        elif not np.array_equal(np.asarray(x), np.asarray(y)):
            bad.append(k)
    ok = not bad
    print(f"  {label}: {'ТОЧНОЕ СОВПАДЕНИЕ' if ok else 'РАСХОЖДЕНИЕ по ' + ', '.join(bad)}")
    return ok


def cmp_snaps(a, b, label):
    ok = len(a) == len(b)
    if ok:
        for x, y in zip(a, b):
            if x["t"] != y["t"] or not np.array_equal(x["weights"], y["weights"]):
                ok = False
                break
            for k in x["state"]:
                if not np.array_equal(x["state"][k], y["state"][k]):
                    ok = False
                    break
    print(f"  {label}: {'ТОЧНОЕ СОВПАДЕНИЕ' if ok else 'РАСХОЖДЕНИЕ'}")
    return ok


ok = tot = 0
for seed in (42, 7, 2024):
    a = old.simulate(seed=seed)
    b = new.simulate(seed=seed)
    tot += 1; ok += cmp_dicts(a, b, f"simulate, seed {seed}, по умолчанию")

    # те же самые позиции и drive, переданные ЯВНО. Порядок жеребьёвки
    # существенен: позиции тянутся первыми, drive -- после них.
    rng = np.random.default_rng(seed)
    pos = rng.uniform(0, 1, size=(80, 2))
    drv = rng.uniform(1.10, 1.25, 80)
    c = new.simulate(seed=seed, positions=pos, drive=drv)
    tot += 1; ok += cmp_dicts(a, c, f"simulate, seed {seed}, позиции и drive явно")

    d = old.simulate_with_snapshots(seed=seed)
    e = new.simulate_with_snapshots(seed=seed)
    tot += 1; ok += cmp_snaps(d, e, f"snapshots, seed {seed}, по умолчанию")

print("\nинертность нового выхода при выключенном механизме:")
inert = True
for seed in (42, 7, 2024):
    s = new.simulate(seed=seed)["state_s"]
    good = np.all(s == 0.5)
    inert &= bool(good)
    print(f"  seed {seed}: s ровно 0.5 у всех -- {'ДА' if good else 'НЕТ'}")

print("\nвключённый механизм не возмущает остальной прогон:")
noperturb = True
for seed in (42, 7, 2024):
    a = new.simulate(seed=seed)
    b = new.simulate(seed=seed, differentiation=0.05)
    good = all(np.array_equal(a[k], b[k]) for k in ("spikes", "weights", "contacts"))
    good &= np.array_equal(a["state"]["threshold"], b["state"]["threshold"])
    noperturb &= bool(good)
    print(f"  seed {seed}: {'ТОЧНОЕ СОВПАДЕНИЕ' if good else 'РАСХОЖДЕНИЕ'} "
          f"(разброс s при включённом: {b['state_s'].std():.4f})")

print(f"\nтождество: {ok} из {tot};  инертность: {'ДА' if inert else 'НЕТ'};  "
      f"невозмущение: {'ДА' if noperturb else 'НЕТ'}")
sys.exit(0 if (ok == tot and inert and noperturb) else 1)

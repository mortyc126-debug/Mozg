"""v0.23: перемер v0.14 при РАБОЧЕЙ силе связи.

v0.14 спрашивал: даёт ли ВЫРОСШАЯ организация (v0.13) функциональное
отличие от случайной при выравненной плотности. Ответ был отрицательный:
отличие в согласовании активности (+16.6%, 12 сидов из 12) исчезало при
обоих способах выравнивания (7 из 12, отношение 1.007).

Но v0.22 показал, что тот ответ получен там, где сеть давала узлу 0.0084
его входа. Механизм, действующий ЧЕРЕЗ связи -- а организация действует
только так, -- проявиться не мог. Здесь тот же вопрос задаётся при силе
связи 4, где адресуемость уже работает (0.860 против 0.561 при силе 1).

СТАРЫЕ ЧИСЛА НЕ ПЕРЕПИСЫВАЮТСЯ: они верны для своего режима и помечены
в ledger. Здесь отдельное измерение того же вопроса.

МЕРЫ. Две, намеренно:
  1. СОГЛАСОВАНИЕ активности (v0.3, нуль циклического сдвига) -- та же
     мера, что в v0.14, ради прямой сравнимости;
  2. АДРЕСУЕМОСТЬ (v0.19) -- цифровая мера, которая при силе 1 не
     работала вовсе и потому в v0.14 применена быть не могла.

ВЫРАВНИВАНИЕ ПЛОТНОСТИ обязательно (урок №30) и делается теми же двумя
способами, что в v0.14: масштаб облака и радиус роста контакта, оба по
ЧИСЛУ СОСЕДЕЙ. Остаточное расхождение выводится отдельной строкой до
обсуждения; выше 10% -- не читается.

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * отличие засчитывается, только если оно есть при ОБОИХ способах
    выравнивания и в одну сторону не менее чем на 5/6 сидов;
  * контраст с силой 1 прогоняется рядом: если при силе 1 отличия нет, а
    при силе 4 есть -- немота действительно была следствием слабой
    связи;
  * если отличия нет и при силе 4 -- выросшая организация функционально
    пуста не из-за режима, и вывод v0.14 остаётся в силе уже безусловно.
"""
import sys
import numpy as np

sys.path.insert(0, "code")
import importlib.util
from sim_core import simulate
from v03_cyclic_shift import cyclic_shift_control
from v13_morphogenesis import grow_positions
from v14_grown_function import mean_degree, scale_to_match, radius_for_degree

spec = importlib.util.spec_from_file_location("v19", "code/v19_addressability.py")
v19 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v19)

N = 80
SEEDS = list(range(901, 913))
R_REF = 0.25


def run_one(seed, pos, radius, coupling):
    r = simulate(seed=seed, positions=pos, contact_radius=radius,
                 coupling=coupling)
    q = cyclic_shift_control(r["spikes"], r["dt"], n_shuffles=100,
                             seed=seed)["q_ratio"]
    a, b = v19.pick_groups(pos)
    acc = shuf = notr = np.nan
    if a is not None:
        keep = np.setdiff1d(np.arange(N), np.concatenate([a, b]))
        rg = np.random.default_rng(seed)
        acc = v19.accuracy(r, a, b, keep, rg, coupling=coupling)
        shuf = v19.accuracy(r, a, b, keep, np.random.default_rng(seed),
                            shuffle=True, coupling=coupling)
        notr = v19.accuracy(r, a, b, keep, np.random.default_rng(seed),
                            transmission=False, coupling=coupling)
    return dict(q=q, acc=acc, shuf=shuf, notr=notr,
                deg=float(r["contacts"].sum(axis=1).mean()),
                rate=r["metrics"]["rate_hz"])


def main():
    for coupling in (1.0, 4.0):
        acc = {k: [] for k in ("равномерные", "выросшие, МАСШТАБ",
                               "выросшие, РАДИУС")}
        for seed in SEEDS:
            uni = np.random.default_rng(seed).uniform(0, 1, size=(N, 2))
            grown = grow_positions(seed=seed)
            deg_ref = mean_degree(uni, R_REF)
            conds = {
                "равномерные": (uni, R_REF),
                "выросшие, МАСШТАБ": (scale_to_match(grown, deg_ref), R_REF),
                "выросшие, РАДИУС": (grown, radius_for_degree(grown, deg_ref)),
            }
            for name, (p, rad) in conds.items():
                acc[name].append(run_one(seed, p, rad, coupling))

        print(f"\n=== сила связи {coupling:g}, {len(SEEDS)} seed'ов ===")
        ref_deg = np.mean([r["deg"] for r in acc["равномерные"]])
        print("  выравнивание (порог 10%), до обсуждения результата:")
        for name in acc:
            d = np.mean([r["deg"] for r in acc[name]])
            rel = abs(d - ref_deg) / ref_deg
            print(f"    {name:<20}: соседей {d:6.3f}  расхождение {rel*100:5.2f}% "
                  f"-- {'ЧИТАЕМО' if rel <= 0.10 else 'НЕ ЧИТАЕМО'}")
        print("  самопроверки адресуемости (обязаны быть около 0.5):")
        for name in acc:
            print(f"    {name:<20}: перемешанные "
                  f"{np.nanmean([r['shuf'] for r in acc[name]]):.3f}, "
                  f"без передачи {np.nanmean([r['notr'] for r in acc[name]]):.3f}")

        qref = np.array([r["q"] for r in acc["равномерные"]])
        aref = np.array([r["acc"] for r in acc["равномерные"]])
        print(f"\n  {'условие':<20} | {'согласование q':>16} | {'выше':>7} | "
              f"{'адресуемость':>16} | {'выше':>7}")
        for name in acc:
            q = np.array([r["q"] for r in acc[name]])
            a = np.array([r["acc"] for r in acc[name]])
            uq = int((q > qref).sum()) if name != "равномерные" else 0
            ua = int(np.nansum(a > aref)) if name != "равномерные" else 0
            m = "--" if name == "равномерные" else f"{uq} из {len(SEEDS)}"
            m2 = "--" if name == "равномерные" else f"{ua} из {len(SEEDS)}"
            print(f"  {name:<20} | {q.mean():>7.4f} +- {q.std():.4f} | {m:>7} | "
                  f"{np.nanmean(a):>7.3f} +- {np.nanstd(a):.3f} | {m2:>7}")

        thr = int(np.ceil(len(SEEDS) * 5 / 6))
        print(f"\n  ЧТЕНИЕ (порог {thr} из {len(SEEDS)}, нужно при ОБОИХ способах):")
        for meas, key, ref in (("согласование", "q", qref),
                               ("адресуемость", "acc", aref)):
            ups = []
            for name in ("выросшие, МАСШТАБ", "выросшие, РАДИУС"):
                v = np.array([r[key] for r in acc[name]])
                up = int(np.nansum(v > ref))
                ups.append(max(up, len(SEEDS) - up))
            ok = all(u >= thr for u in ups)
            print(f"    {meas}: в одну сторону {ups[0]} и {ups[1]} из "
                  f"{len(SEEDS)} -- {'ОТЛИЧИЕ ЕСТЬ' if ok else 'отличия нет'}")


if __name__ == "__main__":
    main()

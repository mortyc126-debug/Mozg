"""v0.24: перемер v0.18 при РАБОЧЕЙ силе связи.

v0.18 ввёл границу: различие состояний мешает связи вырасти. Узор от
этого стал отчётливее (ближнее кольцо 0.725 -> 0.580, 20 сидов из 24),
но функционального следствия не было: согласование активности при
выравненной плотности дало 16 из 24, то есть случайный уровень.

Тот результат получен при силе связи 1, где сеть даёт узлу 0.0084 его
входа (v0.20, v0.22). Здесь тот же вопрос задаётся при силе 4.

СТАРЫЕ ЧИСЛА НЕ ПЕРЕПИСЫВАЮТСЯ. Это отдельное измерение.

Меры те же две, что в v0.23: согласование (для сравнимости с v0.18) и
адресуемость (цифровая мера, при силе 1 не работавшая).

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * остаточное расхождение по числу соседей выше 10% -- не читается;
    выравнивание перепроверяется при КАЖДОЙ силе, потому что правило
    границы зависит от состояний, а те -- от активности, то есть
    калибровка радиуса могла сместиться;
  * следствие засчитывается, если мера отличается от контроля в одну
    сторону не менее чем на 5/6 сидов;
  * контраст силы 1 и 4 прогоняется рядом: если следствие появляется
    только при 4 -- немота границы была следствием слабой связи;
  * если следствия нет и при 4 -- граница меняет устройство, но не
    работу, и вывод v0.18 остаётся безусловным.
"""
import importlib.util
import sys
import numpy as np

sys.path.insert(0, "code")
from sim_core import simulate
from v03_cyclic_shift import cyclic_shift_control

spec = importlib.util.spec_from_file_location("v19", "code/v19_addressability.py")
v19 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v19)

N = 80
SEEDS = list(range(951, 963))
ETA = 0.5
CONDS = {"КОНТРОЛЬ": dict(state_affinity=0.0, contact_radius=0.25),
         "ГРАНИЦА":  dict(state_affinity=1.0, contact_radius=0.285)}


def run_one(seed, kw, coupling):
    r = simulate(seed=seed, drive=1.175, gradual_growth=False,
                 differentiation=ETA, coupling=coupling, **kw)
    q = cyclic_shift_control(r["spikes"], r["dt"], n_shuffles=100,
                             seed=seed)["q_ratio"]
    a, b = v19.pick_groups(r["positions"])
    acc = shuf = notr = np.nan
    if a is not None:
        keep = np.setdiff1d(np.arange(N), np.concatenate([a, b]))
        acc = v19.accuracy(r, a, b, keep, np.random.default_rng(seed),
                           coupling=coupling)
        shuf = v19.accuracy(r, a, b, keep, np.random.default_rng(seed),
                            shuffle=True, coupling=coupling)
        notr = v19.accuracy(r, a, b, keep, np.random.default_rng(seed),
                            transmission=False, coupling=coupling)
    s = r["state_s"]
    return dict(q=q, acc=acc, shuf=shuf, notr=notr,
                deg=float(r["contacts"].sum(axis=1).mean()),
                edge=float(np.mean((s < 0.1) | (s > 0.9))))


def main():
    thr = int(np.ceil(len(SEEDS) * 5 / 6))
    for coupling in (1.0, 4.0):
        acc = {c: [run_one(s, kw, coupling) for s in SEEDS]
               for c, kw in CONDS.items()}
        ref = np.mean([r["deg"] for r in acc["КОНТРОЛЬ"]])
        print(f"\n=== сила связи {coupling:g}, {len(SEEDS)} seed'ов ===")
        print("  выравнивание (порог 10%), до обсуждения результата:")
        readable = True
        for c in CONDS:
            d = np.mean([r["deg"] for r in acc[c]])
            rel = abs(d - ref) / ref
            readable &= rel <= 0.10
            print(f"    {c:<9}: соседей {d:6.3f}  расхождение {rel*100:5.2f}% "
                  f"-- {'ЧИТАЕМО' if rel <= 0.10 else 'НЕ ЧИТАЕМО'}")
        print("  самопроверки адресуемости (обязаны быть около 0.5):")
        for c in CONDS:
            print(f"    {c:<9}: перемешанные "
                  f"{np.nanmean([r['shuf'] for r in acc[c]]):.3f}, "
                  f"без передачи {np.nanmean([r['notr'] for r in acc[c]]):.3f}")

        qr = np.array([r["q"] for r in acc["КОНТРОЛЬ"]])
        ar = np.array([r["acc"] for r in acc["КОНТРОЛЬ"]])
        print(f"\n  {'условие':<9} | {'доля у краёв s':>14} | {'согласование q':>16} | "
              f"{'адресуемость':>16}")
        for c in CONDS:
            q = np.array([r["q"] for r in acc[c]])
            a = np.array([r["acc"] for r in acc[c]])
            print(f"  {c:<9} | {np.mean([r['edge'] for r in acc[c]]):>14.3f} | "
                  f"{q.mean():>7.4f} +- {q.std():.4f} | "
                  f"{np.nanmean(a):>7.3f} +- {np.nanstd(a):.3f}")

        print(f"\n  ЧТЕНИЕ (порог {thr} из {len(SEEDS)}):")
        if not readable:
            print("    плотность не выравнена -- не читается")
            continue
        for meas, key, r0 in (("согласование", "q", qr),
                              ("адресуемость", "acc", ar)):
            v = np.array([r[key] for r in acc["ГРАНИЦА"]])
            up = int(np.nansum(v > r0))
            maj = max(up, len(SEEDS) - up)
            print(f"    {meas}: в одну сторону {maj} из {len(SEEDS)} "
                  f"({np.nanmean(r0):.4f} -> {np.nanmean(v):.4f}) -- "
                  f"{'СЛЕДСТВИЕ ЕСТЬ' if maj >= thr else 'следствия нет'}")


if __name__ == "__main__":
    main()

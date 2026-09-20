"""v0.11 фаза 5: ЗАДАЧА С ЦЕНОЙ ОШИБКИ.

Зачем: фазы 1-4 показали одно и то же -- все меры описывают СВОЙСТВА
отклика (скорость, устойчивость, различимость, декодируемость).
Полезность требует задачи, где поздний или ложный ответ ЧЕМ-ТО ПЛОХ.

ЗАДАЧА. После стимуляции группы-источника при t=0 группа-цель обязана
выдать импульс в пределах срока T мс.
  попадание (hit)  -- цель сработала в пределах T на пробе СО стимулом;
  ложная тревога (FA) -- цель сработала в пределах T на пробе БЕЗ
                         стимула (спонтанная активность, а не ответ).
Оценка сети на задаче: score = hit_rate - FA_rate. Обе ошибки штрафуются:
пропуск снижает hit, ложная тревога повышает FA. Правильный ответ задан
протоколом (был стимул или нет), а не сетью.

U5 = перекрёстный контраст score между совпадающей и несовпадающей по
порядку ветвями (БОЛЬШЕ = лучше), та же форма, что U1 и C из v0.8.

ЗАФИКСИРОВАНО ДО ЗАПУСКА:
- сетка сроков T = 10..100 мс объявлена заранее, КРИВАЯ ЦЕЛИКОМ
  сообщается -- отбор "удачного" T запрещён;
- ОСНОВНОЙ T выбирается правилом по КОНТРОЛЬНЫМ данным (M3, без
  пластичности): ближайший в сетке к медиане латентности M3. Данные
  контроля НЕ участвуют в сравнении ветвей, поэтому выбор срока не
  подсматривает эффект;
- предсказание знака: U5 > 0;
- предсказание ВЕЛИЧИНЫ выводится из уже измеренного распределения
  латентностей и сдвига U1 ДО измерения самого U5 (см. predict_effect).
  Если измеренное сильно превысит предсказанное -- работает что-то
  помимо сдвига латентности, и это надо будет объяснять, а не
  праздновать.

Контроль: у M3 (без пластичности) U5 обязан быть ТОЧНО нулевым.
Тестовые шумы 1100-1199 -- свежие.
"""
import pickle
import time

import numpy as np

from v05_functional import make_noise, probe
from v09_functional_probe import build_common_start_state
from v11_measures import first_spike_latency, CENSORED, crossed_contrast

TEST_SEEDS = list(range(1100, 1200))
PROBE_STEPS = 200
SNAPSHOT_TIME = 96.0
N = 80
DEADLINES = [10, 20, 30, 40, 50, 60, 80, 100]


def latencies(state, W, noises, stim_g, obs_g):
    """Латентности первого импульса цели: со стимулом и без."""
    ls, lb = [], []
    for nz in noises:
        s, _ = probe(state, W, nz, True, stim_g)
        b, _ = probe(state, W, nz, True, None)
        ls.append(first_spike_latency(s, obs_g))
        lb.append(first_spike_latency(b, obs_g))
    return np.array(ls), np.array(lb)


def score_at(lat_stim, lat_base, T):
    """hit - FA при сроке T. CENSORED (=-1) означает 'не сработала' и
    в срок не укладывается по определению."""
    hit = np.mean((lat_stim >= 0) & (lat_stim < T))
    fa = np.mean((lat_base >= 0) & (lat_base < T))
    return float(hit - fa), float(hit), float(fa)


def predict_effect(control_lat, shift_ms, T):
    """ПРЕДСКАЗАНИЕ величины U5 из распределения латентностей контроля
    и измеренного сдвига: если весь эффект -- сдвиг распределения на
    shift_ms влево, то прирост доли попаданий = P(T <= L < T+shift).
    Считается ТОЛЬКО по контрольным данным."""
    v = control_lat[control_lat >= 0]
    if v.size == 0:
        return np.nan
    return float(np.mean((v >= T) & (v < T + shift_ms)))


def main():
    with open("v06_extended_growth_full.pkl", "rb") as f:
        D06 = pickle.load(f)
    with open("v11_train_full.pkl", "rb") as f:
        T1 = pickle.load(f)
    noises = [make_noise(s, PROBE_STEPS, N) for s in TEST_SEEDS]

    per = {}          # (key, direction, branch) -> (lat_stim, lat_base)
    t0 = time.time()
    for key, rec in T1["results"].items():
        sel, geom, growth, mech, rep = key
        gA, gB = rec["group_A"], rec["group_B"]
        v06 = D06["snapshots"][geom][growth][SNAPSHOT_TIME]["state"]
        for direction, (src_g, tgt_g) in (("ab", (gA, gB)), ("ba", (gB, gA))):
            for br in ("AB", "BA"):
                st, W, _ = build_common_start_state(v06, rec[br])
                per[(key, direction, br)] = latencies(st, W, noises, src_g, tgt_g)

    # --- основной срок по КОНТРОЛЮ M3 (данные не участвуют в сравнении)
    ctrl = np.concatenate([per[k][0] for k in per
                           if k[0][3] == "M3_no_plasticity_weakest"])
    ctrl_valid = ctrl[ctrl >= 0]
    med = float(np.median(ctrl_valid))
    T_main = min(DEADLINES, key=lambda t: abs(t - med))
    print(f"медиана латентности контроля M3: {med:.1f} мс "
          f"=> ОСНОВНОЙ срок T = {T_main} мс (по правилу, не по эффекту)")

    # --- предсказание величины ДО измерения U5
    shift = 1.0674   # U1 механизма M1, измеренный в фазе 4
    pred = predict_effect(ctrl_valid, shift, T_main)
    print(f"ПРЕДСКАЗАНИЕ величины U5 при T={T_main}: {pred:+.4f} "
          f"({pred*100:+.2f} проц. пункта), исходя из сдвига {shift:.3f} мс\n")

    out = {}
    for mech in ("M1_plasticity_weakest", "M3_no_plasticity_weakest"):
        keys = sorted({k[0] for k in per if k[0][3] == mech})
        curve = {}
        for T in DEADLINES:
            U5s = []
            for key in keys:
                sc = {}
                for direction in ("ab", "ba"):
                    for br in ("AB", "BA"):
                        ls, lb = per[(key, direction, br)]
                        sc[(br, direction)] = score_at(ls, lb, T)[0]
                U5, _, _ = crossed_contrast(sc[("AB", "ab")], sc[("BA", "ab")],
                                            sc[("BA", "ba")], sc[("AB", "ba")],
                                            lower_is_better=False)
                U5s.append(U5)
            curve[T] = np.array(U5s)
        out[mech] = curve

        print(f"=== {mech} (n={len(keys)} комбинаций)")
        print("  T мс |    U5 среднее | знаки >0/=0/<0")
        for T in DEADLINES:
            a = curve[T]
            mark = " <- основной" if T == T_main else ""
            print(f"  {T:4d} | {a.mean():+.5f}     | "
                  f"{(a>0).sum():2d}/{(a==0).sum():2d}/{(a<0).sum():2d}{mark}")

    a = out["M1_plasticity_weakest"][T_main]
    print(f"\nПРИ ОСНОВНОМ СРОКЕ T={T_main}:")
    print(f"  измеренный U5 = {a.mean():+.5f} ({a.mean()*100:+.2f} проц. пункта)")
    print(f"  предсказанный = {pred:+.5f} ({pred*100:+.2f} проц. пункта)")
    print(f"  отношение измеренное/предсказанное = "
          f"{(a.mean()/pred if pred else np.nan):.2f}")
    print(f"  ст.откл между комбинациями {a.std():.5f}, "
          f"|среднее|/ст.откл = {abs(a.mean())/a.std() if a.std() else np.nan:.3f}")

    m3 = out["M3_no_plasticity_weakest"]
    allzero = all(np.all(m3[T] == 0.0) for T in DEADLINES)
    print(f"\nКОНТРОЛЬ M3 == 0 на всех сроках: {allzero}")
    if not allzero:
        raise AssertionError("M3 дал ненулевой U5 -- контроль не пройден")

    with open("v11_task.pkl", "wb") as f:
        pickle.dump({"curves": out, "T_main": T_main, "prediction": pred,
                     "deadlines": DEADLINES, "test_seeds": TEST_SEEDS,
                     "control_median_latency": med,
                     "code_version": "v0.11 phase5 task"}, f)
    print(f"\nвремя: {time.time()-t0:.1f} c -> v11_task.pkl")


if __name__ == "__main__":
    main()

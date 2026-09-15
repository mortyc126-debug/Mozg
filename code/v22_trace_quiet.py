"""v0.22: полезен ли СЛЕД ОПЫТА в молчащей подложке сильнее, чем в занятой.

ЗАЧЕМ. v0.11 фаза 5 дала: след опыта даёт +2.33 п.п. при жёстком сроке
(29 знаков из 36 положительны). Результат верен, но получен в режиме,
где сеть даёт узлу МЕНЬШЕ ПРОЦЕНТА его входа (0.0084, измерено в v0.20).
В таком режиме пластичность может лишь слегка сдвинуть темп разрядов --
изменить, КАКИЕ события произойдут, ей нечем. Отсюда и малая величина,
которую тогда же и предсказали заранее.

В молчащей подложке (v0.21) один спайк ВЫЗЫВАЕТ другие. То же правило
STDP там действует не на темп, а на состав событий. Вопрос: становится
ли след полезнее.

ПОЧЕМУ НЕ ПЕРЕПРОГОН СТАРОГО КОДА. Конвейер v0.11 тянет снимки v0.6 и
отбор групп по критерию v0.8, а силу связи пришлось бы протаскивать
через пять старых модулей -- ровно та ситуация, что породила ошибку №34
(параметр вписан в одну копию из шести). Здесь всё считает ОДИН код,
одинаковый для обоих режимов; старые числа не трогаются и остаются в
своём разделе.

РЕЖИМЫ:
  ЗАНЯТЫЙ  -- ток 1.175, гомеостаз включён, сила связи 1 (как в v0.1-v0.13);
  МОЛЧАЩИЙ -- ток 0.8, гомеостаз выключен, сила связи 10 (окно местного
              отклика из v0.21: отвечает около 28% сети).

ЗАДАЧА -- та же, что в v0.11 фазе 5. После импульса в группу-источник
группа-цель обязана выдать импульс в пределах срока T.
  попадание -- цель сработала в срок на пробе СО стимулом;
  ложная тревога -- сработала в срок на пробе БЕЗ стимула.
  score = hit - FA.

U5 -- перекрёстный контраст score между совпадающей и несовпадающей по
порядку ветвями, та же форма, что в v0.11. Он считается ВНУТРИ режима,
поэтому разная частота ложных тревог между режимами в него не входит:
в молчащей подложке FA равна нулю по построению, и сравнивать score
между режимами было бы нечестно, а U5 -- честно.

ЗАФИКСИРОВАНО ДО ЗАПУСКА (по образцу v0.11):
- сетка сроков 10..100 мс объявлена заранее, кривая сообщается ЦЕЛИКОМ,
  отбор удачного срока запрещён;
- ОСНОВНОЙ срок выбирается правилом по КОНТРОЛЬНЫМ данным (ветвь без
  пластичности): ближайший в сетке к медиане латентности ОТКЛИКА этой
  ветви; контроль в сравнении ветвей не участвует.
  ПРАВИЛО УТОЧНЕНО ДО ОСНОВНОГО ПРОГОНА: в v0.11 бралась медиана
  латентности контроля на пробах БЕЗ стимула. В молчащей подложке
  фоновых разрядов нет вовсе, медиана там не определена, и правило
  оказалось неприменимо. Взята медиана латентности отклика той же
  контрольной ветви -- это те же контрольные данные, но величина
  существует в обоих режимах;
- предсказание знака: U5 > 0 в обоих режимах;
- предсказание величины: в занятом режиме ожидается около +2..3 п.п.
  (воспроизведение v0.11). Для молчащего величина НЕ предсказывается --
  именно она и есть вопрос;
- КОНТРОЛЬ: у ветви без пластичности U5 обязан быть ТОЧНО нулевым.
  Если он не ноль -- течёт метод, и результат не читается.
"""
import sys
import numpy as np

sys.path.insert(0, "code")
from sim_core import simulate
from v11_measures import crossed_contrast

N = 80
DT = 0.001
LAG = 10                      # мс между импульсами источника и цели при обучении
PERIOD = 400                  # мс между повторами
TRAIN_MS = 12000              # 30 повторов
PROBE_MS = 200
DEADLINES = [10, 20, 30, 40, 50, 60, 80, 100]
GROUP = 5
TEST_NOISES = 60
ETA = 0.0002
SEEDS = list(range(701, 725))

REGIMES = {
    "ЗАНЯТЫЙ":       dict(drive=1.175, homeostasis=True,  coupling=1.0),
    "ЗАНЯТЫЙ+СИЛА":  dict(drive=1.175, homeostasis=True,  coupling=10.0),
    "МОЛЧАЩИЙ":      dict(drive=0.8,   homeostasis=False, coupling=10.0),
}
# Третий режим добавлен ПОСЛЕ первого прогона и ради РАЗДЕЛЕНИЯ причин, а
# не ради лучшего числа: молчащий режим отличается от занятого сразу двумя
# вещами -- тишиной и силой связи 10 против 1. Без этого режима выигрыш
# нельзя приписать именно тишине. Объявлено до запуска: если выигрыш даёт
# сила, он появится и здесь; если тишина -- здесь останется малым.


def pick_groups(pos):
    a = np.argsort(np.linalg.norm(pos - np.array([0.35, 0.5]), axis=1))[:GROUP]
    b = np.argsort(np.linalg.norm(pos - np.array([0.65, 0.5]), axis=1))[:GROUP]
    return np.sort(a), np.sort(b)


def step_dynamics(st, W, noise_row, coupling, forced=None):
    """Один шаг замороженной электрики. Возвращает fired."""
    st["syn"] *= np.exp(-DT / 0.010)
    st["adapt"] *= np.exp(-DT / 0.200)
    st["refr"] = np.maximum(0.0, st["refr"] - DT)
    avail = st["refr"] == 0.0
    cur = st["drive"] + st["syn"] - st["adapt"]
    dv = (DT / 0.020) * (-st["v"] + cur)
    st["v"][avail] += (dv + noise_row)[avail]
    fired = avail & (st["v"] >= st["thr"])
    if forced is not None:
        fired[forced] = True
    if fired.any():
        st["syn"] += coupling * W[:, fired].sum(axis=1)
    st["v"][fired] = 0.0
    st["refr"][fired] = 0.005
    st["adapt"][fired] += 0.25
    return fired


def fresh_state(net):
    s = net["state"]
    return dict(v=s["v"].copy(), syn=np.zeros(N), adapt=s["adaptation"].copy(),
                refr=s["refractory"].copy(), thr=s["threshold"].copy(),
                drive=s["drive"].copy())


def train(net, first, second, plastic, coupling, seed):
    """Повторяющаяся пара импульсов first -> second с лагом LAG."""
    W = net["weights"].copy()
    C = net["contacts"]
    st = fresh_state(net)
    rng = np.random.default_rng(seed)
    noise = 0.012 * rng.standard_normal((TRAIN_MS, N))
    trace = np.zeros(N)
    for t in range(TRAIN_MS):
        forced = None
        ph = t % PERIOD
        if ph == 0:
            forced = first
        elif ph == LAG:
            forced = second
        fired = step_dynamics(st, W, noise[t], coupling, forced)
        trace *= np.exp(-DT / 0.020)
        if plastic and fired.any():
            W[fired, :] += ETA * trace[None, :] * C[fired, :]
            W[:, fired] -= 1.05 * ETA * trace[:, None] * C[:, fired]
            np.clip(W, 0.0, 0.08, out=W)
            tot = W.sum(axis=1)
            W *= np.minimum(1.0, 0.6 / np.maximum(tot, 1e-12))[:, None]
        trace[fired] += 1.0
    return W


def latency(net, W, coupling, stim, obs, noise):
    st = fresh_state(net)
    for t in range(PROBE_MS):
        forced = stim if (stim is not None and t == 20) else None
        fired = step_dynamics(st, W, noise[t], coupling, forced)
        if t > 20 and fired[obs].any():
            return t - 20
    return -1


def score_curve(net, W, coupling, stim, obs, seed):
    rng = np.random.default_rng(seed)
    ls, lb = [], []
    for _ in range(TEST_NOISES):
        nz = 0.012 * rng.standard_normal((PROBE_MS, N))
        ls.append(latency(net, W, coupling, stim, obs, nz))
        lb.append(latency(net, W, coupling, None, obs, nz))
    ls, lb = np.array(ls), np.array(lb)
    out = {}
    for T in DEADLINES:
        hit = np.mean((ls >= 0) & (ls < T))
        fa = np.mean((lb >= 0) & (lb < T))
        out[T] = float(hit - fa)
    return out, ls


def main():
    for rname, rkw in REGIMES.items():
        rows = {T: [] for T in DEADLINES}
        ctrl = {T: [] for T in DEADLINES}
        ctrl_lat = []
        for seed in SEEDS:
            net = simulate(seed=seed, gradual_growth=False, differentiation=0.0,
                           drive=rkw["drive"], homeostasis=rkw["homeostasis"],
                           coupling=rkw["coupling"])
            A, B = pick_groups(net["positions"])
            cp = rkw["coupling"]
            for plastic, acc in ((True, rows), (False, ctrl)):
                W_ab = train(net, A, B, plastic, cp, seed)
                W_ba = train(net, B, A, plastic, cp, seed + 7)
                s_ab_ab, lat_ctrl = score_curve(net, W_ab, cp, A, B, seed + 100)
                s_ba_ab, _ = score_curve(net, W_ba, cp, A, B, seed + 100)
                s_ba_ba, _ = score_curve(net, W_ba, cp, B, A, seed + 200)
                s_ab_ba, _ = score_curve(net, W_ab, cp, B, A, seed + 200)
                if not plastic:
                    ctrl_lat.extend(lat_ctrl[lat_ctrl >= 0].tolist())
                for T in DEADLINES:
                    u, _, _ = crossed_contrast(s_ab_ab[T], s_ba_ab[T],
                                               s_ba_ba[T], s_ab_ba[T],
                                               lower_is_better=False)
                    acc[T].append(u)

        med = np.median(ctrl_lat) if ctrl_lat else np.nan
        Tmain = min(DEADLINES, key=lambda T: abs(T - med)) if np.isfinite(med) else DEADLINES[2]
        print(f"\n=== режим {rname} ({len(SEEDS)} seed'ов) ===")
        print(f"  медиана латентности контроля: "
              f"{med if np.isfinite(med) else float('nan'):.1f} мс "
              f"-> основной срок T = {Tmain} мс")
        print(f"  {'T мс':>5} | {'U5, п.п.':>10} | {'знаков >0':>10} | "
              f"{'контроль U5':>12}")
        for T in DEADLINES:
            u = np.array(rows[T]) * 100
            c = np.array(ctrl[T]) * 100
            mark = "  <- основной" if T == Tmain else ""
            print(f"  {T:>5} | {u.mean():>+10.2f} | {int((u > 0).sum()):>4} из "
                  f"{len(u):<4} | {c.mean():>+12.4f}{mark}")
        cmax = np.max(np.abs([np.array(ctrl[T]).mean() for T in DEADLINES]))
        print(f"  КОНТРОЛЬ (без пластичности): наибольший |U5| = {cmax*100:.4f} п.п. "
              f"-- {'ноль, как и обязан' if cmax < 1e-9 else 'НЕ НОЛЬ: метод течёт'}")


if __name__ == "__main__":
    main()

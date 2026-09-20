"""
v60 -- ТКАНЬ ПРОЕКТА ПОД ДЕФИЦИТОМ ТАКТА

Что здесь соединяется. У проекта две половины: МИР (линия engine/tick,
где дефицитен такт и такты идут тому, кого читают) и МОЗГ (эта линия,
ткань, выращенная за 59 версий). До сих пор они не встречались.

Здесь ткань кладётся в мир тактов. Не переписанная, не изображённая --
та самая: веса, контакты, пороги, drive -- всё из simulate().

ГДЕ ИМЕННО СОЕДИНЕНИЕ. В свободном прогоне ткани (free_run_snapshots)
уже есть построчный вентиль:

    available = refractory == 0.0

Бюджет такта встаёт ровно туда и никуда больше:

    available = (refractory == 0.0) & (кредита хватило)

Нейрон без такта ЗАМИРАЕТ, а не гибнет: его v, syn, adaptation целы, он
по-прежнему получает чужие спайки, он просто не интегрирует и не
стреляет в этот подшаг. Это та же цифровая роскошь, что в мире тактов.

ЧТО ЗДЕСЬ НЕ МЕНЯЕТСЯ. Дальше вентиля -- ни строчки. Те же уравнения,
те же постоянные, тот же порядок, тот же расход случайных чисел.

ТОЖДЕСТВО ПРИ ПОЛНОМ БЮДЖЕТЕ. При budget = N и дележе "поровну" каждый
нейрон получает ровно 1.0 такта за шаг, интегрирует ровно раз, и прогон
обязан совпасть с free_run_snapshots ПОБИТОВО. Это проверяется, а не
предполагается: без такой проверки всякое расхождение дальше можно
списать на дефицит, а можно на мою ошибку в переписанном цикле.

ПОДПИТКА -- ОБЩАЯ, А НЕ АДРЕСНАЯ. Такты идут тому, КОГО СЛЫШНО: доля
нейрона пропорциональна тому, сколько веса он доставил другим своими
спайками за последнее время. Это правило мира тактов, переведённое
дословно; ткани оно ничего не обещает и ни к чему не поощряет.

НЕСКОЛЬКО ТАКТОВ -- НЕСКОЛЬКО ПОДШАГОВ. Кто заработал больше такта,
интегрирует несколько раз за шаг, то есть идёт БЫСТРЕЕ. Это и есть
время как выбор, ради чего мир тактов затевался.
"""
import numpy as np

MAX_TAKE = 4          # потолок подшагов за шаг: иначе один нейрон съест всё
TAU_HEARD = 0.05      # с, память о том, насколько тебя было слышно


def free_run_tick(
    developed,
    snapshot_times=(2.0, 3.0, 4.0, 5.0, 6.0),
    pre_run=2.0,
    seed=5000,
    budget=None,          # тактов на шаг; None -- по числу нейронов
    earn="поровну",       # 'поровну' | 'слышно' | 'жребий'
    base=0.0,             # базовая доля при делёжке
    max_take=MAX_TAKE,
    touch=None,           # список образов: массивы номеров нейронов
    touch_amp=0.0,        # величина добавки к току; 0 -- воздействия нет
    touch_period=0.2,     # как часто приходит касание, с
    touch_len=1,          # сколько шагов длится
    track=False,
):
    """Свободный прогон развитой ткани под бюджетом тактов.

    При budget=N, earn='поровну', base=0 обязан совпасть с
    sim_core.free_run_snapshots побитово.
    """
    rng = np.random.default_rng(seed)

    dt = developed["dt"]
    W = developed["weights"]
    N = W.shape[0]
    if budget is None:
        budget = float(N)

    state = developed["state"]
    v = state["v"].copy()
    syn = state["syn"].copy()
    adaptation = state["adaptation"].copy()
    refractory = state["refractory"].copy()
    threshold = state["threshold"].copy()
    drive = state["drive"].copy()

    wout = W.sum(axis=0)            # сколько веса нейрон доставляет, когда стреляет
    credit = np.zeros(N)
    heard = np.zeros(N)

    total_duration = pre_run + max(snapshot_times)
    steps = int(round(total_duration / dt)) + 1
    snapshot_steps = {int(round((pre_run + t) / dt)): t for t in snapshot_times}
    stim_per = max(1, int(round(touch_period / dt)))
    snapshots = []

    log = {"spikes": np.zeros(steps, dtype=np.int32),
           "takes": np.zeros(steps, dtype=np.int32),
           "fired_by": np.zeros(N, dtype=np.int64),
           "steps_by": np.zeros(N, dtype=np.int64)} if track else None

    for step in range(steps):
        syn *= np.exp(-dt / 0.010)
        adaptation *= np.exp(-dt / 0.200)
        refractory = np.maximum(0.0, refractory - dt)

        # --- начисление тактов ---
        if earn == "поровну":
            credit += budget / N
        else:
            if earn == "слышно":
                w = heard + base
            elif earn == "жребий":
                w = rng.random(N) + base
            else:
                raise ValueError(f"нет правила начисления: {earn}")
            s = w.sum()
            credit += budget * (w / s) if s > 0 else budget / N

        take = np.floor(credit).astype(np.int64)
        np.minimum(take, max_take, out=take)
        credit -= take

        # --- подшаги: кто заработал больше, идёт быстрее ---
        for k in range(int(take.max()) if take.size else 0):
            paid = take > k
            available = (refractory == 0.0) & paid

            current = drive + syn - adaptation
            # ПОДПИТКА: мир трогает ткань. Приходит по тем же правилам,
            # что в simulate() -- добавка к току, раз в touch_period, на
            # touch_len шагов, образы по очереди. При touch_amp = 0 не
            # добавляется ни одного числа и не тратится ни одного
            # случайного, поэтому тождество при полном бюджете цело.
            if touch is not None and touch_amp and k == 0:
                if (step % stim_per) < touch_len:
                    current[touch[(step // stim_per) % len(touch)]] += touch_amp
            noise = 0.012 * rng.standard_normal(N)

            dv = (dt / 0.020) * (-v + current)
            v[available] += (dv + noise)[available]

            fired = available & (v >= threshold)

            if np.any(fired):
                syn += W[:, fired].sum(axis=1)
                heard[fired] += wout[fired]

            v[fired] = 0.0
            refractory[fired] = 0.005
            adaptation[fired] += 0.25

            if log is not None:
                log["spikes"][step] += int(fired.sum())
                log["takes"][step] += int(available.sum())
                log["fired_by"] += fired
                log["steps_by"] += available

        heard *= np.exp(-dt / TAU_HEARD)

        if step in snapshot_steps:
            snapshots.append({
                "t": snapshot_steps[step],
                "state": {
                    "v": v.copy(), "syn": syn.copy(),
                    "adaptation": adaptation.copy(),
                    "refractory": refractory.copy(),
                    "threshold": threshold.copy(), "drive": drive.copy(),
                },
            })

    snapshots.sort(key=lambda s: s["t"])
    return (snapshots, log) if track else snapshots

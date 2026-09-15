import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def simulate(
    seed=42,
    plasticity=True,
    transmission=True,
    homeostasis=True,
    gradual_growth=True,
    positions=None,
    contact_radius=0.25,
    drive=None,
    differentiation=0.0,
    state_affinity=0.0,
    coupling=1.0,
):
    """positions -- готовые координаты (N,2) вместо случайных; None -- как прежде.

    Жеребьёвка случайных позиций выполняется В ЛЮБОМ СЛУЧАЕ, даже когда
    координаты заданы снаружи: иначе сдвинулся бы весь последующий поток
    случайных чисел (drive и далее), и сравнение мерило бы не геометрию,
    а другой поток. При positions=None и contact_radius=0.25 поведение
    побитово прежнее -- проверяется тестом.

    contact_radius -- радиус, в пределах которого возможен рост контакта.
    Вынесен в параметр, чтобы выравнивать ПЛОТНОСТЬ связей при сравнении
    разных расположений (ловушка №13: иначе сравнивалась бы плотность,
    а не организация).

    drive -- собственный ток узла. None -- как прежде, rng.uniform(1.10,
    1.25, N), то есть различие между узлами ВЫДАНО готовым. Скаляр или
    массив позволяет сделать узлы одинаковыми и проверить, возникает ли
    различие само (пункт 2 дорожной карты, требование Ф10). Жеребьёвка,
    как и для позиций, выполняется в любом случае: иначе сдвинулся бы
    весь последующий поток случайных чисел.

    differentiation -- скорость соперничества соседей за состояние (0 --
    механизм выключен). Каждый узел несёт величину s, у ВСЕХ одинаковую
    в начале (ровно 0.5). Правило локальное: собственная активность
    поднимает s, среднее s соседей по контактам опускает. Множитель
    s(1-s) делает края устойчивыми, а середину -- нет, поэтому узлы
    расходятся, а не сползают к общему значению.

    При state_affinity = 0 величина s НИ НА ЧТО НЕ ВЛИЯЕТ, и остальной
    прогон побитово тот же, что при выключенной дифференцировке. Это
    сделано нарочно: тогда картина состояний принадлежит самому механизму,
    а не его побочным следствиям (так проверялись v0.16 и v0.17).

    state_affinity -- насколько РАЗЛИЧИЕ состояний мешает связи вырасти:
        вероятность роста контакта = 0.15 * (1 - state_affinity*|s_i-s_j|)
    При 0 -- прежнее поведение (проверяется тождеством). При 1 узлы с
    противоположными состояниями не связываются вовсе, с одинаковыми --
    как прежде. Это и есть кандидат на границу (пункт 3 карты, Ф11):
    структурный разрыв там, где области состояний сходятся.

    ВНИМАНИЕ: правило режет часть контактов, поэтому средняя степень
    падает. Любое сравнение обязано выравнивать плотность по ЧИСЛУ
    СОСЕДЕЙ -- урок №30. Число случайных величин не меняется.

    coupling -- множитель СИЛЫ СВЯЗИ при передаче: syn += coupling * ...
    При 1.0 поведение прежнее (проверяется тождеством).

    ПЕРВАЯ РЕДАКЦИЯ МАСШТАБИРОВАЛА ПОТОЛОК ВЕСА (0.08) И БЮДЖЕТ ВХОДА
    (0.6) И НЕ ДЕЙСТВОВАЛА ВОВСЕ: эти пределы не связывают. Вес нового
    контакта 0.015, при 12 соседях суммарный вход около 0.18 -- ни
    потолок, ни бюджет не достигаются, и умножение их ничего не меняло
    (все меры совпадали до знака при силе от 1 до 16). Масштаб связи
    задают начальный вес и шаг пластичности, а не ограничения сверху.
    Ручка перенесена туда, где связь входит в динамику.
    """
    rng = np.random.default_rng(seed)

    N = 80
    dt = 0.001
    duration = 12.0
    steps = int(duration / dt)

    drawn = rng.uniform(0, 1, size=(N, 2))          # жеребьёвка не пропускается
    positions = drawn if positions is None else np.asarray(positions, dtype=float)
    if positions.shape != (N, 2):
        raise ValueError(f"positions должен быть ({N}, 2), получено {positions.shape}")
    distance = np.linalg.norm(
        positions[:, None, :] - positions[None, :, :],
        axis=2,
    )

    birth = (
        (np.arange(N) // 8) * 0.5
        if gradual_growth
        else np.zeros(N)
    )

    v = np.zeros(N)
    syn = np.zeros(N)
    adaptation = np.zeros(N)
    refractory = np.zeros(N)

    threshold = np.ones(N)
    rate = np.zeros(N)
    trace = np.zeros(N)

    W = np.zeros((N, N))
    contacts = np.zeros((N, N), dtype=bool)
    state_s = np.full(N, 0.5)          # состояние узла; у всех одинаково в начале
    drawn_drive = rng.uniform(1.10, 1.25, N)       # жеребьёвка не пропускается
    drive = drawn_drive if drive is None else np.broadcast_to(
        np.asarray(drive, dtype=float), (N,)).copy()

    spikes = np.zeros((steps, N), dtype=bool)
    logs = []
    history = []   # (время, контактов, доля у краёв s, средний syn, syn/drive)

    for step in range(steps):
        t = step * dt

        alive = t >= birth
        age = np.maximum(0.0, t - birth)
        maturity = np.clip(age / 1.0, 0.0, 1.0)
        ready = alive & (maturity >= 0.6)

        # Медленная структурная динамика.
        if step % 250 == 0:
            eligible = (
                ready[:, None]
                & ready[None, :]
                & (distance < contact_radius)
                & ~contacts
            )
            np.fill_diagonal(eligible, False)

            # Генерируем одинаковое число случайных величин
            # во всех вариантах эксперимента.
            draws = rng.random((N, N))
            if state_affinity:
                # различие состояний мешает связи вырасти
                p = 0.15 * (1.0 - state_affinity
                            * np.abs(state_s[:, None] - state_s[None, :]))
                new = eligible & (draws < np.maximum(p, 0.0))
            else:
                new = eligible & (draws < 0.15)

            contacts |= new
            W[new] = 0.015

        # Затухание внутренних переменных.
        syn *= np.exp(-dt / 0.010)
        adaptation *= np.exp(-dt / 0.200)
        refractory = np.maximum(0.0, refractory - dt)
        trace *= np.exp(-dt / 0.020)
        rate *= np.exp(-dt / 1.0)

        available = alive & (refractory == 0.0)

        current = maturity * drive + syn - adaptation
        noise = 0.012 * rng.standard_normal(N)

        dv = (dt / 0.020) * (-v + current)
        v[available] += (dv + noise)[available]

        fired = available & (v >= threshold)
        spikes[step] = fired

        # Пластичность существующих контактов.
        if plasticity and np.any(fired):
            eta = 0.0002

            W[fired, :] += (
                eta * trace[None, :] * contacts[fired, :]
            )
            W[:, fired] -= (
                1.05 * eta * trace[:, None] * contacts[:, fired]
            )

        np.clip(W, 0.0, 0.08, out=W)

        # Инженерное ограничение входного усиления.
        total_input = W.sum(axis=1)
        W *= np.minimum(
            1.0, 0.6 / np.maximum(total_input, 1e-12)
        )[:, None]

        if transmission and np.any(fired):
            syn += coupling * W[:, fired].sum(axis=1)

        v[fired] = 0.0
        refractory[fired] = 0.005
        adaptation[fired] += 0.25
        trace[fired] += 1.0
        rate[fired] += 1.0

        if homeostasis:
            target_rate = 5.0 * maturity
            threshold[ready] += (
                dt * 0.02
                * (rate[ready] - target_rate[ready])
            )

        np.clip(threshold, 0.7, 1.5, out=threshold)

        # Соперничество соседей за состояние. Обновляется редко: это
        # медленная величина рядом с электрической динамикой.
        # Случайных чисел не тратит, на остальной прогон не влияет.
        if differentiation and step % 50 == 0 and ready.any():
            nb = contacts | contacts.T
            deg = nb.sum(axis=1)
            pressure = np.where(
                deg > 0,
                (nb * state_s[None, :]).sum(axis=1) / np.maximum(deg, 1),
                0.5,                    # без соседей давления нет
            )
            r_mean = rate[ready].mean()
            own = (rate / r_mean - 1.0) if r_mean > 0 else np.zeros(N)
            ds = (differentiation * state_s * (1.0 - state_s)
                  * (1.0 * own - 4.0 * (pressure - 0.5)))
            state_s[ready] += ds[ready]
            np.clip(state_s, 0.0, 1.0, out=state_s)

        if step % 100 == 0:
            history.append([t, float(contacts.sum()),
                            float(np.mean((state_s < 0.1) | (state_s > 0.9))),
                            float(np.mean(syn)),
                            float(np.mean(syn / np.maximum(drive, 1e-12)))])
            logs.append([
                t,
                rate[ready].mean() if ready.any() else 0.0,
                threshold[ready].mean() if ready.any() else 1.0,
                W[contacts].mean() if contacts.any() else 0.0,
            ])

    # Измеряем конец эксперимента, когда все узлы созрели.
    tail = spikes[-int(2.0 / dt):]
    rates = tail.sum(axis=0) / 2.0

    # Считаем импульсы всей сети в окнах по 20 мс.
    bin_steps = int(0.020 / dt)
    counts = tail.reshape(-1, bin_steps, N).sum(axis=(1, 2))

    # Это вариабельность популяционной активности,
    # не самостоятельное доказательство синхронизации.
    population_cv = (
        counts.std() / counts.mean()
        if counts.mean() > 0
        else np.nan
    )

    metrics = {
        "rate_hz": rates.mean(),
        "silent_fraction": np.mean(rates == 0),
        "population_cv": population_cv,
        "weight_change": (
            np.mean(np.abs(W[contacts] - 0.015))
            if contacts.any() else 0.0
        ),
    }

    return {
        "spikes": spikes,
        "logs": np.array(logs),
        "weights": W.copy(),
        "contacts": contacts.copy(),
        "state_s": state_s.copy(),
        "positions": positions.copy(),
        "history": np.array(history),
        "metrics": metrics,
        "dt": dt,

        # Состояние, необходимое для точного продолжения.
        "state": {
            "v": v.copy(),
            "syn": syn.copy(),
            "adaptation": adaptation.copy(),
            "refractory": refractory.copy(),
            "threshold": threshold.copy(),
            "drive": drive.copy(),
        },
    }


def simulate_with_snapshots(seed=42, n_snapshots=5, positions=None,
                            contact_radius=0.25):
    """
    Идентична simulate() (со всеми механизмами включёнными),
    но дополнительно сохраняет полные снимки состояния сети
    в n_snapshots равноотстоящих моментах времени свободного
    прогона. Моменты выбираются по фиксированной сетке времени,
    без отбора по близости какого-либо узла к порогу.

    positions и contact_radius -- как в simulate(): позиции можно задать
    снаружи, радиус роста контакта вынесен, чтобы выравнивать плотность
    связей. При значениях по умолчанию поведение побитово прежнее.
    Жеребьёвка случайных позиций выполняется в любом случае, иначе
    сдвинулся бы весь последующий поток случайных чисел.
    """
    rng = np.random.default_rng(seed)

    N = 80
    dt = 0.001
    duration = 12.0
    steps = int(duration / dt)

    drawn = rng.uniform(0, 1, size=(N, 2))          # жеребьёвка не пропускается
    positions = drawn if positions is None else np.asarray(positions, dtype=float)
    distance = np.linalg.norm(
        positions[:, None, :] - positions[None, :, :],
        axis=2,
    )

    birth = (np.arange(N) // 8) * 0.5

    v = np.zeros(N)
    syn = np.zeros(N)
    adaptation = np.zeros(N)
    refractory = np.zeros(N)

    threshold = np.ones(N)
    rate = np.zeros(N)
    trace = np.zeros(N)

    W = np.zeros((N, N))
    contacts = np.zeros((N, N), dtype=bool)
    drive = rng.uniform(1.10, 1.25, N)

    spikes = np.zeros((steps, N), dtype=bool)

    # Равноотстоящие моменты снимков в последней трети прогона,
    # когда все узлы уже созрели (созревание завершается к t=4.5с
    # при birth = (arange(80)//8)*0.5, maturity window = 1.0с,
    # т.е. последний узел готов к t=(9*0.5)+0.6=5.1с).
    # Берём равные интервалы во второй половине прогона (6.0-12.0с).
    snapshot_times = np.linspace(6.0, 11.0, n_snapshots)
    snapshot_steps = set(int(round(t / dt)) for t in snapshot_times)
    snapshots = []

    for step in range(steps):
        t = step * dt

        alive = t >= birth
        age = np.maximum(0.0, t - birth)
        maturity = np.clip(age / 1.0, 0.0, 1.0)
        ready = alive & (maturity >= 0.6)

        if step % 250 == 0:
            eligible = (
                ready[:, None]
                & ready[None, :]
                & (distance < contact_radius)
                & ~contacts
            )
            np.fill_diagonal(eligible, False)

            draws = rng.random((N, N))
            new = eligible & (draws < 0.15)

            contacts |= new
            W[new] = 0.015

        syn *= np.exp(-dt / 0.010)
        adaptation *= np.exp(-dt / 0.200)
        refractory = np.maximum(0.0, refractory - dt)
        trace *= np.exp(-dt / 0.020)
        rate *= np.exp(-dt / 1.0)

        available = alive & (refractory == 0.0)

        current = maturity * drive + syn - adaptation
        noise = 0.012 * rng.standard_normal(N)

        dv = (dt / 0.020) * (-v + current)
        v[available] += (dv + noise)[available]

        fired = available & (v >= threshold)
        spikes[step] = fired

        if np.any(fired):
            eta = 0.0002

            W[fired, :] += (
                eta * trace[None, :] * contacts[fired, :]
            )
            W[:, fired] -= (
                1.05 * eta * trace[:, None] * contacts[:, fired]
            )

        np.clip(W, 0.0, 0.08, out=W)

        total_input = W.sum(axis=1)
        W *= np.minimum(
            1.0, 0.6 / np.maximum(total_input, 1e-12)
        )[:, None]

        if np.any(fired):
            syn += W[:, fired].sum(axis=1)

        v[fired] = 0.0
        refractory[fired] = 0.005
        adaptation[fired] += 0.25
        trace[fired] += 1.0
        rate[fired] += 1.0

        target_rate = 5.0 * maturity
        threshold[ready] += (
            dt * 0.02
            * (rate[ready] - target_rate[ready])
        )

        np.clip(threshold, 0.7, 1.5, out=threshold)

        if step in snapshot_steps:
            snapshots.append({
                "t": t,
                "weights": W.copy(),
                "contacts": contacts.copy(),
                "dt": dt,
                "state": {
                    "v": v.copy(),
                    "syn": syn.copy(),
                    "adaptation": adaptation.copy(),
                    "refractory": refractory.copy(),
                    "threshold": threshold.copy(),
                    "drive": drive.copy(),
                },
            })

    # Снимки должны идти в порядке возрастания времени.
    snapshots.sort(key=lambda s: s["t"])

    assert len(snapshots) == n_snapshots, (
        f"Ожидалось {n_snapshots} снимков, получено {len(snapshots)}"
    )

    return snapshots


def free_run_snapshots(
    developed,
    snapshot_times=(2.0, 3.0, 4.0, 5.0, 6.0),
    pre_run=2.0,
    seed=5000,
):
    """
    Берёт УЖЕ развитую и структурно зафиксированную сеть
    (результат simulate()) и запускает только электрическую
    динамику поверх её весов и контактов:
      - рост выключен (сеть уже полностью сформирована);
      - пластичность выключена;
      - гомеостаз (настройка порога) выключен;
      - структура (contacts, W) постоянна;
      - v, syn, adaptation, refractory эволюционируют свободно
        под собственным шумом и текущими весами.

    Сохраняет снимки динамических переменных на заданных
    отметках времени ПОСЛЕ pre_run секунд разгона (чтобы не
    стартовать сразу с состояния, унаследованного от simulate()).
    """
    rng = np.random.default_rng(seed)

    dt = developed["dt"]
    W = developed["weights"]
    contacts = developed["contacts"]
    N = W.shape[0]

    state = developed["state"]
    v = state["v"].copy()
    syn = state["syn"].copy()
    adaptation = state["adaptation"].copy()
    refractory = state["refractory"].copy()
    threshold = state["threshold"].copy()
    drive = state["drive"].copy()

    total_duration = pre_run + max(snapshot_times)
    steps = int(round(total_duration / dt)) + 1

    snapshot_steps = {
        int(round((pre_run + t) / dt)): t for t in snapshot_times
    }

    snapshots = []

    for step in range(steps):
        syn *= np.exp(-dt / 0.010)
        adaptation *= np.exp(-dt / 0.200)
        refractory = np.maximum(0.0, refractory - dt)

        available = refractory == 0.0

        current = drive + syn - adaptation
        noise = 0.012 * rng.standard_normal(N)

        dv = (dt / 0.020) * (-v + current)
        v[available] += (dv + noise)[available]

        fired = available & (v >= threshold)

        if np.any(fired):
            syn += W[:, fired].sum(axis=1)

        v[fired] = 0.0
        refractory[fired] = 0.005
        adaptation[fired] += 0.25

        # Веса, контакты, threshold, drive не меняются в этом режиме.

        if step in snapshot_steps:
            snapshots.append({
                "t": snapshot_steps[step],
                "state": {
                    "v": v.copy(),
                    "syn": syn.copy(),
                    "adaptation": adaptation.copy(),
                    "refractory": refractory.copy(),
                    "threshold": threshold.copy(),
                    "drive": drive.copy(),
                },
            })

    snapshots.sort(key=lambda s: s["t"])

    assert len(snapshots) == len(snapshot_times), (
        f"Ожидалось {len(snapshot_times)} снимков, "
        f"получено {len(snapshots)}"
    )

    return snapshots


def probe(
    trained,
    noise,
    stimulated_nodes,
    transmission=True,
    stimulus=False,
    coupling=1.0,
):
    """coupling -- множитель силы связи, тот же, что в simulate().

    У probe СВОЯ копия строки передачи, и первая правка его не затронула:
    сила влияла на развитие сети, а сама проба всегда шла при 1.0.
    Обнаружено по тому, что при силе 256 отклик на импульс в молчащей
    сети оставался ровно нулевым -- чего быть не может.
    """
    dt = trained["dt"]
    W = trained["weights"]
    state = trained["state"]

    # У каждого запуска собственные копии переменных.
    v = state["v"].copy()
    adaptation = state["adaptation"].copy()
    refractory = state["refractory"].copy()
    threshold = state["threshold"].copy()
    drive = state["drive"].copy()

    # Убираем остаточный синаптический ток во всех вариантах.
    # Затем даём каждому варианту 0.5 с на переходную динамику.
    syn = np.zeros_like(v)

    steps, N = noise.shape
    pulse_step = int(0.5 / dt)

    spikes = np.zeros((steps, N), dtype=bool)

    for step in range(steps):
        syn *= np.exp(-dt / 0.010)
        adaptation *= np.exp(-dt / 0.200)
        refractory = np.maximum(0.0, refractory - dt)

        available = refractory == 0.0

        # Все узлы здесь уже зрелые.
        current = drive + syn - adaptation
        dv = (dt / 0.020) * (-v + current)

        v[available] += (dv + noise[step])[available]

        fired = available & (v >= threshold)

        if stimulus and step == pulse_step:
            # Задаём известное событие на выходе пяти узлов.
            # Для этого вмешательства рефрактерность обходим.
            fired[stimulated_nodes] = True

        spikes[step] = fired

        if transmission and np.any(fired):
            syn += coupling * W[:, fired].sum(axis=1)

        v[fired] = 0.0
        refractory[fired] = 0.005
        adaptation[fired] += 0.25

    return spikes


def trace_probe_preserve_syn(
    network, source, noise, stimulus, transmission=True
):
    """
    Вариант trace_probe(): копирует syn из сохранённого состояния
    вместо обнуления. Нужен, когда переносимое состояние — снимок
    свободного прогона (free_run_snapshots), а не выход probe()/
    simulate(), где остаточный ток намеренно убирался.
    """
    dt = network["dt"]
    W = network["weights"]
    state = network["state"]

    v = state["v"].copy()
    adaptation = state["adaptation"].copy()
    refractory = state["refractory"].copy()
    threshold = state["threshold"].copy()
    drive = state["drive"].copy()
    syn = state["syn"].copy()

    steps, N = noise.shape

    voltage = np.zeros((steps, N))
    synaptic = np.zeros((steps, N))
    spikes = np.zeros((steps, N), dtype=bool)

    for step in range(steps):
        syn *= np.exp(-dt / 0.010)
        adaptation *= np.exp(-dt / 0.200)
        refractory = np.maximum(0.0, refractory - dt)

        available = refractory == 0.0

        current = drive + syn - adaptation
        dv = (dt / 0.020) * (-v + current)
        v[available] += (dv + noise[step])[available]

        fired = available & (v >= threshold)

        if stimulus and step == 0:
            fired[source] = True

        if transmission and np.any(fired):
            syn += W[:, fired].sum(axis=1)

        v[fired] = 0.0
        refractory[fired] = 0.005
        adaptation[fired] += 0.25

        voltage[step] = v
        synaptic[step] = syn
        spikes[step] = fired

    return {
        "v": voltage,
        "syn": synaptic,
        "spikes": spikes,
    }


def trace_probe_dt(
    network, source, noise, stimulus, dt, transmission=True
):
    """
    Как trace_probe_preserve_syn(), но:
      - dt передаётся явно (не берётся из network), чтобы можно
        было проверить одну и ту же обученную сеть при разных
        шагах интегрирования;
      - стимул применяется В НАЧАЛЬНЫЙ МОМЕНТ, до первого
        интегрирования потенциала на этом шаге -- то есть до
        обновления v, а не после него, как раньше. Это делает
        физический момент вмешательства (t=0) одинаковым
        независимо от dt.
      - веса/структура/state берутся из network как обычно.
    """
    W = network["weights"]
    state = network["state"]

    v = state["v"].copy()
    adaptation = state["adaptation"].copy()
    refractory = state["refractory"].copy()
    threshold = state["threshold"].copy()
    drive = state["drive"].copy()
    syn = state["syn"].copy()

    steps, N = noise.shape

    voltage = np.zeros((steps, N))
    synaptic = np.zeros((steps, N))
    spikes = np.zeros((steps, N), dtype=bool)

    for step in range(steps):
        syn *= np.exp(-dt / 0.010)
        adaptation *= np.exp(-dt / 0.200)
        refractory = np.maximum(0.0, refractory - dt)

        available = refractory == 0.0

        current = drive + syn - adaptation
        dv = (dt / 0.020) * (-v + current)
        v[available] += (dv + noise[step])[available]

        fired = available & (v >= threshold)

        # Стимул задаётся ДО интегрирования на step==0, то есть
        # эффективно в момент t=0, независимо от величины dt.
        if stimulus and step == 0:
            fired[source] = True

        if transmission and np.any(fired):
            syn += W[:, fired].sum(axis=1)

        v[fired] = 0.0
        refractory[fired] = 0.005
        adaptation[fired] += 0.25

        voltage[step] = v
        synaptic[step] = syn
        spikes[step] = fired

    return {
        "v": voltage,
        "syn": synaptic,
        "spikes": spikes,
    }


def generate_linked_noise(fine_dt, coarse_dts, duration, N, seed):
    """
    Генерирует шум на самой мелкой сетке fine_dt и суммирует его
    блоками для получения согласованных реализаций на более
    крупных шагах coarse_dts (каждый должен быть кратен fine_dt).

    Масштаб мелких приращений сохраняет тот же физический смысл,
    что и 0.012 * sqrt(dt/0.001) при dt=fine_dt.

    Возвращает словарь {dt_value: noise_array}.
    """
    rng = np.random.default_rng(seed)

    fine_steps = int(round(duration / fine_dt))
    fine_noise = (
        0.012
        * np.sqrt(fine_dt / 0.001)
        * rng.standard_normal((fine_steps, N))
    )

    result = {}
    for dt in coarse_dts:
        ratio = dt / fine_dt
        ratio_int = int(round(ratio))
        assert abs(ratio - ratio_int) < 1e-9, (
            f"dt={dt} не кратно fine_dt={fine_dt}"
        )

        coarse_steps = fine_steps // ratio_int
        usable = coarse_steps * ratio_int

        result[dt] = (
            fine_noise[:usable]
            .reshape(coarse_steps, ratio_int, N)
            .sum(axis=1)
        )

    return result



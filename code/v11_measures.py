"""v0.11 фаза 1: три меры полезности.

ВАЖНО: все три считаются на ОДНОЙ И ТОЙ ЖЕ пробе -- v05_functional.py::
probe (одиночный принудительный импульс при t=0, ДО первого шага окна).
Второй путь обработки импульса НЕ создаётся (ловушка №17): внутри окна
принудительных импульсов нет, поэтому коллизия естественного и
принудительного импульса на одной отметке невозможна по построению.

Меры методологически разнородны и опираются на разные свойства растра:
  U1 -- латентность      : центральная тенденция времени отклика
  U2 -- декодируемость   : разделимость классов линейным правилом
  U3 -- надёжность       : РАЗБРОС отклика по шумам (не центр)
U1 и U3 не имеют общей статистики (среднее против дисперсии); U2 не
использует ни латентность, ни дисперсию.
"""
import numpy as np

CENSORED = -1  # импульса в группе-цели не было за окно


def first_spike_latency(spikes, observe_nodes):
    """Индекс первого шага (=мс при dt=1мс), на котором сработал хоть
    один узел группы-цели. CENSORED, если импульса не было."""
    any_obs = spikes[:, observe_nodes].any(axis=1)
    idx = np.flatnonzero(any_obs)
    return int(idx[0]) if idx.size else CENSORED


def latency_paired(baseline_spikes, stimulated_spikes, observe_nodes):
    """Парная латентность: stimulated минус baseline. Контролирует
    спонтанную активность. Возвращает (значение, ok) -- ok=False, если
    хотя бы одна из двух латентностей цензурирована."""
    lb = first_spike_latency(baseline_spikes, observe_nodes)
    ls = first_spike_latency(stimulated_spikes, observe_nodes)
    if lb == CENSORED or ls == CENSORED:
        return np.nan, False
    return float(ls - lb), True


def crossed_contrast(m_AB_ab, m_BA_ab, m_BA_ba, m_AB_ba, lower_is_better):
    """Перекрёстная симметричная форма -- та же, что у структурного C
    в v0.8:
      m_X_yz = мера на ветви X при направлении yz
      ab = стимул A, смотрим B;  ba = стимул B, смотрим A
    Совпадающая по порядку ветвь: AB на направлении ab, BA на ba.
    Возвращает (U, U_A, U_B); U>0 == совпадающая ветвь ЛУЧШЕ.
    """
    sign = 1.0 if lower_is_better else -1.0
    U_A = sign * (m_BA_ab - m_AB_ab)   # A->B: несовпадающая минус совпадающая
    U_B = sign * (m_AB_ba - m_BA_ba)   # B->A: несовпадающая минус совпадающая
    return 0.5 * (U_A + U_B), U_A, U_B


def response_reliability(spike_list, observe_nodes):
    """U3: НАДЁЖНОСТЬ отклика = разброс растра группы-цели по тестовым
    шумам. Считается как средняя попарная доля несовпадающих отметок
    (расстояние Хэмминга, нормированное). МЕНЬШЕ = надёжнее.
    Не использует ни латентность, ни счёт импульсов."""
    mats = [s[:, observe_nodes] for s in spike_list]
    n = len(mats)
    if n < 2:
        raise ValueError("надёжность требует >=2 реализаций шума")
    dists = [float((mats[i] != mats[j]).mean())
             for i in range(n) for j in range(i + 1, n)]
    return float(np.mean(dists))


def bin_raster(spikes, bin_ms=5, dt_ms=1):
    """Бинирование растра для признаков декодера."""
    bin_steps = int(round(bin_ms / dt_ms))
    n_bins = spikes.shape[0] // bin_steps
    s = spikes[:n_bins * bin_steps]
    return s.reshape(n_bins, bin_steps, s.shape[1]).sum(axis=1)


def linear_decoder_cv(X, y, groups):
    """U2: ЛИНЕЙНЫЙ декодер (least-squares на центрированных признаках)
    с перекрёстной проверкой leave-one-group-out. groups -- номер
    тестового шума: обучаемся на одних шумах, проверяем на ДРУГИХ,
    поэтому доля правильных ответов не может быть получена заучиванием
    конкретной реализации шума.

    Реализация намеренно простейшая (без sklearn): псевдообратная
    матрица, порог 0. Сложный классификатор способен выучить артефакт
    и потребовал бы отдельного обоснования.
    Возвращает (доля правильных, число проверок).
    """
    X = np.asarray(X, dtype=float)
    y = np.asarray(y, dtype=float)   # метки -1/+1
    groups = np.asarray(groups)

    correct = 0
    total = 0
    for g in np.unique(groups):
        tr = groups != g
        te = groups == g
        if tr.sum() == 0 or te.sum() == 0:
            continue
        mu = X[tr].mean(axis=0)
        Xtr = X[tr] - mu
        Xte = X[te] - mu
        # least squares с добавленным свободным членом
        A = np.hstack([Xtr, np.ones((Xtr.shape[0], 1))])
        w, *_ = np.linalg.lstsq(A, y[tr], rcond=None)
        pred = np.sign(np.hstack([Xte, np.ones((Xte.shape[0], 1))]) @ w)
        pred[pred == 0] = 1.0
        correct += int((pred == y[te]).sum())
        total += int(te.sum())
    return (correct / total if total else np.nan), total

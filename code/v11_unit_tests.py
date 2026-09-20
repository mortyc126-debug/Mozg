"""v0.11: сконструированные unit-тесты мер.

Тесты СКОНСТРУИРОВАНЫ (не полагаются на случайное совпадение в
симуляции) -- урок ловушки №17. Знак перекрёстного контраста проверяется
явно на примере с заранее известным правильным ответом -- в проекте уже
был случай перевёрнутого знака (ловушка №7).
"""
import numpy as np

from v11_measures import (CENSORED, first_spike_latency, latency_paired,
                          crossed_contrast, response_reliability,
                          bin_raster, linear_decoder_cv)


def t1_latency_basic():
    sp = np.zeros((20, 4), dtype=bool)
    sp[7, 2] = True
    sp[12, 1] = True
    assert first_spike_latency(sp, [1, 2]) == 7, "первый импульс на шаге 7"
    assert first_spike_latency(sp, [1]) == 12, "только узел 1 -> шаг 12"
    assert first_spike_latency(sp, [0, 3]) == CENSORED, "нет импульсов -> цензура"
    print("  T1 латентность на сконструированном растре: OK")


def t2_latency_paired_censoring():
    b = np.zeros((10, 3), dtype=bool); b[5, 0] = True
    s = np.zeros((10, 3), dtype=bool); s[2, 0] = True
    val, ok = latency_paired(b, s, [0])
    assert ok and val == -3.0, f"stimulated раньше на 3 -> -3, получено {val}"
    empty = np.zeros((10, 3), dtype=bool)
    _, ok2 = latency_paired(empty, s, [0])
    assert not ok2, "цензура должна помечаться ok=False"
    print("  T2 парная латентность и цензурирование: OK")


def t3_crossed_sign_convention():
    """КРИТИЧНО. Совпадающая ветвь отвечает БЫСТРЕЕ (латентность меньше)
    => U должно быть ПОЛОЖИТЕЛЬНЫМ при lower_is_better=True."""
    # направление ab: совпадающая ветвь AB=10мс, несовпадающая BA=15мс
    # направление ba: совпадающая ветвь BA=10мс, несовпадающая AB=15мс
    U, U_A, U_B = crossed_contrast(m_AB_ab=10.0, m_BA_ab=15.0,
                                   m_BA_ba=10.0, m_AB_ba=15.0,
                                   lower_is_better=True)
    assert U_A == 5.0 and U_B == 5.0 and U == 5.0, (U, U_A, U_B)
    # обратный случай: совпадающая ветвь МЕДЛЕННЕЕ -> U отрицательно
    U2, _, _ = crossed_contrast(15.0, 10.0, 15.0, 10.0, lower_is_better=True)
    assert U2 == -5.0, U2
    # нет различия -> строго ноль
    U3, _, _ = crossed_contrast(12.0, 12.0, 12.0, 12.0, lower_is_better=True)
    assert U3 == 0.0, U3
    # lower_is_better=False переворачивает знак
    U4, _, _ = crossed_contrast(10.0, 15.0, 10.0, 15.0, lower_is_better=False)
    assert U4 == -5.0, U4
    print("  T3 знак перекрёстного контраста (4 случая): OK")


def t4_reliability():
    a = np.zeros((10, 2), dtype=bool); a[3, 0] = True
    # три ИДЕНТИЧНЫЕ реализации -> разброс строго ноль
    assert response_reliability([a, a.copy(), a.copy()], [0, 1]) == 0.0
    b = a.copy(); b[3, 0] = False; b[4, 0] = True   # отличие в 2 отметках
    r = response_reliability([a, b], [0, 1])
    assert abs(r - 2 / 20) < 1e-12, r
    # больше различий -> больше значение (меньше надёжность)
    c = a.copy(); c[7, 1] = True
    assert response_reliability([a, b, c], [0, 1]) > 0.0
    print("  T4 надёжность отклика: OK")


def t5_decoder_separable_and_chance():
    """Разделимые классы -> точность 1.0. Метки, не связанные с
    признаками -> около случайного уровня, НЕ 1.0 (иначе декодер
    подсматривает через перекрёстную проверку)."""
    rng = np.random.default_rng(7)
    n_per = 12
    X_sep = np.vstack([rng.normal(+3, 0.1, (n_per, 4)),
                       rng.normal(-3, 0.1, (n_per, 4))])
    y = np.array([1] * n_per + [-1] * n_per, dtype=float)
    groups = np.tile(np.arange(4), n_per // 2)
    acc, n = linear_decoder_cv(X_sep, y, groups)
    assert acc == 1.0 and n == 2 * n_per, (acc, n)

    X_noise = rng.normal(0, 1, (2 * n_per, 4))
    acc2, _ = linear_decoder_cv(X_noise, y, groups)
    assert acc2 < 0.95, f"на несвязанных данных точность {acc2} -- утечка"
    print(f"  T5 декодер: разделимые={acc:.2f}, несвязанные={acc2:.2f}: OK")


def t6_bin_raster():
    sp = np.zeros((20, 2), dtype=bool)
    sp[0, 0] = True; sp[4, 0] = True; sp[5, 1] = True
    b = bin_raster(sp, bin_ms=5, dt_ms=1)
    assert b.shape == (4, 2), b.shape
    assert b[0, 0] == 2 and b[1, 1] == 1 and b[0, 1] == 0
    print("  T6 бинирование растра: OK")


def main():
    print("=== v0.11 сконструированные unit-тесты ===")
    for t in (t1_latency_basic, t2_latency_paired_censoring,
              t3_crossed_sign_convention, t4_reliability,
              t5_decoder_separable_and_chance, t6_bin_raster):
        t()
    print("ВСЕ ТЕСТЫ ПРОЙДЕНЫ")


if __name__ == "__main__":
    main()

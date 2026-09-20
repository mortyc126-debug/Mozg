import os
import csv
import numpy as np

from analyze_recovery import load_and_analyze


MANIFEST = "/home/claude/sim/recovery_v02/manifest.csv"
DIR = "/home/claude/sim/recovery_v02"

FINE_DT = 0.005  # 5 мс разрешение для этого анализа
WINDOW_S = 0.400
STEP_S = 0.100
LAG_RANGE_MS = 40
PERIOD_SEARCH_MS = (60, 250)


def resample_to_5ms(spikes_bool, dt_original):
    """
    spikes_bool: [шаги, узлы] на исходном dt (0.001с).
    Возвращает популяционный счётчик (сумма по узлам) на
    разрешении FINE_DT=5мс.
    """
    width = int(round(FINE_DT / dt_original))
    steps, nodes = spikes_bool.shape
    usable = steps // width * width
    counts = spikes_bool[:usable].reshape(-1, width, nodes).sum(axis=(1, 2))
    return counts.astype(float)


def normalized_xcorr(a, b, max_lag_steps):
    """
    Нормированная кросс-корреляция a и b при лагах
    -max_lag_steps..+max_lag_steps (в отсчётах).

    Конвенция: положительный лаг означает, что событие в b
    происходит ПОЗЖЕ, чем то же событие в a (b запаздывает
    относительно a). Проверено на примере: a[30]=1, b[36]=1
    (событие в b на 6 шагов позже) должно дать best_lag=+6.

    Чтобы сопоставить a[t] с более ранним b[t-lag] (лаг>0
    означает "b нужно брать из прошлого, чтобы совпасть с
    текущим a", то есть b в реальном времени отстаёт):
        a[lag:] сравнивается с b[:-lag]  -- НЕВЕРНО (даёт
        обратный знак, см. историю правок).

    Верное сопоставление при лаге>0 (b отстаёт от a):
        a[:-lag] сравнивается с b[lag:]
    """
    n = len(a)
    lags = np.arange(-max_lag_steps, max_lag_steps + 1)
    correlations = np.full(len(lags), np.nan)

    for i, lag in enumerate(lags):
        if lag > 0:
            seg_a = a[:n - lag]
            seg_b = b[lag:]
        elif lag < 0:
            seg_a = a[-lag:]
            seg_b = b[:n + lag]
        else:
            seg_a = a
            seg_b = b

        if len(seg_a) < 5:
            continue

        sa = seg_a - seg_a.mean()
        sb = seg_b - seg_b.mean()
        denom = np.sqrt((sa**2).sum() * (sb**2).sum())

        if denom < 1e-12:
            continue

        correlations[i] = (sa * sb).sum() / denom

    return lags, correlations


def self_test_sign_convention():
    """
    Явный пример по индексам событий, без словесных рассуждений:
    a[30]=1 (событие в baseline на шаге 30),
    b[36]=1 (то же событие в stimulated на 6 шагов позже).
    По конвенции "плюс = stimulated запаздывает" ожидаем:
        best_lag(a, b) == +6
        best_lag(b, a) == -6
        best_lag(a, a) == 0
    """
    a = np.zeros(100)
    b = np.zeros(100)
    a[30] = 1.0
    b[36] = 1.0

    lags_ab, corr_ab = normalized_xcorr(a, b, max_lag_steps=15)
    best_ab = lags_ab[np.nanargmax(corr_ab)]

    lags_ba, corr_ba = normalized_xcorr(b, a, max_lag_steps=15)
    best_ba = lags_ba[np.nanargmax(corr_ba)]

    lags_aa, corr_aa = normalized_xcorr(a, a, max_lag_steps=15)
    best_aa = lags_aa[np.nanargmax(corr_aa)]

    print(
        f"best_lag(a,b) = {best_ab:+d} (ожидается +6)\n"
        f"best_lag(b,a) = {best_ba:+d} (ожидается -6)\n"
        f"best_lag(a,a) = {best_aa:+d} (ожидается 0)"
    )

    ok = (best_ab == 6) and (best_ba == -6) and (best_aa == 0)
    print("Самопроверка знака:", "СОВПАДАЕТ" if ok else "НЕ СОВПАДАЕТ -- знак неверен!")

    assert ok, "Конвенция знака лага не подтверждена самопроверкой."
    return ok


def estimate_period(signal, dt, search_range_ms=PERIOD_SEARCH_MS):
    """
    Автокорреляция сигнала с самим собой; ищем отчётливый
    повторный максимум в диапазоне search_range_ms.
    Возвращает (period_ms, is_well_defined).
    """
    n = len(signal)
    s = signal - signal.mean()
    if (s**2).sum() < 1e-12:
        return None, False

    autocorr = np.correlate(s, s, mode="full")
    autocorr = autocorr[n - 1:]
    autocorr /= autocorr[0]

    lag_min = int(round(search_range_ms[0] / (dt * 1000)))
    lag_max = min(int(round(search_range_ms[1] / (dt * 1000))), n - 1)

    if lag_max <= lag_min:
        return None, False

    window = autocorr[lag_min:lag_max + 1]
    if len(window) < 3:
        return None, False

    peak_idx = np.argmax(window)
    peak_value = window[peak_idx]

    at_boundary = peak_idx == 0 or peak_idx == len(window) - 1
    background = np.median(window)
    prominent = peak_value > background + 0.15

    is_well_defined = (not at_boundary) and prominent and peak_value > 0.2

    period_ms = (lag_min + peak_idx) * dt * 1000
    return period_ms, is_well_defined


def analyze_pair_quantitative(npz_path):
    d = np.load(npz_path)
    N = d["baseline_spikes"].shape[1]
    nodes = d["nodes"]
    other = np.ones(N, dtype=bool)
    other[nodes] = False
    dt = float(d["dt"])

    baseline_spikes = d["baseline_spikes"][:, other]
    stimulated_spikes = d["stimulated_spikes"][:, other]

    base_5ms = resample_to_5ms(baseline_spikes, dt)
    stim_5ms = resample_to_5ms(stimulated_spikes, dt)

    n_targets = other.sum()
    duration_s = baseline_spikes.shape[0] * dt

    base_rate = baseline_spikes.sum() / (n_targets * duration_s)
    stim_rate = stimulated_spikes.sum() / (n_targets * duration_s)

    base_period_ms, base_period_defined = estimate_period(base_5ms, FINE_DT)
    stim_period_ms, stim_period_defined = estimate_period(stim_5ms, FINE_DT)

    width_steps = int(round(WINDOW_S / FINE_DT))
    step_steps = int(round(STEP_S / FINE_DT))
    max_lag_steps = int(round(LAG_RANGE_MS / (FINE_DT * 1000)))

    n_fine = min(len(base_5ms), len(stim_5ms))

    window_results = []
    start = 0
    while start + width_steps <= n_fine:
        end = start + width_steps
        seg_base = base_5ms[start:end]
        seg_stim = stim_5ms[start:end]

        lags, corr = normalized_xcorr(seg_base, seg_stim, max_lag_steps)

        zero_idx = np.where(lags == 0)[0][0]
        sim_zero = corr[zero_idx]

        valid = ~np.isnan(corr)
        if valid.any():
            best_idx = np.nanargmax(corr)
            sim_max = corr[best_idx]
            best_lag_ms = lags[best_idx] * FINE_DT * 1000
        else:
            sim_max = np.nan
            best_lag_ms = np.nan

        ambiguous = False
        if valid.any():
            near_max = corr[valid] >= (sim_max - 0.03)
            if near_max.sum() > 3:
                ambiguous = True
            if abs(best_lag_ms) >= LAG_RANGE_MS - (FINE_DT * 1000):
                ambiguous = True
            if np.isnan(sim_max) or sim_max < 0.1:
                ambiguous = True
        else:
            ambiguous = True

        window_results.append({
            "start_s": start * FINE_DT,
            "sim_zero_lag": sim_zero,
            "sim_max": sim_max,
            "best_lag_ms": best_lag_ms,
            "ambiguous": ambiguous,
            "at_boundary": (
                not np.isnan(best_lag_ms)
                and abs(best_lag_ms) >= LAG_RANGE_MS - (FINE_DT * 1000)
            ),
        })

        start += step_steps

    return {
        "base_rate_hz": base_rate,
        "stim_rate_hz": stim_rate,
        "base_period_ms": base_period_ms if base_period_defined else None,
        "stim_period_ms": stim_period_ms if stim_period_defined else None,
        "windows": window_results,
        "n_ambiguous": sum(w["ambiguous"] for w in window_results),
        "n_windows": len(window_results),
    }


def main():
    print("=" * 70)
    print("САМОПРОВЕРКА ЗНАКА ЛАГА")
    print("=" * 70)
    ok = self_test_sign_convention()
    if not ok:
        raise RuntimeError("Самопроверка знака лага провалена -- останов.")

    print("\n" + "=" * 70)
    print("КОЛИЧЕСТВЕННЫЙ АНАЛИЗ ВСЕХ 36 ПАР (после исправления знака)")
    print("=" * 70)

    with open(MANIFEST, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    summary_rows = []

    for row in rows:
        path = os.path.join(DIR, row["filename"])
        d = np.load(path)
        meta = {
            "development_seed": int(d["development_seed"]),
            "gain": float(d["gain"]),
            "state_seed": int(d["state_seed"]),
            "test_seed": int(d["test_seed"]),
        }

        result = analyze_pair_quantitative(path)
        windows = result["windows"]

        all_lags = [w["best_lag_ms"] for w in windows]
        sims_zero = [w["sim_zero_lag"] for w in windows]
        sims_max = [w["sim_max"] for w in windows if not np.isnan(w["sim_max"])]

        n_ambiguous = sum(w["ambiguous"] for w in windows)
        n_boundary = sum(w["at_boundary"] for w in windows)

        first_three = [w["best_lag_ms"] for w in windows[:3] if not np.isnan(w["best_lag_ms"])]
        last_three = [w["best_lag_ms"] for w in windows[-3:] if not np.isnan(w["best_lag_ms"])]

        median_first = float(np.median(first_three)) if first_three else np.nan
        median_last = float(np.median(last_three)) if last_three else np.nan
        late_minus_early = (
            median_last - median_first
            if (not np.isnan(median_first) and not np.isnan(median_last))
            else np.nan
        )

        # Наклон линейной аппроксимации лага по времени (мс/с),
        # описательный, без доверительного интервала (окна
        # перекрываются -- не независимые наблюдения).
        valid_lag_mask = ~np.isnan(all_lags)
        starts = np.array([w["start_s"] for w in windows])
        lags_arr = np.array(all_lags)
        if valid_lag_mask.sum() >= 2:
            slope_ms_per_s = float(np.polyfit(
                starts[valid_lag_mask], lags_arr[valid_lag_mask], 1
            )[0])
        else:
            slope_ms_per_s = np.nan

        row_out = {
            **meta,
            "base_rate_hz": result["base_rate_hz"],
            "stim_rate_hz": result["stim_rate_hz"],
            "base_period_ms": result["base_period_ms"],
            "stim_period_ms": result["stim_period_ms"],
            "median_sim_zero_lag": float(np.median(sims_zero)) if sims_zero else np.nan,
            "median_sim_max": float(np.median(sims_max)) if sims_max else np.nan,
            "n_windows": result["n_windows"],
            "n_ambiguous": n_ambiguous,
            "n_boundary": n_boundary,
            "median_lag_first3_ms": median_first,
            "median_lag_last3_ms": median_last,
            "late_minus_early_ms": late_minus_early,
            "slope_ms_per_s": slope_ms_per_s,
            "lags_all_windows_ms": ";".join(
                f"{v:.1f}" if not np.isnan(v) else "nan" for v in all_lags
            ),
        }
        summary_rows.append(row_out)

        print(
            f"dev={meta['development_seed']}, gain={meta['gain']:.0f}, "
            f"state={meta['state_seed']}, test={meta['test_seed']}: "
            f"rate={result['base_rate_hz']:.1f}/{result['stim_rate_hz']:.1f}Гц, "
            f"period={result['base_period_ms']}/{result['stim_period_ms']}мс, "
            f"sim0={row_out['median_sim_zero_lag']:.3f}, "
            f"simMax={row_out['median_sim_max']:.3f}, "
            f"лаг(перв3/посл3)={median_first:+.1f}/{median_last:+.1f}мс, "
            f"Δ={late_minus_early:+.1f}мс, "
            f"наклон={slope_ms_per_s:+.1f}мс/с, "
            f"погран={n_boundary}/{result['n_windows']}"
        )

    out_csv = "/home/claude/sim/recovery_quantitative_summary.csv"
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(summary_rows[0].keys()))
        writer.writeheader()
        writer.writerows(summary_rows)
    print(f"\nСохранено: {out_csv}")

    return summary_rows


if __name__ == "__main__":
    main()

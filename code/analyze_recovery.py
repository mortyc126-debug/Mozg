import os
import csv
import numpy as np


def keep_long_runs(mask, minimum_steps):
    """Оставить только непрерывные True-участки нужной длины."""
    padded = np.r_[False, mask, False]
    changes = np.diff(padded.astype(int))

    starts = np.flatnonzero(changes == 1)
    ends = np.flatnonzero(changes == -1)

    result = np.zeros_like(mask, dtype=bool)

    for start, end in zip(starts, ends):
        if end - start >= minimum_steps:
            result[start:end] = True

    return result


def analyze_saved_pair(
    baseline_spikes,
    stimulated_spikes,
    baseline_traces,
    stimulated_traces,
    dt,
):
    """
    spikes: bool-массивы [время, наблюдаемый узел].
    traces: словари с одинаковыми ключами: v, margin, adaptation,
        syn_effective, refractory.
    Все массивы уже относятся к одной группе наблюдаемых узлов
    (стимулируемые узлы уже исключены вызывающим кодом).
    """
    b = np.asarray(baseline_spikes, dtype=bool)
    s = np.asarray(stimulated_spikes, dtype=bool)

    assert b.shape == s.shape
    assert b.ndim == 2
    assert baseline_traces.keys() == stimulated_traces.keys()

    steps, nodes = b.shape

    for key in baseline_traces:
        assert baseline_traces[key].shape == b.shape
        assert stimulated_traces[key].shape == b.shape

    joint_silence = ~(b.any(axis=1) | s.any(axis=1))

    sustained_silence = keep_long_runs(
        joint_silence,
        minimum_steps=max(1, int(np.ceil(0.010 / dt))),
    )

    absolute_differences = {
        key: np.abs(
            np.asarray(stimulated_traces[key], dtype=float)
            - np.asarray(baseline_traces[key], dtype=float)
        )
        for key in baseline_traces
    }

    # Различие во время молчания усредняется по ВСЕМ отсчётам
    # и узлам внутри выделенных периодов молчания в этой паре
    # (не по среднему окон 200мс, чтобы короткие и длинные периоды
    # учитывались пропорционально их длительности).
    if sustained_silence.any():
        pair_silent_abs_diff = {
            key: diff[sustained_silence].mean()
            for key, diff in absolute_differences.items()
        }
    else:
        pair_silent_abs_diff = {
            key: np.nan for key in absolute_differences
        }

    fine_width = int(round(0.020 / dt))
    fine_usable = steps // fine_width * fine_width

    def population_rate(spikes):
        counts = spikes[:fine_usable].reshape(
            -1, fine_width, nodes
        ).sum(axis=(1, 2))

        return counts / (nodes * fine_width * dt)

    fine = {
        "time_s": (
            np.arange(fine_usable // fine_width) + 0.5
        ) * fine_width * dt,
        "baseline_hz": population_rate(b),
        "stimulated_hz": population_rate(s),
    }

    width = int(round(0.200 / dt))
    rows = []

    for start in range(0, steps - width + 1, width):
        end = start + width
        bb = b[start:end]
        ss = s[start:end]
        silence = sustained_silence[start:end]

        base_rate = bb.sum() / (nodes * width * dt)
        stim_rate = ss.sum() / (nodes * width * dt)

        row = {
            "start_s": start * dt,
            "baseline_hz": base_rate,
            "stimulated_hz": stim_rate,
            "delta_rate_hz": stim_rate - base_rate,
            "baseline_active_fraction": bb.any(axis=0).mean(),
            "stimulated_active_fraction": ss.any(axis=0).mean(),
            "changed_fraction": (bb != ss).any(axis=0).mean(),
            "joint_silence_fraction": silence.mean(),
        }

        for key, difference in absolute_differences.items():
            window_difference = difference[start:end]

            row[f"mean_abs_delta_{key}"] = (
                window_difference.mean()
            )

            row[f"silent_mean_abs_delta_{key}"] = (
                window_difference[silence].mean()
                if silence.any() else np.nan
            )

        rows.append(row)

    return {
        "windows": rows,
        "population": fine,
        "joint_silence_mask": sustained_silence,
        "pair_silent_abs_diff": pair_silent_abs_diff,
    }


TRACE_KEYS = ("v", "margin", "adaptation", "syn_effective", "refractory")


def load_and_analyze(npz_path):
    d = np.load(npz_path)

    N = d["baseline_spikes"].shape[1]
    nodes = d["nodes"]
    other = np.ones(N, dtype=bool)
    other[nodes] = False

    baseline_spikes = d["baseline_spikes"][:, other]
    stimulated_spikes = d["stimulated_spikes"][:, other]

    baseline_traces = {
        key: d[f"baseline_{key}"][:, other] for key in TRACE_KEYS
    }
    stimulated_traces = {
        key: d[f"stimulated_{key}"][:, other] for key in TRACE_KEYS
    }

    dt = float(d["dt"])

    result = analyze_saved_pair(
        baseline_spikes, stimulated_spikes,
        baseline_traces, stimulated_traces, dt,
    )

    result["meta"] = {
        "development_seed": int(d["development_seed"]),
        "gain": float(d["gain"]),
        "state_seed": int(d["state_seed"]),
        "test_seed": int(d["test_seed"]),
        "filename": os.path.basename(npz_path),
    }

    # Проверка избыточности margin/v: при фиксированном пороге
    # |Δmargin| должно совпадать с |Δv|.
    dv = np.abs(
        stimulated_traces["v"].astype(float)
        - baseline_traces["v"].astype(float)
    )
    dmargin = np.abs(
        stimulated_traces["margin"].astype(float)
        - baseline_traces["margin"].astype(float)
    )
    assert np.allclose(dv, dmargin, atol=1e-9), (
        f"|Δv| и |Δmargin| разошлись в {npz_path} -- "
        "порог не был константой, либо ошибка записи."
    )

    return result


if __name__ == "__main__":
    manifest_path = "/home/claude/sim/recovery_v02/manifest.csv"
    with open(manifest_path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    print(f"Файлов в манифесте: {len(rows)}")

    sample = os.path.join(
        "/home/claude/sim/recovery_v02", rows[0]["filename"]
    )
    result = load_and_analyze(sample)
    print(f"\nПроверка на {rows[0]['filename']}:")
    print(f"  Число оконных строк (200мс): {len(result['windows'])}")
    print(
        "  Общее молчание (доля шагов, keep_long_runs): "
        f"{result['joint_silence_mask'].mean():.4f}"
    )
    print("  Первое окно:", {
        k: (f"{v:.4f}" if isinstance(v, float) else v)
        for k, v in result['windows'][0].items()
    })
    print("OK: анализ одного файла прошёл проверку избыточности margin/v.")

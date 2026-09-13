import os
import csv
import numpy as np

from analyze_recovery import load_and_analyze


MANIFEST = "/home/claude/sim/recovery_v02/manifest.csv"
DIR = "/home/claude/sim/recovery_v02"


def main():
    with open(MANIFEST, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    all_results = []
    for row in rows:
        path = os.path.join(DIR, row["filename"])
        result = load_and_analyze(path)
        all_results.append(result)

    print(f"Проанализировано пар: {len(all_results)} (все прошли проверку margin/v)")

    networks = sorted(set(r["meta"]["development_seed"] for r in all_results))
    gains = sorted(set(r["meta"]["gain"] for r in all_results))

    for dev in networks:
        for gain in gains:
            group = [
                r for r in all_results
                if r["meta"]["development_seed"] == dev
                and r["meta"]["gain"] == gain
            ]
            if not group:
                continue

            print(f"\n{'='*70}")
            print(f"Сеть {dev}, gain={gain:.0f} ({len(group)} пар)")
            print(f"{'='*70}")

            print("\nПопуляционные кривые (Гц), первые 10 окон по 20мс, все пары:")
            for r in group:
                m = r["meta"]
                base_hz = r["population"]["baseline_hz"][:10]
                stim_hz = r["population"]["stimulated_hz"][:10]
                print(f"  state={m['state_seed']}, test={m['test_seed']}:")
                print(f"    фон:    {np.round(base_hz, 1)}")
                print(f"    стимул: {np.round(stim_hz, 1)}")

            print("\nОконные различия частоты (Δrate_hz), 200мс окна, по парам:")
            delta_matrix = np.array([
                [w["delta_rate_hz"] for w in r["windows"]]
                for r in group
            ])
            print(f"  Средние по окнам (по всем парам): {np.round(delta_matrix.mean(axis=0), 3)}")
            print(f"  Std по окнам (по всем парам):     {np.round(delta_matrix.std(axis=0), 3)}")
            print(f"  Диапазон [{delta_matrix.min():.3f}, {delta_matrix.max():.3f}]")

            silence_fracs = np.array([
                r["joint_silence_mask"].mean() for r in group
            ])
            print(
                f"\nДоля общего молчания (keep_long_runs, >=10мс): "
                f"среднее={silence_fracs.mean():.3f}, "
                f"диапазон=[{silence_fracs.min():.3f}, {silence_fracs.max():.3f}]"
            )

            print("\nАбсолютные различия внутренних переменных во время общего молчания")
            print("(усреднено по ВСЕМ отсчётам молчания внутри каждой пары, затем по 6 парам):")
            for key in ("v", "adaptation", "syn_effective"):
                pair_values = np.array([
                    r["pair_silent_abs_diff"][key] for r in group
                ])
                finite = pair_values[np.isfinite(pair_values)]
                n_undefined = np.isnan(pair_values).sum()
                if finite.size:
                    print(
                        f"  {key}: среднее={finite.mean():.5f}, "
                        f"std={finite.std():.5f}, "
                        f"диапазон=[{finite.min():.5f}, {finite.max():.5f}], "
                        f"пар={finite.size}/6"
                        + (f" (не определено в {n_undefined} парах -- нет молчания)"
                           if n_undefined else "")
                    )
                else:
                    print(f"  {key}: не определено ни в одной паре (нет молчания)")

            print("\nДля сравнения, те же различия по ВСЕМ окнам (не только молчание):")
            for key in ("v", "adaptation", "syn_effective"):
                all_key = f"mean_abs_delta_{key}"
                values = np.array([
                    w[all_key] for r in group for w in r["windows"]
                ])
                print(
                    f"  {key}: среднее={values.mean():.5f}, std={values.std():.5f}"
                )

    return all_results


if __name__ == "__main__":
    all_results = main()

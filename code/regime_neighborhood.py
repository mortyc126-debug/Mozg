import csv
import numpy as np

from sim_core import simulate
from regime_map import evaluate_point


def run_neighborhood(development_seed=11):
    initial = simulate(seed=development_seed)
    N = initial["weights"].shape[0]

    drives = (0.95, 1.10, 1.25)
    gains = (2.0, 4.0, 6.0)

    rows = []

    for repeat in range(3):
        # Набор узлов одинаков для всех точек внутри повтора.
        node_rng = np.random.default_rng(1000 + repeat)
        nodes = np.sort(
            node_rng.choice(N, size=5, replace=False)
        )

        noise_seed = 500 + repeat

        for drive in drives:
            for gain in gains:
                metrics = evaluate_point(
                    initial,
                    internal_drive=drive,
                    gain=gain,
                    nodes=nodes,
                    seed=noise_seed,
                    warm_duration=12.0,
                )

                row = {
                    "development_seed": development_seed,
                    "repeat": repeat,
                    "drive": drive,
                    "gain": gain,
                    "warm_duration": 12.0,
                    "noise_seed": noise_seed,
                    "stimulated_nodes": " ".join(map(str, nodes)),
                    **metrics,
                }
                rows.append(row)

                print(
                    f"dev={development_seed}, repeat={repeat}, "
                    f"drive={drive:.2f}, gain={gain:.1f}"
                    f" | rate={metrics['rate_hz']:.2f}"
                    f" | response={metrics['response_fraction']:.0%}"
                    f" | drift={metrics['rate_drift_hz']:+.2f}"
                )

    filename = f"/home/claude/sim/neighborhood_dev{development_seed}.csv"

    with open(filename, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=list(rows[0].keys()),
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nСохранено: {filename}")
    print("\nСводка: среднее ± разброс трёх повторов")

    for drive in drives:
        for gain in gains:
            selected = [
                row for row in rows
                if row["drive"] == drive and row["gain"] == gain
            ]

            print(f"\ndrive={drive:.2f}, gain={gain:.1f}")

            for key in (
                "rate_hz",
                "silent_fraction",
                "population_cv",
                "response_fraction",
                "delta_spikes",
            ):
                values = np.array([
                    row[key] for row in selected
                ], dtype=float)

                finite = values[np.isfinite(values)]

                if finite.size:
                    print(
                        f"  {key}: "
                        f"{finite.mean():.4f} ± {finite.std():.4f}"
                    )
                else:
                    print(f"  {key}: не определено")

            # Подписанный средний дрейф может взаимно погаситься.
            # Поэтому показываем также средний модуль.
            drift = np.array([
                row["rate_drift_hz"] for row in selected
            ])

            print(
                f"  средний |drift|: {np.abs(drift).mean():.4f} Гц"
            )

    return rows


if __name__ == "__main__":
    rows = run_neighborhood(development_seed=11)

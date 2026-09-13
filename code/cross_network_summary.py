import csv
import numpy as np


def load_rows(filename):
    with open(filename, encoding="utf-8", newline="") as file:
        rows = list(csv.DictReader(file))

    numeric = (
        "drive",
        "gain",
        "rate_hz",
        "response_fraction",
        "population_cv",
        "rate_drift_hz",
    )

    for row in rows:
        for key in numeric:
            row[key] = float(row[key])

    return rows


datasets = {
    seed: load_rows(f"/home/claude/sim/neighborhood_dev{seed}.csv")
    for seed in (11, 22, 33)
}

for drive in (0.95, 1.10, 1.25):
    for gain in (2.0, 4.0, 6.0):
        print(f"\ndrive={drive:.2f}, gain={gain:.1f}")

        network_means = []

        for seed, rows in datasets.items():
            selected = [
                row for row in rows
                if np.isclose(row["drive"], drive)
                and np.isclose(row["gain"], gain)
            ]

            if len(selected) != 3:
                raise ValueError(
                    f"Ожидались 3 повтора: "
                    f"seed={seed}, drive={drive}, gain={gain}"
                )

            response = np.array([
                row["response_fraction"] for row in selected
            ])
            rate = np.array([
                row["rate_hz"] for row in selected
            ])
            drift = np.array([
                row["rate_drift_hz"] for row in selected
            ])

            network_means.append(response.mean())

            print(
                f"  сеть {seed}:"
                f" response={response.mean():.1%}"
                f" ± {response.std():.1%};"
                f" диапазон={response.min():.1%}"
                f"-{response.max():.1%};"
                f" rate={rate.mean():.2f} Гц;"
                f" средний |drift|={np.abs(drift).mean():.3f} Гц"
            )

        print(
            "  Диапазон средних ответов между сетями: "
            f"{min(network_means):.1%}"
            f"-{max(network_means):.1%}"
        )

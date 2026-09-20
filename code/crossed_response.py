import csv
import numpy as np

from sim_core import simulate
from regime_map import evaluate_point


def main():
    records = []

    for development_seed in (11, 22, 33):
        initial = simulate(seed=development_seed)
        N = initial["weights"].shape[0]

        # Три непересекающихся набора, выбранных до проверки.
        # Те же номера узлов для всех сетей;
        # их геометрия и связи между сетями различаются.
        rng = np.random.default_rng(3100)
        chosen = rng.choice(N, size=15, replace=False)

        groups = [
            np.sort(chosen[i * 5:(i + 1) * 5])
            for i in range(3)
        ]

        for gain in (4.0, 6.0):
            for group_id, nodes in enumerate(groups):
                for history_id, noise_seed in enumerate(
                    (1500, 1501, 1502)
                ):
                    metrics = evaluate_point(
                        initial,
                        internal_drive=1.25,
                        gain=gain,
                        nodes=nodes,
                        seed=noise_seed,
                        warm_duration=12.0,
                    )

                    record = {
                        "development_seed": development_seed,
                        "drive": 1.25,
                        "gain": gain,
                        "group_id": group_id,
                        "history_id": history_id,
                        "noise_seed": noise_seed,
                        "nodes": " ".join(map(str, nodes)),
                        **metrics,
                    }
                    records.append(record)

                    print(
                        f"сеть={development_seed}, gain={gain:.1f}, "
                        f"группа={group_id}, история={history_id}"
                        f" | ответ={metrics['response_fraction']:.1%}"
                    )

            # Промежуточное сохранение после каждой точки сети.
            with open(
                "/home/claude/sim/crossed_response.csv",
                "w",
                newline="",
                encoding="utf-8",
            ) as file:
                writer = csv.DictWriter(
                    file,
                    fieldnames=list(records[0].keys()),
                )
                writer.writeheader()
                writer.writerows(records)

    summarize(records)


def summarize(records):
    for development_seed in (11, 22, 33):
        for gain in (4.0, 6.0):
            selected = [
                row for row in records
                if int(row["development_seed"]) == development_seed
                and float(row["gain"]) == gain
            ]

            matrix = np.full((3, 3), np.nan)
            background_rate = np.full((3, 3), np.nan)

            for row in selected:
                i = int(row["group_id"])
                j = int(row["history_id"])

                matrix[i, j] = float(row["response_fraction"])
                background_rate[i, j] = float(row["rate_hz"])

            if not np.isfinite(matrix).all():
                raise ValueError("Неполная матрица проверок.")

            # При одной шумовой истории свободный прогон
            # не должен зависеть от будущего места стимуляции.
            assert np.allclose(
                background_rate,
                background_rate[0:1, :],
                rtol=0.0,
                atol=1e-12,
            )

            group_means = matrix.mean(axis=1)
            history_means = matrix.mean(axis=0)

            # Остаток после вычитания средних эффектов строк/столбцов.
            residual = (
                matrix
                - group_means[:, None]
                - history_means[None, :]
                + matrix.mean()
            )

            print(
                f"\nСеть {development_seed}, gain={gain:.1f}"
                "\nСтроки — группы, столбцы — шумовые истории:"
            )
            print(np.array2string(100 * matrix, precision=1))

            print(
                "Средние по группам, %:",
                np.round(100 * group_means, 1),
            )
            print(
                "Средние по историям, %:",
                np.round(100 * history_means, 1),
            )
            print(
                "Разброс средних по группам:",
                f"{100 * group_means.std():.1f} п.п.",
            )
            print(
                "Разброс средних по историям:",
                f"{100 * history_means.std():.1f} п.п.",
            )
            print(
                "RMS остатка:",
                f"{100 * np.sqrt(np.mean(residual ** 2)):.1f} п.п.",
            )


if __name__ == "__main__":
    main()

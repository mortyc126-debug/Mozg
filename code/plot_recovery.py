import os
import csv
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from analyze_recovery import load_and_analyze


MANIFEST = "/home/claude/sim/recovery_v02/manifest.csv"
DIR = "/home/claude/sim/recovery_v02"
OUT_DIR = "/home/claude/sim/recovery_plots"


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    with open(MANIFEST, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    all_results = []
    for row in rows:
        path = os.path.join(DIR, row["filename"])
        result = load_and_analyze(path)
        all_results.append(result)

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

            group = sorted(
                group,
                key=lambda r: (
                    r["meta"]["state_seed"], r["meta"]["test_seed"]
                ),
            )

            fig, axes = plt.subplots(
                3, 2, figsize=(13, 11), sharex=True, sharey=True
            )
            axes_flat = axes.flatten()

            for ax, r in zip(axes_flat, group):
                m = r["meta"]
                t = r["population"]["time_s"]
                base_hz = r["population"]["baseline_hz"]
                stim_hz = r["population"]["stimulated_hz"]

                ax.plot(t, base_hz, label="фон", linewidth=0.8, alpha=0.8)
                ax.plot(t, stim_hz, label="стимул", linewidth=0.8, alpha=0.8)
                ax.set_title(
                    f"state={m['state_seed']}, test={m['test_seed']}",
                    fontsize=9,
                )
                ax.tick_params(labelsize=8)

            axes_flat[0].legend(fontsize=8)
            for ax in axes[-1, :]:
                ax.set_xlabel("время, с")
            for ax in axes[:, 0]:
                ax.set_ylabel("частота, Гц")

            fig.suptitle(
                f"Сеть {dev}, gain={gain:.0f}: популяционная частота (20мс окна)",
                fontsize=12,
            )
            plt.tight_layout()
            fname1 = f"{OUT_DIR}/population_dev{dev}_gain{int(gain)}.png"
            plt.savefig(fname1, dpi=110)
            plt.close(fig)
            print(f"Сохранено: {fname1}")

            fig2, axes2 = plt.subplots(
                3, 1, figsize=(10, 9), sharex=True
            )

            for r in group:
                m = r["meta"]
                label = f"s={m['state_seed']},t={m['test_seed']}"
                starts = [w["start_s"] for w in r["windows"]]

                delta_rate = [w["delta_rate_hz"] for w in r["windows"]]
                mean_abs_v = [w["mean_abs_delta_v"] for w in r["windows"]]
                mean_abs_adapt = [
                    w["mean_abs_delta_adaptation"] for w in r["windows"]
                ]

                axes2[0].plot(starts, delta_rate, marker="o", markersize=3, label=label)
                axes2[1].plot(starts, mean_abs_v, marker="o", markersize=3, label=label)
                axes2[2].plot(starts, mean_abs_adapt, marker="o", markersize=3, label=label)

            axes2[0].axhline(0, color="gray", linewidth=0.7)
            axes2[0].set_ylabel("Δ частота, Гц")
            axes2[1].set_ylabel("средн. |Δv|")
            axes2[2].set_ylabel("средн. |Δadaptation|")
            axes2[2].set_xlabel("время, с")
            axes2[0].legend(fontsize=7, ncol=3)
            fig2.suptitle(
                f"Сеть {dev}, gain={gain:.0f}: оконные различия (200мс)",
                fontsize=12,
            )
            plt.tight_layout()
            fname2 = f"{OUT_DIR}/windows_dev{dev}_gain{int(gain)}.png"
            plt.savefig(fname2, dpi=110)
            plt.close(fig2)
            print(f"Сохранено: {fname2}")


if __name__ == "__main__":
    main()

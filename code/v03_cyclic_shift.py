import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from v03_rhythm_origin import CONDITIONS, free_dynamics_run
from sim_core import simulate
from regime_map import DT


def population_counts_5ms(spikes, dt, fine_dt=0.005):
    steps, N = spikes.shape
    width = int(round(fine_dt / dt))
    usable = steps // width * width
    counts = spikes[:usable].reshape(-1, width, N).sum(axis=(1, 2)).astype(float)
    return counts, usable, width, N


def cyclic_shift_control(spikes, dt, fine_dt=0.005, n_shuffles=100, seed=42):
    steps, N = spikes.shape
    rng = np.random.default_rng(seed)

    def pop_variance(sp):
        counts, usable, width, n = population_counts_5ms(sp, dt, fine_dt)
        return counts.var(), counts.mean()

    original_var, original_mean = pop_variance(spikes)

    shuffled_vars = np.zeros(n_shuffles)

    for i in range(n_shuffles):
        shifts = rng.integers(0, steps, size=N)
        shifted = np.empty_like(spikes)
        for node in range(N):
            shifted[:, node] = np.roll(spikes[:, node], shifts[node])

        var_i, _ = pop_variance(shifted)
        shuffled_vars[i] = var_i

    delta_v = original_var - shuffled_vars.mean()
    q_ratio = (
        original_var / shuffled_vars.mean()
        if shuffled_vars.mean() > 0 else np.nan
    )
    # Скорректированное одностороннее p: считаем и наблюдаемое
    # значение как один из (n_shuffles+1) возможных исходов.
    p_value = (
        1 + np.count_nonzero(shuffled_vars >= original_var)
    ) / (len(shuffled_vars) + 1)

    return {
        "original_var": original_var,
        "original_mean": original_mean,
        "shuffled_vars": shuffled_vars,
        "shuffled_mean": shuffled_vars.mean(),
        "shuffled_std": shuffled_vars.std(),
        "percentile_of_original": (
            (shuffled_vars < original_var).mean() * 100
        ),
        "delta_v": delta_v,
        "q_ratio": q_ratio,
        "p_value": p_value,
    }


def main():
    initial = simulate(seed=11)

    # Явно: development_seed=11 -- ОДНА структурная сеть.
    # seeds=(600,601,602) -- три разных шумовых реализации ЭТОЙ
    # ЖЕ структуры (тот же набор весов/контактов/начального
    # состояния), не три независимо сформированные сети.
    noise_seeds = (600, 601, 602)

    print("=" * 70)
    print("КОНТРОЛЬ НЕЗАВИСИМЫМИ ЦИКЛИЧЕСКИМИ СДВИГАМИ (100 повторов)")
    print("=" * 70)
    print(
        "development_seed=11 (одна структура); "
        f"проверяем все {len(noise_seeds)} шумовых реализации: {noise_seeds}\n"
        "Сравниваем дисперсию исходных популяционных счётчиков (5мс окна)\n"
        "с распределением дисперсий после разрушения относительных фаз\n"
        "узлов (число импульсов и структура каждого узла сохранены).\n"
    )

    fig, axes = plt.subplots(
        len(noise_seeds), len(CONDITIONS),
        figsize=(4.2 * len(CONDITIONS), 3.2 * len(noise_seeds)),
        squeeze=False,
    )

    all_results = {name: [] for name in CONDITIONS}

    for row_idx, noise_seed in enumerate(noise_seeds):
        for col_idx, (name, params) in enumerate(CONDITIONS.items()):
            ax = axes[row_idx][col_idx]

            spikes = free_dynamics_run(
                initial, drive_scalar=1.25, gain=4.0,
                duration=14.0, measure_duration=10.0,
                seed=noise_seed, **params,
            )

            result = cyclic_shift_control(
                spikes, DT, fine_dt=0.005, n_shuffles=100, seed=42
            )
            all_results[name].append(result)

            print(
                f"{name}, шум={noise_seed}: "
                f"V_ориг={result['original_var']:.3f}, "
                f"V_переставл={result['shuffled_mean']:.3f}±{result['shuffled_std']:.3f}, "
                f"ΔV={result['delta_v']:+.3f}, "
                f"Q={result['q_ratio']:.2f}, "
                f"p={result['p_value']:.4f}"
            )

            ax.hist(result["shuffled_vars"], bins=25, alpha=0.7)
            ax.axvline(result["original_var"], color="red", linewidth=2)
            ax.set_title(f"{name}\nшум={noise_seed}", fontsize=8)
            if row_idx == len(noise_seeds) - 1:
                ax.set_xlabel("дисперсия (5мс)", fontsize=8)

        print()

    plt.tight_layout()
    plt.savefig("/home/claude/sim/v03_cyclic_shift_control.png", dpi=110)
    print("Сохранено: v03_cyclic_shift_control.png")

    print("\n" + "=" * 70)
    print("СВОДКА ПО ТРЁМ ШУМОВЫМ РЕАЛИЗАЦИЯМ ОДНОЙ СТРУКТУРЫ")
    print("=" * 70)
    print(
        "(это разброс между реализациями шума ОДНОЙ сети, "
        "не между независимыми сетями)\n"
    )

    for name, results_list in all_results.items():
        delta_vs = np.array([r["delta_v"] for r in results_list])
        qs = np.array([r["q_ratio"] for r in results_list])
        ps = np.array([r["p_value"] for r in results_list])

        print(
            f"{name}:\n"
            f"  ΔV по трём шумам: {np.round(delta_vs, 3)}, "
            f"среднее={delta_vs.mean():.3f}\n"
            f"  Q по трём шумам:  {np.round(qs, 3)}, "
            f"среднее={qs.mean():.3f}\n"
            f"  p по трём шумам:  {np.round(ps, 4)}\n"
        )

    return all_results


if __name__ == "__main__":
    main()

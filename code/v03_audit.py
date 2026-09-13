import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from v03_rhythm_origin import CONDITIONS, free_dynamics_run
from sim_core import simulate
from regime_map import DT


def full_autocorrelation(spikes, dt, fine_dt, max_lag_s=1.0):
    steps, N = spikes.shape
    fine_width = int(round(fine_dt / dt))
    fine_usable = steps // fine_width * fine_width
    fine_counts = spikes[:fine_usable].reshape(
        -1, fine_width, N
    ).sum(axis=(1, 2)).astype(float)

    s = fine_counts - fine_counts.mean()
    if (s**2).sum() < 1e-12:
        return None, None

    autocorr = np.correlate(s, s, mode="full")
    autocorr = autocorr[len(s) - 1:]
    autocorr /= autocorr[0]

    max_lag_steps = min(int(round(max_lag_s / fine_dt)), len(autocorr) - 1)
    lags_ms = np.arange(max_lag_steps + 1) * fine_dt * 1000

    return lags_ms, autocorr[:max_lag_steps + 1]


def coactivation_index_v2(spikes, dt, bin_s=0.020):
    """
    ИСПРАВЛЕНО: прежняя версия усредняла долю активных узлов
    только по окнам, где хотя бы один узел уже активен (условное
    среднее), тогда как rate_based_prediction использовал все
    окна без фильтрации (безусловное среднее). Это давало
    положительный систематический сдвиг и нарушало неравенство
    occupancy <= rate*bin_s. Теперь оба усредняются по ВСЕМ
    окнам одинаково.
    """
    steps, N = spikes.shape
    bin_steps = int(round(bin_s / dt))
    usable = steps // bin_steps * bin_steps

    counts = spikes[:usable].reshape(-1, bin_steps, N).sum(axis=1)

    # Доля узлов с хотя бы одним импульсом в окне, усреднённая
    # по ВСЕМ окнам (без фильтрации по активности).
    occupancy = (counts > 0).mean()
    mean_count = counts.mean()

    rate_hz = spikes.sum() / (N * steps * dt)
    rate_based_prediction = rate_hz * bin_s

    # mean_count и rate_based_prediction должны совпадать точно
    # (это одна и та же величина, вычисленная двумя способами).
    assert abs(mean_count - rate_based_prediction) < 1e-9, (
        f"mean_count={mean_count} != rate*bin_s={rate_based_prediction}"
    )

    # Ключевая проверка корректности: occupancy <= mean_count
    # всегда (доля узлов с >=1 импульсом не может превышать
    # среднее число импульсов на узел за то же окно).
    assert occupancy <= mean_count + 1e-12, (
        f"Нарушено occupancy<=mean_count: {occupancy} > {mean_count}"
    )

    return occupancy, rate_based_prediction, rate_hz


def isi_distribution(spikes, dt):
    steps, N = spikes.shape
    all_isis = []
    for node in range(N):
        spike_times = np.flatnonzero(spikes[:, node]) * dt
        if len(spike_times) >= 2:
            all_isis.append(np.diff(spike_times))
    if all_isis:
        return np.concatenate(all_isis) * 1000
    return np.array([])


def main():
    initial = simulate(seed=11)

    print("=" * 70)
    print("1. ПОЛНАЯ АВТОКОРРЕЛЯЦИЯ ВСЕХ УСЛОВИЙ (до 1с, разрешение 1мс)")
    print("=" * 70)

    fig, axes = plt.subplots(
        len(CONDITIONS), 1, figsize=(11, 3 * len(CONDITIONS)), sharex=True
    )

    autocorr_data = {}

    for ax, (name, params) in zip(axes, CONDITIONS.items()):
        spikes = free_dynamics_run(
            initial, drive_scalar=1.25, gain=4.0,
            duration=14.0, measure_duration=10.0,
            seed=600, **params,
        )

        lags_ms, autocorr = full_autocorrelation(
            spikes, DT, fine_dt=0.001, max_lag_s=1.0
        )
        autocorr_data[name] = (lags_ms, autocorr)

        if autocorr is not None:
            ax.plot(lags_ms, autocorr, linewidth=0.8)
            ax.axhline(0, color="gray", linewidth=0.5)
            ax.axvspan(60, 250, alpha=0.1, color="orange",
                       label="старый диапазон поиска 60-250мс")
        ax.set_ylabel(name, fontsize=9)
        ax.legend(fontsize=6, loc="upper right")

    axes[-1].set_xlabel("лаг, мс")
    fig.suptitle(
        "Полная автокорреляция популяционного счётчика "
        "(development_seed=11, seed=600)"
    )
    plt.tight_layout()
    plt.savefig("/home/claude/sim/v03_full_autocorr.png", dpi=110)
    print("Сохранено: v03_full_autocorr.png")

    print(
        "\nМаксимум автокорреляции на всём диапазоне 5-1000мс "
        "(без ограничения окном 60-250):"
    )
    for name, (lags_ms, autocorr) in autocorr_data.items():
        if autocorr is None:
            print(f"  {name}: нет активности (autocorr не определена)")
            continue
        search_start = 5
        idx_start = np.searchsorted(lags_ms, search_start)
        sub_lags = lags_ms[idx_start:]
        sub_ac = autocorr[idx_start:]
        peak_idx = np.argmax(sub_ac)
        print(
            f"  {name}: глобальный максимум на лаге {sub_lags[peak_idx]:.0f}мс, "
            f"значение={sub_ac[peak_idx]:.3f}"
        )

    print("\n" + "=" * 70)
    print("2. ПРОВЕРКА ФОРМУЛЫ coactivation_index")
    print("=" * 70)

    for name, params in CONDITIONS.items():
        spikes = free_dynamics_run(
            initial, drive_scalar=1.25, gain=4.0,
            duration=14.0, measure_duration=10.0,
            seed=600, **params,
        )
        coact, rate_pred, rate_hz = coactivation_index_v2(spikes, DT, bin_s=0.020)
        print(
            f"  {name}: coactivation={coact:.4f}, "
            f"rate*bin_s={rate_pred:.4f} (rate={rate_hz:.2f}Гц), "
            f"разница={coact - rate_pred:+.4f}"
        )

    print("\n" + "=" * 70)
    print("3. РАСПРЕДЕЛЕНИЕ ISI (не только медиана)")
    print("=" * 70)

    fig2, axes2 = plt.subplots(1, len(CONDITIONS), figsize=(4 * len(CONDITIONS), 4))

    for ax, (name, params) in zip(axes2, CONDITIONS.items()):
        spikes = free_dynamics_run(
            initial, drive_scalar=1.25, gain=4.0,
            duration=14.0, measure_duration=10.0,
            seed=600, **params,
        )
        isis = isi_distribution(spikes, DT)

        if len(isis):
            ax.hist(isis, bins=50, range=(0, min(500, np.percentile(isis, 99))))
            print(
                f"  {name}: n={len(isis)}, медиана={np.median(isis):.1f}мс, "
                f"IQR=[{np.percentile(isis,25):.1f}, {np.percentile(isis,75):.1f}], "
                f"5-95%=[{np.percentile(isis,5):.1f}, {np.percentile(isis,95):.1f}]"
            )
        ax.set_title(name, fontsize=9)
        ax.set_xlabel("ISI, мс")

    plt.tight_layout()
    plt.savefig("/home/claude/sim/v03_isi_distributions.png", dpi=110)
    print("\nСохранено: v03_isi_distributions.png")

    print("\n" + "=" * 70)
    print("4. РЕГУЛЯРНОСТЬ ОТДЕЛЬНЫХ УЗЛОВ vs СОГЛАСОВАННОСТЬ ПОПУЛЯЦИИ")
    print("=" * 70)
    print("(регулярность узла = ISI_CV на этом узле; меньше = регулярнее)")

    for name, params in CONDITIONS.items():
        spikes = free_dynamics_run(
            initial, drive_scalar=1.25, gain=4.0,
            duration=14.0, measure_duration=10.0,
            seed=600, **params,
        )
        N = spikes.shape[1]
        node_isi_cvs = []
        for node in range(N):
            spike_times = np.flatnonzero(spikes[:, node]) * DT
            if len(spike_times) >= 3:
                isis = np.diff(spike_times)
                if isis.mean() > 0:
                    node_isi_cvs.append(isis.std() / isis.mean())

        if node_isi_cvs:
            arr = np.array(node_isi_cvs)
            print(
                f"  {name}: individual ISI CV: среднее={arr.mean():.3f}, "
                f"std={arr.std():.3f} (n_узлов={len(arr)}/{N})"
            )
        else:
            print(f"  {name}: недостаточно данных по узлам")


if __name__ == "__main__":
    main()

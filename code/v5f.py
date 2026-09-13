import numpy as np
import pickle


def simulate_v05(
    seed=42,
    use_budget=False,
    use_length_penalty=False,
    max_in_degree=12,
    length_penalty_scale=0.10,
    growth_seed_offset=100000,
):
    rng_growth = np.random.default_rng(seed)
    rng_noise = np.random.default_rng(seed + growth_seed_offset)

    N = 80
    dt = 0.001
    duration = 12.0
    steps = int(duration / dt)

    positions = rng_growth.uniform(0, 1, size=(N, 2))
    distance = np.linalg.norm(
        positions[:, None, :] - positions[None, :, :], axis=2,
    )

    birth = (np.arange(N) // 8) * 0.5

    v = np.zeros(N)
    syn = np.zeros(N)
    adaptation = np.zeros(N)
    refractory = np.zeros(N)
    threshold = np.ones(N)
    rate = np.zeros(N)
    trace = np.zeros(N)

    W = np.zeros((N, N))
    contacts = np.zeros((N, N), dtype=bool)
    drive = rng_noise.uniform(1.10, 1.25, N)

    spikes = np.zeros((steps, N), dtype=bool)
    logs = []

    growth_log = []
    normalization_events = 0

    for step in range(steps):
        t = step * dt

        alive = t >= birth
        age = np.maximum(0.0, t - birth)
        maturity = np.clip(age / 1.0, 0.0, 1.0)
        ready = alive & (maturity >= 0.6)

        if step % 250 == 0:
            eligible = (
                ready[:, None] & ready[None, :]
                & (distance < 0.25) & ~contacts
            )
            np.fill_diagonal(eligible, False)

            draws = rng_growth.random((N, N))

            if use_length_penalty:
                length_factor = np.exp(-distance / length_penalty_scale)
                prob = 0.15 * length_factor
            else:
                prob = np.full((N, N), 0.15)

            passed_probability = eligible & (draws < prob)
            n_passed = int(passed_probability.sum())

            if use_budget:
                current_in_degree = contacts.sum(axis=1)
                budget_remaining = np.maximum(0, max_in_degree - current_in_degree)

                new = np.zeros_like(contacts)
                n_rejected_by_budget = 0

                for i in range(N):
                    candidates_i = np.flatnonzero(passed_probability[i])
                    if len(candidates_i) == 0:
                        continue
                    slots = budget_remaining[i]
                    if slots <= 0:
                        n_rejected_by_budget += len(candidates_i)
                        continue
                    if len(candidates_i) <= slots:
                        chosen = candidates_i
                    else:
                        chosen = rng_growth.choice(
                            candidates_i, size=int(slots), replace=False
                        )
                        n_rejected_by_budget += len(candidates_i) - int(slots)

                    new[i, chosen] = True
            else:
                new = passed_probability
                n_rejected_by_budget = 0

            n_accepted = int(new.sum())

            contacts |= new
            W[new] = 0.015

            in_degree_now = contacts.sum(axis=1)
            n_budget_exhausted = (
                int((in_degree_now >= max_in_degree).sum()) if use_budget else 0
            )

            growth_log.append({
                "step": step,
                "t": t,
                "n_passed_probability": n_passed,
                "n_accepted": n_accepted,
                "n_rejected_by_budget": n_rejected_by_budget,
                "n_budget_exhausted_nodes": n_budget_exhausted,
                "total_contacts": int(contacts.sum()),
            })

        syn *= np.exp(-dt / 0.010)
        adaptation *= np.exp(-dt / 0.200)
        refractory = np.maximum(0.0, refractory - dt)
        trace *= np.exp(-dt / 0.020)
        rate *= np.exp(-dt / 1.0)

        available = alive & (refractory == 0.0)

        current = maturity * drive + syn - adaptation
        noise = 0.012 * rng_noise.standard_normal(N)

        dv = (dt / 0.020) * (-v + current)
        v[available] += (dv + noise)[available]

        fired = available & (v >= threshold)
        spikes[step] = fired

        if np.any(fired):
            eta = 0.0002
            W[fired, :] += eta * trace[None, :] * contacts[fired, :]
            W[:, fired] -= 1.05 * eta * trace[:, None] * contacts[:, fired]

        np.clip(W, 0.0, 0.08, out=W)

        total_input = W.sum(axis=1)
        pre_clip_over_cap = total_input > 0.6
        if pre_clip_over_cap.any():
            normalization_events += int(pre_clip_over_cap.sum())

        W *= np.minimum(1.0, 0.6 / np.maximum(total_input, 1e-12))[:, None]

        if np.any(fired):
            syn += W[:, fired].sum(axis=1)

        v[fired] = 0.0
        refractory[fired] = 0.005
        adaptation[fired] += 0.25
        trace[fired] += 1.0
        rate[fired] += 1.0

        target_rate = 5.0 * maturity
        threshold[ready] += dt * 0.02 * (rate[ready] - target_rate[ready])
        np.clip(threshold, 0.7, 1.5, out=threshold)

        if step % 100 == 0:
            logs.append([
                t,
                rate[ready].mean() if ready.any() else 0.0,
                threshold[ready].mean() if ready.any() else 1.0,
                W[contacts].mean() if contacts.any() else 0.0,
            ])

    tail = spikes[-int(2.0 / dt):]
    rates = tail.sum(axis=0) / 2.0
    bin_steps = int(0.020 / dt)
    counts = tail.reshape(-1, bin_steps, N).sum(axis=(1, 2))
    population_cv = counts.std() / counts.mean() if counts.mean() > 0 else np.nan

    metrics = {
        "rate_hz": rates.mean(),
        "silent_fraction": np.mean(rates == 0),
        "population_cv": population_cv,
    }

    return {
        "spikes": spikes,
        "logs": np.array(logs),
        "weights": W.copy(),
        "contacts": contacts.copy(),
        "positions": positions.copy(),
        "distance": distance.copy(),
        "metrics": metrics,
        "dt": dt,
        "growth_log": growth_log,
        "normalization_events": normalization_events,
        "state": {
            "v": v.copy(), "syn": syn.copy(), "adaptation": adaptation.copy(),
            "refractory": refractory.copy(), "threshold": threshold.copy(),
            "drive": drive.copy(),
        },
    }


CONDITIONS_V05 = {
    "Исходное": dict(use_budget=False, use_length_penalty=False),
    "Только бюджет": dict(use_budget=True, use_length_penalty=False),
    "Только длина": dict(use_budget=False, use_length_penalty=True),
    "Совместное": dict(use_budget=True, use_length_penalty=True),
}


def run_four_conditions(seeds=(11, 22, 33), max_in_degree=12):
    results = {name: [] for name in CONDITIONS_V05}

    for seed in seeds:
        for name, params in CONDITIONS_V05.items():
            net = simulate_v05(seed=seed, max_in_degree=max_in_degree, **params)
            results[name].append(net)
            print(
                "seed", seed, name,
                "contacts", int(net["contacts"].sum()),
                "mean_in_degree", round(net["contacts"].sum(axis=1).mean(), 2),
                "mean_dist", round(net["distance"][net["contacts"]].mean(), 4),
                "rate_hz", round(net["metrics"]["rate_hz"], 3),
                "norm_events", net["normalization_events"],
            )

    return results


if __name__ == "__main__":
    results = run_four_conditions()

    with open("/home/claude/sim/v05_four_conditions.pkl", "wb") as f:
        pickle.dump(results, f)
    print("Saved: v05_four_conditions.pkl")

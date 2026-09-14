"""v0.13 шаг 1: пространственная организация ВОЗНИКАЕТ, а не выдаётся.

Пункт 1 дорожной карты (PRINCIPLES.md п.4) и требование Ф12
(STAGE_MAP). До сих пор позиции задавались как `rng.uniform(0,1,(80,2))`
-- система получала готовым то, что должна строить сама.

ПО PRINCIPLES.md: агент -- автономная вычислительная единица, деление --
механизм, а не копия митоза. Молекулярной биологии здесь нет и не
требуется; требуется, чтобы организация ВОЗНИКАЛА из локальных правил.

ПРАВИЛА (все параметры объявлены заранее, не подбирались):
1. старт -- ОДИН агент в центре области (существенно более простое
   состояние, чем 80 разбросанных точек);
2. деление: каждый существующий агент порождает потомка со смещением
   в случайном направлении на шаг `step`;
3. локальное расталкивание: пары ближе `r_min` отодвигаются друг от
   друга, `relax_steps` итераций после каждого деления;
4. область ограничена [0,1]^2 (значения обрезаются).
Ничего глобального: агент знает только соседей ближе r_min.

ИЗМЕРЯЕТСЯ СТРУКТУРА, НЕ ФУНКЦИЯ. Выросшие позиции дадут другую
плотность, поэтому функциональное сравнение было бы спутано с ней --
это отдельный следующий шаг с выравниванием плотности.

ПРЕДСКАЗАНИЯ ДО ЗАПУСКА:
- индекс Кларка-Эванса R (наблюдаемое среднее расстояние до ближайшего
  соседа, делённое на ожидаемое при полной случайности) для выросших
  позиций > 1, для равномерно случайных ~1;
- коэффициент вариации расстояний до ближайшего соседа у выросших
  МЕНЬШЕ, чем у случайных (расталкивание даёт регулярность);
- обе величины устойчивы по seed'ам.
Если R выросших окажется ~1 -- организация НЕ возникла, правила
недостаточны, и так и записывается.
"""
import numpy as np

N_AGENTS = 80
DOMAIN = (0.0, 1.0)
STEP = 0.06
R_MIN = 0.07
RELAX_STEPS = 20
PUSH = 0.5          # доля недостающего расстояния, отдаваемая за итерацию


def _relax(pos, r_min=R_MIN, steps=RELAX_STEPS, push=PUSH):
    """Локальное расталкивание: пары ближе r_min отодвигаются.
    Только локальное взаимодействие, ничего глобального."""
    lo, hi = DOMAIN
    for _ in range(steps):
        diff = pos[:, None, :] - pos[None, :, :]
        dist = np.linalg.norm(diff, axis=2)
        np.fill_diagonal(dist, np.inf)
        too_close = dist < r_min
        if not too_close.any():
            break
        # величина отталкивания пропорциональна недостающему расстоянию
        with np.errstate(invalid="ignore", divide="ignore"):
            unit = np.where(dist[:, :, None] > 1e-12, diff / dist[:, :, None], 0.0)
        deficit = np.where(too_close, (r_min - dist), 0.0)
        shift = (unit * deficit[:, :, None]).sum(axis=1) * push
        pos = np.clip(pos + shift, lo, hi)
    return pos


def grow_positions(n=N_AGENTS, seed=0, step=STEP, r_min=R_MIN,
                   relax_steps=RELAX_STEPS):
    """Выращивание из ОДНОГО агента делением + локальным расталкиванием."""
    rng = np.random.default_rng(seed)
    lo, hi = DOMAIN
    pos = np.array([[(lo + hi) / 2, (lo + hi) / 2]], dtype=float)
    while len(pos) < n:
        n_new = min(len(pos), n - len(pos))
        parents = pos[:n_new]
        ang = rng.uniform(0, 2 * np.pi, size=n_new)
        offs = np.stack([np.cos(ang), np.sin(ang)], axis=1) * step
        daughters = np.clip(parents + offs, lo, hi)
        pos = np.vstack([pos, daughters])
        pos = _relax(pos, r_min, relax_steps)
    return pos[:n]


def nn_distances(pos):
    d = np.linalg.norm(pos[:, None, :] - pos[None, :, :], axis=2)
    np.fill_diagonal(d, np.inf)
    return d.min(axis=1)


def clark_evans(pos, domain=DOMAIN):
    """R = наблюдаемое среднее NN / ожидаемое при полной случайности.
    R>1 -- регулярнее случайного, R<1 -- более сгущённо."""
    n = len(pos)
    area = (domain[1] - domain[0]) ** 2
    expected = 0.5 / np.sqrt(n / area)
    return float(nn_distances(pos).mean() / expected)


def summarize(pos):
    nn = nn_distances(pos)
    return {"R": clark_evans(pos),
            "nn_mean": float(nn.mean()),
            "nn_cv": float(nn.std() / nn.mean()),
            "occupied_span": float(pos.max(axis=0).mean() - pos.min(axis=0).mean())}


def main():
    seeds = list(range(11, 21))
    print(f"агентов: {N_AGENTS}, старт: ОДИН агент в центре, "
          f"шаг {STEP}, r_min {R_MIN}, релаксаций {RELAX_STEPS}")
    print(f"seed'ов: {len(seeds)}\n")

    grown = [summarize(grow_positions(seed=s)) for s in seeds]
    uni = [summarize(np.random.default_rng(s).uniform(0, 1, size=(N_AGENTS, 2)))
           for s in seeds]

    def col(rows, k):
        return np.array([r[k] for r in rows])

    print(f"{'величина':>22} | {'ВЫРОСШИЕ':>18} | {'равномерно случайные':>20}")
    for k, name in (("R", "индекс Кларка-Эванса"),
                    ("nn_mean", "среднее расст. до соседа"),
                    ("nn_cv", "коэф. вариации NN"),
                    ("occupied_span", "занятый размах")):
        g, u = col(grown, k), col(uni, k)
        print(f"{name:>22} | {g.mean():>8.4f} +- {g.std():.4f} | "
              f"{u.mean():>10.4f} +- {u.std():.4f}")

    Rg, Ru = col(grown, "R"), col(uni, "R")
    cg, cu = col(grown, "nn_cv"), col(uni, "nn_cv")
    print(f"\nПРОВЕРКА ПРЕДСКАЗАНИЙ:")
    print(f"  R выросших > 1        : {(Rg>1).sum()}/{len(Rg)} seed'ов, "
          f"среднее {Rg.mean():.4f}")
    print(f"  R случайных ~1        : среднее {Ru.mean():.4f} "
          f"(самопроверка: {'ОК' if abs(Ru.mean()-1)<0.1 else 'НЕ ПРОЙДЕНА'})")
    print(f"  CV выросших < CV случ.: {(cg<cu).sum()}/{len(cg)} seed'ов "
          f"({cg.mean():.4f} против {cu.mean():.4f})")

    np.savez("v13_positions.npz",
             **{f"grown_{s}": grow_positions(seed=s) for s in seeds})
    print("\nсохранено: v13_positions.npz")


if __name__ == "__main__":
    main()

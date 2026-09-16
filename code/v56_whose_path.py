"""v0.56: тропинку прокладывает ТКАНЬ или её ГЕОМЕТРИЯ?

ОТКУДА. v0.55: ткань прокладывает пути сама, по своему движению (тропинка,
tract_pick="worn"). Но "сама" -- слово, которое надо проверять. Если путь
целиком определён тем, ГДЕ СТОЯТ УЗЛЫ, то никакого выбора нет: есть
геометрия, и она диктует единственный возможный ход. Самостоятельность
тогда мнимая.

ЗАМЫСЕЛ. Отделить одно от другого можно точно, и для этого в движке уже
всё есть. Берётся ОДНА И ТА ЖЕ ткань -- те же координаты (positions), то
же расписание рождений (birth_times), -- и прогоняется при РАЗНЫХ сидах.
Меняется только поток случайных чисел: шум мембран, жеребьёвка контактов,
всё остальное совпадает до последнего узла.

  если пути ложатся В ТЕ ЖЕ МЕСТА -- их диктует геометрия, и выбора нет;
  если пути РАСХОДЯТСЯ -- ткань действительно выбирает, и одна и та же
  ткань могла стать разной.

МЕРА. Пути -- это набор пар узлов. Поскольку геометрия и номера узлов
общие, наборы сравнимы напрямую: доля общих пар от объединения (мера
Жаккара). Пустой отсчёт -- та же доля для СЛУЧАЙНЫХ наборов той же
величины из тех же узлов.

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * совпадение считается значимым, если доля общих пар ВЫШЕ случайной
    по большинству сравнений с биномиальным p < 0.05;
  * сообщаются обе величины, а не только их отношение (урок №44: не
    усреднять отношения с малым знаменателем);
  * если у ткани меньше 5 дальних связей, она в счёт не идёт: сравнивать
    почти пустые наборы бессмысленно. Число отброшенных сообщается;
  * ОБА ИСХОДА СОДЕРЖАТЕЛЬНЫ, и ни один не объявляется желаемым заранее.
"""
import sys
from math import comb

import numpy as np

sys.path.insert(0, "code")
import v37_self_built as v37
import v46_closed_loop as v46
from sim_core import simulate

N = 80
SEEDS = list(range(6701, 6725))
REPEATS = 4
BASE = {k: v for k, v in v37.GROWN.items()
        if k not in ("div_rate", "coupling")}


def p_ge(k, n):
    return sum(comb(n, i) for i in range(k, n + 1)) / 2 ** n


def links_of(net, radius=0.25):
    pos = net["positions"]
    d = np.linalg.norm(pos[:, None, :] - pos[None, :, :], axis=2)
    alive = np.isfinite(net["birth"])
    m = net["contacts"] & (d > radius) & alive[:, None] & alive[None, :]
    return {(int(i), int(j)) for i, j in zip(*np.where(m))}


def main():
    same, rand, sizes = [], [], []
    skipped = 0
    for seed in SEEDS:
        grown = simulate(seed=seed, div_rate=0.10, coupling=10.0, **BASE)
        if grown["born"] < N:
            skipped += 1
            continue
        pos, birth = grown["positions"], grown["birth"]
        fixed = {k: v for k, v in BASE.items() if k != "growth_by_division"}
        sets = []
        for r in range(REPEATS):
            net = simulate(seed=seed + 1000 * (r + 1), positions=pos,
                           birth_times=birth, coupling=10.0,
                           stimulus=[v46.touch], stimulus_amp=0.4,
                           stimulus_period=0.2, duration=24.0,
                           world=v46.live_world, world_init=0.5,
                           activity_memory=0.05, long_range_rate=3.0,
                           tract_pick="worn", long_range_weight=0.08,
                           **fixed)
            sets.append(links_of(net))
        if min(len(s) for s in sets) < 5:
            skipped += 1
            continue
        rng = np.random.default_rng(seed)
        alive = np.where(np.isfinite(birth))[0]
        for i in range(REPEATS):
            for j in range(i + 1, REPEATS):
                a, b = sets[i], sets[j]
                same.append(len(a & b) / len(a | b))
                ra = {(int(x), int(y)) for x, y in
                      rng.choice(alive, size=(len(a), 2))}
                rb = {(int(x), int(y)) for x, y in
                      rng.choice(alive, size=(len(b), 2))}
                rand.append(len(ra & rb) / max(len(ra | rb), 1))
        sizes.append(np.mean([len(s) for s in sets]))

    n = len(same)
    print(f"{len(SEEDS)} тканей ({len(sizes)} в счёт, {skipped} отброшено), "
          f"по {REPEATS} прогона на ткань, {n} сравнений\n")
    if n == 0:
        print("  мерить не на чем")
        return
    a, b = np.array(same), np.array(rand)
    k = int((a > b).sum())
    print(f"дальних связей у ткани: {np.mean(sizes):.1f}")
    print(f"доля общих путей у одной и той же ткани при разном шуме: "
          f"{a.mean():.4f}")
    print(f"то же у случайных наборов той же величины:                "
          f"{b.mean():.4f}")
    print(f"\nвыше случайного: {k} из {n}, p = {p_ge(k, n):.2e}")
    if p_ge(k, n) < 0.05 and a.mean() > b.mean():
        print("\n  ПУТЬ ДИКТУЕТ ГЕОМЕТРИЯ: одна и та же ткань при разном шуме "
              "прокладывает пути в те же места")
    else:
        print("\n  ПУТЬ ВЫБИРАЕТ ТКАНЬ: при той же геометрии и том же "
              "расписании пути расходятся не реже случайного")


if __name__ == "__main__":
    main()

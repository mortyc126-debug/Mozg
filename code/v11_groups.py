"""v0.11: выбор пар групп A/B.

Критерий -- ТОТ ЖЕ, что в v0.8 (sequence_test.py::select_groups):
>=2 контакта A->B и >=2 контакта B->A, с усиленным требованием
выполнения ОДНОВРЕМЕННО в обеих историях роста одной геометрии.
Критерий НЕ меняется -- меняется только seed отбора, иначе смена
критерия внесла бы новую систематику поверх смены групп.

Seed'ы отбора ОБЪЯВЛЕНЫ ЗАРАНЕЕ: 100 (пара из v0.8), 200, 300.
Берётся ПЕРВАЯ найденная пара для каждого seed -- отбор среди
найденных пар (по числу контактов и т.п.) НЕ производится.
"""
import numpy as np

SELECTION_SEEDS = [100, 200, 300]
GROUP_SIZE = 5


def pair_ok(contacts, A, B, min_contacts=2):
    """W/contacts[получатель, источник]: contacts[B,A] = связи A->B."""
    return (contacts[np.ix_(B, A)].sum() >= min_contacts
            and contacts[np.ix_(A, B)].sum() >= min_contacts)


def select_pair_both_histories(contacts_by_history, seed, n_tries=10000):
    """Первая пара, удовлетворяющая критерию во ВСЕХ переданных
    историях роста одной геометрии."""
    rng = np.random.default_rng(seed)
    N = contacts_by_history[0].shape[0]
    for _ in range(n_tries):
        chosen = rng.choice(N, size=2 * GROUP_SIZE, replace=False)
        A = np.sort(chosen[:GROUP_SIZE])
        B = np.sort(chosen[GROUP_SIZE:])
        if all(pair_ok(c, A, B) for c in contacts_by_history):
            return A, B
    raise RuntimeError(f"seed={seed}: пара не найдена за {n_tries} попыток")

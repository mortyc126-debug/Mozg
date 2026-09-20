"""РАЗВЕДКА: группа-цель (5 узлов) против всей сети (80) как область наблюдения."""
import pickle, numpy as np
with open('v09_functional_probe_full.pkl','rb') as f: d9 = pickle.load(f)
gA, gB = d9['group_A'], d9['group_B']

ch_obs, ch_net, nd_obs, nd_net = 0, 0, [], []
n = 0
for key, r in d9['results'].items():
    for direction, obs in (('A_to_B', gB), ('B_to_A', gA)):
        for br in ('per_test_seed_AB','per_test_seed_BA'):
            for e in r['directions'][direction][br]:
                b, s = e['baseline_spikes'], e['stimulated_spikes']
                ch_obs += int(not np.array_equal(b[:, obs], s[:, obs]))
                ch_net += int(not np.array_equal(b, s))
                # доля узлов с изменённым растром
                nd_obs.append((b[:, obs] != s[:, obs]).any(axis=0).mean())
                nd_net.append((b != s).any(axis=0).mean())
                n += 1
print(f'проб: {n}')
print(f'растр ИЗМЕНИЛСЯ хоть где-то:')
print(f'  только группа-цель (5 узлов) : {ch_obs}/{n} = {ch_obs/n:.3f}')
print(f'  вся сеть (80 узлов)          : {ch_net}/{n} = {ch_net/n:.3f}')
print()
print(f'средняя доля узлов с изменённым растром:')
print(f'  внутри группы-цели : {np.mean(nd_obs):.4f}')
print(f'  по всей сети       : {np.mean(nd_net):.4f}  (=> ~{np.mean(nd_net)*80:.1f} узлов из 80)')

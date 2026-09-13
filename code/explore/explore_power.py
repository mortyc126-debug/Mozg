"""РАЗВЕДКА: сколько вообще импульсов содержит проба? Оценка мощности."""
import pickle, numpy as np
with open('v09_functional_probe_full.pkl','rb') as f: d9 = pickle.load(f)
gA, gB = d9['group_A'], d9['group_B']

tot_obs_b, tot_obs_s, tot_net, changed_any, n = [], [], [], 0, 0
for key, r in d9['results'].items():
    for direction, obs in (('A_to_B', gB), ('B_to_A', gA)):
        for br in ('per_test_seed_AB','per_test_seed_BA'):
            for e in r['directions'][direction][br]:
                b, s = e['baseline_spikes'], e['stimulated_spikes']
                tot_obs_b.append(b[:, obs].sum()); tot_obs_s.append(s[:, obs].sum())
                tot_net.append(b.sum())
                changed_any += int(not np.array_equal(b[:, obs], s[:, obs]))
                n += 1
tot_obs_b = np.array(tot_obs_b); tot_obs_s = np.array(tot_obs_s); tot_net = np.array(tot_net)
print(f'проб всего: {n}')
print(f'импульсов в группе-НАБЛЮДЕНИЯ (5 узлов, 200мс), baseline : среднее {tot_obs_b.mean():.2f}, диапазон {tot_obs_b.min()}-{tot_obs_b.max()}')
print(f'то же, stimulated                                        : среднее {tot_obs_s.mean():.2f}, диапазон {tot_obs_s.min()}-{tot_obs_s.max()}')
print(f'импульсов во ВСЕЙ сети (80 узлов, 200мс), baseline       : среднее {tot_net.mean():.1f}')
print(f'доля проб, где растр группы-цели ВООБЩЕ изменился стимулом: {changed_any}/{n} = {changed_any/n:.3f}')
print()
print(f'знаковая разница счёта в группе-цели: среднее {(tot_obs_s-tot_obs_b).mean():+.4f}, ')
print(f'  ненулевых: {(tot_obs_s!=tot_obs_b).sum()}/{n}')

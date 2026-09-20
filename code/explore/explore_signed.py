"""РАЗВЕДКА (не результат): знаковый перекрёстный контраст на уже
сохранённых данных v0.9/v0.10. Гипотезо-ПОРОЖДАЮЩАЯ процедура."""
import pickle, numpy as np

with open('v09_functional_probe_full.pkl','rb') as f: d9 = pickle.load(f)

def S_signed(entry_list):
    """S = суммарный знаковый отклик группы-цели: sum R_bins по узлам и бинам,
    усреднённый по тестовым шумам."""
    return float(np.mean([e['R_bins'].sum() for e in entry_list]))

rows = {}
for key, r in d9['results'].items():
    seed, growth, rep, mech = key
    dAB = r['directions']['A_to_B']; dBA = r['directions']['B_to_A']
    S_AB_ab = S_signed(dAB['per_test_seed_AB'])   # ветвь AB, стимул A, смотрим B
    S_BA_ab = S_signed(dAB['per_test_seed_BA'])   # ветвь BA, стимул A, смотрим B
    S_BA_ba = S_signed(dBA['per_test_seed_BA'])   # ветвь BA, стимул B, смотрим A
    S_AB_ba = S_signed(dBA['per_test_seed_AB'])   # ветвь AB, стимул B, смотрим A
    U_A = S_AB_ab - S_BA_ab      # "AB лучше проводит A->B, чем BA"
    U_B = S_BA_ba - S_AB_ba      # симметрично
    U   = 0.5*(U_A + U_B)
    rows.setdefault(mech, []).append((seed, growth, rep, U_A, U_B, U))

for mech in sorted(rows):
    vals = rows[mech]
    U_all  = np.array([v[5] for v in vals])
    UA_all = np.array([v[3] for v in vals])
    UB_all = np.array([v[4] for v in vals])
    print(f'--- {mech}  (n={len(vals)} комбинаций)')
    print(f'    U  : среднее {U_all.mean():+.4f} | >0: {(U_all>0).sum()}  =0: {(U_all==0).sum()}  <0: {(U_all<0).sum()}')
    print(f'    U_A : среднее {UA_all.mean():+.4f} | >0: {(UA_all>0).sum()}  =0: {(UA_all==0).sum()}  <0: {(UA_all<0).sum()}')
    print(f'    U_B : среднее {UB_all.mean():+.4f} | >0: {(UB_all>0).sum()}  =0: {(UB_all==0).sum()}  <0: {(UB_all<0).sum()}')
    print(f'    диапазон U: [{U_all.min():+.3f}, {U_all.max():+.3f}]')

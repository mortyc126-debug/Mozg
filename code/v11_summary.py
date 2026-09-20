"""v0.11 фаза 1: сводка по трём мерам. Только печать, ничего не считает заново."""
import pickle
import numpy as np


def main():
    with open("v11_measures_full.pkl", "rb") as f:
        R = pickle.load(f)
    res = R["results"]
    sels = R["selection_seeds"]

    print(f"тестовые шумы: {R['test_seeds']}  (свежие, не пересекаются с 900/901/902)")
    print(f"окно пробы: {R['probe_ms']}мс (не менялось)  цензурировано латентностей: "
          f"{R['n_censored']}/{R['n_latency_probes']}")
    print(f"M3 точных контролей: {R['m3_exact_controls_passed']}\n")

    for mech in ("M1_plasticity_weakest", "M3_no_plasticity_weakest"):
        print(f"===== {mech}")
        for sel in sels:
            keys = [k for k in res if k[0] == sel and k[3] == mech]
            if not keys:
                continue
            U1 = np.array([res[k]["U1"] for k in keys])
            U3 = np.array([res[k]["U3"] for k in keys])
            aAB = np.array([res[k]["acc_AB_net"] for k in keys])
            aBA = np.array([res[k]["acc_BA_net"] for k in keys])
            print(f"  пара групп seed={sel}  (n={len(keys)} комбинаций)")
            print(f"    U1 латентность : среднее {U1.mean():+.3f}  "
                  f">0:{(U1>0).sum()} =0:{(U1==0).sum()} <0:{(U1<0).sum()}  "
                  f"диап [{U1.min():+.2f},{U1.max():+.2f}]")
            print(f"    U3 надёжность  : среднее {U3.mean():+.5f}  "
                  f">0:{(U3>0).sum()} =0:{(U3==0).sum()} <0:{(U3<0).sum()}  "
                  f"диап [{U3.min():+.4f},{U3.max():+.4f}]")
            print(f"    U2 декодер     : точность на сети AB {aAB.mean():.3f}, "
                  f"на сети BA {aBA.mean():.3f}")
        print()

    # сводка M1 по всем парам вместе
    keys = [k for k in res if k[3] == "M1_plasticity_weakest"]
    U1 = np.array([res[k]["U1"] for k in keys])
    U3 = np.array([res[k]["U3"] for k in keys])
    print("===== M1, все 3 пары групп вместе (n=%d)" % len(keys))
    print(f"  U1: среднее {U1.mean():+.4f}, >0:{(U1>0).sum()} =0:{(U1==0).sum()} <0:{(U1<0).sum()}")
    print(f"  U3: среднее {U3.mean():+.6f}, >0:{(U3>0).sum()} =0:{(U3==0).sum()} <0:{(U3<0).sum()}")
    print("\nЗНАК U>0 означает: совпадающая по порядку ветвь ЛУЧШЕ")
    print("(U1 -- отвечает быстрее; U3 -- отвечает устойчивее).")


if __name__ == "__main__":
    main()

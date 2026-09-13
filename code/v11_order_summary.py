"""v0.11 фаза 2: сводка задачи распознавания порядка. Только печать."""
import pickle
import numpy as np


def main():
    with open("v11_order_task_clean.pkl", "rb") as f:
        R = pickle.load(f)
    res = R["results"]
    print(f"проб: {R['n_probes']}, коллизий natural+forced: {R['total_collisions']}")
    print(f"предъявление: первая группа на {R['t0_ms']}мс, вторая через "
          f"{R['lag_ms']}мс; окно {R['probe_steps']}мс (не менялось)")
    print(f"тестовых шумов: {len(R['test_seeds'])} ({R['test_seeds'][0]}-{R['test_seeds'][-1]}, свежие)")
    print(f"признаки: НЕ стимулированные узлы, от {R['feature_start_ms']}мс "
          f"(строго после обоих импульсов)\n")

    acc = {}
    for mech in ("M1_plasticity_weakest", "M3_no_plasticity_weakest"):
        ks = [k for k in res if k[3] == mech]
        a = np.array([res[k]["acc_mean"] for k in ks])
        s = np.array([res[k]["acc_shuf_mean"] for k in ks])
        acc[mech] = (a, s, ks)
        print(f"=== {mech} (n={len(ks)})")
        print(f"  точность распознавания порядка : {a.mean():.4f} "
              f"(диап {a.min():.3f}-{a.max():.3f})")
        print(f"  КОНТРОЛЬ, перемешанные метки   : {s.mean():.4f} "
              f"(диап {s.min():.3f}-{s.max():.3f})")
        art = np.array([res[k]["acc_artifact_mean"] for k in ks])
        print(f"  [дефектный вариант с артефактом]: {art.mean():.4f} "
              f"-- показан для документирования, НЕ результат")

    a1, _, k1 = acc["M1_plasticity_weakest"]
    a3, _, k3 = acc["M3_no_plasticity_weakest"]
    # парное сопоставление по одинаковым (sel, geom, growth, rep)
    m3 = {(k[0], k[1], k[2], k[4]): res[k]["acc_mean"] for k in k3}
    pairs = [(res[k]["acc_mean"], m3[(k[0], k[1], k[2], k[4])]) for k in k1
             if (k[0], k[1], k[2], k[4]) in m3]
    d = np.array([p[0] - p[1] for p in pairs])
    print(f"\n=== U2a = точность(M1) - точность(M3), парно по структуре")
    print(f"  n={len(d)}  среднее {d.mean():+.4f}  ст.откл {d.std():.4f}")
    print(f"  знаки: >0:{(d>0).sum()} =0:{(d==0).sum()} <0:{(d<0).sum()}")

    U2b = np.array([res[k]["U2b"] for k in k1])
    print(f"\n=== U2b = перекрёстный контраст по классам (M1)")
    print(f"  n={len(U2b)}  среднее {U2b.mean():+.4f}  ст.откл {U2b.std():.4f}")
    print(f"  знаки: >0:{(U2b>0).sum()} =0:{(U2b==0).sum()} <0:{(U2b<0).sum()}")
    for pos, name in ((0, "пара групп"), (1, "геометрия")):
        lv = sorted({k[pos] for k in k1}, key=str)
        ms = [U2b[[i for i, k in enumerate(k1) if k[pos] == l]].mean() for l in lv]
        same = all(np.sign(m) == np.sign(ms[0]) for m in ms)
        print(f"  по {name}: " + ", ".join(f"{l}={m:+.4f}" for l, m in zip(lv, ms))
              + f" | один знак: {same}")


if __name__ == "__main__":
    main()

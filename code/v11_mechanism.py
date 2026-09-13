"""v0.11 фаза 3, шаг 1: есть ли СТРУКТУРНАЯ причина у U1 и U3?

Гипотеза "быстрее, но менее устойчиво" непроверяема, пока U1 и U3 --
две поведенческие статистики с одних и тех же проб. Ищем величину,
которая могла бы порождать обе: суммарный вес связей ИСТОЧНИК -> ЦЕЛЬ.

dW -- перекрёстная форма, та же, что у U1 и структурного C в v0.8:
  dW = 1/2[(W_AB[B,A] - W_BA[B,A]) + (W_BA[A,B] - W_AB[A,B])]
Положительное dW = совпадающая по порядку ветвь имеет БОЛЬШИЙ вес в
выученном направлении.

Считается на СОХРАНЁННЫХ данных обучения, новых симуляций не требует.
Отдельно разделены вклад ВЕСОВ и вклад ТОПОЛОГИИ: dW_common -- только
по контактам, присутствующим в ОБЕИХ ветвях (чистое изменение весов);
dW_topo -- вклад контактов, существующих лишь в одной ветви.
"""
import pickle

import numpy as np


def block_sum(W, contacts, tgt, src, mask=None):
    b = W[np.ix_(tgt, src)]
    c = contacts[np.ix_(tgt, src)]
    m = c if mask is None else (c & mask)
    return float(b[m].sum())


def main():
    with open("v11_train_full.pkl", "rb") as f:
        T = pickle.load(f)
    with open("v11_measures_full.pkl", "rb") as f:
        M = pickle.load(f)

    rows = []
    for key, rec in T["results"].items():
        if key[3] != "M1_plasticity_weakest":
            continue
        gA, gB = rec["group_A"], rec["group_B"]
        Wab, Cab = rec["AB"]["weights"], rec["AB"]["contacts"]
        Wba, Cba = rec["BA"]["weights"], rec["BA"]["contacts"]

        # полный блок (веса + топология вместе)
        dW_A = block_sum(Wab, Cab, gB, gA) - block_sum(Wba, Cba, gB, gA)
        dW_B = block_sum(Wba, Cba, gA, gB) - block_sum(Wab, Cab, gA, gB)
        dW = 0.5 * (dW_A + dW_B)

        # только общие контакты -> чистый вклад ВЕСОВ
        comAB = Cab[np.ix_(gB, gA)] & Cba[np.ix_(gB, gA)]
        comBA = Cab[np.ix_(gA, gB)] & Cba[np.ix_(gA, gB)]
        dWc_A = (Wab[np.ix_(gB, gA)][comAB].sum() - Wba[np.ix_(gB, gA)][comAB].sum())
        dWc_B = (Wba[np.ix_(gA, gB)][comBA].sum() - Wab[np.ix_(gA, gB)][comBA].sum())
        dW_common = 0.5 * float(dWc_A + dWc_B)

        same_topo = bool(np.array_equal(Cab[np.ix_(gB, gA)], Cba[np.ix_(gB, gA)])
                         and np.array_equal(Cab[np.ix_(gA, gB)], Cba[np.ix_(gA, gB)]))

        m = M["results"][key]
        rows.append((key, dW, dW_common, dW - dW_common, same_topo,
                     m["U1"], m["U3"]))

    dW = np.array([r[1] for r in rows])
    dWc = np.array([r[2] for r in rows])
    dWt = np.array([r[3] for r in rows])
    topo_same = np.array([r[4] for r in rows])
    U1 = np.array([r[5] for r in rows])
    U3 = np.array([r[6] for r in rows])

    print(f"комбинаций M1: {len(rows)}")
    print(f"топология блока A-B ОДИНАКОВА в обеих ветвях: "
          f"{topo_same.sum()}/{len(rows)}\n")

    print("=== dW: вес в выученном направлении, совпадающая минус несовпадающая")
    print(f"  полный блок   : среднее {dW.mean():+.6f}  "
          f">0:{(dW>0).sum()} =0:{(dW==0).sum()} <0:{(dW<0).sum()}")
    print(f"  только веса   : среднее {dWc.mean():+.6f}  "
          f">0:{(dWc>0).sum()} =0:{(dWc==0).sum()} <0:{(dWc<0).sum()}")
    print(f"  вклад топологии: среднее {dWt.mean():+.6f}  "
          f">0:{(dWt>0).sum()} =0:{(dWt==0).sum()} <0:{(dWt<0).sum()}")

    def corr(a, b):
        if a.std() == 0 or b.std() == 0:
            return np.nan
        return float(np.corrcoef(a, b)[0, 1])

    print("\n=== Связь структурной величины с поведенческими мерами")
    print(f"  corr(dW, U1) = {corr(dW, U1):+.4f}   "
          f"corr(dW_веса, U1) = {corr(dWc, U1):+.4f}")
    print(f"  corr(dW, U3) = {corr(dW, U3):+.4f}   "
          f"corr(dW_веса, U3) = {corr(dWc, U3):+.4f}")
    print(f"  corr(U1, U3) = {corr(U1, U3):+.4f}  <- прямая связь двух мер")

    print("\n=== Разбивка dW по уровням")
    for pos, name in ((0, "пара групп"), (1, "геометрия")):
        lv = sorted({r[0][pos] for r in rows}, key=str)
        ms = [dW[[i for i, r in enumerate(rows) if r[0][pos] == l]].mean() for l in lv]
        same = all(np.sign(m) == np.sign(ms[0]) for m in ms)
        print(f"  {name}: " + ", ".join(f"{l}={m:+.5f}" for l, m in zip(lv, ms))
              + f" | один знак: {same}")

    np.save("v11_mechanism_dW.npy",
            np.array([[r[1], r[2], r[3], r[5], r[6]] for r in rows]))
    print("\nсохранено: v11_mechanism_dW.npy (dW, dW_веса, dW_топология, U1, U3)")


if __name__ == "__main__":
    main()

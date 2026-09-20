"""v61 -- ПО КАКОЙ ЦЕНЕ ПОКУПАЕТСЯ ЖИЗНЬ МЕЖДУ КАСАНИЯМИ

Правила чтения -- docs/DRIVE_SPEC.md, объявлены до этого файла.
Здесь они только исполняются. Выход -- прейскурант; никакое значение
drive по итогам не выбирается (DRIVE_SPEC §1).

Опыт А: вырастить при 0.8, поднять drive в состоянии выросшей сети.
Опыт Б: вырастить при поднятом drive с самого начала.

Меры: жизнь между касаниями (спайков/с в свободном прогоне),
адресуемость (мера v0.19 без изменений) с самопроверкой на
перемешанных метках, и доля ответивших узлов -- чтобы отличить
адресуемость от общего разгона (правило v0.21).
"""
import importlib.util
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import v37_self_built as v37
from sim_core import simulate
from v60_tick_tissue import free_run_tick

_spec = importlib.util.spec_from_file_location(
    "v19", os.path.join(os.path.dirname(os.path.abspath(__file__)), "v19_addressability.py"))
v19 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(v19)

BASE = {k: v for k, v in v37.GROWN.items() if k not in ("div_rate", "coupling", "drive")}
COUPLING = 10.0
DRIVES = [0.80, 0.85, 0.90, 0.95, 1.00]
SEEDS = list(range(501, 517))
FREE_DUR = 8.0
LIVE_BAR = 1.0                    # спайков в секунду -- планка объявлена в спецификации
ACC_BAR = 0.65                    # порог v0.21
SHUF_LO, SHUF_HI = 0.42, 0.58     # стражи самопроверки, v0.59


def grow(seed, drive):
    return simulate(seed=seed, div_rate=0.10, coupling=COUPLING,
                    duration=24.0, drive=drive, **BASE)


def spikes_per_sec(net):
    """Жизнь между касаниями: свободный прогон без входа, сила связи верная."""
    N = net["weights"].shape[0]
    _, log = free_run_tick(net, snapshot_times=(FREE_DUR - 2.0,), pre_run=2.0,
                           seed=5000, budget=float(N), earn="поровну",
                           coupling=COUPLING, track=True)
    return float(log["spikes"].sum()) / FREE_DUR


def addressability(net, rng_seed):
    pos = net["positions"]
    a, b = v19.pick_groups(pos)
    if a is None:
        return None
    keep = np.setdiff1d(np.arange(len(pos)), np.concatenate([a, b]))
    acc = v19.accuracy(net, a, b, keep, np.random.default_rng(rng_seed), coupling=COUPLING)
    shuf = v19.accuracy(net, a, b, keep, np.random.default_rng(rng_seed),
                        shuffle=True, coupling=COUPLING)
    # доля незатронутых узлов, ответивших на касание -- общий разгон или нет
    noise = 0.012 * np.random.default_rng(rng_seed + 7).standard_normal(
        (int(v19.DUR / v19.DT), len(pos)))
    from sim_core import probe
    sp = probe(net, noise, a, transmission=True, stimulus=True, coupling=COUPLING)
    seg = sp[v19.WIN[0]:v19.WIN[1]][:, keep]
    responded = float((seg.sum(axis=0) > 0).mean())
    return acc, shuf, responded


def one(net, seed):
    return {"spikes_s": spikes_per_sec(net), "N": int(net["weights"].shape[0]),
            "addr": addressability(net, seed)}


def main():
    rows = []
    print("ПО КАКОЙ ЦЕНЕ ПОКУПАЕТСЯ ЖИЗНЬ МЕЖДУ КАСАНИЯМИ")
    print(f"сетка drive {DRIVES}, порог 1.000; {len(SEEDS)} сидов; сила связи {COUPLING}")
    print("правила чтения -- docs/DRIVE_SPEC.md, объявлены до прогона\n")

    base_nets = {}
    for seed in SEEDS:
        base_nets[seed] = grow(seed, 0.80)

    for kind in ("А", "Б"):
        print(f"--- опыт {kind}: " +
              ("поднимаем drive у выросшей при 0.8" if kind == "А"
               else "растим при поднятом drive") + " ---")
        print(" drive | зазор,шумов | спайков/с | живых сетей | адресуемость | самопроверка | ответило узлов")
        for d in DRIVES:
            got = []
            for seed in SEEDS:
                if kind == "А":
                    net = base_nets[seed]
                    net = dict(net)
                    st = {k: v.copy() if hasattr(v, "copy") else v for k, v in net["state"].items()}
                    st["drive"] = np.full_like(st["drive"], d)
                    net["state"] = st
                else:
                    net = grow(seed, d)
                r = one(net, seed)
                if r["addr"] is None:
                    continue
                got.append(r)
            sp = np.array([r["spikes_s"] for r in got])
            acc = np.array([r["addr"][0] for r in got])
            shuf = np.array([r["addr"][1] for r in got])
            resp = np.array([r["addr"][2] for r in got])
            ok = (shuf >= SHUF_LO) & (shuf <= SHUF_HI)
            alive = int((sp >= LIVE_BAR).sum())
            rows.append({"kind": kind, "drive": d, "spikes_s": sp.tolist(),
                         "acc": acc.tolist(), "shuf": shuf.tolist(),
                         "responded": resp.tolist(), "n": len(got)})
            gap = (1.0 - d) / 0.038
            am = acc[ok].mean() if ok.any() else float("nan")
            print(f"{d:6.2f} | {gap:11.1f} | {sp.mean():9.2f} | {alive:4d}/{len(got):<6d} | "
                  f"{am:12.3f} | {shuf.mean():12.3f} | {resp.mean()*100:13.1f}%"
                  + ("" if ok.all() else f"   <- самопроверка вне стражей у {int((~ok).sum())}"))
        print()

    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "..", "data", "v61_drive_price.json"), "w") as fh:
        json.dump(rows, fh)

    # --- чтение по объявленному правилу ---
    print("=" * 72)
    for kind in ("А", "Б"):
        sub = [r for r in rows if r["kind"] == kind]
        both = []
        for r in sub:
            sp = np.array(r["spikes_s"]); acc = np.array(r["acc"])
            shuf = np.array(r["shuf"]); resp = np.array(r["responded"])
            ok = (shuf >= SHUF_LO) & (shuf <= SHUF_HI)
            lives = sp.mean() >= LIVE_BAR
            addressed = ok.any() and acc[ok].mean() >= ACC_BAR
            partial = resp.mean() < 0.9
            if lives and addressed and partial:
                both.append(r["drive"])
        any_life = any(np.mean(r["spikes_s"]) >= LIVE_BAR for r in sub)
        print(f"опыт {kind}:")
        if both:
            print(f"  ОБА УСЛОВИЯ ВЫПОЛНЕНЫ при drive {both}: жизнь есть, адресуемость цела,")
            print("  отвечает не вся сеть. Цена не та, которой боялись в v0.21.")
            print("  ПРЕДСКАЗАНИЕ (DRIVE_SPEC §6) НЕ СБЫЛОСЬ.")
        elif not any_life:
            print("  ЖИЗНЬ НЕ ПОЯВИЛАСЬ НИГДЕ на сетке: drive не тот рычаг,")
            print("  и развилка RUDIMENT_SPEC §8 теряет путь А.")
        else:
            print("  РАЗМЕН ПОДТВЕРЖДЁН: жизнь появляется только там, где адресуемость")
            print("  ниже порога либо отвечает вся сеть. Прейскурант напечатан выше.")
            print("  ПРЕДСКАЗАНИЕ (DRIVE_SPEC §6) СБЫЛОСЬ.")
    print("\nНикакое значение drive по итогам НЕ выбирается (DRIVE_SPEC §1).")
    print("Строка 0 RUDIMENT_SPEC этим не закрывается (DRIVE_SPEC §7).")


if __name__ == "__main__":
    main()

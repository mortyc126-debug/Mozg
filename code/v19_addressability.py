"""v0.19: АДРЕСУЕМА ли ткань -- говорит ли активность, ГДЕ было событие.

Это первый шаг по PRINCIPLES п.2a: мера берётся цифровая, а не
заимствованная у нейрофизиологии культур. До сих пор функциональность
проверялась частотой разрядов и согласованностью спайков -- то есть
вопросом "ведёт ли себя ткань как культура в чашке". По такой линейке
каждый возникший уровень организации выходил немым (v0.14, v0.16,
v0.18). Цифровая валюта другая: сколько из состояния можно ПРОЧЕСТЬ.

ВОПРОС. Два участка ткани, A слева и B справа. Один из них получает
известное событие. Можно ли по активности ОСТАЛЬНЫХ узлов сказать,
какой именно? Если да -- ткань адресуема: активность несёт сведения о
месте. Это же прямо относится к требованию Ф6 ("активность
распространяется в пространстве"), закрытому отрицательно в v0.12 --
но тогда у ткани не было ни состояний, ни границ.

УСЛОВИЯ, плотность выравнена (урок №30):
  ГРАНИЦА  -- дифференцировка 0.5, притяжение состояний 1, радиус 0.285;
  КОНТРОЛЬ -- дифференцировка 0.5, притяжения нет, радиус 0.25.
Геометрия у пары одна: позиции берутся из одного seed'а, стимулируемые
узлы -- одни и те же. Отличается только правило роста связей.

ПРИЗНАКИ. Спайки узлов, НЕ входящих ни в A, ни в B, в окне строго ПОСЛЕ
импульса. Стимулированные узлы исключены -- иначе признак содержал бы
саму метку (ловушка №20, на которой проект уже обжёгся).

КЛАССИФИКАТОР. Ближайший центроид с перекрёстной проверкой по 5 блокам,
признаки стандартизуются по обучающей части. Пары A/B прогоняются на
ОДНОМ И ТОМ ЖЕ шуме -- сравнивается воздействие, а не реализация шума.

ДВЕ ПЕРВЫЕ РЕДАКЦИИ ДАВАЛИ ТОЧНОСТЬ РОВНО 0.000, и разбор стоит читать
прежде результата.

Первая мысль была на скользящий контроль (leave-one-out): при исключении
точки центроид её же класса смещается от неё. Замена на блоки НИЧЕГО НЕ
ИЗМЕНИЛА -- значит догадка была неверна, и пришлось смотреть в данные.

Настоящая причина -- УТЕЧКА ЧЕРЕЗ ПАРНОСТЬ. Пара A/B прогоняется на одном
и том же шуме, чтобы сравнивалось воздействие, а не реализация шума. Но
признаки определяются шумом сильнее, чем стимуляцией (в окне около 64
спайков на пробу, а разница между классами -- порядка 5). При разбиении
по ОТДЕЛЬНЫМ пробам близнец тестовой точки, несущий ПРОТИВОПОЛОЖНУЮ
метку и тот же шум, попадает в обучающую часть. Тестовая точка
оказывается ближе к нему, чем к своему классу, и ошибка систематична --
отсюда ровно 0.000, а не 0.5.

Парность, введённая ради честного сравнения, стала утечкой в
перекрёстной проверке. ИСПРАВЛЕНО: блоки нарезаются ПО ПАРАМ -- оба
члена пары всегда по одну сторону разбиения. Поймано объявленной
самопроверкой до чтения результата.

САМОПРОВЕРКИ, обязательные к выводу ДО обсуждения результата:
  * перемешанные метки обязаны дать около 0.5 -- иначе течёт метод;
  * БЕЗ ПЕРЕДАЧИ (transmission=False) обязана дать около 0.5: если
    импульс не может никуда дойти, остальные узлы о нём знать не могут.
    Это проверка, что сигнал идёт ЧЕРЕЗ СЕТЬ, а не через артефакт.

МОЩНОСТЬ выбрана ОДИН РАЗ до основного прогона и больше не менялась:
40 проб на класс и 4 корзины (256 признаков вместо 640). Сигнал слабый --
в окне около 64 спайков на пробу, а разница между классами порядка 5, --
поэтому меньше признаков и больше проб. Это выбор мощности, а не подбор
результата: перебора вариантов не было.

ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
  * если обе самопроверки не около 0.5 -- результат не читается вовсе;
  * адресуемость есть, если точность заметно выше 0.5 хотя бы в одном
    условии (не менее 0.65 в среднем);
  * границы помогают, если точность в ГРАНИЦЕ выше, чем в КОНТРОЛЕ, не
    менее чем на 5/6 seed'ов ПРИ ВЫРАВНЕННОЙ ПЛОТНОСТИ;
  * если обе около 0.5 -- ткань пространственно слепа и со структурой:
    Ф6 остаётся невыполненным, и немота была НЕ линейкой. Это тоже
    результат, и он записывается именно так.
"""
import os
import sys
import numpy as np

sys.path.insert(0, "code")
from sim_core import simulate, probe

SEEDS = [int(x) for x in os.environ.get(
    "SEEDS", ",".join(map(str, range(501, 517)))).split(",")]
ETA = 0.5
GROUP = 8                  # узлов в каждом участке
TRIALS = 40                # прогонов на класс
DT = 0.001
DUR = 1.2                  # с; импульс на 0.5 с
PULSE = int(0.5 / DT)
WIN = (PULSE + 20, PULSE + 220)    # окно признаков: строго ПОСЛЕ импульса
BINS = 4


def pick_groups(pos):
    """A -- слева, B -- справа; по GROUP узлов, ближайших к центру участка."""
    left = np.where(pos[:, 0] < 0.35)[0]
    right = np.where(pos[:, 0] > 0.65)[0]
    if len(left) < GROUP or len(right) < GROUP:
        return None, None
    a = left[np.argsort(np.abs(pos[left, 1] - 0.5))][:GROUP]
    b = right[np.argsort(np.abs(pos[right, 1] - 0.5))][:GROUP]
    return np.sort(a), np.sort(b)


def features(spikes, keep):
    """Спайки незатронутых узлов в окне, по BINS корзинам."""
    seg = spikes[WIN[0]:WIN[1]][:, keep]
    w = seg.shape[0] // BINS
    return seg[:w * BINS].reshape(BINS, w, -1).sum(axis=1).ravel().astype(float)


def cv_nearest_centroid(X, y, groups, folds=5):
    """Перекрёстная проверка по блокам, нарезанным ПО ПАРАМ.

    groups -- номер пробы: у пары A/B он один. Оба члена пары всегда по
    одну сторону разбиения, иначе близнец с противоположной меткой и тем
    же шумом попадает в обучение и утягивает тестовую точку к чужому
    классу."""
    n = len(y)
    idx = np.arange(n)
    ok = tot = 0
    for f in range(folds):
        te = idx[np.isin(groups, np.unique(groups)[f::folds])]
        tr = np.setdiff1d(idx, te)
        if len(np.unique(y[tr])) < 2:
            continue
        Xt, yt = X[tr], y[tr]
        mu, sd = Xt.mean(axis=0), Xt.std(axis=0)
        sd = np.where(sd > 1e-9, sd, 1.0)
        Z = (Xt - mu) / sd
        c0, c1 = Z[yt == 0].mean(axis=0), Z[yt == 1].mean(axis=0)
        for i in te:
            z = (X[i] - mu) / sd
            pred = int(np.linalg.norm(z - c1) < np.linalg.norm(z - c0))
            ok += int(pred == y[i]); tot += 1
    return ok / tot if tot else np.nan


def accuracy(net, a, b, keep, rng, transmission=True, shuffle=False, coupling=1.0):
    X, y, g = [], [], []
    steps = int(DUR / DT)
    for trial in range(TRIALS):
        noise = 0.012 * rng.standard_normal((steps, len(net["state"]["v"])))
        for lab, grp in ((0, a), (1, b)):
            sp = probe(net, noise, grp, transmission=transmission,
                       stimulus=True, coupling=coupling)
            X.append(features(sp, keep)); y.append(lab); g.append(trial)
    X, y, g = np.array(X), np.array(y), np.array(g)
    if shuffle:
        y = rng.permutation(y)
    return cv_nearest_centroid(X, y, g)


def main():
    conds = {"ГРАНИЦА": dict(state_affinity=1.0, contact_radius=0.285),
             "КОНТРОЛЬ": dict(state_affinity=0.0, contact_radius=0.25)}
    acc = {c: [] for c in conds}
    shuf = {c: [] for c in conds}
    notr = {c: [] for c in conds}
    degs = {c: [] for c in conds}
    used = []

    for seed in SEEDS:
        r0 = simulate(seed=seed, drive=1.175, gradual_growth=False,
                      differentiation=ETA, **conds["КОНТРОЛЬ"])
        a, b = pick_groups(r0["positions"])
        if a is None:
            continue
        keep = np.setdiff1d(np.arange(len(r0["positions"])), np.concatenate([a, b]))
        used.append(seed)
        for name, kw in conds.items():
            r = (r0 if name == "КОНТРОЛЬ" else
                 simulate(seed=seed, drive=1.175, gradual_growth=False,
                          differentiation=ETA, **kw))
            degs[name].append(float(r["contacts"].sum(axis=1).mean()))
            acc[name].append(accuracy(r, a, b, keep, np.random.default_rng(seed)))
            shuf[name].append(accuracy(r, a, b, keep, np.random.default_rng(seed),
                                       shuffle=True))
            notr[name].append(accuracy(r, a, b, keep, np.random.default_rng(seed),
                                       transmission=False))

    n = len(used)
    ref = np.mean(degs["КОНТРОЛЬ"])
    print(f"seed'ов использовано: {n} из {len(SEEDS)}; "
          f"в каждом участке {GROUP} узлов, признаков "
          f"{(80 - 2 * GROUP) * BINS}, проб на класс {TRIALS}\n")
    print("ПРОВЕРКА ВЫРАВНИВАНИЯ (порог 10%), до обсуждения результата:")
    for c in conds:
        d = np.mean(degs[c])
        print(f"  {c:<9}: соседей {d:6.3f}  расхождение {abs(d-ref)/ref*100:5.2f}% "
              f"-- {'ЧИТАЕМО' if abs(d-ref)/ref <= 0.10 else 'НЕ ЧИТАЕМО'}")

    print("\nСАМОПРОВЕРКИ (обязаны быть около 0.5):")
    for c in conds:
        print(f"  {c:<9}: перемешанные метки {np.mean(shuf[c]):.3f};  "
              f"без передачи {np.mean(notr[c]):.3f}")

    print(f"\n{'условие':<9} | {'точность':>18} | {'выше контроля':>14}")
    for c in conds:
        A = np.array(acc[c])
        up = (int(np.sum(A > np.array(acc["КОНТРОЛЬ"])))
              if c != "КОНТРОЛЬ" else 0)
        print(f"{c:<9} | {A.mean():>8.3f} +- {A.std():.3f} | "
              f"{(str(up) + ' из ' + str(n)) if c != 'КОНТРОЛЬ' else '--':>14}")

    thr = int(np.ceil(n * 5 / 6))
    okself = all(abs(np.mean(shuf[c]) - 0.5) < 0.1 and abs(np.mean(notr[c]) - 0.5) < 0.1
                 for c in conds)
    print(f"\nЧТЕНИЕ ПО ОБЪЯВЛЕННОМУ ПРАВИЛУ (порог {thr} из {n}):")
    print(f"  самопроверки: {'пройдены' if okself else 'НЕ ПРОЙДЕНЫ -- результат не читается'}")
    if okself:
        best = max(conds, key=lambda c: np.mean(acc[c]))
        print(f"  адресуемость: лучшая точность {np.mean(acc[best]):.3f} ({best}) -- "
              f"{'ЕСТЬ' if np.mean(acc[best]) >= 0.65 else 'НЕТ: ткань пространственно слепа'}")
        up = int(np.sum(np.array(acc['ГРАНИЦА']) > np.array(acc['КОНТРОЛЬ'])))
        print(f"  границы помогают: {up} из {n} -- "
              f"{'ДА' if up >= thr else 'НЕ ПОДТВЕРЖДЕНО'}")


if __name__ == "__main__":
    main()

# RUNBOOK.md

## Организация проекта (актуально начиная с релиза v0.7_corrected)

Единственный источник истины -- рабочая директория со структурой:

```
project/
    docs/          <- единственные редактируемые документы (.md, .csv, self_checks.py)
    code/          <- актуальный код (плоская структура, все .py в одной папке)
    data/          <- данные (.pkl, .png, .csv, .npz)
    tools/         <- build_release.py, verify_manifest.py
    releases/      <- готовые архивы + MANIFEST.sha256, ВРУЧНУЮ НЕ РЕДАКТИРУЮТСЯ
```

**Правило:** документацию и код редактируют ТОЛЬКО в `docs/`/`code/`/`data/`.
Промежуточные рабочие копии (вроде прежних `updated_docs/`,
`handoff_package/`) НЕ должны становиться параллельными источниками
истины -- если такая копия создаётся для проверки, она одноразовая и
удаляется после использования, а не служит источником для следующей
сборки.

Сборка релиза (архив включает docs/code/data/tools -- инструменты сборки
и проверки входят в САМ пакет, иначе следующая сессия получит
инструкции без утилит для их выполнения):
```bash
cd project
python3 tools/build_release.py <release_name>
# создаёт releases/<release_name>.tar.gz (docs/ + code/ + data/ + tools/)
#          releases/<release_name>_MANIFEST.sha256 (покрывает все 4 директории)
```

Проверка распакованного пакета против манифеста (в т.ч. после передачи
между сессиями/носителями):
```bash
python3 tools/verify_manifest.py <extracted_dir> <manifest.sha256>
```

`docs/DATA_INDEX.csv` по-прежнему индексирует только код и данные (как
раньше). `MANIFEST.sha256` в `releases/` дополнительно покрывает и
документацию, и сами инструменты (`tools/`) -- это ПОЛНЫЙ манифест
собранного пакета, автоматически генерируется `build_release.py`,
вручную не редактируется и не пересчитывается по частям.

Число файлов в манифесте растёт ТОЛЬКО за счёт новых файлов (новые
скрипты + новые файлы данных), НЕ за счёт правок уже существующих
документов -- обновление содержимого HANDOFF.md/RESULTS_LEDGER.md/
MODEL_SPEC.md не увеличивает счётчик, т.к. это те же имена файлов с
новым содержимым, не новые записи. При сверке "было X, добавилось Y,
стало X+Y" проверяй это утверждение по факту (`wc -l` на манифесте до и
после), а не только логически -- рассинхронизация между директориями и
последним собранным манифестом возможна, если файлы добавлялись в
data/code между сборками релизов.

Git можно использовать локально для истории изменений `docs/`/`code/`
(без внешнего репозитория, если git установлен и рабочая директория
сохраняется между сессиями) -- манифест проверяет целостность
конкретного среза, но не заменяет историю правок. Не настроено на
данный момент; не блокирует текущую работу.

## Окружение

- Python 3.12.3
- numpy 2.4.4
- matplotlib 3.10.8
- Рабочая директория: /home/claude/sim (в исходной среде). При переносе
  в новую среду -- воссоздать ту же плоскую структуру (все .py файлы в
  одной директории; recovery_v02/ и recovery_plots/ как поддиректории).

### Перенос в новую среду (проверено 2026-09-13)

Пакет перенесён и проверен под Python 3.12.x / **numpy 2.4.6 /
matplotlib 3.11.2** -- версии ВЫШЕ зафиксированных выше. Поскольку
проект опирается на побитовые сравнения (`np.array_equal` без допуска,
см. RESULTS_LEDGER.md пункт 14), совместимость проверена ФАКТОМ, а не
предположением о стабильности API:

1. Поток RNG побитово идентичен: `np.random.default_rng(11).uniform(
   0,1,size=(80,2))` совпал (`np.array_equal`) с архивным `positions`
   из `v05_four_conditions.pkl`.
2. `python3 v06_extended_growth.py` -- ВСЕ 12 комбинаций (3 геометрии x
   4 условия) точно совпали и со свежим вызовом `simulate_v05()`, и с
   архивным `v05_four_conditions.pkl`.
3. Структурные числа v0.5 воспроизведены из архива точно: контакты
   seed=11 952/828/592/588, взаимодействие I=+120 (совпадает с
   RESULTS_LEDGER.md пункт 11).

Вывод: на numpy 2.4.6 результаты пакета воспроизводятся побитово.
Это НЕ гарантия для произвольной будущей версии -- при следующем
переносе повторить те же три проверки (они занимают минуты), а не
полагаться на эту запись.

**Плоская структура через симлинки.** Пакет разложен по
`docs/`/`code/`/`data/`, а скрипты и RUNBOOK написаны под плоскую
структуру (все .py и .pkl рядом). Рабочая директория собирается без
копирования данных:
```bash
mkdir -p run && cd run && ln -sf ../code/*.py . && ln -sf ../data/* .
```
Все команды ниже запускать из `run/`. Директория одноразовая,
в git не версионируется (см. .gitignore) -- это НЕ параллельный
источник истины, правки по-прежнему только в `code/`/`docs/`/`data/`.

Установка (если нужно): `pip install numpy matplotlib --break-system-packages`

## КРИТИЧЕСКИ ВАЖНО: модули, выполняющие вычисления при импорте

Следующие файлы запускают ПОЛНУЮ СИМУЛЯЦИЮ на верхнем уровне модуля
(не под `if __name__ == "__main__":`), то есть простой `import sequence_test`
запустит тяжёлые вычисления:

- **sequence_test.py**: строка 366, `result = sequence_test()` -- один
  прогон simulate(seed=11) + train_weights AB/BA + specificity анализ.
  Занимает заметное время (несколько секунд).
- **trace_diag.py**: строка 195, `diagnostics = inspect_sequence(result)`
  -- ЗАВИСИТ от импорта sequence_test.py (см. выше, `from sequence_test
  import result`), то есть импорт trace_diag.py каскадно запускает ОБА
  тяжёлых вычисления.

Если в новом чате нужно переиспользовать функции из этих файлов БЕЗ
повторного запуска -- либо скопировать только нужные функции в новый
файл, либо обернуть верхнеуровневый код в `if __name__ == "__main__":`
перед импортом (это безопасная правка, не меняющая логику).

Все остальные файлы либо:
(а) безопасны для импорта (только определения функций, весь
    исполняемый код под `if __name__`), например: sim_core.py,
    regime_map.py, v03_rhythm_origin.py, v03_cyclic_shift.py,
    v04_regional.py, v04_localization.py, v04_recompute_final.py,
    v05_growth_rules.py, v5f.py, audit_v5.py, recovery_probe.py,
    v05_functional.py, v06_extended_growth.py, v06_structural_summary.py,
    v07_rewiring.py;
(б) написаны как ЦЕЛЬНЫЕ СКРИПТЫ для запуска через
    `python3 script.py`, а не для импорта (весь код на верхнем уровне,
    без функций-обёрток): v04_paired_analysis.py, v04_minimal_audit.py,
    v04_contrast_table.py, v04_four_windows_analysis.py,
    cross_network_summary.py, analyze_recovery.py (частично),
    summarize_recovery.py, plot_recovery.py, quantitative_recovery.py.
    Импортировать их не нужно -- только запускать как скрипт.

## Команды: ТОЛЬКО ЧТЕНИЕ сохранённых данных (безопасно, быстро)

```bash
# v0.5 -- посмотреть готовые структуры без пересчёта
python3 -c "
import pickle
with open('v05_four_conditions.pkl','rb') as f: d = pickle.load(f)
print(list(d.keys()))
print(d['Исходное'][0].keys())
"

# v0.4 -- финальные данные функционального теста (R, F по 4 окнам + 200мс)
python3 v04_contrast_table.py     # печатает таблицы, не запускает симуляции

# v0.5 функциональный тест -- посмотреть агрегированные результаты без пересчёта
python3 -c "
import pickle
with open('v05_functional_full_324.pkl','rb') as f: d = pickle.load(f)
print('n results:', len(d['results']), 'n checkpoints:', len(d['checkpoints']))
print(d['results'][0].keys())
"

# v0.3 -- recovery-протокол (36 пар), количественный анализ лага
python3 quantitative_recovery.py  # ВНИМАНИЕ: этот файл делает И анализ,
                                    # И относится к уже сохранённым .npz
                                    # в recovery_v02/ -- проверить внутри
                                    # файла, не пересчитывает ли он всё
                                    # заново (использует ли open()/load()
                                    # или заново вызывает train_weights)

# Аналогичные скрипты, только читающие recovery_v02/*.npz:
python3 analyze_recovery.py       # печатает разбор одного файла
python3 summarize_recovery.py     # сводка по всем 36 парам
python3 plot_recovery.py          # строит графики (создаёт recovery_plots/)
```

## Команды: ЗАПУСК новых симуляций (тяжёлые, с оценкой времени)

Ориентировочное время дано по опыту исходной среды; в новой среде может
отличаться.

```bash
# Одна базовая сеть (v0.1 ядро) -- быстро, ~2-5 сек
python3 -c "from sim_core import simulate; net = simulate(seed=11); print(net['metrics'])"

# v0.2 картография 5x5 -- ~1 минута
python3 regime_map.py

# v0.2 окрестность 3x3x3 повтора x 12с прогрев -- несколько минут
python3 regime_neighborhood.py

# v0.3 пять условий x 3 шума x 14с -- около 1-2 минуты
python3 v03_rhythm_origin.py

# v0.3 cyclic-shift контроль (3 шума x 5 условий x 100 перемешиваний) -- быстро, секунды
python3 v03_cyclic_shift.py

# v0.4 региональный факторный тест (3 варианта x 4 источника x 5x5 состояний/шумов)
python3 v04_recompute_final.py    # ~несколько минут, ЭТО ФИНАЛЬНАЯ версия
                                    # с полными R/F по 4 окнам + 200мс

# v0.5 структурный факторный эксперимент (3 сида x 4 условия)
python3 v5f.py                     # несколько минут (питоновский for-loop
                                    # по 80 узлам внутри бюджетной логики)

# v0.5 функциональный тест (324 пары) -- ~9 секунд
python3 v05_full_run.py

# v0.6 строгая проверка честности продолжения (12 комбинаций) -- быстро
python3 v06_extended_growth.py     # безопасно перезапускать повторно,
                                    # секунды на комбинацию, только печать

# v0.6 полный структурный прогон (12 траекторий x 4 снимка до 96с) -- ~76с
python3 v06_full_run.py

# v0.6 функциональный тест на снимках t=96с (324 пары) -- ~9 секунд
python3 v06_functional_96s.py      # требует v06_extended_growth_full.pkl

# v0.7 полный запуск структурной пластичности (36 траекторий) -- ~15с
python3 v07_full_run.py            # требует v06_extended_growth_full.pkl

# v0.7 функциональный тест на снимках t=24с, БЕЗ доп. прогрева (324 пары) -- ~2с
python3 v07_functional_full.py     # требует v07_rewiring_full.pkl
```

## Команды: НЕ запускать без явного согласования (очень тяжёлые/большие)

```bash
python3 recovery_expand36.py       # создаёт recovery_v02/ (~370 МБ),
                                     # 36 пар с полными растрами+traces
python3 full_protocol.py           # УСТАРЕВШИЙ протокол с известной
                                     # ошибкой смешения стадии развития
                                     # и обучения -- не запускать, замена:
                                     # corrected_protocol.py
```

## Входы/выходы ключевых скриптов

| Скрипт | Вход | Выход |
|---|---|---|
| sim_core.py | -- (библиотека) | -- |
| v5f.py | -- | v05_four_conditions.pkl (~13 МБ) |
| v05_functional.py | -- (библиотека: frozen_step, probe, make_noise) | -- |
| v05_pilot.py | v05_four_conditions.pkl | v05_pilot_record.pkl (~32 КБ), печать проверок в stdout |
| v05_full_run.py | v05_four_conditions.pkl, v05_functional.py | v05_functional_full_324.pkl (~10.1 МБ) |
| v06_extended_growth.py | -- (библиотека: simulate_v05_snapshots, verify_snapshot_matches_v05) | -- (при запуске как скрипт: печать строгой проверки в stdout) |
| v06_structural_summary.py | -- (библиотека: compute_capacity, jaccard, structural_summary) | -- |
| v06_full_run.py | v06_extended_growth.py, v06_structural_summary.py | v06_extended_growth_full.pkl (~6.8 МБ) |
| v06_functional_96s.py | v06_extended_growth_full.pkl, v05_functional.py | v06_functional_96s_full_324.pkl (~10.1 МБ) |
| v07_rewiring.py | -- (библиотека: run_rewiring_trajectory, verify_invariants) | -- |
| v07_full_run.py | v06_extended_growth_full.pkl, v07_rewiring.py | v07_rewiring_full.pkl (~72 МБ) |
| v07_functional_full.py | v07_rewiring_full.pkl, v05_functional.py | v07_functional_full_324.pkl (~10 МБ) |
| v07_variance_decomposition.py | v07_functional_full_324.pkl | -- (печать в stdout) |
| v04_recompute_final.py | -- (пересчитывает с нуля через build_variant_networks) | v04_final_data.pkl (~270 КБ) |
| v04_contrast_table.py | v04_final_data.pkl | печать таблиц в stdout |
| quantitative_recovery.py | recovery_v02/manifest.csv + *.npz | recovery_quantitative_summary.csv |
| recovery_expand36.py | -- | recovery_v02/*.npz + manifest.csv |
| audit_v5.py | -- (вызывает simulate_with_growth_rule заново) | печать в stdout |

## Объём хранения уже выполненных запусков (на момент передачи)

```
recovery_v02/            369 МБ  (36 .npz файлов по ~10.7 МБ + manifest.csv)
v05_four_conditions.pkl   13 МБ
v05_functional_full_324.pkl 10.1 МБ (324 пары функционального теста v0.5)
v06_extended_growth_full.pkl 6.8 МБ (12 траекторий x 4 снимка, структурная часть v0.6)
v06_functional_96s_full_324.pkl 10.1 МБ (324 пары функционального теста на снимках t=96с)
v07_rewiring_full.pkl    72.4 МБ (36 траекторий структурной пластичности, включая полные растры 24000x80 на траекторию)
v07_functional_full_324.pkl 10.0 МБ (324 пары функционального теста на снимках t=24с)
v04_all_windows_data.pkl 463 КБ
v04_final_data.pkl        274 КБ
v04_raw_paired_data.pkl    40 КБ
pilot_2s_probe.npz        10.7 МБ (устаревший одиночный пилот)
Все *.png графики          ~1.5 МБ суммарно
Все *.py файлы              ~350 КБ суммарно
ИТОГО ~480 МБ (без recovery_v02/: ~110 МБ)
```

## Лёгкие самопроверки (безопасно запускать всегда)

```bash
# Проверка версий окружения
python3 -c "import numpy, matplotlib; print(numpy.__version__, matplotlib.__version__)"

# Проверка доступности ключевых файлов
python3 -c "
import os
required = ['sim_core.py', 'v5f.py', 'v04_regional.py', 'v04_recompute_final.py',
            'v05_four_conditions.pkl', 'v04_final_data.pkl']
for f in required:
    print(f, 'OK' if os.path.exists(f) else 'MISSING')
"

# Проверка целостности v05_four_conditions.pkl (без пересчёта)
python3 -c "
import pickle, numpy as np
with open('v05_four_conditions.pkl','rb') as f: d = pickle.load(f)
for name, runs in d.items():
    for net in runs:
        assert net['contacts'].shape == (80,80)
        assert net['weights'].shape == (80,80)
        assert np.isfinite(net['weights']).all()
        assert not net['contacts'].diagonal().any(), 'diagonal contact found!'
        if 'Только бюджет' in name or 'Совместное' in name:
            assert net['contacts'].sum(axis=1).max() <= 12, 'budget exceeded!'
print('v05_four_conditions.pkl: все проверки пройдены')
"

# Проверка целостности v05_functional_full_324.pkl (без пересчёта)
python3 -c "
import pickle, numpy as np
with open('v05_functional_full_324.pkl','rb') as f: d = pickle.load(f)
assert len(d['results']) == 324
assert len(d['checkpoints']) == 36
for r in d['results']:
    assert r['baseline_spikes'].shape == (200, 80)
    assert r['stimulated_spikes'].shape == (200, 80)
    assert len(r['R_windows']) == 4 and len(r['F_windows']) == 4
print('v05_functional_full_324.pkl: базовые проверки пройдены')
"

# Проверка целостности v06_extended_growth_full.pkl (без пересчёта)
python3 -c "
import pickle, numpy as np
with open('v06_extended_growth_full.pkl','rb') as f: d = pickle.load(f)
assert set(d['seeds']) == {11,22,33}
assert len(d['conditions']) == 4
for seed in d['seeds']:
    for cond in d['conditions']:
        for t in d['duration_snapshots']:
            snap = d['snapshots'][seed][cond][t]
            assert snap['contacts'].shape == (80,80)
            assert not snap['contacts'].diagonal().any()
            assert np.isfinite(snap['weights']).all()
            summ = d['summaries'][seed][cond][t]
            assert 0.0 <= summ['fill_fraction'] <= 1.0 + 1e-9
print('v06_extended_growth_full.pkl: базовые проверки пройдены')
"

# Проверка целостности v06_functional_96s_full_324.pkl (без пересчёта)
python3 -c "
import pickle, numpy as np
with open('v06_functional_96s_full_324.pkl','rb') as f: d = pickle.load(f)
assert len(d['results']) == 324
assert len(d['checkpoints']) == 36
assert d['snapshot_time'] == 96.0
for r in d['results']:
    assert r['baseline_spikes'].shape == (200, 80)
    assert r['stimulated_spikes'].shape == (200, 80)
print('v06_functional_96s_full_324.pkl: базовые проверки пройдены')
"

# Проверка целостности v07_rewiring_full.pkl (без пересчёта)
python3 -c "
import pickle, numpy as np
with open('v07_rewiring_full.pkl','rb') as f: d = pickle.load(f)
assert len(d['results']) == 36
for key, r in d['results'].items():
    assert r['spikes'].shape == (24000, 80)
    assert set(r['snapshots'].keys()) == {0.0, 12.0, 24.0}
    ok = all(v for k,v in r['invariant_checks'].items() if isinstance(v,(bool,np.bool_)))
    assert ok, f'инварианты нарушены для {key}'
print('v07_rewiring_full.pkl: базовые проверки пройдены')
"

# Проверка целостности v07_functional_full_324.pkl (без пересчёта)
python3 -c "
import pickle, numpy as np
with open('v07_functional_full_324.pkl','rb') as f: d = pickle.load(f)
assert len(d['results']) == 324
for r in d['results']:
    assert r['baseline_spikes'].shape == (200, 80)
    assert r['stimulated_spikes'].shape == (200, 80)
print('v07_functional_full_324.pkl: базовые проверки пройдены')
"

# Самопроверка знака лага (должна пройти -- если нет, проверить
# normalized_xcorr в quantitative_recovery.py)
python3 -c "
from quantitative_recovery import self_test_sign_convention
ok = self_test_sign_convention()
assert ok
"
```

Эти проверки НЕ доказывают полную корректность модели -- только
структурную целостность сохранённых данных и работоспособность
критической функции (знак лага), которая один раз уже была найдена
неверной.

## Структура малого архива (project_core_handoff.tar.gz)

Архив НЕ плоский -- три поддиректории:
```
docs/   -- вся документация (.md, DATA_INDEX.csv, self_checks.py)
code/   -- все актуальные .py файлы (без поддиректорий)
data/   -- v05_four_conditions.pkl, v04_final_data.pkl, графики, CSV
```

Перед запуском кода объедините code/ и data/ в одну плоскую рабочую
директорию (сам код ожидает относительные пути вида "v05_four_
conditions.pkl", а не "data/v05_four_conditions.pkl"):

```bash
mkdir work && cd work
cp ../code/*.py .
cp ../data/*.pkl .
python3 ../docs/self_checks.py   # или скопируйте self_checks.py тоже сюда
```

Проверено: после такого объединения self_checks.py проходит все 4
применимые проверки (5-я, recovery_v02/, пропускается -- она относится
только к историческому архиву).

## Структура исторического архива (project_historical_archive.tar.gz)

Один каталог `full_sim_snapshot/` -- точная копия рабочей директории
проекта на момент передачи (уже плоская структура, включая recovery_v02/
и recovery_plots/ как поддиректории, и __pycache__ исключён). Можно
работать прямо в ней без объединения.

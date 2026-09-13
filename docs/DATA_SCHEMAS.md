# DATA_SCHEMAS.md

Дополнение к DATA_INDEX.csv: описание внутренней структуры ключевых
файлов данных (ключи, формы массивов, dtype, единицы). CSV содержит
только путь/размер/SHA-256 -- эта схема нужна отдельно.

## ПРЕДУПРЕЖДЕНИЕ О БЕЗОПАСНОСТИ

Все .pkl файлы ниже созданы этим проектом и считаются доверенными В ЭТОЙ
среде. Тем не менее: **pickle.load() может исполнять произвольный код**.
Загружайте .pkl файлы только из источника, которому вы доверяете так же,
как исполнению кода. Если архив передаётся через посредника или третье
лицо, проверьте SHA-256 из DATA_INDEX.csv перед загрузкой.

## v05_four_conditions.pkl (~13 МБ) -- исходные данные версии 0.5

```
dict[condition_name -> list[net_dict]]

condition_name in {"Исходное", "Только бюджет", "Только длина", "Совместное"}
list длины 3 (по одному на development_seed in [11, 22, 33], в этом порядке)

net_dict:
  "spikes":       bool[12000, 80]   -- растр за всё развитие (12с при dt=0.001)
  "logs":         float[~120, 4]    -- [t, mean_rate, mean_threshold, mean_weight]
                                        каждые 100 шагов
  "weights":      float64[80, 80]   -- W[получатель, источник], финальные
  "contacts":     bool[80, 80]      -- граф связей, финальный
  "positions":    float64[80, 2]    -- координаты узлов в [0,1]x[0,1]
  "distance":     float64[80, 80]   -- матрица расстояний
  "metrics":      dict {rate_hz, silent_fraction, population_cv}
  "dt":           float = 0.001
  "growth_log":   list[48 dict]     -- по одному на каждую проверку роста
                    (step, t, n_passed_probability, n_accepted,
                     n_rejected_by_budget, n_budget_exhausted_nodes,
                     total_contacts)
  "normalization_events": int       -- 0 для ВСЕХ 12 прогонов, см. RESULTS_LEDGER
  "state":        dict, ПОЛНОЕ конечное состояние для продолжения динамики:
                    v, syn, adaptation, refractory, threshold, drive
                    (каждый float64[80])
```

**Это ПОЛНЫЕ конечные состояния** -- функциональный тест можно продолжить
без повторного развития сети, просто загрузив net_dict и запустив probe-
подобную функцию (см. v04_localization.py::probe_from_checkpoint как
образец) на net_dict["weights"], net_dict["state"], net_dict["contacts"].

## v05_functional_full_324.pkl (~10.1 МБ) -- функциональный тест v0.5 (324 пары)

```
dict:
  "results": list[324 dict], каждый:
      {
        "geometry_index": int 0-2,
        "geometry_seed_label": int (11/22/33) -- ВЫВЕДЕНО из кода
            v5f.py, не проверено независимо от числа; см. MODEL_SPEC.md
            раздел 9.1 и index_to_seed_label_note ниже,
        "condition": str, одно из 4 условий v05_four_conditions.pkl,
        "warm_seed": int in {500,501,502},
        "test_seed": int in {900,901,902},
        "stim_set_index": int 0-2,
        "stim_nodes": np.array[3] int,
        "baseline_spikes":    bool[200, 80] -- растр без стимула,
        "stimulated_spikes":  bool[200, 80] -- растр со стимулом,
                              ОБА растра построены на ОДНОМ и том же
                              шумовом массиве (см. make_noise),
        "R_windows": list[4 float] -- окна [0-50,50-100,100-150,150-200]мс,
        "F_windows": list[4 float],
        "R_200": float  -- сумма R_windows,
        "F_200": float  -- ОБЪЕДИНЕНИЕ затронутых узлов за 200мс (не сумма),
        "baseline_rate_hz": float,
        "stimulated_rate_hz": float,
      }
  "checkpoints": dict[(geometry_index, condition, warm_seed) -> state_dict]
      state_dict: {v, syn, adaptation, refractory, threshold, drive}
      -- каждый float64[80]; состояние ПОСЛЕ дополнительного 12с
      свободного прогона (веса/пороги заморожены), ДО применения
      стимула. Используется для проверки воспроизводимости конкретной
      пары без повторного прогона 12с warm-динамики.
  "conditions": list[4 str]
  "geometry_indices": list[3 int] = [0,1,2]
  "index_to_seed_label": dict {0:11, 1:22, 2:33}
  "index_to_seed_label_note": str -- явная оговорка о невалидированности
      соответствия index->seed (см. MODEL_SPEC.md 9.1)
  "warm_seeds": list[3 int]
  "test_seeds": list[3 int]
  "stim_sets": list[3 np.array[3] int]
  "probe_duration_ms": int = 200
  "free_dynamics_duration_s": float = 12.0
  "dt": float = 0.001
  "code_version": str
  "runtime_seconds": float
```

R/F формулы идентичны v04_final_data.pkl (см. ниже), с той разницей, что
здесь наблюдаемые узлы -- все 80 минус 3 стимулированных (не привязаны к
регионам). Электрическая динамика при построении растров -- ЗАМОРОЖЕННАЯ
(см. MODEL_SPEC.md, v05_functional.py::frozen_step): рост, пластичность,
нормировка весов и обновление порога ВЫКЛЮЧЕНЫ; адаптация, рефрактерность
и передача по неизменным весам ВКЛЮЧЕНЫ. current = drive + syn -
adaptation (без явного maturity и без gain -- см. обоснование в
MODEL_SPEC.md).

## v06_extended_growth_full.pkl (~6.8 МБ) -- продлённое развитие 12/24/48/96с

```
dict:
  "snapshots": dict[seed -> dict[condition -> dict[t_snapshot -> net_dict]]]
      seed in {11, 22, 33} -- РЕАЛЬНЫЕ development_seed (не index, как в
        v05_functional_full_324.pkl -- здесь однозначность гарантирована
        построением: simulate_v05_snapshots(seed=...) вызывается явно)
      condition in {4 условия v0.5}
      t_snapshot in {12.0, 24.0, 48.0, 96.0}
      net_dict:
        "t_snapshot": float
        "next_step_index": int -- индекс следующего невыполненного шага
            (0-based); "снимок после t секунд" = после round(t/dt)
            обновлений, next_step_index=round(t/dt)
        "weights": float64[80,80], "contacts": bool[80,80],
        "positions": float64[80,2], "distance": float64[80,80],
        "metrics": {rate_hz, silent_fraction, population_cv} --
            посчитаны по ПОСЛЕДНИМ 2.0с ПЕРЕД снимком (ring buffer)
        "dt": 0.001
        "logs": float[N,4] -- кумулятивно с t=0
        "growth_log": list[dict] -- кумулятивно с t=0
        "normalization_events": int -- кумулятивно с t=0
        "n_new_contacts_last_second": int -- контактов, добавленных за
            последнюю секунду ДО снимка (0 = рост уже остановился)
        "state": {v, syn, adaptation, refractory, threshold, drive,
                   rate, trace} -- ПОЛНОЕ состояние, каждый float64[80].
            rate и trace ДОБАВЛЕНЫ относительно v05_four_conditions.pkl
            (нужны для честного продолжения гомеостаза/пластичности,
            если снимок будет использован для дальнейшего роста)
        "rng_growth_state": dict -- rng_growth.bit_generator.state
            (полная глубокая копия, независима от продолжающейся
            симуляции)
        "rng_noise_state": dict -- rng_noise.bit_generator.state
        "code_version", "seed", "use_budget", "use_length_penalty",
        "max_in_degree", "length_penalty_scale"
  "summaries": dict[seed -> dict[condition -> dict[t -> summary_dict]]]
      summary_dict (см. v06_structural_summary.py::structural_summary):
        n_contacts, capacity_total, fill_fraction,
        in_degree_per_node[80], n_eligible_per_node[80],
        unfilled_capacity_per_node[80], contact_lengths[n_contacts],
        mean_contact_length, total_input_weight_per_node[80],
        threshold_per_node[80], n_new_contacts_last_second,
        normalization_events, rate_hz, silent_fraction, population_cv
  "jaccard": dict[seed -> dict[t -> dict[(condA,condB) -> float]]]
      -- индекс Жаккара для ВСЕХ 6 пар условий (C(4,2)=6), см.
      v06_structural_summary.py::jaccard. J=1.0 для двух пустых графов
      по соглашению (не встречается на практике в этих данных).
  "seeds", "conditions", "condition_params", "duration_snapshots",
  "max_in_degree", "dt", "code_version", "runtime_seconds"
```

ВАЖНО про честность продолжения: RNG-состояния (rng_growth_state,
rng_noise_state) сохранены здесь, НО ЭТОГО НЕ БЫЛО в оригинальном
v05_four_conditions.pkl -- поэтому данные в этом файле получены ЧЕСТНЫМ
ПОЛНЫМ ПЕРЕЗАПУСКОМ развития с t=0 (не продолжением архивных сетей).
Точность подтверждена: снимок t=12.0 в этом файле ПОБИТОВО (np.array_equal,
без допуска) совпадает с v05_four_conditions.pkl для всех 12 комбинаций
(3 seed x 4 условия) -- см. RESULTS_LEDGER.md v0.6 и v06_extended_growth.py
::verify_snapshot_matches_v05.

capacity_total и n_eligible_per_node -- ВЕРХНЯЯ ГРАНИЦА по геометрии
(distance<0.25, без диагонали, направленные рёбра), НЕ учитывает
ready/maturity динамику узлов во времени.

## v06_functional_96s_full_324.pkl (~10.1 МБ) -- функциональный тест v0.5-протокола на снимках t=96с

```
dict: ТА ЖЕ схема, что v05_functional_full_324.pkl, с отличиями:
  "results": list[324 dict] -- каждый как в v05_functional_full_324.pkl,
      НО ключ геометрии называется "geometry_seed" (int 11/22/33
      НАПРЯМУЮ, без неоднозначности index<->seed, в отличие от
      v05_functional_full_324.pkl) вместо "geometry_index" +
      "geometry_seed_label"; добавлено "snapshot_time": 96.0
  "checkpoints": dict[(geometry_seed, condition, warm_seed) -> state_dict]
  "conditions", "geometry_seeds" (=[11,22,33]), "snapshot_time" (=96.0),
  "warm_seeds", "test_seeds", "stim_sets" -- ИДЕНТИЧНЫ v05_functional_
      full_324.pkl по построению (тот же rng_stim seed=12345, те же
      warm_seeds=[500,501,502], test_seeds=[900,901,902])
  "probe_duration_ms", "free_dynamics_duration_s", "dt", "code_version",
  "runtime_seconds"
```

Электрическая динамика, R/F формулы -- идентичны v05_functional_full_324.
pkl (тот же код v05_functional.py, тот же протокол v05_full_run.py,
применённый к weights/state из снимка t=96с вместо t=12с). Точное
побитовое воспроизведение подтверждено ТОЛЬКО для одной пилотной
комбинации на снимке t=12с (seed=11, "Исходное", warm_seed=500,
test_seed=900, stim_set=0) -- см. RESULTS_LEDGER.md v0.6 -- НЕ для всех
324 пар в этом файле.

## v07_rewiring_full.pkl (~72 МБ) -- структурная пластичность (36 траекторий)

```
dict:
  "results": dict[(geometry_seed, growth_condition, policy, repeat_index) -> traj_dict]
      geometry_seed in {11,22,33}
      growth_condition in {"Только бюджет", "Совместное"}
      policy in {"none", "random", "weakest"}
      repeat_index in {0, 1}
      traj_dict:
        "geometry_seed", "growth_condition", "policy", "repeat_index",
        "rewire_seed", "noise_seed"
        "event_log": list[dict] -- журнал КАЖДОЙ попытки на 48 отметках:
            status in {"applied", "policy_none_no_op",
                       "skipped_no_eligible_receiver",
                       "skipped_no_candidates_or_no_sources"}
            для "applied": receiver, old_source, new_source,
                transferred_weight, old_length, new_length, step, t
        "snapshots": dict[t -> {"contacts","weights","state"}] на
            t=0.0, 12.0, 24.0 (после события на этой отметке)
        "spikes": bool[24000, 80] -- полный растр за всю траекторию
        "invariant_checks": dict -- результат verify_invariants
        "summary": dict -- см. v07_full_run.py::summarize_trajectory:
            n_events_applied, n_control_marks_no_op,
            n_events_skipped_no_candidates, unique_receivers_touched,
            unique_created_edges, unique_removed_edges,
            re_removed_recently_created (НЕ то же самое, что
            restored_previously_removed -- см. MODEL_SPEC.md и
            RESULTS_LEDGER.md v0.7), jaccard_final_vs_initial,
            n_edges_differing_final_vs_initial, mean_new_length,
            mean_transferred_weight, final_rate_hz, final_silent_fraction
  "geometry_seeds", "growth_conditions", "policies", "repeats",
  "duration" (=24.0), "rewire_interval" (=0.5),
  "snapshot_time_source" (=96.0, источник в v06_extended_growth_full.pkl),
  "rewire_seeds" (=[42,43]), "noise_seeds" (=[1000,1001]),
  "dt", "code_version", "runtime_seconds"
```

Электрическая динамика -- ЗАМОРОЖЕННАЯ (v05_functional.py::frozen_step,
как в v05/v06): рост, пластичность (STDP), нормировка весов, обновление
порога ВЫКЛЮЧЕНЫ. Перестройка (do_rewire_event) -- ЕДИНСТВЕННЫЙ механизм
изменения связей. Расписание получателей ОБЩЕЕ между всеми тремя
политиками при одном rewire_seed (build_fixed_schedule, построено один
раз из стартового списка).

## v07_functional_full_324.pkl (~10 МБ) -- функциональный тест на снимках t=24с (без прогрева)

```
dict:
  "results": list[324 dict], каждый:
      geometry_seed, growth_condition, policy, repeat_index,
      stim_set_index, stim_nodes, test_seed,
      baseline_spikes, stimulated_spikes (bool[200,80]),
      R_windows, F_windows (list[4]), R_200, F_200,
      baseline_rate_hz, stimulated_rate_hz
  "stim_sets" (идентичны v0.5/v0.6, тот же rng_stim seed=12345),
  "test_seeds" (=[900,901,902], идентичны v0.5/v0.6),
  "probe_duration_ms" (=200), "dt", "source" (явное указание: снимки
  t=24.0 из v07_rewiring_full.pkl, БЕЗ дополнительного прогрева -- в
  отличие от v05/v06 протокола, который включал 12с свободного прогона),
  "code_version", "runtime_seconds"
```

ВАЖНО: этот тест измеряет реакцию НЕПОСРЕДСТВЕННО после истории
перестройки -- результат включает и различия конечных графов, и различия
накопленного динамического состояния (36 траекторий имеют разные v/syn/
adaptation/refractory на момент t=24с, не только разные contacts/weights).
Для сравнения ТОЛЬКО графов (при уравненном динамическом состоянии)
понадобился бы отдельный контроль -- не сделано в этой версии.

Разложение дисперсии парных контрастов F_200 (within/between группы
geometry_seed x growth_condition) -- см. v07_variance_decomposition.py,
читает этот файл, ничего не пересчитывает по симуляциям.

## v04_final_data.pkl (~274 КБ) -- ФИНАЛЬНАЯ версия v0.4 функционального теста

```
dict:
  "raw_data": dict[variant_name -> dict[(source, target, warm_seed, test_seed) -> result]]
      variant_name in {"Исходная (bias=1.0)", "Внутриобластная (bias=2.0)",
                        "Межобластная (bias=0.5)"}
      key = (source_region: int 0-3, target_region: int 0-3,
             warm_seed: int in {700..704}, test_seed: int in {800..804})
      result: dict {
        "n_observed": int,
        "R_windows": list[4 float]   -- R по окнам [0-50,50-100,100-150,150-200]мс
        "F_windows": list[4 float]   -- F (changed_fraction) по тем же окнам
        "R_200": float               -- сумма R_windows
        "F_200": float               -- ОБЪЕДИНЕНИЕ (не сумма!) затронутых узлов
                                          за все 200мс
      }
  "stim_sets": dict[region_id -> np.array узлов] -- 3 узла на регион, фиксированы
  "region_id": np.array[80] int -- region_id[i] = регион узла i, 0-3
```

R формула: R = (sum(stimulated[window,observe]) - sum(baseline[window,observe]))
  / n_observed. observe_mask исключает стимулированные узлы этого запуска.

F формула (по окну): F = mean(any(baseline[window,observe] != stimulated[window,observe], axis=0))
F_200 формула: F_200 = mean(any(baseline[0:200steps,observe] != stimulated[...], axis=0))
  -- НЕ сумма F_windows, а объединение по времени (узел считается один раз,
  даже если менялся в нескольких окнах).

## v04_all_windows_data.pkl (~463 КБ) -- ПРОМЕЖУТОЧНАЯ версия

Та же схема ключей, что v04_final_data.pkl, но result -- список из 4
словарей (по одному на окно), каждый:
  {"window_start_ms", "R", "baseline_rate_hz", "stimulated_rate_hz",
   "changed_fraction"}
Нет R_200/F_200. Использовать v04_final_data.pkl вместо этого файла для
дальнейшей работы; этот сохранён для прослеживаемости шагов анализа.

## v04_raw_paired_data.pkl (~40 КБ) -- ПЕРВАЯ версия (только окно 0-50мс)

dict: {"raw_data": dict[variant_name -> dict[key -> float]], "stim_sets",
"region_id"} -- значение это просто R (скаляр) для окна 0-50мс. Показал
ложно нулевой результат из-за ограничения короткого окна -- см.
RESULTS_LEDGER.md пункт 1 в разделе критических ошибок. Сохранён для
истории обнаружения этой ошибки.

## recovery_v02/*.npz (36 файлов по ~10.7 МБ, ~370 МБ суммарно)

Имя файла: dev{development_seed}_gain{gain}_state{state_seed}_test{test_seed}.npz
development_seed=11 (одна структура!), gain in {4,6}, state_seed in
{1500,1501}, test_seed in {2500,2501,2502}.

Ключи внутри каждого .npz:
```
noise:                    float64[2000, 80]   -- тестовый шум, 2с при dt=0.001
baseline_spikes:          bool[2000, 80]
stimulated_spikes:        bool[2000, 80]
baseline_{v,margin,adaptation,syn_effective,refractory}: float64[2000, 80] каждый
stimulated_{...}:         те же 5 полей, float64[2000, 80] каждый
nodes:                    int[5]     -- стимулированные узлы (не 3, здесь 5!)
development_seed, gain, state_seed, test_seed: скаляры
drive_scalar:             float (=1.25)
drive_vec:                float64[80]
dt:                       float (=0.001)
code_version:             str
traces_recorded_after_reset: bool (=True, см. MODEL_SPEC раздел 3)
weights:                  float64[80,80]
contacts:                 bool[80,80]
full_initial_{v,syn,adaptation,refractory,threshold,drive}: float64[80] каждый
                          -- ПОЛНОЕ начальное состояние всех 80 узлов
                             (нужно для точного продолжения, не только 75
                             наблюдаемых)
```
manifest.csv в этой же папке: построчно те же параметры + filename + status.

## regime_map_results.npz

```
drive_values: float64[5]  -- [0.80, 0.95, 1.10, 1.25, 1.40]
gain_values:  float64[5]  -- [0.0, 1.0, 2.0, 4.0, 8.0]
stimulated_nodes: int[5]
rate_hz, silent_fraction, population_cv, rate_drift_hz,
response_fraction, delta_spikes: каждый float64[5,5] -- [drive_idx, gain_idx]
```

## neighborhood_dev{11,22,33}.csv

Столбцы: development_seed, repeat, drive, gain, warm_duration, noise_seed,
stimulated_nodes (строка через пробел), rate_hz, silent_fraction,
population_cv, rate_drift_hz, response_fraction, delta_spikes.
drive in {0.95,1.10,1.25}, gain in {2.0,4.0,6.0}, repeat in {0,1,2}
(разные наборы узлов и шумов на повтор, см. RESULTS_LEDGER v0.2).

## crossed_response.csv

Столбцы: development_seed, drive(=1.25), gain(4.0 или 6.0), group_id(0-2),
history_id(0-2), noise_seed, nodes, + все метрики evaluate_point.
3 сети x 2 gain x 3 группы x 3 истории = 54 строки.

## recovery_quantitative_summary.csv

Одна строка на (development_seed, gain, state_seed, test_seed) --
всего 36 строк соответствующих recovery_v02/*.npz. Столбцы: base_rate_hz,
stim_rate_hz, base_period_ms, stim_period_ms, median_sim_zero_lag,
median_sim_max, n_windows, n_ambiguous, n_boundary, median_lag_first3_ms,
median_lag_last3_ms, late_minus_early_ms, slope_ms_per_s,
lags_all_windows_ms (17 значений через ";"). Знак лага здесь УЖЕ
исправлен (после correction в quantitative_recovery.py).

## desync_summary.csv -- УСТАРЕВШИЙ, знак лага НЕ проверен

Похожая схема на recovery_quantitative_summary.csv, но создан РАНЬШЕ
исправления знака лага в normalized_xcorr. Столбец all_lags_ms в этом
файле МОЖЕТ иметь перевёрнутый знак. Не использовать для выводов о
направлении лага без пересчёта.

# MODEL_SPEC.md

Специфицирует модель ПО ФАКТИЧЕСКОМУ КОДУ на момент передачи. Если версии
расходятся, расхождение указано явно с именем файла.

## 1. Базовая геометрия и время

- N = 80 узлов.
- positions: N x 2, равномерно на [0,1]x[0,1] (rng.uniform(0,1,size=(N,2))).
- distance[i,j] = ||positions[i] - positions[j]||_2 (евклидово).
- dt = 0.001 секунды (1 мс) -- стандартный шаг для v0.1-v0.4.
  В отдельных проверках версии 0.1 (resolution_check.py) dt временно
  варьировался до 0.0005 и 0.00025 для проверки численной устойчивости;
  это НЕ шаг по умолчанию нигде больше.
- Полное развитие (simulate() / simulate_v05()): duration = 12.0
  секунд, steps = 12000.

## 2. Созревание узлов

- birth[i] = (i // 8) * 0.5 секунд (при gradual_growth=True, значение
  по умолчанию) -- узлы рождаются группами по 8, каждая группа на 0.5с
  позже предыдущей. Итого 10 групп, последняя рождается на t=4.5с.
- alive = t >= birth.
- age = max(0, t - birth), maturity = clip(age / 1.0, 0, 1) --
  созревание занимает 1 секунду после рождения.
- ready = alive & (maturity >= 0.6) -- узел участвует в росте контактов
  и гомеостазе только начиная с 60% созревания.

## 3. Электрическая динамика (переменные на узел)

Порядок обновления за один шаг dt (соблюдается во всех вариантах кода --
advance() в regime_map.py, тело цикла в simulate(), advance_v03() в
v03_rhythm_origin.py):

1. Экспоненциальное затухание:
     syn *= exp(-dt/0.010)
     adaptation *= exp(-dt/tau_adapt)      # tau_adapt = 0.200 по умолчанию
     refractory = max(0, refractory - dt)
     trace *= exp(-dt/0.020)               # только simulate()
     rate *= exp(-dt/1.0)                  # только simulate()

2. available = alive & (refractory == 0)  # в regime_map.py: refractory==0

3. current = maturity*drive + gain*syn - adaptation
     (в simulate(): current = maturity*drive + syn - adaptation, т.е. gain=1
      неявно; gain как явный множитель появляется в regime_map.py/v0.2+)

4. noise = 0.012 * sqrt(dt/0.001) * standard_normal(N)
     (масштаб амплитуды шума нормирован на dt=0.001; при других dt
      множитель sqrt(dt/0.001) обязателен для сопоставимости)

5. dv = (dt/0.020) * (-v + current)
   v[available] += (dv + noise)[available]

6. fired = available & (v >= threshold)

7. [версия-специфичная точка: искусственный стимул, если применяется,
    добавляется здесь -- см. раздел 7]

8. Пластичность (если plasticity=True, только simulate()):
     eta = 0.0002
     W[fired, :] += eta * trace[None,:] * contacts[fired,:]
     W[:, fired] -= 1.05 * eta * trace[:,None] * contacts[:,fired]
     clip(W, 0, 0.08)
     нормировка: total_input = W.sum(axis=1)
                 W *= min(1, 0.6/max(total_input, 1e-12))[:,None]

9. Передача (если transmission=True):
     syn[i] += sum_j W[i,j] for j in fired   (syn += W[:,fired].sum(axis=1))
     ВАЖНО: syn хранит НЕ усиленный вклад; gain применяется в п.3 при
     вычислении current, а не при накоплении syn.

10. Сброс сработавших узлов:
      v[fired] = 0.0
      refractory[fired] = 0.005            # 5 мс
      adaptation[fired] += 0.25
      trace[fired] += 1.0                  # только simulate()
      rate[fired] += 1.0                   # только simulate()

11. Гомеостаз (если homeostasis=True, только для ready-узлов):
      target_rate = 5.0 * maturity
      threshold[ready] += dt * 0.02 * (rate[ready] - target_rate[ready])
      clip(threshold, 0.7, 1.5)

ВАЖНО про запись диагностики: в recovery_probe.py::run_probe_recording
переменные (v, margin, adaptation, syn_effective, refractory) пишутся
ПОСЛЕ полного обновления шага, то есть ПОСЛЕ сброса v[fired]=0. Помечено
полем traces_recorded_after_reset=True в сохранённых .npz. Значит v в
момент спайка узла записан как 0.0, а не как значение перед порогом.

## 4. Смысл W[i, j]

W[i, j] = вес связи ОТ узла j К узлу i (получатель -- первый индекс).
W[:, fired].sum(axis=1) по строке i даёт сумму входящих весов от всех
сработавших источников j. Подтверждено в sequence_test.py::
mean_existing_weight (использует W[np.ix_(target, source)]).

contacts[i, j] (bool) = существует ли структурная связь j->i. Диагональ
всегда False.

## 5. Структурный рост контактов

### 5.1 Базовое правило (sim_core.py::simulate, "distance_only" в v0.5)

Каждые 250 шагов (=0.25с):
  eligible[i,j] = ready[i] & ready[j] & (distance[i,j]<0.25) & ~contacts[i,j]
  draws = rng.random((N,N))
  new = eligible & (draws < 0.15)
  contacts |= new
  W[new] = 0.015

Контакты никогда не удаляются. 0.25 -- порог расстояния, 0.15 -- базовая
вероятность за одну проверку. Проверок за 12с: 12000/250 = 48.

### 5.2 Правило версии 0.5 (v5f.py::simulate_v05)

Два независимых флага:
- use_length_penalty: вероятность образования домножается на
  exp(-distance/0.10) вместо константы 0.15. Порог расстояния 0.25
  сохраняется как жёсткое ограничение первого прохода (eligible).
- use_budget: получатель i не может иметь более max_in_degree=12
  входящих контактов. При нехватке мест -- СЛУЧАЙНЫЙ ВЫБОР среди
  прошедших кандидатов через rng_growth.choice(..., replace=False),
  НЕ по индексу узла.

Четыре условия (v5f.py::CONDITIONS_V05):
  "Исходное":      use_budget=False, use_length_penalty=False
  "Только бюджет": use_budget=True,  use_length_penalty=False
  "Только длина":  use_budget=False, use_length_penalty=True
  "Совместное":    use_budget=True,  use_length_penalty=True

## 6. Единицы времени всех констант

dt = 0.001 с
duration (развитие) = 12.0 с
tau_syn = 0.010 с
tau_adapt по умолчанию = 0.200 с (варьировалось 0.1-0.4 в v0.3)
tau_trace = 0.020 с
tau_rate = 1.0 с
tau_membrane = 0.020 с
refractory после спайка = 0.005 с
adaptation increment = 0.25 (безразмерн.)
рост: расстояние = 0.25 (координаты 0..1)
рост: интервал проверки = 250 шагов = 0.25 с
рост: вероятность база = 0.15
eta (пластичность) = 0.0002
W clip = [0, 0.08]
нормировка входа cap = 0.6
homeostasis rate constant = 0.02 (1/с, множитель dt)
target_rate = 5.0 * maturity Гц
threshold clip = [0.7, 1.5]
length_penalty_scale (v0.5) = 0.10
max_in_degree (v0.5) = 12

## 7. Момент стимуляции относительно интегрирования

ЕДИНСТВЕННОЕ меж-версионное расхождение, требующее внимания:

- force_initial_spikes / force_spikes (regime_map.py, v04, v03):
  применяется к состоянию ДО первого шага интегрирования пробного окна,
  напрямую устанавливая v[nodes]=0, refractory[nodes]=0.005,
  adaptation[nodes]+=0.25, syn += W[:,nodes].sum(axis=1). Момент
  воздействия физически не зависит от dt.
- trace_probe_dt (sim_core.py): стимул применяется на step==0, ПЕРЕД
  первым обновлением v на этом шаге -- специально исправлено в ходе
  v0.1, т.к. более ранняя версия (trace_probe_preserve_syn) применяла
  стимул ПОСЛЕ первого обновления v, что делало момент воздействия
  зависимым от dt. Исправление сделано для resolution_check.py.

Если код для новой задачи пишется заново -- проверять этот момент явно.

## 8. Разделение RNG (только v0.5, v5f.py)

  rng_growth = np.random.default_rng(seed)               # positions, рост
  rng_noise  = np.random.default_rng(seed + 100000)       # drive, шум

Смена use_budget/use_length_penalty НЕ меняет rng_noise -- разные условия
версии 0.5 получают идентичный электрический шум. В версиях 0.1-0.4
используется ЕДИНЫЙ rng для всего -- growth и noise НЕ разделены.

## 9. Структурные версии кода -- где что реализовано

sim_core.py: simulate() -- базовая v0.1 модель; simulate_with_snapshots,
  free_run_snapshots, probe, trace_probe_preserve_syn, trace_probe_dt,
  generate_linked_noise. Актуален для v0.1 полностью.

sequence_test.py: train_weights() (с second_nodes/lag), select_groups,
  measure_response, mean_existing_weight. v0.1 sequence/specificity тесты.

trace_diag.py, recovery_probe.py: trace_probe, causal_traces,
  run_probe_recording, probe_pair_recording. v0.1 диагностика, v0.3
  recovery-протокол.

regime_map.py: advance(), run_probe(), evaluate_point() -- явный gain,
  warm_duration. v0.2 картография; переиспользуется в v0.3/v0.4.

v03_rhythm_origin.py: advance_v03(), free_dynamics_run(),
  analyze_free_dynamics(). v0.3 происхождение ритма.

v03_cyclic_shift.py: cyclic_shift_control() -- перестановочный тест с
  DeltaV, Q, p. v0.3 контроль синхронизации.

v04_regional.py: assign_regions(), rebias_weights(),
  build_variant_networks(). v0.4 региональные варианты весов.

v04_localization.py, v04_recompute_final.py: get_warmed_checkpoint,
  probe_from_checkpoint, measure_full_response (R и F, 4 окна + 200мс).
  v0.4 функциональный тест, ФИНАЛЬНАЯ версия метрики.

v05_growth_rules.py: первая версия альт. правила роста (единый rng).
  Устарело -- см. v5f.py.

v5f.py: simulate_v05() -- факторная версия, раздельные RNG, журнал
  роста, 4 условия. v0.5 АКТУАЛЬНАЯ реализация.

audit_v5.py: структурный аудит (in-degree vs eligible vs capacity).
  v0.5 диагностика.

v05_functional.py: frozen_step() -- замороженная электрическая динамика
  (без роста/пластичности/нормировки весов/гомеостаза порога),
  построчно сверена с simulate_v05(). current = drive + syn - adaptation
  (без явного maturity -- проверено, что maturity=1 для всех узлов к
  моменту сохранения состояния v0.5, т.к. t_save=12s >> t_full_maturity=5.5s).
  Шум = 0.012*standard_normal(N), БЕЗ sqrt(dt/0.001) (dt всегда 0.001,
  assert в коде). Шум для сопоставляемых прогонов генерируется ЗАРАНЕЕ
  как явный массив (make_noise) и передаётся в probe()/run_free_dynamics_
  with_weights() извне, а не через общий RNG-объект в состоянии -- чтобы
  гарантировать идентичный шум между baseline и stimulated без
  зависимости от порядка вызовов. force_spikes() идентичен
  v04_localization.py::force_spikes с добавленным флагом transmission
  (для контроля "нет обходного пути воздействия").

v05_pilot.py, v05_full_run.py: протокол функционального теста v0.5
  (см. HANDOFF.md). v05_full_run.py производит
  v05_functional_full_324.pkl -- 324 пары (3 геометрии x 4 условия x
  3 состояния свободного прогона x 3 тестовых шума x 3 набора
  стимуляции), с полными растрами, checkpoint'ами после свободного
  прогона, R/F по 4 окнам + 200мс, частотами baseline/stimulated.

v06_extended_growth.py: simulate_v05_snapshots() -- построчная копия
  v5f.py::simulate_v05, продолженная до max(duration_snapshots) с
  точными снимками (structure + state + RNG-состояния) на каждый
  запрошенный момент. RNG-состояния НЕ сохранялись в исходном v5f.py/
  v05_four_conditions.pkl -- поэтому используется ЧЕСТНЫЙ ПОЛНЫЙ
  ПЕРЕЗАПУСК с t=0, не продолжение существующих сохранённых сетей.
  verify_snapshot_matches_v05() -- строгая (np.array_equal, БЕЗ
  tolerance) проверка: снимок t=12с должен точно совпасть и с повторным
  вызовом simulate_v05(), и (если передан archived_net) с архивным
  v05_four_conditions.pkl. Подтверждено на всех 12 комбинациях (3 seed
  x 4 условия) перед полным запуском -- см. RESULTS_LEDGER.md пункт 14
  критических находок про разницу np.isclose vs np.array_equal.

v06_structural_summary.py: compute_capacity() (ёмкость по геометрии:
  sum_i min(K,n_i) с бюджетом, sum_i n_i без бюджета, n_i = число
  допустимых соседей при distance<0.25, направленные рёбра, без
  диагонали -- ВЕРХНЯЯ ГРАНИЦА при бесконечном времени, не учитывает
  ready/maturity динамику), jaccard() (J=|E1∩E2|/|E1∪E2|, J=1.0 для
  двух пустых графов по соглашению), structural_summary() (агрегирует
  n_contacts, fill_fraction, распределения in-degree/длин/весов/порогов,
  темп роста за последнюю секунду, нормировку).

v06_full_run.py: полный структурный прогон v0.6 -- 12 траекторий (3
  seed x 4 условия) до 96с со снимками на 12/24/48/96с, структурными
  сводками и Жаккаром между всеми 6 парами условий. Производит
  v06_extended_growth_full.pkl (~6.8 МБ).

v06_functional_96s.py: тот же функциональный протокол, что
  v05_full_run.py (идентичные стимульные наборы, warm_seeds, test_seeds,
  длительность свободного прогона, окна, метрики), применённый к
  снимкам t=96с из v06_extended_growth_full.pkl. Производит
  v06_functional_96s_full_324.pkl (~10.1 МБ). Побитовая совместимость
  снимков v0.6 с v05_functional.py подтверждена эмпирически ДЛЯ ОДНОЙ
  пилотной комбинации перед полным запуском (см. HANDOFF.md, "текущее
  состояние" v0.6).

v07_rewiring.py: первая реализация УДАЛЕНИЯ контактов в проекте.
  eligible_mask() (геометрически допустимые пары), build_fixed_schedule()
  (расписание получателей строится ОДИН РАЗ из стартового списка
  допустимых получателей -- обосновано инвариантностью множества
  допустимых получателей при сохранении in-degree на фиксированной
  геометрии), do_rewire_event() (одно событие замены: кандидаты на
  новый источник фиксируются ДО удаления старого -- иначе старый
  источник немедленно становится "свободным"; вес переносится
  old->new), run_rewiring_trajectory() (полная траектория: frozen_step
  из v05_functional.py для электрической динамики + события перестройки
  на фиксированных интервалах; ДВА независимых генератора -- rng_schedule
  для расписания получателей, общий между политиками, и
  rng_event_choice для выбора old_source/new_source внутри события,
  раздельный, т.к. разные политики расходуют его по-разному, что иначе
  расходило бы общее расписание -- см. RESULTS_LEDGER.md пункт 15),
  verify_invariants() (сохранение степени, суммы весов -- с допуском
  машинной точности из-за неизбежной ошибки округления при
  пересуммировании float64, И более сильная побитово точная проверка
  мультимножества весов строки через np.sort).

v07_full_run.py: полный запуск 36 траекторий (3 геометрии x 2 истории
  роста "Только бюджет"/"Совместное" x 3 политики "none"/"random"/
  "weakest" x 2 заранее выбранные реализации шума+расписания), 24с
  каждая, замена каждые 0.5с. summarize_trajectory() считает структурную
  сводку, РАЗДЕЛЯЯ явно: повторное удаление недавно созданного контакта
  (эффект "weakest" при выключенной пластичности) vs восстановление
  ранее удалённого (не то же самое -- см. пример цепочки A->B->C->D в
  RESULTS_LEDGER.md) vs итоговое число отличий графа. Производит
  v07_rewiring_full.pkl (~72 МБ).

v07_functional_full.py: функциональный тест на 36 конечных снимках
  t=24с из v07_rewiring_full.pkl, БЕЗ дополнительного прогрева (в
  отличие от протокола v0.5/v0.6) -- 3 стимульных набора x 3 тестовых
  шума = 324 пары, идентичные стимулы/шумы предыдущим версиям.
  Производит v07_functional_full_324.pkl (~10 МБ).

v07_variance_decomposition.py: точное разложение дисперсии парных
  контрастов F_200 на within/between-групповые компоненты (группа =
  geometry_seed x growth_condition, оба repeat_index объединены).
  Использует формальное тождество total_variance = within_variance +
  between_variance через суммы квадратов (np.mean((x-mean)**2)), НЕ
  сравнение std напрямую -- см. RESULTS_LEDGER.md пункт 16 критических
  находок про исправление первоначальной ошибочной оценки "~93%".
  Читает только v07_functional_full_324.pkl, без пересчёта симуляций.

v08_experience_rewiring.py: совмещает STDP (точное правило v5f.py) и
  перестройку контактов (v07) в одном прогоне, с принудительной
  стимуляцией A->B/B->A. integrate_electrical() -- интеграция БЕЗ
  немедленной STDP/передачи/сброса (только для natural_fired).
  process_fired_batch() -- ЕДИНСТВЕННОЕ место, где применяется STDP/
  передача/сброс, вызывается РОВНО ОДИН РАЗ за шаг на ОБЪЕДИНЁННУЮ
  маску (natural_fired | forced_fired) -- см. RESULTS_LEDGER.md пункт
  17 критических находок про исправленную ошибку двойного учёта.
  run_experience_trajectory() -- полная траектория с расписанием
  перестройки (build_fixed_schedule, общее между AB/BA) и расписанием
  стимуляции (period=0.4с, лаг=10мс). summarize_stim_log() разделяет
  n_sequences/n_forced_timestamps/n_assigned_node_spikes/n_overlap_
  node_events/n_added_node_spikes.

v08_structural_metric.py: направленный показатель сохранения исходных
  контактов. directed_original_contacts() -- списки (receiver,source)
  для направлений A->B и B->A. contact_fate() -- present_at_end/
  never_removed/removed_then_restored для каждого исходного ребра.
  compute_directional_contrast() -- S_AB/S_BA по обоим направлениям,
  C = 1/2*[(S_AB(A->B)-S_BA(A->B))+(S_BA(B->A)-S_AB(B->A))], а также
  C_A и C_B раздельно (C = 0.5*(C_A+C_B), проверено тождество).

v08_unit_tests.py: 4 искусственно СКОНСТРУИРОВАННЫХ (не полагающихся на
  случайное совпадение в симуляции) теста для семантики совпадающих
  событий -- см. RESULTS_LEDGER.md пункт 17.

v08_pilot.py, v08_full_run.py: протокол v0.8 (см. HANDOFF.md).
  v08_full_run.py производит v08_experience_full.pkl (~137 МБ) -- 72
  траектории (36 пар AB/BA), с полными растрами, журналами событий
  стимуляции и перестройки, структурным показателем на каждую пару.

v09_functional_probe.py: функциональная проба на сохранённых сетях
  v0.8. build_common_start_state() -- конструирует общий контролируемый
  старт (v/adaptation/refractory/threshold/drive из снимка v0.6 ДО
  начала v0.8, syn=0, веса/контакты -- конечные из траектории v0.8).
  check_full_graph_and_weights_match() -- ПРЯМАЯ проверка (не через
  метрику C из v0.8) совпадения полного графа/весов AB vs BA -- важно,
  т.к. C=0 в v0.8 НЕ гарантирует совпадение графа целиком (см.
  RESULTS_LEDGER.md v0.9). run_direction_probe() -- использует
  v05_functional.py::probe напрямую (та же проверенная семантика, не
  создаёт второй путь обработки импульса). compute_R() -- подписанный
  ответ в окнах по 5мс. compute_D() -- основной показатель, mean_{i,k}
  |R_AB-R_BA|, проверен на искусственных примерах.

v09_pilot.py, v09_full_run.py: протокол v0.9 (см. HANDOFF.md).
  v09_full_run.py производит v09_functional_probe_full.pkl (~14 МБ) --
  432 пары (72 экземпляра x 2 направления x 3 шума), с полными
  растрами, R по 5мс окнам, F по 50мс окнам, R_200/F_200, фоновыми/
  вызванными частотами, флагами same_contacts/same_weights AB vs BA.

v10_no_rewiring.py: изолированное ядро для контроля M0 (пластичность
  без перестройки). СКОПИРОВАНО из v08_experience_rewiring.py БЕЗ
  изменения зафиксированного v0.8 кода -- единственное содержательное
  отличие: rewire_policy="none" обрабатывает отметку перестройки как
  "событие без вмешательства" (расписание получателей потребляется --
  rewire_event_idx продвигается, но do_rewire_event НЕ вызывается,
  граф не меняется). Побитовое совпадение с v08_experience_rewiring.py
  при одинаковой политике подтверждено unit-тестом (см. v10_unit_
  tests.py) -- гарантирует, что копирование не внесло расхождений в
  путь STDP/электрической динамики.

v10_unit_tests.py: 3 теста -- (1) none-политика никогда не меняет граф;
  (2) v10 побитово идентичен v08 при одинаковой политике "weakest";
  (3) электрический шум независим от политики перестройки (активность
  ДО первого события перестройки совпадает между M0 и M1).

v10_pilot.py, v10_full_run.py: протокол v0.10 (см. HANDOFF.md).
  v10_full_run.py производит v10_m0_control_full.pkl (~46 МБ) -- 24
  траектории M0 + 144 функциональные пары + контрасты ΔD_weakest/
  ΔD_random против уже сохранённого v09_functional_probe_full.pkl
  (согласованность групп/шумов/snapshot_time_source/bin_ms между
  файлами проверяется программно перед вычислением контрастов).

Устаревшие/промежуточные файлы:
- desync_protocol.py, desync_summary.csv -- ранний анализ лага БЕЗ
  проверки знака. Заменён на quantitative_recovery.py (знак лага
  протестирован явно: a[30]=1,b[36]=1 => lag=+6; в первой версии этого
  файла знак тоже был перепутан и затем исправлен -- используйте только
  финальную версию функции normalized_xcorr в этом файле).
- v05_growth_rules.py::simulate_with_growth_rule -- ранняя версия
  budget_length (бюджет и штраф длины только совместно, RNG не
  разделены). Замена: v5f.py::simulate_v05.
- full_protocol.py (v0.1) -- смешение стадии развития и обучения.
  Заменён на corrected_protocol.py.
- state_noise_grid.py -- изначальная версия метрик
  early_response_fraction/late_response_fraction использовала
  НЕРАВНЫЕ окна (0-50 vs 50-200мс); переписана на равные 50мс окна --
  ориентируйтесь на актуальное содержимое файла.
- recovery_v02/pilot_2s_probe.npz -- первый одиночный пилот,
  воспроизведён и расширен 36-парным прогоном в той же папке.

## 9.1 Соответствие geometry_index <-> development_seed в v05_four_conditions.pkl

`v05_four_conditions.pkl` не хранит `development_seed` явно внутри каждой
записи. Соответствие `index (0,1,2) -> seed (11,22,33)` ВЫВЕДЕНО из
порядка вызова в `v5f.py::run_four_conditions` (`for seed in seeds: for
name in CONDITIONS_V05.items()`, `seeds=(11,22,33)` по умолчанию) и НЕ
проверено независимо от значения самого числа seed.

Эмпирически подтверждено (в ходе функционального теста v0.5, см.
`v05_full_run.py`): для каждого `index` матрицы `positions` и `distance`
идентичны во всех 4 условиях роста -- то есть `index` корректно
сопоставляет ОДНУ И ТУ ЖЕ геометрию между условиями. Это достаточно для
парного сравнения правил роста при "одном and том же development_seed",
но НЕ доказывает, что index=0 -- это буквально seed=11, а не какой-то
другой конкретный seed. Если это разграничение когда-нибудь станет
важным (например, потребуется воспроизвести конкретную геометрию заново
через `simulate_v05(seed=...)`), нужно либо проверить по коду отдельно,
либо пересчитать `positions` для кандидатных seed и сравнить.

## 10. Пороговый гомеостаз vs нормировка весов

Модель имеет ДВА независимых ограничивающих механизма:
1. Пороговый гомеостаз (threshold[ready] += dt*0.02*(rate-target)) --
   медленно подстраивает порог под целевую частоту 5*maturity Гц.
   Работает всегда при homeostasis=True.
2. Нормировка суммы входных весов (W *= min(1, 0.6/total_input)) --
   ограничивает сумму входящих весов узла потолком 0.6.

В версии 0.5 normalization_events=0 для ВСЕХ 12 прогонов (3 сида x
4 условия) -- механизм (2) НИ РАЗУ не сработал. Близость частот между
структурно разными сетями версии 0.5 обусловлена (1), а не (2). Роль (1)
в компенсации структурных различий отдельно НЕ изолирована.

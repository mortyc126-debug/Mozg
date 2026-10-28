#!/usr/bin/env node
'use strict';
/* ============================================================
   ЕСТЬ ЛИ ПОЛОСА МЕЖДУ МОЛЧАНИЕМ И ПРИПАДКОМ

   ОТКУДА. Этап 14: наследная ткань между касаниями молчит абсолютно, а
   26 мутантов из 100 "оживают" -- но половина из них разряжается у
   самого потолка рефрактерности (медиана 53% потолка, четверо ровно на
   нём). Объявленное тогда правило имело нижнюю границу и не имело
   верхней, и потому засчитывало припадок как жизнь. Это ошибка №49
   Python-ведомости в новом костюме, и здесь она исправляется.

   ЧТО МЕНЯЕТСЯ В МЕРЕ. Из §2a: цифровая валюта -- не "есть ли
   импульсы", а СКОЛЬКО ИЗ СОСТОЯНИЯ МОЖНО ПРОЧЕСТЬ. И молчание, и
   припадок читаются одинаково -- никак: в первом случае не происходит
   ничего, во втором в каждый миг происходит всё. Значит мера обязана
   требовать трёх вещей разом.

     share -- доля агентов, выстреливших хотя бы раз (НИЖНЯЯ граница);
     load  -- доля потолка разряда, 2000/(REFRACT+1) * N (ВЕРХНЯЯ);
     structure -- есть ли в активности повторяющийся рисунок.

   КАК СЧИТАЕТСЯ structure, и у неё есть ПУСТОЙ ОТСЧЁТ. Окно наблюдения
   режется на 100 бинов по 20 шагов; для каждого бина берётся набор
   выстреливших агентов. Мера -- среднее попарное расстояние Жаккара
   между бинами. Пустой отсчёт: случайные наборы ТЕХ ЖЕ размеров из тех
   же агентов. Если ткань всякий раз зажигает одних и тех же, наблюдаемое
   расстояние МЕНЬШЕ случайного, и

     structure = 1 - наблюдаемое / случайное

   равна нулю при бесструктурном шуме и растёт, когда группы
   возвращаются. У припадка все бины -- вся ткань, расстояние ~0 и у
   наблюдаемого, и у нуля: мера не наградит разряд, потому что делить
   будет нечего (такие случаи печатаются как nan и в счёт не идут).

   ПРАВИЛО ЧТЕНИЯ, ОБЪЯВЛЕНО ДО ЗАПУСКА:
     ткань ЖИВАЯ, если ОДНОВРЕМЕННО
       * share >= 0.05          -- не молчит;
       * load  <  0.25          -- не припадок;
       * structure >= 0.10      -- рисунок есть, и он выше шума.
     Отрицательных исходов ТРИ, и они разные, каждый содержателен:
       МОЛЧИТ (share мал) / ПРИПАДОК (load велик) / ШУМ (structure мал).
     * ПОЛОСА ЕСТЬ, если живых не менее 5 из 100;
     * ПОЛОСЫ НЕТ, если ни одной;
     * 1-4 -- НЕ РАЗРЕШЕНО, и мутант 49 остаётся наблюдением, а не
       результатом.
     * Наследный геном обязан выйти МОЛЧАЩИМ -- контроль исправности.

   ВМЕШАТЕЛЬСТВО ИСПРАВЛЕНО: глушится СЛУХ, а не поле. Прежняя проверка
   обнуляла поля 0-2 и 5, чем задевала и обмен веществ, и развитие, а
   поле 3 (ресурс) не проверяла вовсе. Здесь после роста обнуляется
   sens[f] у всех генов -- мир остаётся нетронутым, ткань просто
   перестаёт слышать. Четыре глушения:
       свой голос (0-2) | ресурс (3) | градиент (5) | совсем глухая
   Последнее решает главное: если глухая ткань продолжает разряжаться,
   активность держится на сети связей, а не на ощущении.
   ============================================================ */
const fs = require('fs');
const { createWorld, step } = require('../src/world');
const { ancestral, mutate } = require('../src/genome');
const { makeRNG } = require('../src/rng');

const GROW = 1600;
const WATCH = 2000;
const BIN = 20;
const WSEED = 5;
const N_MUT = 100;
const TIERS = [0.03, 0.06, 0.12, 0.20];
const REFRACT = 5;
const MIN_SHARE = 0.05, MAX_LOAD = 0.25, MIN_STRUCT = 0.10;

/* глушение слуха: обнуляем sens у всех генов по списку полей */
function deafen(g, fields) {
  for (const e of g.eff) for (const f of fields) e.sens[f] = 0;
  return g;
}

function jaccardMean(sets, sizes, N, rnd) {
  let obs = 0, nul = 0, pairs = 0;
  const rand = sizes.map((k) => {
    const s = new Set();
    while (s.size < k) s.add(Math.floor(rnd() * N));
    return s;
  });
  const inter = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n; };
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const uO = sets[i].size + sets[j].size - inter(sets[i], sets[j]);
      const uR = rand[i].size + rand[j].size - inter(rand[i], rand[j]);
      if (uO === 0 || uR === 0) continue;
      obs += 1 - inter(sets[i], sets[j]) / uO;
      nul += 1 - inter(rand[i], rand[j]) / uR;
      pairs++;
    }
  }
  if (!pairs || nul === 0) return { obs: NaN, nul: NaN, structure: NaN };
  return { obs: obs / pairs, nul: nul / pairs, structure: 1 - (obs / pairs) / (nul / pairs) };
}

function watch(genome, fields) {
  const w = createWorld({ seed: WSEED, genome });
  for (let i = 0; i < GROW; i++) step(w);
  if (fields) deafen(w.genome, fields);      // слух глушится ПОСЛЕ роста
  const cells = w.cells.slice();
  const idx = new Map(cells.map((c, k) => [c, k]));
  const N = cells.length;
  const t0 = w.t;
  const sets = [];
  let cur = new Set(), spikes = 0;
  for (let i = 0; i < WATCH; i++) {
    step(w);
    for (const c of w.cells) if (c.fired === w.t && idx.has(c)) { cur.add(idx.get(c)); spikes++; }
    if ((i + 1) % BIN === 0) { sets.push(cur); cur = new Set(); }
  }
  const lit = new Set();
  for (const s of sets) for (const x of s) lit.add(x);
  const cap = Math.floor(WATCH / (REFRACT + 1)) * N;
  const j = jaccardMean(sets, sets.map((s) => s.size), N, makeRNG(4242));
  return {
    n: N, spikes, share: N ? lit.size / N : 0, load: cap ? spikes / cap : 0,
    obs: j.obs, nul: j.nul, structure: j.structure,
  };
}

function verdictOf(r) {
  if (r.share < MIN_SHARE) return 'МОЛЧИТ';
  if (r.load >= MAX_LOAD) return 'ПРИПАДОК';
  if (!(r.structure >= MIN_STRUCT)) return 'ШУМ';
  return 'ЖИВАЯ';
}

const base = ancestral();
console.log('ЕСТЬ ЛИ ПОЛОСА МЕЖДУ МОЛЧАНИЕМ И ПРИПАДКОМ');
console.log(`${N_MUT} мутантов; живая = share >= ${MIN_SHARE}, load < ${MAX_LOAD}, structure >= ${MIN_STRUCT}\n`);

const ctl = watch(base, null);
console.log(`КОНТРОЛЬ, наследный геном: share ${(ctl.share * 100).toFixed(1)}%, ` +
  `load ${(ctl.load * 100).toFixed(2)}% -> ${verdictOf(ctl)}`);
if (verdictOf(ctl) !== 'МОЛЧИТ') console.log('  ВНИМАНИЕ: контроль обязан молчать -- мера неисправна');

const rows = [];
for (let i = 0; i < N_MUT; i++) {
  const g = mutate(base, makeRNG(9000 + i), { pWeight: TIERS[i % 4], pEff: TIERS[i % 4] });
  const r = watch(g, null);
  rows.push({ i, tier: TIERS[i % 4], ...r, verdict: verdictOf(r) });
}

const tally = {};
for (const r of rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
console.log('\nразбор всех 100:');
for (const k of ['МОЛЧИТ', 'ШУМ', 'ПРИПАДОК', 'ЖИВАЯ'])
  if (tally[k]) console.log(`  ${k}: ${tally[k]}`);

const live = rows.filter((r) => r.verdict === 'ЖИВАЯ');
if (live.length) {
  console.log('\n    № | ступень | выстрелило | доля потолка | набл. | нуль | рисунок');
  for (const r of live) {
    console.log(`${String(r.i).padStart(5)} | ${r.tier.toFixed(2).padStart(7)} | ` +
      `${(r.share * 100).toFixed(0).padStart(9)}% | ${(r.load * 100).toFixed(2).padStart(11)}% | ` +
      `${r.obs.toFixed(3)} | ${r.nul.toFixed(3)} | ${r.structure.toFixed(3)}`);
  }

  console.log('\nГЛУШЕНИЕ СЛУХА (мир не трогаем, ткань перестаёт слышать):');
  console.log('    № | как есть | без своего | без ресурса | без градиента | совсем глухая');
  for (const r of live) {
    const g = () => mutate(base, makeRNG(9000 + r.i), { pWeight: r.tier, pEff: r.tier });
    const own = watch(g(), [0, 1, 2]);
    const res = watch(g(), [3]);
    const gra = watch(g(), [5]);
    const all = watch(g(), [0, 1, 2, 3, 4, 5]);
    const f = (x) => `${(x.share * 100).toFixed(0)}% (x${(r.share ? x.share / r.share : 1).toFixed(2)})`;
    console.log(`${String(r.i).padStart(5)} | ${(r.share * 100).toFixed(0).padStart(7)}% | ` +
      `${f(own).padStart(10)} | ${f(res).padStart(11)} | ${f(gra).padStart(13)} | ${f(all).padStart(13)}`);
    r.deaf = { own, res, gra, all };
  }
}

let verdict;
if (live.length >= 5) verdict = 'ПОЛОСА ЕСТЬ: между молчанием и припадком лежит читаемая активность';
else if (live.length === 0) verdict = 'ПОЛОСЫ НЕТ: ни одной ткани между молчанием и припадком';
else verdict = `НЕ РАЗРЕШЕНО: живых ${live.length} при объявленном пороге 5`;
console.log(`\n${verdict}`);
console.log('ЭТО НЕ ОТБОР: мутанты ни с чем не соревновались.');

fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/band.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

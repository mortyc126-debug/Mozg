#!/usr/bin/env node
'use strict';
/* ============================================================
   ПОЛОСА МЕЖДУ МОЛЧАНИЕМ И ПРИПАДКОМ -- ТРЕТЬЯ РЕДАКЦИЯ МЕРЫ

   ЗАЧЕМ ТРЕТЬЯ. Две предыдущие провалились ОДИНАКОВО, и это стоит
   выписать, потому что ошибка одна и та же:

     spark.js  -- порог был только снизу: засчитал припадок как жизнь
                  (половина "оживших" разряжалась у потолка);
     band.js   -- порог стал с двух сторон, но по ВСЕЙ ткани, и местная
                  судорога прошла насквозь: у мутантов 15 и 35 участок в
                  16-17% ткани разряжался на 97% ЛИЧНОГО предела, а в
                  каждом бине это были одни и те же агенты.

   Вдобавок мера structure награждала ПОСТОЯНСТВО: застывший рисунок даёт
   почти единицу. Но состояние, которое никогда не меняется, читается так
   же никак, как и случайное. Значит и здесь нужна полоса, а не порог.

   ОБЩИЙ УРОК, РАДИ КОТОРОГО ВСЁ ЭТО: ЖИЗНЬ -- ВСЕГДА ПОЛОСА. Всякая
   величина, которой её меряют, обязана иметь ДВЕ границы. Правило с
   одной границей не может ошибиться в одну сторону -- оно напечатает то,
   что в нём записано первым (ошибка №49 Python-ведомости).

   ТРИ УСЛОВИЯ, И ВСЕ ДВУСТОРОННИЕ ПО СУЩЕСТВУ:

     1. share >= 0.05          -- ткань не молчит;
     2. нагрузка НА УЧАСТВУЮЩЕГО АГЕНТА < 0.50 его личного предела
        (предел = WATCH/(REFRACT+1) импульсов). Порог взят как СЕРЕДИНА
        возможного размаха, а не подобран по разрыву между наблюдёнными
        точками: половина предела -- это "реже, чем вдвое медленнее
        физического максимума";
     3. 0.10 <= structure <= 0.90, где structure = 1 - набл./случайное.
        Снизу -- чтобы рисунок был не случайным, сверху -- чтобы он не
        был застывшим. Граница относительная, к пустому отсчёту, а не
        абсолютная: она не зависит от плотности активности.

   ОТРИЦАТЕЛЬНЫХ ИСХОДОВ ЧЕТЫРЕ, И ОНИ РАЗНЫЕ:
     МОЛЧИТ / ПРИПАДОК / ШУМ (рисунка нет) / ЗАСТЫЛА (рисунок не меняется)

   ПРОВЕРКА НА СЛУЧАЙНОСТЬ. Прежние 100 сидов повторяются ради
   сопоставимости (мутант 49 обязан найтись снова), и добавляются 200
   СВЕЖИХ, которых мера ещё не видела. Итог по свежим сообщается
   ОТДЕЛЬНО -- это и есть честная перепроверка.

   ПРАВИЛО ЧТЕНИЯ, ОБЪЯВЛЕНО ДО ЗАПУСКА:
     * ПОЛОСА ЕСТЬ, если среди СВЕЖИХ 200 живых не менее 5;
     * ПОЛОСЫ НЕТ, если ни одной;
     * 1-4 -- НЕ РАЗРЕШЕНО: находка остаётся наблюдением.
     * Наследный геном обязан выйти МОЛЧАЩИМ.
     * Мутанты 15, 21, 35, 36 обязаны выйти ПРИПАДКОМ -- проверка того,
       что третья редакция чинит именно то, что сломалось.
   ============================================================ */
const fs = require('fs');
const { createWorld, step } = require('../src/world');
const { ancestral, mutate } = require('../src/genome');
const { makeRNG } = require('../src/rng');

const GROW = 1600, WATCH = 2000, BIN = 20, WSEED = 5, REFRACT = 5;
const TIERS = [0.03, 0.06, 0.12, 0.20];
const N_OLD = 100, N_FRESH = 200;
const PER_CAP = Math.floor(WATCH / (REFRACT + 1));
const MIN_SHARE = 0.05, MAX_PER = 0.50, MIN_ST = 0.10, MAX_ST = 0.90;

function deafen(g, fields) {
  for (const e of g.eff) for (const f of fields) e.sens[f] = 0;
  return g;
}

function jac(sets, N, rnd) {
  const rand = sets.map((s) => {
    const r = new Set();
    while (r.size < s.size) r.add(Math.floor(rnd() * N));
    return r;
  });
  const inter = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n; };
  let obs = 0, nul = 0, pairs = 0;
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
    const iO = inter(sets[i], sets[j]), uO = sets[i].size + sets[j].size - iO;
    const iR = inter(rand[i], rand[j]), uR = rand[i].size + rand[j].size - iR;
    if (uO === 0 || uR === 0) continue;
    obs += 1 - iO / uO; nul += 1 - iR / uR; pairs++;
  }
  if (!pairs || nul === 0) return { obs: NaN, nul: NaN, structure: NaN };
  return { obs: obs / pairs, nul: nul / pairs, structure: 1 - (obs / pairs) / (nul / pairs) };
}

function watch(genome, fields) {
  const w = createWorld({ seed: WSEED, genome });
  for (let i = 0; i < GROW; i++) step(w);
  if (fields) deafen(w.genome, fields);
  const idx = new Map(w.cells.map((c, k) => [c, k]));
  const N = w.cells.length;
  const sets = []; let cur = new Set(), spikes = 0;
  for (let i = 0; i < WATCH; i++) {
    step(w);
    for (const c of w.cells) if (c.fired === w.t && idx.has(c)) { cur.add(idx.get(c)); spikes++; }
    if ((i + 1) % BIN === 0) { sets.push(cur); cur = new Set(); }
  }
  const lit = new Set();
  for (const s of sets) for (const x of s) lit.add(x);
  const j = jac(sets, N, makeRNG(4242));
  const firing = lit.size;
  return {
    n: N, spikes, share: N ? firing / N : 0,
    per: firing ? (spikes / firing) / PER_CAP : 0,        // доля ЛИЧНОГО предела
    obs: j.obs, nul: j.nul, structure: j.structure,
  };
}

function verdictOf(r) {
  if (r.share < MIN_SHARE) return 'МОЛЧИТ';
  if (r.per >= MAX_PER) return 'ПРИПАДОК';
  if (!(r.structure >= MIN_ST)) return 'ШУМ';
  if (r.structure > MAX_ST) return 'ЗАСТЫЛА';
  return 'ЖИВАЯ';
}

const base = ancestral();
console.log('ПОЛОСА МЕЖДУ МОЛЧАНИЕМ И ПРИПАДКОМ -- ТРЕТЬЯ РЕДАКЦИЯ МЕРЫ');
console.log(`живая = share >= ${MIN_SHARE}, личная нагрузка < ${MAX_PER}, ` +
  `${MIN_ST} <= рисунок <= ${MAX_ST}`);
console.log(`предел на агента: ${PER_CAP} импульсов за ${WATCH} шагов\n`);

const ctl = watch(base, null);
console.log(`КОНТРОЛЬ наследный: ${verdictOf(ctl)} (share ${(ctl.share * 100).toFixed(1)}%)`);

function runSet(from, count, label) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const i = from + k;
    const tier = TIERS[k % 4];
    const g = mutate(base, makeRNG(9000 + i), { pWeight: tier, pEff: tier });
    const r = watch(g, null);
    out.push({ i, tier, label, ...r, verdict: verdictOf(r) });
  }
  return out;
}

const old = runSet(0, N_OLD, 'прежние');
const fresh = runSet(200, N_FRESH, 'свежие');

function tallyOf(rows) {
  const t = {};
  for (const r of rows) t[r.verdict] = (t[r.verdict] || 0) + 1;
  return t;
}
for (const [name, rows] of [['ПРЕЖНИЕ 100', old], ['СВЕЖИЕ 200', fresh]]) {
  const t = tallyOf(rows);
  console.log(`\n${name}:`);
  for (const k of ['МОЛЧИТ', 'ШУМ', 'ЗАСТЫЛА', 'ПРИПАДОК', 'ЖИВАЯ'])
    if (t[k]) console.log(`  ${k}: ${t[k]}`);
}

console.log('\nПРОВЕРКА ПОЧИНКИ (мутанты, прошедшие вторую редакцию насквозь):');
for (const i of [15, 21, 35, 36, 49]) {
  const r = old.find((x) => x.i === i);
  console.log(`  № ${String(i).padStart(2)}: личная нагрузка ${(r.per * 100).toFixed(0)}%, ` +
    `рисунок ${r.structure.toFixed(3)} -> ${r.verdict}`);
}

const liveAll = old.concat(fresh).filter((r) => r.verdict === 'ЖИВАЯ');
const liveFresh = fresh.filter((r) => r.verdict === 'ЖИВАЯ');
if (liveAll.length) {
  console.log('\n    № | набор | стреляло | личн. нагрузка | набл. | нуль | рисунок');
  for (const r of liveAll)
    console.log(`${String(r.i).padStart(5)} | ${r.label.padStart(7)} | ` +
      `${(r.share * 100).toFixed(0).padStart(7)}% | ${(r.per * 100).toFixed(1).padStart(13)}% | ` +
      `${r.obs.toFixed(3)} | ${r.nul.toFixed(3)} | ${r.structure.toFixed(3)}`);

  console.log('\nГЛУШЕНИЕ СЛУХА (мир не трогаем):');
  console.log('    № | как есть | без своего | без ресурса | без градиента | совсем глухая');
  for (const r of liveAll) {
    const g = () => mutate(base, makeRNG(9000 + r.i), { pWeight: r.tier, pEff: r.tier });
    const d = { own: watch(g(), [0, 1, 2]), res: watch(g(), [3]), gra: watch(g(), [5]), all: watch(g(), [0, 1, 2, 3, 4, 5]) };
    const f = (x) => `${(x.share * 100).toFixed(0)}% (x${(r.share ? x.share / r.share : 1).toFixed(2)})`;
    console.log(`${String(r.i).padStart(5)} | ${(r.share * 100).toFixed(0).padStart(7)}% | ` +
      `${f(d.own).padStart(10)} | ${f(d.res).padStart(11)} | ${f(d.gra).padStart(13)} | ${f(d.all).padStart(13)}`);
    r.deaf = d;
  }
}

let verdict;
if (liveFresh.length >= 5) verdict = 'ПОЛОСА ЕСТЬ: подтверждено на свежих сидах';
else if (liveFresh.length === 0) verdict = 'ПОЛОСЫ НЕТ: среди свежих 200 ни одной живой';
else verdict = `НЕ РАЗРЕШЕНО: живых среди свежих ${liveFresh.length} при объявленном пороге 5`;
console.log(`\nживых среди свежих 200: ${liveFresh.length}`);
console.log(verdict);
console.log('ЭТО НЕ ОТБОР: мутанты ни с чем не соревновались.');

fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/band2.jsonl',
  old.concat(fresh).map((r) => JSON.stringify(r)).join('\n') + '\n');

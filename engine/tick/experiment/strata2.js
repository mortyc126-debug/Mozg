#!/usr/bin/env node
'use strict';
/* ============================================================
   РАССЛАИВАЮТСЯ ЛИ СКОРОСТИ -- С ПЕРЕСТАНОВОЧНЫМ НУЛЁМ

   ПОЧЕМУ ВТОРОЙ ЗАХОД. strata.js сравнивал правило с равномерным
   ЖРЕБИЕМ и напечатал "оба правила выравнивают сильнее случая, 16 из 16,
   p = 0.00002". Разбор показал, что мерился мой выбор нуля:

     разброс весов у правил  0.21-0.24
     разброс весов у жребия  0.577     -- вдвое с лишним больше

   Равномерный жребий неравномернее любого гладкого правила, поэтому
   всякое правило против него выглядит выравнивающим. Вывод был о нуле,
   а не о мире.

   ЧТО ИСПРАВЛЕНО. Нуль стал ПЕРЕСТАНОВОЧНЫМ: берутся ТЕ ЖЕ веса, что
   назначило правило, и раздаются частям ВПЕРЕМЕШКУ. Распределение весов
   то же до последнего числа, связь с состоянием разорвана. Сравнение
   теперь отвечает ровно на вопрос: важно ли, КОМУ достаются такты, --
   а не на вопрос, какой формы моё распределение.

   Это стандартный инструмент проекта, и в первой редакции я его не
   применил. Заодно исправлено вырождение из carry.js: там при потолке
   переноса 0 мир не ходил вовсе (0.5 такта на часть, floor = 0), и
   вердикт печатался на мёртвом мире. Здесь бюджет РАВЕН числу частей,
   так что средняя скорость 1 обновление на круг и мир заведомо живой;
   проверка этого печатается.

   ПРАВИЛО ЧТЕНИЯ, ОБЪЯВЛЕНО ДО ЗАПУСКА, ДВУСТОРОННЕЕ:
     * АДРЕС ТАКТА ВАЖЕН, если разброс скоростей при настоящем правиле
       ОТЛИЧЕН от перестановочного у большинства сидов, p < 0.05.
         ВВЕРХ -- связь с состоянием расслаивает сильнее перестановки;
         ВНИЗ  -- она, наоборот, выравнивает.
     * АДРЕС НЕ ВАЖЕН, если не отличается: тогда всё равно, кому давать
       такты, важно лишь СКОЛЬКО их у кого, и никакой самоорганизации
       дележа в этой среде нет.
     * То же двусторонне -- для "держится ли дележ".
   ОБА ИСХОДА СОДЕРЖАТЕЛЬНЫ. "Адрес не важен" -- полноценный ответ: он
   означал бы, что среда безразлична к тому, ЧЕМУ достаётся вычисление.
   ============================================================ */
const fs = require('fs');
const { createTickWorld, roundWithWeights, weightsOf, EARN } = require('../world');

const N = 64, DEG = 3, ROUNDS = 400, BUDGET = 64;   // бюджет = числу частей: мир заведомо живой
const SEEDS = [11, 22, 33, 44, 55, 66, 77, 88, 99, 110, 121, 132, 143, 154, 165, 176];

function go(seed, rule, shuffle) {
  const w = createTickWorld({ n: N, deg: DEG, seed, budget: BUDGET });
  const pr = require('../../src/rng').makeRNG(seed * 7 + 3);
  const half = ROUNDS / 2;
  let at = null, atQ3 = null;
  for (let r = 0; r < ROUNDS; r++) {
    let wts = weightsOf(w, EARN[rule]);
    if (shuffle) {                       // те же веса, другим частям
      for (let i = wts.length - 1; i > 0; i--) {
        const j = Math.floor(pr() * (i + 1));
        [wts[i], wts[j]] = [wts[j], wts[i]];
      }
    }
    roundWithWeights(w, wts);
    if (r === half - 1) at = w.parts.map((p) => p.steps);
    if (r === ROUNDS * 0.75 - 1) atQ3 = w.parts.map((p) => p.steps);
  }
  const end = w.parts.map((p) => p.steps);
  const sp = end.map((s, i) => (s - at[i]) / half);
  const m = sp.reduce((a, b) => a + b, 0) / N;
  const sd = Math.sqrt(sp.reduce((a, b) => a + (b - m) ** 2, 0) / N);
  const a = atQ3.map((s, i) => s - at[i]), b = end.map((s, i) => s - atQ3[i]);
  const ma = a.reduce((x, y) => x + y, 0) / N, mb = b.reduce((x, y) => x + y, 0) / N;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < N; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return { cv: m > 0 ? sd / m : 0, mean: m, keep: (da > 0 && db > 0) ? num / Math.sqrt(da * db) : 0,
    grab: Math.max(...end) / end.reduce((x, y) => x + y, 0) };
}
function pge(k, n) {
  const c = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  let s = 0; for (let i = k; i <= n; i++) s += c(n, i); return s / 2 ** n;
}

console.log('РАССЛАИВАЮТСЯ ЛИ СКОРОСТИ -- С ПЕРЕСТАНОВОЧНЫМ НУЛЁМ');
console.log(`${N} частей, бюджет ${BUDGET} (= числу частей), ${ROUNDS} кругов, ${SEEDS.length} сидов\n`);
console.log('  сид |    изменчивость     |    устойчивость     | скорость');
console.log('      | своё   перемеш.     | своё   перемеш.     | своё');
const data = [];
for (const seed of SEEDS) {
  const d = { seed };
  for (const rule of ['изменчивость', 'устойчивость']) {
    d[rule] = { real: go(seed, rule, false), perm: go(seed, rule, true) };
  }
  data.push(d);
  console.log(`${String(seed).padStart(5)} | ${d['изменчивость'].real.cv.toFixed(4)} ${d['изменчивость'].perm.cv.toFixed(4)}      | ` +
    `${d['устойчивость'].real.cv.toFixed(4)} ${d['устойчивость'].perm.cv.toFixed(4)}      | ${d['изменчивость'].real.mean.toFixed(3)}`);
}
const n = data.length;
const mean = (f) => (data.reduce((s, d) => s + f(d), 0) / n).toFixed(4);
console.log(`\nмир живой: средняя скорость ${mean((d) => d['изменчивость'].real.mean)} обновлений на круг`);
console.log(`средний разброс: изменчивость своё ${mean((d) => d['изменчивость'].real.cv)} / ` +
  `перемеш. ${mean((d) => d['изменчивость'].perm.cv)}; устойчивость своё ` +
  `${mean((d) => d['устойчивость'].real.cv)} / перемеш. ${mean((d) => d['устойчивость'].perm.cv)}`);
console.log(`средний "держится": изменчивость ${mean((d) => d['изменчивость'].real.keep)} / ` +
  `${mean((d) => d['изменчивость'].perm.keep)}; устойчивость ${mean((d) => d['устойчивость'].real.keep)} / ` +
  `${mean((d) => d['устойчивость'].perm.keep)}`);

function two(label, pick) {
  const up = data.filter((d) => pick(d) > 0).length, dn = n - up;
  const p = pge(Math.max(up, dn), n);
  const sig = p < 0.05;
  console.log(`  ${label}: выше ${up}, ниже ${dn} из ${n}, p = ${p.toFixed(5)}` +
    (sig ? `  <- ОТЛИЧАЕТСЯ, ${up > dn ? 'ВВЕРХ' : 'ВНИЗ'}` : ''));
  return sig;
}
console.log('\nразброс скоростей: своё против перемешанного');
const a1 = two('изменчивость', (d) => d['изменчивость'].real.cv - d['изменчивость'].perm.cv);
const a2 = two('устойчивость', (d) => d['устойчивость'].real.cv - d['устойчивость'].perm.cv);
console.log('держится ли дележ: своё против перемешанного');
const b1 = two('изменчивость', (d) => d['изменчивость'].real.keep - d['изменчивость'].perm.keep);
const b2 = two('устойчивость', (d) => d['устойчивость'].real.keep - d['устойчивость'].perm.keep);

console.log(`\n${(a1 || a2 || b1 || b2)
  ? 'АДРЕС ТАКТА ВАЖЕН: важно не только сколько тактов, но и кому'
  : 'АДРЕС НЕ ВАЖЕН: среда безразлична к тому, чему достаётся вычисление'}`);
fs.mkdirSync('tick/results', { recursive: true });
fs.writeFileSync('tick/results/strata2.jsonl', data.map((d) => JSON.stringify(d)).join('\n') + '\n');

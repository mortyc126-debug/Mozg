#!/usr/bin/env node
'use strict';
/* ============================================================
   ОТЛИЧАЕТСЯ ЛИ ВЫБОР ОТ ЖРЕБИЯ

   Ветвление построено и проверено (test/branch_identity.js). Прежде чем
   спрашивать, какое правило выбора лучше, надо спросить внутреннее и
   куда более важное: ДЕЛАЕТ ЛИ ВЫБОР ХОТЬ ЧТО-НИБУДЬ. Если мир, где
   ветвь оставляют по правилу, неотличим от мира, где её оставляют
   жребием, -- вся постройка мертва, и придумывать правила дальше
   бессмысленно.

   Это вопрос о работе, а не о похожести на что бы то ни было.

   УСТРОЙСТВО. Один и тот же выросший мир, дальше EPISODES эпизодов
   ветвления по N будущих на HORIZON шагов. Различаются только правила:

     жребий-1, жребий-2 -- ветвь выбирается случайно, двумя разными
                           жеребьёвками. Расстояние МЕЖДУ НИМИ и есть
                           ПОЛ: столько даёт один только случай;
     дальше             -- ветвь, ушедшая от прежнего себя дальше всех;
     ближе              -- оставшаяся ближе всех;
     деятельнее         -- та, где произошло больше событий.

   МЕРА РАССТОЯНИЯ МЕЖДУ МИРАМИ -- занятость решётки: сколько агентов в
   каждой ячейке 56x44, L1-расстояние между гистограммами, делённое на
   удвоенное число агентов. Ноль -- миры неразличимы по размещению,
   единица -- не пересекаются вовсе. Мера не знает ни задачи, ни цели и
   ничего не объявляет хорошим; она только говорит, НАСКОЛЬКО РАЗОШЛИСЬ.

   ПРАВИЛО ЧТЕНИЯ, ОБЪЯВЛЕНО ДО ЗАПУСКА:
     * ВЫБОР ДЕЙСТВУЕТ, если расстояние (правило против жребия-1)
       превышает пол (жребий-1 против жребия-2) у большинства сидов при
       биномиальном p < 0.05 -- хотя бы для одного правила;
     * ВЫБОР НЕ ДЕЙСТВУЕТ, если ни одно правило пола не превышает;
     * НЕ РАЗРЕШЕНО, если знаковый счёт не проходит порога.
   ОБА ИСХОДА СОДЕРЖАТЕЛЬНЫ. "Не действует" означало бы, что в этой
   среде выбор будущего ничего не решает -- и это надо знать до того,
   как строить на нём дальше.

   ЧЕГО ОПЫТ НЕ СКАЖЕТ, объявлено заранее: он не говорит, какое правило
   ЛУЧШЕ. "Лучше" требует цели, а цели нет и не назначается. Он говорит
   только, оставляет ли выбор след на мире.
   ============================================================ */
const fs = require('fs');
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');
const { cloneWorld } = require('../src/clone');
const { branchRun, RULES } = require('../src/branch');
const { makeRNG } = require('../src/rng');

const GROW = 1200, N = 4, HORIZON = 200, EPISODES = 20;
const SEEDS = [5, 77, 2024, 11, 22, 33, 101, 202, 303, 404, 505, 606];

/* занятость решётки: агентов в каждой ячейке */
function occupancy(w) {
  const h = new Float64Array(w.GX * w.GY);
  for (const c of w.cells) {
    const x = Math.max(0, Math.min(w.GX - 1, (c.x / w.CS) | 0));
    const y = Math.max(0, Math.min(w.GY - 1, (c.y / w.CS) | 0));
    h[y * w.GX + x] += 1;
  }
  return h;
}
function dist(a, b) {
  const ha = occupancy(a), hb = occupancy(b);
  let s = 0;
  for (let i = 0; i < ha.length; i++) s += Math.abs(ha[i] - hb[i]);
  return s / (a.cells.length + b.cells.length);
}

function grown(seed) {
  const w = createWorld({ seed, genome: ancestral() });
  for (let i = 0; i < GROW; i++) step(w);
  return w;
}

function runPolicy(base, pick) {
  return branchRun(cloneWorld(base), { n: N, horizon: HORIZON, episodes: EPISODES, pick }).world;
}

console.log('ОТЛИЧАЕТСЯ ЛИ ВЫБОР ОТ ЖРЕБИЯ');
console.log(`${N} будущих по ${HORIZON} шагов, ${EPISODES} эпизодов, ${SEEDS.length} сидов`);
console.log('мера -- расхождение размещения агентов; пол -- две разные жеребьёвки\n');
console.log('  сид |    пол | дальше | ближе  | деятельнее | выше пола');

const rows = [];
for (const seed of SEEDS) {
  const base = grown(seed);
  const r1 = makeRNG(1000 + seed), r2 = makeRNG(7000 + seed);
  const lot1 = runPolicy(base, () => r1());
  const lot2 = runPolicy(base, () => r2());
  const floor = dist(lot1, lot2);
  const res = {};
  for (const name of ['дальше', 'ближе', 'деятельнее'])
    res[name] = dist(runPolicy(base, RULES[name]()), lot1);
  const above = Object.keys(res).filter((k) => res[k] > floor);
  rows.push({ seed, floor, ...res, above });
  console.log(`${String(seed).padStart(5)} | ${floor.toFixed(4)} | ${res['дальше'].toFixed(4)} | ` +
    `${res['ближе'].toFixed(4)} | ${res['деятельнее'].toFixed(4).padStart(10)} | ${above.join(', ') || '--'}`);
}

function pge(k, n) {
  const c = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  let s = 0; for (let i = k; i <= n; i++) s += c(n, i); return s / 2 ** n;
}

const n = rows.length;
const mean = (f) => (rows.reduce((s, r) => s + f(r), 0) / n).toFixed(4);
console.log(`\nсредние: пол ${mean((r) => r.floor)}, дальше ${mean((r) => r['дальше'])}, ` +
  `ближе ${mean((r) => r['ближе'])}, деятельнее ${mean((r) => r['деятельнее'])}`);

let any = false;
console.log('\nзнаковый счёт против пола:');
for (const name of ['дальше', 'ближе', 'деятельнее']) {
  const up = rows.filter((r) => r[name] > r.floor).length;
  const p = pge(Math.max(up, n - up), n);
  const sig = p < 0.05 && up > n / 2;
  if (sig) any = true;
  console.log(`  ${name}: выше пола ${up} из ${n}, p = ${p.toFixed(4)}${sig ? '  <- действует' : ''}`);
}

const never = rows.every((r) => r.above.length === 0);
let v;
if (any) v = 'ВЫБОР ДЕЙСТВУЕТ: оставленная по правилу ветвь уводит мир дальше, чем жребий';
else if (never) v = 'ВЫБОР НЕ ДЕЙСТВУЕТ: ни одно правило не превысило пола ни на одном сиде';
else v = 'НЕ РАЗРЕШЕНО: превышения есть, но знаковый счёт порога не проходит';
console.log(`\n${v}`);
console.log('Какое правило ЛУЧШЕ -- этот опыт не говорит: "лучше" требует цели, а цели нет.');

fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/choice.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

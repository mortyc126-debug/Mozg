#!/usr/bin/env node
'use strict';
/* ============================================================
   ПЕРЕНОС ОСТАТКА -- ЭТО ОН ВЫРАВНИВАЕТ?

   ОТКУДА. strata.js: оба правила начисления дают разброс скоростей НИЖЕ
   жребия (16 из 16, p = 0.00002), дележ не держится вовсе, захвата нет
   (1.6% при ровной доле 1.56%). Моё предсказание захвата провалилось
   полностью -- 0 сидов из 16.

   Диагноз назван, но он был рассуждением: перенос остатка -- это
   отрицательная обратная связь. Кто мало заработал, копит и рано или
   поздно ходит; кто много -- тратит сразу. Здесь он проверяется
   ВМЕШАТЕЛЬСТВОМ.

   ЧТО МЕНЯЕТСЯ. Один параметр: потолок переносимого остатка.
     Infinity -- как было: копить можно без предела;
     1.0      -- копить можно не больше одного такта;
     0.0      -- неистраченное пропадает, накопить нельзя вовсе.
   Больше не меняется ничего.

   ПРАВИЛО ЧТЕНИЯ, ОБЪЯВЛЕНО ДО ЗАПУСКА, ДВУСТОРОННЕЕ:
     * ВЫРАВНИВАЕТ ПЕРЕНОС, если при потолке 0 разброс скоростей
       становится ВЫШЕ жребиевого у большинства сидов при p < 0.05,
       тогда как при бесконечном потолке он ниже;
     * ПЕРЕНОС НИ ПРИ ЧЁМ, если разброс остаётся ниже жребия и без
       переноса -- тогда выравнивает что-то другое, и диагноз был
       неверен;
     * НЕ РАЗРЕШЕНО иначе.
   Оба исхода содержательны: "перенос ни при чём" означало бы, что части
   неразличимы по самой мере начисления, и чинить надо не бухгалтерию, а
   вещество мира.
   ============================================================ */
const fs = require('fs');
const { createTickWorld, run } = require('../world');

const N = 64, DEG = 3, ROUNDS = 400, BUDGET = 32;
const SEEDS = [11, 22, 33, 44, 55, 66, 77, 88, 99, 110, 121, 132, 143, 154, 165, 176];
const CAPS = [Infinity, 1.0, 0.0];

function cv(seed, rule, carryCap) {
  const w = createTickWorld({ n: N, deg: DEG, seed, budget: BUDGET, carryCap });
  run(w, ROUNDS / 2, rule);
  const at = w.parts.map((p) => p.steps);
  run(w, ROUNDS / 2, rule);
  const sp = w.parts.map((p, i) => (p.steps - at[i]) / (ROUNDS / 2));
  const m = sp.reduce((a, b) => a + b, 0) / N;
  const sd = Math.sqrt(sp.reduce((a, b) => a + (b - m) ** 2, 0) / N);
  return { cv: m > 0 ? sd / m : 0, mean: m,
    grab: Math.max(...w.parts.map((p) => p.steps)) / w.parts.reduce((a, p) => a + p.steps, 0) };
}
function pge(k, n) {
  const c = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  let s = 0; for (let i = k; i <= n; i++) s += c(n, i); return s / 2 ** n;
}

console.log('ПЕРЕНОС ОСТАТКА -- ЭТО ОН ВЫРАВНИВАЕТ?');
console.log(`${N} частей, бюджет ${BUDGET}, ${ROUNDS} кругов, ${SEEDS.length} сидов\n`);
console.log('потолок |  жребий | изменчивость | устойчивость | захват изм. | скорость');
const rows = [];
for (const cap of CAPS) {
  const r = { cap, lot: [], chg: [], sta: [], grab: [], mean: [] };
  for (const seed of SEEDS) {
    const l = cv(seed, 'жребий', cap), c = cv(seed, 'изменчивость', cap), s = cv(seed, 'устойчивость', cap);
    r.lot.push(l.cv); r.chg.push(c.cv); r.sta.push(s.cv); r.grab.push(c.grab); r.mean.push(c.mean);
  }
  const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  rows.push(r);
  console.log(`${String(cap).padStart(7)} | ${m(r.lot).toFixed(4)}  | ${m(r.chg).toFixed(4)}       | ` +
    `${m(r.sta).toFixed(4)}       | ${(m(r.grab) * 100).toFixed(2)}%       | ${m(r.mean).toFixed(3)}`);
}

console.log('\nзнаковый счёт: правило против жребия, двусторонний');
const verdicts = {};
for (const r of rows) {
  for (const [nm, arr] of [['изменчивость', r.chg], ['устойчивость', r.sta]]) {
    const up = arr.filter((v, i) => v > r.lot[i]).length, dn = arr.length - up;
    const p = pge(Math.max(up, dn), arr.length);
    const dir = p < 0.05 ? (up > dn ? 'ВВЕРХ' : 'ВНИЗ') : '--';
    verdicts[`${r.cap}|${nm}`] = dir;
    console.log(`  потолок ${String(r.cap).padStart(8)}, ${nm}: выше ${up}, ниже ${dn}, ` +
      `p = ${p.toFixed(5)}  ${dir !== '--' ? '<- ' + dir : ''}`);
  }
}

const wasDown = verdicts['Infinity|изменчивость'] === 'ВНИЗ';
const nowUp = verdicts['0|изменчивость'] === 'ВВЕРХ';
const stillDown = verdicts['0|изменчивость'] === 'ВНИЗ';
let v;
if (wasDown && nowUp) v = 'ВЫРАВНИВАЕТ ПЕРЕНОС: убрали накопление -- разброс ушёл выше жребия';
else if (wasDown && stillDown) v = 'ПЕРЕНОС НИ ПРИ ЧЁМ: без накопления выравнивание осталось. Диагноз был неверен: части неразличимы по самой мере начисления';
else v = 'НЕ РАЗРЕШЕНО';
console.log(`\n${v}`);

fs.mkdirSync('tick/results', { recursive: true });
fs.writeFileSync('tick/results/carry.json', JSON.stringify(rows, null, 1));

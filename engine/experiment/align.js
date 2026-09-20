#!/usr/bin/env node
'use strict';
/* ============================================================
   ЭКСПЕРИМЕНТ: согласование ориентаций
   Вопрос только один: способно ли локальное правило превратить
   разнонаправленные ориентации в согласованные. Морфология здесь
   не измеряется вообще и в выводах не участвует.

   Что агент использует: свою локальную асимметрию плотности и
   ориентации соседей в радиусе контакта. Что он НЕ использует:
   координаты, направление к центру или краю, номер ряда, «верх»,
   ось структуры, желаемую форму.

   Контроль: случайные стартовые ориентации. Если согласованность
   растёт от случайного старта — правило действительно уменьшает
   разброс, а не закрепляет уже готовый рисунок.

   Запуск: node experiment/align.js [сиды] [рядов]
   ============================================================ */
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const ALL = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808];
const SEEDS = (process.argv[2] || ALL.join(',')).split(',').map(Number);
const ROWS = +(process.argv[3] || 2);
const STEPS = 1400, MARKS = [0, 50, 200, 600, 1400];

/* порядок: модуль среднего направления. 0 — направления разбросаны, 1 — все совпали */
function order(cells) {
  let sx = 0, sy = 0;
  for (const c of cells) { sx += c.qx; sy += c.qy; }
  return Math.hypot(sx, sy) / cells.length;
}
/* согласие соседей: среднее скалярное произведение ориентаций соприкасающихся агентов */
function localCoherence(w) {
  const R = 7.2 * 1.35;
  let sum = 0, n = 0;
  for (let i = 0; i < w.cells.length; i++) for (let j = i + 1; j < w.cells.length; j++) {
    const a = w.cells[i], b = w.cells[j];
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx * dx + dy * dy > R * R) continue;
    sum += a.qx * b.qx + a.qy * b.qy; n++;
  }
  return n ? sum / n : 0;
}
/* разброс направлений: энтропия по 12 секторам, 1 — полный разброс, 0 — одно направление */
function entropy(cells) {
  const bins = new Array(12).fill(0);
  for (const c of cells) {
    const a = Math.atan2(c.qy, c.qx) + Math.PI;
    bins[Math.min(11, Math.floor(a / (2 * Math.PI) * 12))]++;
  }
  let h = 0;
  for (const b of bins) { if (!b) continue; const p = b / cells.length; h -= p * Math.log(p); }
  return h / Math.log(12);
}

function run(seed, { align, self, randomInit }) {
  const g = ancestral();
  g.eff[0].pol = 1; g.eff[1].pol = 1;
  const per = 60;
  const w = createWorld({
    seed, genome: g, init: 'layer', layerLength: per, layerRows: ROWS,
    params: {
      twoPoint: true, polarity: 0.35, maxCells: per * ROWS,
      align, alignSelf: self, alignRate: 0.10,
    },
  });
  if (randomInit) for (const c of w.cells) { const a = w.rnd() * Math.PI * 2; c.qx = Math.cos(a); c.qy = Math.sin(a); }
  const series = [];
  for (let i = 0; i <= STEPS; i++) {
    if (MARKS.includes(i)) series.push({ t: i, order: order(w.cells), coh: localCoherence(w), ent: entropy(w.cells) });
    if (i < STEPS) step(w);
  }
  const up = w.cells.filter((c) => c.qy < 0).length;
  return { series, up, n: w.cells.length };
}

const CONDS = [
  ['контроль: согласования нет', { align: 0, self: 1, randomInit: false }],
  ['согласование 1', { align: 1, self: 1, randomInit: false }],
  ['согласование 3', { align: 3, self: 1, randomInit: false }],
  ['согласование 1, случайный старт', { align: 1, self: 1, randomInit: true }],
  ['только согласование, случайный старт', { align: 1, self: 0, randomInit: true }],
];
const pick = (process.argv[4] || '0,1,2,3,4').split(',').map(Number);

console.log(`лента из ${ROWS} рядов по 60 агентов, ${SEEDS.length} сидов, ${STEPS} шагов\n`);
for (const idx of pick) {
  const [name, cfg] = CONDS[idx];
  const runs = SEEDS.map((s) => run(s, cfg));
  const at = (k, f) => (runs.reduce((s, r) => s + f(r.series[k]), 0) / runs.length).toFixed(3);
  console.log(name);
  console.log('   шаг   |  порядок | согласие соседей | разброс');
  MARKS.forEach((t, k) => {
    console.log(`  ${String(t).padStart(5)}  |    ${at(k, (p) => p.order)} |            ${at(k, (p) => p.coh)} |   ${at(k, (p) => p.ent)}`);
  });
  const ups = runs.map((r) => r.up);
  console.log(`  в одну сторону смотрят: ${ups.join(', ')} из ${runs[0].n} (по сидам)\n`);
}

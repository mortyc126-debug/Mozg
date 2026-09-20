#!/usr/bin/env node
'use strict';
/* ============================================================
   ЭКСПЕРИМЕНТ: согласование ориентаций на поверхности плотного тела
   Вопрос один: решает ли локальная различимость сторон проблему доменов.
   Морфология не измеряется: механика полярности выключена (polarity = 0),
   поэтому ткань во всех условиях одна и та же, меняется только поле ориентаций.

   Важно про измерение: на искривлённой поверхности единый вектор — неверная
   цель. Если все агенты смотрят наружу, среднее направление равно нулю, хотя
   ткань согласована идеально. Поэтому измеряются и модуль среднего направления,
   и согласие со стороной (наружу или внутрь). Направление «наружу» вычисляет
   наблюдатель, агенту оно недоступно.

   Запуск: node experiment/surface.js [сиды] [условия]
   ============================================================ */
const { createWorld, step, buildHash, forNeighbors, D0 } = require('../src/world');
const { ancestral } = require('../src/genome');

const ALL = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808];
const SEEDS = (process.argv[2] || ALL.join(',')).split(',').map(Number);
const STEPS = 1400, RC = D0 * 1.35;

function neighbors(w, cells) {
  const H = buildHash(w);
  const idx = new Map(cells.map((c, i) => [c, i]));
  const adj = cells.map(() => []);
  for (const c of cells) {
    forNeighbors(H, c, RC, (o) => {
      if (!idx.has(o)) return;
      const dx = o.x - c.x, dy = o.y - c.y;
      if (dx * dx + dy * dy <= RC * RC) adj[idx.get(c)].push(idx.get(o));
    });
  }
  return adj;
}

function metrics(w, cells, cx, cy) {
  if (cells.length < 5) return null;
  let sx = 0, sy = 0;
  for (const c of cells) { sx += c.qx; sy += c.qy; }
  const order = Math.hypot(sx, sy) / cells.length;

  const adj = neighbors(w, cells);
  let sum = 0, n = 0;
  cells.forEach((c, i) => {
    for (const j of adj[i]) { if (j <= i) continue; sum += c.qx * cells[j].qx + c.qy * cells[j].qy; n++; }
  });
  const coh = n ? sum / n : 0;

  // крупнейший ориентационный домен: связная группа, внутри которой соседи согласны
  const seen = new Array(cells.length).fill(false);
  let biggest = 0;
  for (let i = 0; i < cells.length; i++) {
    if (seen[i]) continue;
    const q = [i]; seen[i] = true; let size = 0;
    while (q.length) {
      const x = q.pop(); size++;
      for (const j of adj[x]) {
        if (seen[j]) continue;
        const d = cells[x].qx * cells[j].qx + cells[x].qy * cells[j].qy;
        if (d < 0.8) continue;
        seen[j] = true; q.push(j);
      }
    }
    biggest = Math.max(biggest, size);
  }

  // согласие со стороной: сколько агентов смотрит наружу от центра тела
  let rad = 0;
  for (const c of cells) {
    const dx = c.x - cx, dy = c.y - cy, L = Math.hypot(dx, dy) || 1;
    rad += (c.qx * dx + c.qy * dy) / L;
  }
  rad /= cells.length;

  const bins = new Array(12).fill(0);
  for (const c of cells) {
    const a = Math.atan2(c.qy, c.qx) + Math.PI;
    bins[Math.min(11, Math.floor(a / (2 * Math.PI) * 12))]++;
  }
  let h = 0;
  for (const b of bins) { if (!b) continue; const p = b / cells.length; h -= p * Math.log(p); }

  return { n: cells.length, order, coh, domain: biggest / cells.length, rad, ent: h / Math.log(12) };
}

function run(seed, { align, self, randomInit }) {
  const w = createWorld({
    seed, genome: ancestral(),
    params: { polarity: 0, align, alignSelf: self, alignRate: 0.10 },
  });
  if (randomInit) {
    for (let i = 0; i < 200; i++) step(w);          // дать ткани сложиться
    for (const c of w.cells) { const a = w.rnd() * Math.PI * 2; c.qx = Math.cos(a); c.qy = Math.sin(a); }
    for (let i = 200; i < STEPS; i++) step(w);
  } else {
    for (let i = 0; i < STEPS; i++) step(w);
  }
  let cx = 0, cy = 0;
  for (const c of w.cells) { cx += c.x / w.cells.length; cy += c.y / w.cells.length; }
  const surf = w.cells.filter((c) => c.nb <= 5);
  const deep = w.cells.filter((c) => c.nb >= 6);
  return { all: metrics(w, w.cells, cx, cy), surf: metrics(w, surf, cx, cy), deep: metrics(w, deep, cx, cy) };
}

const CONDS = [
  ['контроль: согласования нет', { align: 0, self: 1, randomInit: false }],
  ['согласование 1', { align: 1, self: 1, randomInit: false }],
  ['согласование 3', { align: 3, self: 1, randomInit: false }],
  ['согласование 1, случайный старт на шаге 200', { align: 1, self: 1, randomInit: true }],
];
const pick = (process.argv[3] || '0,1,2,3').split(',').map(Number);
const f = (x) => x.toFixed(3);

for (const i of pick) {
  const [name, cfg] = CONDS[i];
  const rs = SEEDS.map((s) => run(s, cfg));
  console.log(name);
  console.log('  группа       | агентов | согласие | наружу | крупнейший домен | порядок | разброс');
  for (const part of ['surf', 'deep', 'all']) {
    const label = { surf: 'поверхность', deep: 'глубина    ', all: 'вся ткань  ' }[part];
    const ok = rs.filter((r) => r[part]);
    if (!ok.length) { console.log(`  ${label}  |  нет данных`); continue; }
    const mn = (g) => ok.reduce((s, r) => s + g(r[part]), 0) / ok.length;
    console.log(`  ${label}  |   ${String(Math.round(mn((m) => m.n))).padStart(4)}  |   ${f(mn((m) => m.coh))} | ${f(mn((m) => m.rad))} |            ${f(mn((m) => m.domain))} |   ${f(mn((m) => m.order))} |   ${f(mn((m) => m.ent))}`);
  }
  console.log();
}

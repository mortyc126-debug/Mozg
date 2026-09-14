#!/usr/bin/env node
'use strict';
/* ============================================================
   ЭКСПЕРИМЕНТ: тот же механизм, другая начальная геометрия
   Меняется ровно одно: стартовая конфигурация. Геном, сила полярности,
   сиды, физика, поля, регуляция, пластичность и критерии измерения —
   те же, что в эксперименте с диском.

   Ёмкость мира приравнена к числу стартовых агентов: иначе деление
   мгновенно превратит слой обратно в комок. Это ограничение начального
   условия, а не новое правило.
   ============================================================ */
const { createWorld, step } = require('../src/world');
const { measure, curvature, shape } = require('../src/measure');
const { ancestral } = require('../src/genome');

const STEPS = 1400;
const STRENGTH = 0.35;       // та же сила, что и в эксперименте с диском
const GENES = (process.argv[4] || '3').split(',').map(Number); // по умолчанию тот же ген, что в основном сравнении
const ALL = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808];
const SEEDS = (process.argv[2] || ALL.join(',')).split(',').map(Number);
const ROWS = (process.argv[3] || '1,2').split(',').map(Number);

function run(seed, rows, strength, genes) {
  const g = ancestral();
  for (const gi of genes) g.eff[gi].pol = 1;
  const per = 60, n0 = per * rows;
  const w = createWorld({
    seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
    params: { polarity: strength, maxCells: n0 },
  });
  for (let i = 0; i < STEPS; i++) step(w);
  const m = measure(w);
  const sh = shape(w.cells, w);
  const cu = curvature(w.cells);
  // угол между градиентом среды и слоем: слой горизонтален, поэтому это |cos theta|
  const along = Math.abs(Math.cos(w.theta));
  return {
    pop: m.n, states: m.types.length, anis: m.anis,
    elong: sh.elong, wid: sh.wid, len: cu.len,
    sagitta: cu.sagitta, bend: cu.bend, along,
    profiles: m.types.map((t) => `${t.bits}:${t.n}`).join(' '),
  };
}

const f = (x, k = 3) => x.toFixed(k);
for (const rows of ROWS) {
  console.log(`\n=== слой толщиной ${rows} агент${rows > 1 ? 'а' : ''}, длина 60, ${SEEDS.length} сидов ===`);
  console.log('сид  | вдоль град. | прогиб/длина off → on | толщина off → on | состояний off → on');
  const recs = [];
  for (const seed of SEEDS) {
    const a = run(seed, rows, 0, []);
    const b = run(seed, rows, STRENGTH, GENES);
    recs.push({ seed, a, b });
    console.log(`${String(seed).padStart(4)} | ${f(a.along, 2).padStart(11)} | ` +
      `${f(a.bend).padStart(9)} → ${f(b.bend).padEnd(9)} | ${f(a.wid, 1).padStart(6)} → ${f(b.wid, 1).padEnd(6)} | ` +
      `${a.states} → ${b.states}`);
  }
  const mn = (sel, fn) => recs.reduce((s, r) => s + fn(r[sel]), 0) / recs.length;
  const up = recs.filter((r) => r.b.bend > r.a.bend).length;
  console.log(`  прогиб/длина: ${f(mn('a', (r) => r.bend))} → ${f(mn('b', (r) => r.bend))}, вырос у ${up} из ${recs.length}`);
  console.log(`  прогиб, ед.:  ${f(mn('a', (r) => r.sagitta), 1)} → ${f(mn('b', (r) => r.sagitta), 1)}`);
  console.log(`  толщина:      ${f(mn('a', (r) => r.wid), 1)} → ${f(mn('b', (r) => r.wid), 1)}`);
  console.log(`  длина:        ${f(mn('a', (r) => r.len), 1)} → ${f(mn('b', (r) => r.len), 1)}`);
  console.log(`  агентов:      ${f(mn('a', (r) => r.pop), 0)} → ${f(mn('b', (r) => r.pop), 0)}`);
  console.log(`  состояний:    ${f(mn('a', (r) => r.states), 1)} → ${f(mn('b', (r) => r.states), 1)}`);
  // разделение по тому, насколько градиент направлен вдоль слоя
  const strong = recs.filter((r) => r.a.along > 0.6), weak = recs.filter((r) => r.a.along <= 0.6);
  const sub = (arr, sel) => arr.length ? f(arr.reduce((s, r) => s + r[sel].bend, 0) / arr.length) : '—';
  console.log(`  градиент вдоль слоя (>0.6, ${strong.length} сидов): ${sub(strong, 'a')} → ${sub(strong, 'b')}`);
  console.log(`  градиент поперёк   (≤0.6, ${weak.length} сидов): ${sub(weak, 'a')} → ${sub(weak, 'b')}`);
}

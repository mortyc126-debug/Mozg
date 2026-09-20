#!/usr/bin/env node
'use strict';
/* ============================================================
   ЭТАПЫ A и C двухточечного агента.
     A — эквивалентность: тот же геном, полярность выключена, диск.
         Побитового совпадения не ожидается: агент физически другой.
         Нужно понять, что именно изменилось от смены примитива.
     C — тот же тест на изгиб, что и раньше, но агентом с формой.
   Запуск: node experiment/twopoint.js A|C [сиды] [доп.]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { createWorld, step } = require('../src/world');
const { measure, curvature, shape } = require('../src/measure');
const { ancestral } = require('../src/genome');
const { pickDomain } = require('../src/classify');

const ALL = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808];
const mode = process.argv[2] || 'A';
const SEEDS = (process.argv[3] || ALL.join(',')).split(',').map(Number);

function discRun(seed, two) {
  const w = createWorld({ seed, genome: ancestral(), params: { twoPoint: two } });
  for (let i = 0; i < 1400; i++) step(w);
  const m = measure(w);
  const d = pickDomain(m);
  const nb = w.cells.reduce((s, c) => s + c.nb, 0) / w.cells.length;
  return {
    pop: m.n, states: m.types.length, anis: m.anis, nb,
    bits: d ? d.bits : '—', dn: d ? d.n : 0,
    elong: d ? d.elong : 0, inner: d ? d.inner : 0, wid: d ? d.wid : 0,
    net: m.net.compMax, links: m.net.links,
    tissue: shape(w.cells, w).elong,
  };
}

function layerRun(seed, two, strength, genes, rows) {
  const g = ancestral();
  for (const gi of genes) g.eff[gi].pol = 1;
  const per = 60;
  const w = createWorld({
    seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
    params: { twoPoint: two, polarity: strength, maxCells: per * rows },
  });
  for (let i = 0; i < 1400; i++) step(w);
  const m = measure(w);
  const cu = curvature(w.cells);
  const sh = shape(w.cells, w);
  const nb = w.cells.reduce((s, c) => s + c.nb, 0) / w.cells.length;
  return { pop: m.n, bend: cu.bend, sagitta: cu.sagitta, len: cu.len, wid: sh.wid, nb, states: m.types.length };
}

const f = (x, k = 2) => (typeof x === 'number' ? x.toFixed(k) : String(x));

if (mode === 'A') {
  const OUT = path.join(__dirname, '..', 'results', 'twopoint_A.jsonl');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  for (const seed of SEEDS) {
    const a = discRun(seed, false), b = discRun(seed, true);
    fs.appendFileSync(OUT, JSON.stringify({ seed, point: a, two: b }) + '\n');
    console.log(`сид ${String(seed).padStart(4)} | агентов ${a.pop}→${b.pop} | состояний ${a.states}→${b.states} | ` +
      `профиль ${a.bits}→${b.bits} | область ${a.dn}→${b.dn} | вытянутость ${f(a.elong)}→${f(b.elong)} | ` +
      `внутри ${f(a.inner)}→${f(b.inner)} | сеть ${a.net}→${b.net} | соседей ${f(a.nb)}→${f(b.nb)}`);
  }
} else if (mode === 'C') {
  const rows = +(process.argv[4] || 1);
  const genes = (process.argv[5] || '0,1').split(',').map(Number);
  console.log(`слой толщиной ${rows}, полярность генам ${genes.join(',')}, двухточечные агенты`);
  const recs = [];
  for (const seed of SEEDS) {
    const a = layerRun(seed, true, 0, [], rows);
    const b = layerRun(seed, true, 0.35, genes, rows);
    recs.push({ seed, a, b });
    console.log(`  сид ${String(seed).padStart(4)} | прогиб/длина ${f(a.bend, 3)}→${f(b.bend, 3)} | ` +
      `толщина ${f(a.wid, 1)}→${f(b.wid, 1)} | длина ${f(a.len, 0)}→${f(b.len, 0)} | соседей ${f(a.nb)}→${f(b.nb)}`);
  }
  const mn = (sel, fn) => recs.reduce((s, r) => s + fn(r[sel]), 0) / recs.length;
  const up = recs.filter((r) => r.b.bend > r.a.bend).length;
  console.log(`\n  прогиб/длина: ${f(mn('a', (r) => r.bend), 3)} → ${f(mn('b', (r) => r.bend), 3)}, вырос у ${up} из ${recs.length}`);
  console.log(`  прогиб, ед.:  ${f(mn('a', (r) => r.sagitta), 1)} → ${f(mn('b', (r) => r.sagitta), 1)}`);
  console.log(`  толщина:      ${f(mn('a', (r) => r.wid), 1)} → ${f(mn('b', (r) => r.wid), 1)}`);
  console.log(`  длина:        ${f(mn('a', (r) => r.len), 0)} → ${f(mn('b', (r) => r.len), 0)}`);
  console.log(`  соседей:      ${f(mn('a', (r) => r.nb))} → ${f(mn('b', (r) => r.nb))}`);
}

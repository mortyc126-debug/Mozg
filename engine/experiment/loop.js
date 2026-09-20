#!/usr/bin/env node
'use strict';
/* ============================================================
   ЭКСПЕРИМЕНТ: замкнутая петля
   состояние → согласование → механика → геометрия

   Три условия, различающиеся ровно одним параметром каждое:
     0  baseline     twoPoint ✓  align 1  polarity 0     — устойчива ли исходная форма
     1  полярность   twoPoint ✓  align 1  polarity 0.35  — возникает ли деформация
     2  контроль     twoPoint ✓  align 0  polarity 0.35  — нужна ли коллективная ориентация

   Три независимых вопроса измеряются раздельно:
     1) поляризация: согласие соседей, согласие со стороной, крупнейший домен
     2) механическая передача: деформация агентов
     3) морфогенез: геометрия границы и её устойчивость во времени

   Запуск: node experiment/loop.js [условие] [сиды]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { createWorld, step, buildHash, forNeighbors, D0 } = require('../src/world');
const { measure, shape } = require('../src/measure');
const { ancestral } = require('../src/genome');

const ALL = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808];
const COND = [
  ['baseline', { align: 1, polarity: 0 }],
  ['полярность', { align: 1, polarity: 0.35 }],
  ['контроль без согласования', { align: 0, polarity: 0.35 }],
];
const ci = +(process.argv[2] || 0);
const SEEDS = (process.argv[3] || ALL.join(',')).split(',').map(Number);
const MARKS = [400, 700, 1000, 1400];
const RC = D0 * 1.35;

function orient(w) {
  const cs = w.cells;
  let cx = 0, cy = 0;
  for (const c of cs) { cx += c.x / cs.length; cy += c.y / cs.length; }
  const H = buildHash(w), idx = new Map(cs.map((c, i) => [c, i])), adj = cs.map(() => []);
  for (const c of cs) forNeighbors(H, c, RC, (o) => {
    const dx = o.x - c.x, dy = o.y - c.y;
    if (dx * dx + dy * dy <= RC * RC && idx.has(o)) adj[idx.get(c)].push(idx.get(o));
  });
  let s = 0, n = 0;
  cs.forEach((c, i) => { for (const j of adj[i]) { if (j <= i) continue; s += c.qx * cs[j].qx + c.qy * cs[j].qy; n++; } });
  const seen = new Array(cs.length).fill(false);
  let big = 0;
  for (let i = 0; i < cs.length; i++) {
    if (seen[i]) continue;
    const q = [i]; seen[i] = true; let sz = 0;
    while (q.length) {
      const x = q.pop(); sz++;
      for (const j of adj[x]) {
        if (seen[j] || cs[x].qx * cs[j].qx + cs[x].qy * cs[j].qy < 0.8) continue;
        seen[j] = true; q.push(j);
      }
    }
    big = Math.max(big, sz);
  }
  let rad = 0;
  for (const c of cs) { const dx = c.x - cx, dy = c.y - cy, L = Math.hypot(dx, dy) || 1; rad += (c.qx * dx + c.qy * dy) / L; }
  return { coh: n ? s / n : 0, domain: big / cs.length, rad: rad / cs.length, cx, cy };
}

/* геометрия границы: средний радиус поверхностных агентов и его неровность */
function boundary(w, cx, cy) {
  const surf = w.cells.filter((c) => c.nb <= 5);
  if (surf.length < 10) return { n: surf.length, r: 0, rough: 0 };
  const rs = surf.map((c) => Math.hypot(c.x - cx, c.y - cy));
  const m = rs.reduce((a, b) => a + b, 0) / rs.length;
  const sd = Math.sqrt(rs.reduce((a, b) => a + (b - m) * (b - m), 0) / rs.length);
  return { n: surf.length, r: m, rough: sd / m };
}

function snapshot(w) {
  const o = orient(w);
  const m = measure(w);
  const b = boundary(w, o.cx, o.cy);
  const def = w.cells.reduce((s, c) => s + Math.abs(c.r1 - c.r2) / ((c.r1 + c.r2) / 2 || 1), 0) / w.cells.length;
  const sh = shape(w.cells, w);
  const nb = w.cells.reduce((s, c) => s + c.nb, 0) / w.cells.length;
  return {
    t: w.t, pop: m.n, coh: o.coh, domain: o.domain, rad: o.rad, deform: def,
    bR: b.r, rough: b.rough, surfN: b.n, elong: sh.elong, nb,
    net: m.net.compMax, links: m.net.links, states: m.types.length,
  };
}

const [name, cfg] = COND[ci];
const OUT = path.join(__dirname, '..', 'results', 'loop.jsonl');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
console.log(`условие: ${name} (align ${cfg.align}, polarity ${cfg.polarity})\n`);
const runs = [];
for (const seed of SEEDS) {
  const g = ancestral();
  for (let i = 0; i < g.nGenes; i++) g.eff[i].pol = 1;    // деформироваться может любой агент
  const w = createWorld({
    seed, genome: g,
    params: { twoPoint: true, align: cfg.align, alignSelf: 1, alignRate: 0.10, polarity: cfg.polarity },
  });
  const series = [];
  for (let i = 1; i <= 1400; i++) { step(w); if (MARKS.includes(i)) series.push(snapshot(w)); }
  runs.push({ seed, cond: name, series });
  fs.appendFileSync(OUT, JSON.stringify({ seed, cond: name, series }) + '\n');
  const l = series[series.length - 1];
  console.log(`сид ${String(seed).padStart(4)} | согласие ${l.coh.toFixed(2)} домен ${l.domain.toFixed(2)} наружу ${l.rad.toFixed(2)} | ` +
    `деформация ${(100 * l.deform).toFixed(0)}% | радиус ${l.bR.toFixed(0)} неровность ${l.rough.toFixed(3)} | ` +
    `соседей ${l.nb.toFixed(2)} сеть ${l.net}`);
}
console.log('\nво времени (среднее по сидам):');
console.log('  шаг  | согласие | домен | наружу | деформация | радиус | неровность | соседей | сеть');
MARKS.forEach((t, k) => {
  const mn = (f) => runs.reduce((s, r) => s + f(r.series[k]), 0) / runs.length;
  console.log(`  ${String(t).padStart(4)} |     ${mn((p) => p.coh).toFixed(2)} |  ${mn((p) => p.domain).toFixed(2)} |   ${mn((p) => p.rad).toFixed(2)} |` +
    `        ${(100 * mn((p) => p.deform)).toFixed(0)}% |  ${mn((p) => p.bR).toFixed(0)}   |      ${mn((p) => p.rough).toFixed(3)} |    ${mn((p) => p.nb).toFixed(2)} |  ${Math.round(mn((p) => p.net))}`);
});

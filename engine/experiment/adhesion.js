#!/usr/bin/env node
'use strict';
/* Параметрический прогон по силе сцепления.
   Гипотеза, которую проверяем: дифференциальная адгезия отвечает за сортировку
   ткани, уплотнение области и её уход внутрь.
   Метрика сортировки: доля соседей агента, находящихся в том же состоянии. */
const { createWorld, step, buildHash, forNeighbors, D0 } = require('../src/world');
const { measure } = require('../src/measure');
const { ancestral } = require('../src/genome');
const { pickDomain } = require('../src/classify');

const SEEDS = [5, 77, 2024];
const VALUES = [0, 0.25, 0.5, 1, 2, 3];

function sorting(w, bits) {
  const inGroup = (c) => {
    let k = 0;
    for (let g = 0; g < w.nGenes; g++) if (c.e[g] > 0.5) k |= (1 << g);
    return k === bits;
  };
  const H = buildHash(w);
  let same = 0, total = 0;
  for (const c of w.cells) {
    if (!inGroup(c)) continue;
    forNeighbors(H, c, D0 * 1.35, (o) => {
      const dx = o.x - c.x, dy = o.y - c.y;
      if (dx * dx + dy * dy > (D0 * 1.35) * (D0 * 1.35)) return;
      total++; if (inGroup(o)) same++;
    });
  }
  return total ? same / total : 0;
}

console.log('множитель | сид | вытянутость | ширина | внутри | сортировка | сеть');
for (const v of VALUES) {
  const row = [];
  for (const seed of SEEDS) {
    const w = createWorld({ seed, genome: ancestral(), params: { adhesionScale: v } });
    for (let i = 0; i < 1400; i++) step(w);
    const m = measure(w);
    const d = pickDomain(m);
    const srt = d ? sorting(w, d.key) : 0;
    row.push({ seed, el: d ? d.elong : 0, wid: d ? d.wid : 0, inner: d ? d.inner : 0, srt, net: m.net.compMax });
    console.log(`   ${String(v).padEnd(6)} | ${String(seed).padStart(4)} | ` +
      `${(d ? d.elong : 0).toFixed(2).padStart(11)} | ${(d ? d.wid : 0).toFixed(1).padStart(6)} | ` +
      `${(d ? d.inner : 0).toFixed(2).padStart(6)} | ${srt.toFixed(2).padStart(10)} | ${String(m.net.compMax).padStart(4)}`);
  }
  const mean = (f) => (row.reduce((a, b) => a + f(b), 0) / row.length).toFixed(2);
  console.log(`   среднее по множителю ${v}: вытянутость ${mean((r) => r.el)}, ширина ${mean((r) => r.wid)}, ` +
    `внутри ${mean((r) => r.inner)}, сортировка ${mean((r) => r.srt)}\n`);
}

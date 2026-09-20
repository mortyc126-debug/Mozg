#!/usr/bin/env node
'use strict';
/* Сводка по эксперименту: повторяемость исходов и группировка по признакам. */
const fs = require('fs');
const { kmeans } = require('../src/classify');
const { makeRNG } = require('../src/rng');

const rows = fs.readFileSync(process.argv[2] || 'results/sweep.jsonl', 'utf8')
  .trim().split('\n').filter(Boolean).map(JSON.parse).filter((r) => !r.error);

console.log(`прогонов: ${rows.length}\n`);
const counts = new Map();
for (const r of rows) counts.set(r.key, (counts.get(r.key) || 0) + 1);
console.log('исходы по убыванию частоты:');
for (const [k, v] of [...counts].sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(v).padStart(3)}  ${k}`);

const anc = rows.find((r) => r.kind === 'исходный');
console.log(`\nисходный геном: ${anc.key}`);
const same = rows.filter((r) => r.kind !== 'исходный' && r.key === anc.key).length;
console.log(`мутантов с тем же исходом: ${same} из ${rows.length - 1}`);

const NAMES = ['агентов', 'состояний', 'вытянутость', 'внутри', 'центр пуст', 'размер области',
  'сеть', 'степень', 'анизотропия', 'отклик', 'прирост отклика'];
const rnd = makeRNG(7);
const { assign, centers } = kmeans(rows.map((r) => r.features), 6, rnd);
console.log('\nгруппировка по признакам (k-средних, 6 групп):');
centers.forEach((c, ci) => {
  const mem = rows.filter((_, i) => assign[i] === ci);
  if (!mem.length) return;
  const top = c.map((v, j) => [NAMES[j], v]).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([nm, v]) => `${nm} ${v.toFixed(2)}`).join(', ');
  const ex = [...new Set(mem.map((m) => m.key))].slice(0, 2).join(' / ');
  console.log(`  группа ${ci + 1}: ${String(mem.length).padStart(3)} прогонов | ${top}`);
  console.log(`            типичные исходы: ${ex}`);
  if (mem.some((m) => m.kind === 'исходный')) console.log('            сюда попадает исходный геном');
});

const learn = rows.filter((r) => r.pl && r.pl.gain >= 2 && r.pl.after - r.pl.before >= 5);
const elong = rows.filter((r) => r.domains.some((d) => d.elong >= 3 && d.n >= 15));
const ring = rows.filter((r) => r.domains.some((d) => d.hollow >= 0.8 && d.elong < 2 && d.n >= 15));
console.log(`\nсводка: вытянутая область — ${elong.length}, кольцевая — ${ring.length}, ` +
  `рост отклика от повторов — ${learn.length}, сеть ≥50 — ${rows.filter((r) => r.net.compMax >= 50).length}`);

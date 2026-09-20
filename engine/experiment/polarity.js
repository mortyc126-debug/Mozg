#!/usr/bin/env node
'use strict';
/* ============================================================
   ЭКСПЕРИМЕНТ: локальная асимметрия окружения
   Вопрос ровно один: может ли локальная асимметрия изменить геометрию
   уже существующей области? Ничего про замыкание, полость и трубку здесь нет.

   Что именно получает агент: усреднённое направление на ту сторону, где
   ближайших соседей меньше, и величина этой асимметрии. Больше ничего.
   Агент не знает ни своего положения, ни формы ткани, ни направления
   «наружу» в смысле будущей структуры.

   Запуск: node experiment/polarity.js [режим] [сиды]
     режимы: main (baseline vs polarity_on), sweep (по силе), where (кому включено)
   ============================================================ */
const { createWorld, step } = require('../src/world');
const { measure, curvature } = require('../src/measure');
const { ancestral } = require('../src/genome');
const { pickDomain } = require('../src/classify');

const STEPS = 1400;
const ALL = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808];

/* target — двоичный профиль группы, по которой меряем. Если задан, берём именно её:
   иначе наблюдатель в разных режимах выберет разные группы и сравнение будет ложным. */
function run(seed, { strength = 0, genes = [3], target = null } = {}) {
  const g = ancestral();
  for (const gi of genes) g.eff[gi].pol = 1;
  const w = createWorld({ seed, genome: g, params: { polarity: strength } });
  for (let i = 0; i < STEPS; i++) step(w);
  const m = measure(w);
  const d = target ? (m.types.find((t) => t.bits === target) || null) : pickDomain(m);
  if (!d) return { bits: target, n: 0, elong: 0, wid: 0, inner: 0, len: 0, sagitta: 0, bend: 0, net: m.net.compMax, pop: m.n, missing: true };
  const group = w.cells.filter((c) => {
    let k = 0;
    for (let x = 0; x < w.nGenes; x++) if (c.e[x] > 0.5) k |= (1 << x);
    return k === d.key;
  });
  const cu = curvature(group);
  return {
    bits: d.bits, n: d.n, elong: d.elong, wid: d.wid, inner: d.inner,
    len: cu.len, sagitta: cu.sagitta, bend: cu.bend,
    net: m.net.compMax, pop: m.n,
  };
}

const mode = process.argv[2] || 'main';
const SEEDS = (process.argv[3] || ALL.join(',')).split(',').map(Number);
const GENES = (process.argv[4] || '3').split(',').map(Number);
const f = (x, k = 2) => (x === null || x === undefined ? '—' : x.toFixed(k));

if (mode === 'main') {
  console.log('сид  | режим        | агентов | вытянутость | ширина | прогиб | прогиб/длина | сеть');
  const rows = [];
  for (const seed of SEEDS) {
    const a = run(seed, { strength: 0, genes: GENES });
    const b = run(seed, { strength: 0.35, genes: GENES, target: a.bits });
    rows.push({ seed, a, b });
    for (const [name, r] of [['baseline', a], ['polarity_on', b]]) {
      console.log(`${String(seed).padStart(4)} | ${name.padEnd(12)} | ${r.bits} ${String(r.n).padStart(4)} | ` +
        `${f(r.elong).padStart(11)} | ${f(r.wid, 1).padStart(6)} | ${f(r.sagitta, 1).padStart(6)} | ` +
        `${f(r.bend, 3).padStart(12)} | ${String(r.net).padStart(4)}`);
    }
  }
  const mean = (sel, f2) => rows.reduce((s, r) => s + f2(r[sel]), 0) / rows.length;
  const up = rows.filter((r) => r.b.bend > r.a.bend).length;
  console.log('\nсводка по', rows.length, 'сидам (одни и те же сиды в обоих режимах):');
  console.log(`  прогиб/длина: baseline ${f(mean('a', (r) => r.bend), 3)} → polarity_on ${f(mean('b', (r) => r.bend), 3)}`);
  console.log(`  прогиб (ед.): baseline ${f(mean('a', (r) => r.sagitta), 1)} → polarity_on ${f(mean('b', (r) => r.sagitta), 1)}`);
  console.log(`  вытянутость:  baseline ${f(mean('a', (r) => r.elong))} → polarity_on ${f(mean('b', (r) => r.elong))}`);
  console.log(`  ширина:       baseline ${f(mean('a', (r) => r.wid), 1)} → polarity_on ${f(mean('b', (r) => r.wid), 1)}`);
  console.log(`  сеть:         baseline ${f(mean('a', (r) => r.net), 0)} → polarity_on ${f(mean('b', (r) => r.net), 0)}`);
  console.log(`  прогиб вырос у ${up} из ${rows.length} сидов`);
} else if (mode === 'sweep') {
  console.log('сила | средний прогиб/длина | прогиб | вытянутость | ширина | сеть');
  for (const s of [0, 0.15, 0.35, 0.6, 1.0, 1.6]) {
    const rs = SEEDS.map((seed) => run(seed, { strength: s })).filter(Boolean);
    const mn = (f2) => rs.reduce((a, b) => a + f2(b), 0) / rs.length;
    console.log(`${String(s).padEnd(4)} | ${f(mn((r) => r.bend), 3).padStart(20)} | ${f(mn((r) => r.sagitta), 1).padStart(6)} | ` +
      `${f(mn((r) => r.elong)).padStart(11)} | ${f(mn((r) => r.wid), 1).padStart(6)} | ${f(mn((r) => r.net), 0).padStart(4)}`);
  }
} else if (mode === 'where') {
  console.log('кому включено | прогиб/длина | вытянутость | ширина | сеть');
  const variants = [['никому', []], ['гену 3 (область)', [3]], ['генам 0 и 1 (домены)', [0, 1]], ['всем генам', [0, 1, 2, 3, 4, 5]]];
  for (const [name, genes] of variants) {
    const rs = SEEDS.map((seed) => run(seed, { strength: genes.length ? 0.35 : 0, genes })).filter(Boolean);
    const mn = (f2) => rs.reduce((a, b) => a + f2(b), 0) / rs.length;
    console.log(`${name.padEnd(21)} | ${f(mn((r) => r.bend), 3).padStart(12)} | ${f(mn((r) => r.elong)).padStart(11)} | ` +
      `${f(mn((r) => r.wid), 1).padStart(6)} | ${f(mn((r) => r.net), 0).padStart(4)}`);
  }
}

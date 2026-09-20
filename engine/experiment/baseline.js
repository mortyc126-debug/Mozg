#!/usr/bin/env node
'use strict';
/* ============================================================
   ЭКСПЕРИМЕНТ: baseline
   Воспроизведение текущего результата без единого изменения правил.
   Сохраняется не итог, а временной ряд: нас интересует процесс.
   Запуск: node experiment/baseline.js [сиды через запятую]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { createWorld, step } = require('../src/world');
const { measure } = require('../src/measure');
const { ancestral } = require('../src/genome');
const { sites, plasticity } = require('../src/probe');
const { pickDomain } = require('../src/classify');

const SEEDS = (process.argv[2] || '5,77,2024,9,101,202,303,404,505,606,707,808')
  .split(',').map(Number);
const STEPS = 1400;
const MARKS = [0, 10, 25, 50, 100, 200, 300, 400, 600, 900, 1200, 1400];

function snapshot(w) {
  const m = measure(w);
  const d = pickDomain(m);
  return {
    t: m.t,
    population: m.n,
    energy: +m.energy.toFixed(3),
    expression: m.mean.map((x) => +x.toFixed(3)),
    states: m.types.length,
    anisotropy: +m.anis.toFixed(3),
    morphology: d ? {
      n: d.n, elongation: +d.elong.toFixed(2),
      inner: +d.inner.toFixed(2), hollow: +d.hollow.toFixed(2),
    } : null,
    connectivity: {
      comps: m.net.comps, compMax: m.net.compMax,
      links: m.net.links, degree: +m.net.degree.toFixed(2),
      wMean: +m.net.wMean.toFixed(3),
    },
  };
}

const runs = [];
for (const seed of SEEDS) {
  const w = createWorld({ seed, genome: ancestral() });
  const series = [snapshot(w)];
  for (let i = 1; i <= STEPS; i++) {
    step(w);
    if (MARKS.includes(i)) series.push(snapshot(w));
  }
  const s = sites(w)[0];
  const exc = s ? plasticity(w, s) : null;
  runs.push({ seed, genome_id: 'ancestral', steps: STEPS, parameters: w.p, series, excitation: exc });
  const last = series[series.length - 1];
  console.log(`сид ${String(seed).padStart(4)} | агентов ${last.population} | состояний ${last.states} | ` +
    `вытянутость ${last.morphology ? last.morphology.elongation.toFixed(1) : '—'} | ` +
    `внутри ${last.morphology ? last.morphology.inner.toFixed(2) : '—'} | ` +
    `пусто в центре ${last.morphology ? last.morphology.hollow.toFixed(2) : '—'} | ` +
    `сеть ${last.connectivity.compMax} | связей ${last.connectivity.links} | ` +
    `отклик ${exc ? exc.before + '→' + exc.after : '—'}`);
}

/* сводка: разброс по сидам важнее среднего */
const pick = (f) => runs.map(f).filter((x) => x !== null && x !== undefined);
const stat = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return `${mean.toFixed(2)} (от ${s[0].toFixed(2)} до ${s[s.length - 1].toFixed(2)})`;
};
const last = (r) => r.series[r.series.length - 1];
console.log('\nсводка по', runs.length, 'сидам:');
console.log('  агентов          ', stat(pick((r) => last(r).population)));
console.log('  состояний        ', stat(pick((r) => last(r).states)));
console.log('  анизотропия      ', stat(pick((r) => last(r).anisotropy)));
console.log('  вытянутость      ', stat(pick((r) => last(r).morphology && last(r).morphology.elongation)));
console.log('  доля внутри      ', stat(pick((r) => last(r).morphology && last(r).morphology.inner)));
console.log('  пусто в центре   ', stat(pick((r) => last(r).morphology && last(r).morphology.hollow)));
console.log('  крупнейшая сеть  ', stat(pick((r) => last(r).connectivity.compMax)));
console.log('  связей           ', stat(pick((r) => last(r).connectivity.links)));
console.log('  отклик до обучения', stat(pick((r) => r.excitation && r.excitation.before)));
console.log('  отклик после     ', stat(pick((r) => r.excitation && r.excitation.after)));
const grew = runs.filter((r) => r.excitation && r.excitation.after > r.excitation.before).length;
console.log(`  отклик вырос у ${grew} из ${runs.length} сидов`);

/* когда каждый признак появляется впервые — по временному ряду, а не по расписанию */
console.log('\nпервое появление признака (шаг), по сидам:');
const firstAt = (r, test) => { const p = r.series.find(test); return p ? p.t : null; };
const feats = [
  ['анизотропия > 0.5', (p) => p.anisotropy > 0.5],
  ['два состояния', (p) => p.states >= 2],
  ['область ≥ 20 агентов', (p) => p.morphology && p.morphology.n >= 20],
  ['вытянутость ≥ 3', (p) => p.morphology && p.morphology.elongation >= 3],
  ['доля внутри > 0.7', (p) => p.morphology && p.morphology.inner > 0.7],
  ['сеть ≥ 50', (p) => p.connectivity.compMax >= 50],
];
for (const [name, test] of feats) {
  const vals = runs.map((r) => firstAt(r, test));
  const ok = vals.filter((v) => v !== null);
  console.log(`  ${name.padEnd(22)} ${ok.length}/${runs.length} сидов, шаги: ${vals.map((v) => v === null ? '—' : v).join(', ')}`);
}

fs.mkdirSync(path.join(__dirname, '..', 'results'), { recursive: true });
const out = path.join(__dirname, '..', 'results', 'baseline.json');
fs.writeFileSync(out, JSON.stringify({ created: new Date().toISOString(), steps: STEPS, marks: MARKS, runs }, null, 1));
console.log('\nсохранено:', out);

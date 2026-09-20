#!/usr/bin/env node
'use strict';
/* ============================================================
   ЭКСПЕРИМЕНТ: пространство правил
   Берём исходный геном, вносим случайные мутации и смотрим,
   какие структуры возникают. Цель не в том, чтобы получить
   заранее задуманное, а в том, чтобы увидеть распределение исходов.
   Использование: node bin/sweep.js [N] [файл]
   ============================================================ */
const fs = require('fs');
const { createWorld, step } = require('../src/world');
const { measure } = require('../src/measure');
const { ancestral, mutate, randomGenome } = require('../src/genome');
const { makeRNG } = require('../src/rng');
const { sites, plasticity } = require('../src/probe');
const { key, features, labels } = require('../src/classify');

const FROM = +(process.argv[2] || 0);
const TO = +(process.argv[3] || 100);
const OUT = process.argv[4] || 'results/sweep.jsonl';
const STEPS = 1400, WSEED = 5;
fs.mkdirSync('results', { recursive: true });
if (FROM === 0) fs.writeFileSync(OUT, '');   // начинаем заново только с нулевого прогона

const TIERS = [0.03, 0.06, 0.12, 0.20];

function trial(genome, tag) {
  const w = createWorld({ seed: WSEED, genome });
  for (let i = 0; i < STEPS; i++) step(w);
  const m = measure(w);
  let pl = null;
  const s = sites(w)[0];
  if (s && m.n >= 60) pl = plasticity(w, s);
  return {
    tag,
    n: m.n, energy: +m.energy.toFixed(3), types: m.types.length, anis: +m.anis.toFixed(3),
    domains: m.types.map((t) => ({ bits: t.bits, n: t.n, elong: +t.elong.toFixed(2), inner: +t.inner.toFixed(2), hollow: +t.hollow.toFixed(2) })),
    net: { comps: m.net.comps, compMax: m.net.compMax, links: m.net.links, degree: +m.net.degree.toFixed(2), wMean: +m.net.wMean.toFixed(3) },
    pl: pl && { before: pl.before, after: pl.after, gain: +(pl.gain === Infinity ? 99 : pl.gain).toFixed(2) },
    key: key(m, pl), labels: labels(m, pl), features: features(m, pl).map((x) => +x.toFixed(4)),
  };
}

const t0 = Date.now();
const write = (r) => fs.appendFileSync(OUT, JSON.stringify(r) + '\n');

if (FROM === 0) {
  write({ i: 0, kind: 'исходный', ...trial(ancestral(), 'ancestral') });
  process.stderr.write('исходный геном готов\n');
}

for (let i = Math.max(1, FROM); i <= TO; i++) {
  const rnd = makeRNG(1000 + i);
  const tier = TIERS[i % TIERS.length];
  const kind = i % 10 === 0 ? 'случайный' : `мутант p=${tier}`;
  const g = i % 10 === 0 ? randomGenome(rnd) : mutate(ancestral(), rnd, { pWeight: tier, sWeight: 2.2, pEff: tier * 1.6 });
  let r;
  try { r = trial(g, kind); } catch (e) { r = { tag: kind, error: String(e.message) }; }
  write({ i, kind, ...r });
  process.stderr.write(`${i}/${TO} ${((Date.now() - t0) / 1000).toFixed(0)}с — ${r.key || r.error}\n`);
}
process.stderr.write('готово\n');

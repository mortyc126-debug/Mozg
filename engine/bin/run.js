#!/usr/bin/env node
'use strict';
/* Один прогон: развитие, измерения по ходу, затем проба на пластичность.
   Использование: node bin/run.js [seed] [steps] */
const { createWorld, step } = require('../src/world');
const { measure } = require('../src/measure');
const { ancestral } = require('../src/genome');
const { sites, plasticity } = require('../src/probe');
const { labels } = require('../src/classify');

const seed = +(process.argv[2] || 5), steps = +(process.argv[3] || 1600);
const w = createWorld({ seed, genome: ancestral() });
for (let i = 1; i <= steps; i++) {
  step(w);
  if (i % 400 === 0) {
    const m = measure(w);
    console.log(`шаг ${String(i).padStart(5)} | агентов ${m.n} | состояний ${m.types.length} | ` +
      `анизотропия ${m.anis.toFixed(2)} | сеть ${m.net.compMax}/${m.net.comps} | связей ${m.net.links}`);
  }
}
const m = measure(w);
console.log('\nустойчивые состояния экспрессии:');
for (const t of m.types)
  console.log(`  профиль ${t.bits} | ${t.n} агентов (${(t.share * 100).toFixed(0)}%) | ` +
    `длина/ширина ${t.elong.toFixed(1)} | внутри ${t.inner.toFixed(2)} | центр пуст ${t.hollow.toFixed(2)}`);
const p = sites(w)[0];
const pl = p ? plasticity(w, p) : null;
if (pl) console.log(`\nпроба: до ${pl.before} агентов (дальность ${pl.farBefore.toFixed(0)}), ` +
  `после повторов ${pl.after} (дальность ${pl.farAfter.toFixed(0)})`);
console.log('\nописание исхода:');
for (const l of labels(measure(w), pl)) console.log('  -', l);

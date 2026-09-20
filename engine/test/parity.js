'use strict';
/* Проверка, что переписанное ядро воспроизводит поведение прежнего:
   разделение на состояния, вытянутая внутренняя область, единая сеть,
   рост отклика от повторов. */
const { createWorld, step } = require('../src/world');
const { measure } = require('../src/measure');
const { ancestral } = require('../src/genome');
const { sites, plasticity } = require('../src/probe');
const { pickDomain } = require('../src/classify');

let fails = 0;
const check = (name, ok, info) => { console.log(`${ok ? ' ok ' : 'СБОЙ'}  ${name}  ${info}`); if (!ok) fails++; };

for (const seed of [5, 77, 2024]) {
  const w = createWorld({ seed, genome: ancestral() });
  for (let i = 0; i < 1600; i++) step(w);
  const m = measure(w);
  const d = pickDomain(m);
  check(`seed ${seed}: несколько состояний`, m.types.length >= 2, `состояний ${m.types.length}`);
  check(`seed ${seed}: вытянутая внутренняя область`, !!d && d.elong >= 3 && d.inner > 0.6,
    d ? `длина/ширина ${d.elong.toFixed(1)}, внутри ${d.inner.toFixed(2)}` : 'области нет');
  check(`seed ${seed}: единая сеть`, m.net.compMax >= 50, `крупнейшая ${m.net.compMax}`);
  const p = sites(w)[0];
  const pl = plasticity(w, p);
  check(`seed ${seed}: отклик растёт от повторов`, pl.after > pl.before,
    `${pl.before} → ${pl.after}`);
}
console.log(fails ? `\nпровалено проверок: ${fails}` : '\nвсе проверки пройдены');
process.exit(fails ? 1 : 0);

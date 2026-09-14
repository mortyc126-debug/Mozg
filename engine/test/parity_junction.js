'use strict';
/* ТЕ ЖЕ критерии приёмки, что в parity.js, но механизм включён на ВСЁ
   РАЗВИТИЕ. Вопрос: не ломает ли сцепление через закреплённые контакты
   само развитие? Критерии не мои, а движка -- это важно: свой критерий
   можно подобрать под результат, чужой нельзя.

   Запуск: node test/parity_junction.js [jadh] [jstiff] */
const { createWorld, step } = require('../src/world');
const { measure } = require('../src/measure');
const { ancestral } = require('../src/genome');
const { sites, plasticity } = require('../src/probe');
const { pickDomain } = require('../src/classify');

const JADH = +(process.argv[2] || 1);
const JST = +(process.argv[3] || 0.4);

let fails = 0;
const check = (name, ok, info) => { console.log(`${ok ? ' ok ' : 'СБОЙ'}  ${name}  ${info}`); if (!ok) fails++; };

console.log(`развитие С механизмом: junctionAdhesion=${JADH}, junction=${JST}\n`);
for (const seed of [5, 77, 2024]) {
  const w = createWorld({ seed, genome: ancestral(),
    params: { junctionAdhesion: JADH, junction: JST } });
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
  check(`seed ${seed}: агентов`, w.cells.length > 100, `${w.cells.length}`);
}
console.log(fails ? `\nпровалено проверок: ${fails}` : '\nвсе проверки пройдены');

#!/usr/bin/env node
'use strict';
/* ============================================================
   ТОЖДЕСТВО ПРИ ВЫКЛЮЧЕННОМ МЕХАНИЗМЕ.

   При junction = 0 изменённое ядро обязано вести себя ТОЧНО так же,
   как нетронутое из архива. Без этого сравнение "с закреплёнными
   контактами против без" сравнивало бы две разные реализации, а не
   наличие механизма.

   Сверяется полное состояние: число агентов, координаты, энергия,
   экспрессия, возбуждение, связи. Точное равенство, без допуска.

   Запуск: node test/junction_identity.js <путь-к-оригиналу>
   ============================================================ */
const path = require('path');
const ORIG = process.argv[2];
if (!ORIG) { console.error('нужен путь к нетронутому движку'); process.exit(1); }

const A = require('../src/world.js');
const B = require(path.join(ORIG, 'src/world.js'));
const GA = require('../src/genome.js');
const GB = require(path.join(ORIG, 'src/genome.js'));

function snapshot(w) {
  const rows = w.cells.map((c) => [
    c.x, c.y, c.vx, c.vy, c.energy, c.nb, c.v, c.u, c.ad, c.fired,
    c.p1x, c.p1y, c.p2x, c.p2y, c.qx, c.qy, c.amag,
    c.links.length, Array.from(c.e).join(','),
  ].join('|'));
  return { n: w.cells.length, t: w.t, rows: rows.join('\n') };
}

let failures = 0;
for (const two of [false, true]) {
  for (const seed of [5, 77, 2024]) {
    const ga = GA.ancestral(), gb = GB.ancestral();
    const params = two
      ? { twoPoint: true, align: 1, alignSelf: 1, alignRate: 0.10, polarity: 0.35 }
      : {};
    const wa = A.createWorld({ seed, genome: ga, params: { ...params, junction: 0 } });
    const wb = B.createWorld({ seed, genome: gb, params });
    const N = 600;
    for (let i = 0; i < N; i++) { A.step(wa); B.step(wb); }
    const sa = snapshot(wa), sb = snapshot(wb);
    const same = sa.n === sb.n && sa.t === sb.t && sa.rows === sb.rows;
    console.log(`  ${two ? 'двухточечный' : 'точечный  '} seed ${String(seed).padStart(4)}: ` +
      `агентов ${sa.n} против ${sb.n} -- ${same ? 'ТОЧНОЕ СОВПАДЕНИЕ' : 'РАСХОЖДЕНИЕ'}`);
    if (!same) failures++;
  }
}
console.log(failures === 0
  ? '\nтождество при junction=0 подтверждено на всех 6 сверках'
  : `\nНЕ ПРОЙДЕНО: расхождений ${failures}`);
process.exit(failures ? 1 : 0);

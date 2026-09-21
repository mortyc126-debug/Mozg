#!/usr/bin/env node
'use strict';
/* ============================================================
   ВЕЛИЧИНА, КОТОРАЯ НЕ РАЗМЫВАЕТСЯ -- ЧЕРНОВИК

   Не опыт. Правил чтения не объявлено, вердиктов не будет.

   Тот же протокол, что в шаге 13: впрыск событий до круга 10000,
   потом выключается, и мир живёт сам. Там различие СОСТОЯНИЙ
   возвращалось к стерильному уровню за тридцать кругов.

   Здесь рядом меряется различие ПАМЯТИ -- набора меток, который растёт
   только объединением и не убывает никогда. Два числа, один и тот же
   мир, один и тот же миг выключения.

   Вопрос, ради которого всё: насыщается ли память. Если дальность
   меток велика, через тысячу кругов у всех будут все метки, и мир
   снова однороден -- только на другом конце. Поэтому дальность
   перебирается.
   ============================================================ */
const fs = require('fs');
const { execFileSync } = require('child_process');
const BUILD = 10000, AFTER = 2000;
const SEEDS = [701, 702, 703];

if (process.env.CHILD) {
  Object.assign(process.env, { CAP: '64', BASE: '0.05', HOLD: '0.1', TAX: '40',
    LEARN: '0.1', W: '20', HEAD: '20', GRACE: '30', ROT: '0.01',
    ROT_UNTIL: String(BUILD), MARKS: '1' });
  process.env.HOPS = process.env.H;
  const G = require('../grow.js');
  const w = G.createSeed(+process.env.SEED, false);

  const stateSpread = () => {
    const P = w.parts; let s = 0, n = 0;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { s += G.dist(P[i].x, P[j].x); n++; }
    return s / n;
  };
  const memSpread = () => {
    const P = w.parts; let s = 0, n = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i].mem;
      for (let j = i + 1; j < P.length; j++) {
        const b = P[j].mem;
        let inter = 0;
        const [sm, bg] = a.size < b.size ? [a, b] : [b, a];
        for (const k of sm.keys()) if (bg.has(k)) inter++;
        const uni = a.size + b.size - inter;
        s += uni > 0 ? 1 - inter / uni : 0; n++;
      }
    }
    return s / n;
  };
  const memSize = () => w.parts.reduce((a, p) => a + p.mem.size, 0) / w.parts.length;

  const marks = [];
  const snap = (t) => marks.push({ t, st: stateSpread(), mem: memSpread(), size: memSize() });
  for (let r = 0; r < BUILD; r++) {
    G.round(w);
    if (r === 999 || r === 4999 || r === BUILD - 1) snap(r + 1 - BUILD);
  }
  for (let r = 0; r < AFTER; r++) {
    G.round(w);
    if ([10, 30, 100, 300, 1000, 2000].includes(r + 1)) snap(r + 1);
  }
  process.stdout.write(JSON.stringify({ marks, total: w.nextMark,
    deg: w.parts.reduce((a, p) => a + p.links.length, 0) / w.parts.length }));
  return;
}

const run = (seed, h) => JSON.parse(execFileSync(process.execPath, [__filename],
  { env: Object.assign({}, process.env, { CHILD: '1', SEED: String(seed), H: String(h) }),
    maxBuffer: 1 << 24 }).toString());
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

console.log('ВЕЛИЧИНА, КОТОРАЯ НЕ РАЗМЫВАЕТСЯ -- ЧЕРНОВИК, вердиктов не будет');
console.log(`впрыск до круга ${BUILD}, дальше мир живёт сам; сиды ${SEEDS.join(',')}\n`);
console.log('дальность | круг | различие состояний | различие ПАМЯТИ | меток в памяти');
const rows = [];
for (const h of [1, 2, 3]) {
  const rs = SEEDS.map((s) => run(s, h));
  rows.push({ hops: h, rs });
  const T = rs[0].marks.map((m) => m.t);
  T.forEach((t, i) => {
    const st = mean(rs.map((r) => r.marks[i].st));
    const mm = mean(rs.map((r) => r.marks[i].mem));
    const sz = mean(rs.map((r) => r.marks[i].size));
    console.log(`${String(h).padStart(9)} | ${String(t).padStart(5)} | ` +
      `${st.toFixed(5).padStart(18)} | ${mm.toFixed(4).padStart(15)} | ${sz.toFixed(0).padStart(14)}`);
  });
  console.log(`          | всего меток рождено ${mean(rs.map((r) => r.total)).toFixed(0)}, ` +
    `связей на часть ${mean(rs.map((r) => r.deg)).toFixed(1)}`);
  console.log('');
}
console.log('круг: отрицательный -- до выключения впрыска, положительный -- после.');
console.log('различие памяти: доля несовпадающих меток у пары частей (0 -- памяти одинаковы).');
console.log('\nНи одно число здесь не говорит, что так лучше. Правил чтения не объявлено.');
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/mark_hold.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

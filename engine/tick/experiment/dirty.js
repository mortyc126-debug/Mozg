#!/usr/bin/env node
'use strict';
/* ============================================================
   ГРЯЗНЫЙ МИР -- ЧЕРНОВИК

   Не опыт. Правил чтения не объявлено, вердиктов не будет, числа --
   описание того, что вышло. Сделано по доводу автора, и довод стоит
   того, чтобы его записать:

     «У нас нет эталона, у нас нет готового мозга, нам не с чем
      сравнивать. Кто знает, на что ошибки влияют, может они будут
      делать мозг лучше или позволят делать костыли... Мозг невозможно
      вырастить в биологически стерильной среде.»

   Среда до сих пор была стерильной: адрес точен, память нерушима,
   такт не теряется, проводка подконтрольна. Это был мой выбор, ничем
   не обоснованный.

   Сравнивать есть с чем и без эталона: ТОТ ЖЕ мир, ТОТ ЖЕ сид, ручка
   сбоев на нуле. Это не стерильность, это ручка громкости.

   Ни одна строка ниже не утверждает, что сбои полезны или вредны.
   ============================================================ */
const { execFileSync } = require('child_process');
const fs = require('fs');

const ROUNDS = 20000;
const SEEDS = [401, 402, 403];

if (process.env.CHILD) {
  process.env.CAP = '64'; process.env.BASE = '0.05'; process.env.HOLD = '0.1';
  process.env.TAX = '40'; process.env.LEARN = '0.1';
  process.env.W = '20'; process.env.HEAD = '20'; process.env.GRACE = '30';
  const G = require('../grow.js');
  const w = G.createSeed(+process.env.SEED, false);
  const from = Math.floor(ROUNDS * 0.75);
  const lives = [];
  for (let r = 0; r < ROUNDS; r++) {
    if (r === from) G.watch(w);
    let before = null;
    if (r >= from) { before = new Set(); for (const p of w.parts) for (const l of p.links) before.add(l); }
    G.round(w);
    if (before) {
      const now = new Set();
      for (const p of w.parts) for (const l of p.links) now.add(l);
      for (const l of before) if (!now.has(l)) lives.push(w.round - l.born);
    }
  }
  lives.sort((a, b) => a - b);
  const P = w.parts, N = P.length, st = w.stat;
  const out = new Map(P.map((p) => [p.id, new Set(p.links.map((l) => l.j))]));
  let links = 0, mutual = 0;
  const inDeg = new Map(P.map((p) => [p.id, 0]));
  for (const p of P) for (const l of p.links) {
    links++; inDeg.set(l.j, (inDeg.get(l.j) || 0) + 1);
    if (out.get(l.j) && out.get(l.j).has(p.id)) mutual++;
  }
  const deg = links / N;
  const ins = [...inDeg.values()].sort((a, b) => b - a);
  const lvl = [];
  for (const p of P) for (const l of p.links) {
    if (!l || l.nr < 40) continue;
    let last = 0; for (let i = 0; i < 20; i++) last += l.lBuf[i];
    lvl.push(last / 20);
  }
  let dsum = 0, dn = 0;
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { dsum += G.dist(P[i].x, P[j].x); dn++; }
  // сколько РАЗНЫХ состояний в мире: доля пар, разошедшихся заметно
  let far = 0;
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (G.dist(P[i].x, P[j].x) > 0.05) far++;
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  process.stdout.write(JSON.stringify({
    parts: N, deg, mutual: links ? mutual / links : NaN, chance: deg / (N - 1),
    excess: links ? mutual / links - deg / (N - 1) : NaN,
    life: lives.length ? lives[Math.floor(lives.length / 2)] : Infinity,
    reads: st.readN / (ROUNDS - from), level: mean(lvl), inMeasure: lvl.length,
    spreadState: dsum / dn, far: far / dn,
    topIn: links ? ins.slice(0, Math.max(1, Math.round(N * 0.1))).reduce((a, b) => a + b, 0) / links : NaN,
    faults: w.faults,
  }));
  return;
}

function run(seed, env) {
  return JSON.parse(execFileSync(process.execPath, [__filename],
    { env: Object.assign({}, process.env, env, { CHILD: '1', SEED: String(seed) }),
      maxBuffer: 1 << 20 }).toString());
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const rows = [];
function line(label, env) {
  const rs = SEEDS.map((s) => run(s, env));
  rows.push({ label, env, rs });
  const m = (f) => mean(rs.map(f));
  console.log(`${label.padEnd(18)} | ${m((r) => r.deg).toFixed(2).padStart(6)} | ` +
    `${m((r) => r.life).toFixed(0).padStart(6)} | ${m((r) => r.reads).toFixed(1).padStart(7)} | ` +
    `${(m((r) => r.excess) * 100).toFixed(2).padStart(7)}% | ${m((r) => r.level).toFixed(5)} | ` +
    `${m((r) => r.spreadState).toFixed(5)} | ${(m((r) => r.far) * 100).toFixed(1).padStart(6)}% | ` +
    `${(m((r) => r.topIn) * 100).toFixed(1).padStart(6)}%`);
}

console.log('ГРЯЗНЫЙ МИР -- ЧЕРНОВИК, не опыт, вердиктов не будет');
console.log(`${ROUNDS} кругов, сиды ${SEEDS.join(',')}, отсрочка GRACE=30, потолок 64 части\n`);
console.log('ручка сбоев         | связей |  жизнь | чтений  | избыток | расхожд | расст.сост | разных | ступицы');
line('стерильно (0)', { FAULT: '0' });
for (const f of ['0.001', '0.01', '0.05', '0.2']) line(`все сбои ${f}`, { FAULT: f });
console.log('');
for (const f of ['MISS', 'ROT', 'SLIP', 'GHOST']) {
  const env = { FAULT: '0' }; env[f] = '0.05';
  line(`${f} один, 0.05`, env);
}

console.log('\nчто это за столбцы:');
console.log('  связей -- на часть; жизнь -- медианная жизнь связи в кругах;');
console.log('  чтений -- за круг; избыток -- взаимности над случайным графом той же степени;');
console.log('  расхожд -- уровень ошибки предсказания; расст.сост -- среднее попарное;');
console.log('  разных -- доля пар частей, разошедшихся больше чем на 0.05; ступицы -- входящих у верхних 10%.');
console.log('\nНи одно из этих чисел не говорит, что сбои полезны или вредны.');
console.log('Правил чтения не объявлено. Это описание прогона, а не установленный факт.');
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/dirty.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

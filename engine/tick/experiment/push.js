#!/usr/bin/env node
'use strict';
/* ============================================================
   ЧЕМ РАЗОЙТИСЬ -- ЧЕРНОВИК

   Не опыт, вердиктов не будет. Тот же протокол, что в шагах 13 и 14:
   впрыск до круга 10000, дальше мир живёт сам.

   Рядом с различием ВСЕГДА меряется, живо ли оно: доля координат,
   прижатых к краю, и насколько части шевелятся. Расхождение, дошедшее
   до насыщения, -- это замёрзший узор, а не различие (ловушка band.js).
   ============================================================ */
const fs = require('fs');
const { execFileSync } = require('child_process');
const BUILD = 10000, AFTER = 2000;
const SEEDS = [801, 802, 803];

if (process.env.CHILD) {
  Object.assign(process.env, { CAP: '64', BASE: '0.05', HOLD: '0.1', TAX: '40',
    LEARN: '0.1', W: '20', HEAD: '20', GRACE: '30', ROT: '0.05',
    ROT_UNTIL: String(BUILD), PUSH: '1' });
  process.env.MIX0 = process.env.M;
  const G = require('../grow.js');
  const w = G.createSeed(+process.env.SEED, false);
  const K = G.K;
  const spread = () => {
    const P = w.parts; let s = 0, n = 0;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { s += G.dist(P[i].x, P[j].x); n++; }
    return s / n;
  };
  const edge = () => {
    const P = w.parts; let e = 0, n = 0;
    for (const p of P) for (let k = 0; k < K; k++) { if (Math.abs(p.x[k]) > 0.95) e++; n++; }
    return e / n;
  };
  const move = () => {
    const P = w.parts; let m = 0;
    for (const p of P) { let d = 0; for (let k = 0; k < K; k++) d += Math.abs(p.x[k] - p.prev[k]); m += d / K; }
    return m / P.length;
  };
  const out = [];
  const snap = (t) => out.push({ t, sp: spread(), ed: edge(), mv: move() });
  for (let r = 0; r < BUILD; r++) { G.round(w); if (r === BUILD - 1) { G.watch(w); snap(0); } }
  for (let r = 0; r < AFTER; r++) {
    G.round(w);
    if ([10, 30, 100, 300, 1000, 2000].includes(r + 1)) snap(r + 1);
  }
  const st = w.stat;
  process.stdout.write(JSON.stringify({ out,
    deg: w.parts.reduce((a, p) => a + p.links.length, 0) / w.parts.length,
    reads: st.readN / AFTER,
    mix: w.parts.reduce((a, p) => a + p.par.mix, 0) / w.parts.length }));
  return;
}

const run = (seed, m) => JSON.parse(execFileSync(process.execPath, [__filename],
  { env: Object.assign({}, process.env, { CHILD: '1', SEED: String(seed), M: String(m) }),
    maxBuffer: 1 << 24 }).toString());
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

console.log('ЧЕМ РАЗОЙТИСЬ -- ЧЕРНОВИК, вердиктов не будет');
console.log(`впрыск до круга ${BUILD}, дальше мир сам; сиды ${SEEDS.join(',')}\n`);
console.log('  mix | круг | различие | у края | шевеление | связей | чтений');
const rows = [];
for (const m of [0.3, 0.0, -0.1, -0.3, -0.6]) {
  const rs = SEEDS.map((s) => run(s, m));
  rows.push({ mix0: m, rs });
  rs[0].out.forEach((_, i) => {
    const g = (f) => mean(rs.map((r) => f(r.out[i])));
    console.log(`${String(m).padStart(5)} | ${String(rs[0].out[i].t).padStart(4)} | ` +
      `${g((o) => o.sp).toFixed(5).padStart(8)} | ${(g((o) => o.ed) * 100).toFixed(1).padStart(5)}% | ` +
      `${g((o) => o.mv).toFixed(5).padStart(9)}` +
      (i === 0 ? ` | ${mean(rs.map((r) => r.deg)).toFixed(1).padStart(6)} | ${mean(rs.map((r) => r.reads)).toFixed(0).padStart(6)}` : ''));
  });
  console.log(`      | средний mix в конце ${mean(rs.map((r) => r.mix)).toFixed(3)}`);
  console.log('');
}
console.log('различие -- среднее попарное расстояние состояний; у края -- доля координат |x|>0.95;');
console.log('шевеление -- насколько часть сдвинулась за своё последнее обновление.');
console.log('\nРасхождение, у которого шевеление около нуля, -- замёрзший узор, а не различие.');
console.log('Ни одно число не говорит, что так лучше. Правил чтения не объявлено.');
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/push.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

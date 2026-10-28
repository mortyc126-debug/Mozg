#!/usr/bin/env node
'use strict';
/* ============================================================
   ПРИВЯЗКА СОСТОЯНИЯ К ПАМЯТИ -- ЧЕРНОВИК

   Не опыт, вердиктов не будет. Шаг 15 дал разброс без лица: состояние
   части перемешивается за тысячу-пять тысяч кругов. Здесь состояние
   притягивается к подписи -- среднему цвету событий, дошедших до этой
   части. Набор событий не убывает, значит тяга никуда не денется.

   Меряется то же, что в шаге 15: держит ли часть СВОЁ состояние, --
   и рядом всегда пустой отсчёт (связь с состоянием другой части) и
   проверка на мёртвое насыщение.
   ============================================================ */
const fs = require('fs');
const { execFileSync } = require('child_process');
const BUILD = 6000;
const SEEDS = [901, 902, 903];

if (process.env.CHILD) {
  Object.assign(process.env, { CAP: '64', BASE: '0.05', HOLD: '0.1', TAX: '40',
    LEARN: '0.1', W: '20', HEAD: '20', GRACE: '30', ROT: '0.01',
    ROT_UNTIL: String(BUILD), PUSH: '1', MARKS: '1', HOPS: '1' });
  process.env.MIX0 = process.env.M; process.env.ANCHOR = process.env.A;
  process.env.ANCHOR_OWN = process.env.O || '0';
  const G = require('../grow.js');
  const K = G.K;
  const w = G.createSeed(+process.env.SEED, false);
  const cor = (a, b) => {
    const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
    let s = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da > 0 && db > 0 ? s / Math.sqrt(da * db) : NaN;
  };
  for (let r = 0; r < BUILD; r++) G.round(w);
  const P = w.parts;
  const snap = P.map((p) => Float64Array.from(p.x));
  const sig0 = P.map((p) => (p.sigW > 0 ? Array.from(p.sigSum).map((v) => v / p.sigW) : null));
  const res = { gaps: {} };
  for (const gap of [100, 1000, 5000]) {
    while (w.round < BUILD + gap) G.round(w);
    const a = [], b = [], c = [], sa = [], sb = [];
    for (let i = 0; i < P.length; i++) for (let k = 0; k < K; k++) {
      a.push(snap[i][k]); b.push(P[i].x[k]); c.push(snap[(i + 17) % P.length][k]);
      if (sig0[i] && P[i].sigW > 0) { sa.push(sig0[i][k]); sb.push(P[i].sigSum[k] / P[i].sigW); }
    }
    let sp = 0, n = 0, ed = 0, en = 0, mv = 0;
    for (let i = 0; i < P.length; i++) {
      for (let j = i + 1; j < P.length; j++) { sp += G.dist(P[i].x, P[j].x); n++; }
      for (let k = 0; k < K; k++) { if (Math.abs(P[i].x[k]) > 0.95) ed++; en++; }
      let d = 0; for (let k = 0; k < K; k++) d += Math.abs(P[i].x[k] - P[i].prev[k]); mv += d / K;
    }
    res.gaps[gap] = { own: cor(a, b), other: cor(a, c), sig: sa.length ? cor(sa, sb) : NaN,
      sp: sp / n, ed: ed / en, mv: mv / P.length };
  }
  res.mem = P.reduce((x, p) => x + p.mem.size, 0) / P.length;
  process.stdout.write(JSON.stringify(res));
  return;
}

const run = (seed, m, a, o) => JSON.parse(execFileSync(process.execPath, [__filename],
  { env: Object.assign({}, process.env, { CHILD: '1', SEED: String(seed), M: String(m), A: String(a), O: String(o) }),
    maxBuffer: 1 << 24 }).toString());
const mean = (arr) => arr.reduce((x, y) => x + y, 0) / arr.length;

console.log('ПРИВЯЗКА СОСТОЯНИЯ К ПАМЯТИ -- ЧЕРНОВИК, вердиктов не будет');
console.log(`впрыск до круга ${BUILD}, дальше мир сам; сиды ${SEEDS.join(',')}; дальность метки 1\n`);
console.log('  mix | тяга | своё | лицо ч/з 100 | ч/з 1000 | ч/з 5000 | отсчёт | подпись ч/з 5000 | разброс | у края');
const rows = [];
for (const [m, a, o] of [[-0.3, 0, 0], [-0.3, 0.2, 0], [-0.3, 0.05, 1], [-0.3, 0.2, 1], [-0.3, 0.5, 1], [0.3, 0.2, 1]]) {
  const rs = SEEDS.map((s) => run(s, m, a, o));
  rows.push({ mix0: m, anchor: a, own: o, rs });
  const g = (gap, f) => mean(rs.map((r) => f(r.gaps[gap])));
  console.log(`${String(m).padStart(5)} | ${String(a).padStart(4)} | ${String(o).padStart(4)} | ` +
    `${g(100, (x) => x.own).toFixed(3).padStart(12)} | ${g(1000, (x) => x.own).toFixed(3).padStart(8)} | ` +
    `${g(5000, (x) => x.own).toFixed(3).padStart(8)} | ${g(5000, (x) => x.other).toFixed(3).padStart(6)} | ` +
    `${g(5000, (x) => x.sig).toFixed(3).padStart(16)} | ${g(5000, (x) => x.sp).toFixed(4).padStart(7)} | ` +
    `${(g(5000, (x) => x.ed) * 100).toFixed(1).padStart(5)}%`);
}
console.log('\nлицо -- связь состояния части с самой собой через N кругов;');
console.log('отсчёт -- та же связь, но с состоянием ДРУГОЙ части: сколько даёт простая похожесть.');
console.log('подпись -- связь подписи части с самой собой: это потолок, выше лицо не удержится.');
console.log('\nНи одно число не говорит, что так лучше. Правил чтения не объявлено.');
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/anchor.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

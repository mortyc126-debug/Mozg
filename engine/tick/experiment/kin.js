#!/usr/bin/env node
'use strict';
/* ============================================================
   ЛИЦО КАК АДРЕС -- ЧЕРНОВИК

   Не опыт, вердиктов не будет. Шаг 16 дал части лицо, но оно ни на что
   не влияло. Здесь подпись становится адресом, и часть, связываясь,
   выбирает из нескольких встречных по адресу.

   Впрыск НЕ выключается -- это честный режим шага 16: подпись живая и
   продолжает дрейфовать.

   ГЛАВНОЕ, ЧТО МЕРЯЕТСЯ -- РОДСТВО СВЯЗЕЙ: насколько близки по адресу
   те, кто связан, против того, насколько близки просто любые две
   части. Второе -- встроенный нуль: если выбор не работает, числа
   совпадут.
   ============================================================ */
const fs = require('fs');
const { execFileSync } = require('child_process');
const BUILD = 6000;
const SEEDS = [1001, 1002, 1003];

if (process.env.CHILD) {
  Object.assign(process.env, { CAP: '64', BASE: '0.05', HOLD: '0.1', TAX: '40',
    LEARN: '0.1', W: '20', HEAD: '20', GRACE: '30', ROT: '0.01',
    ROT_UNTIL: '999999', PUSH: '1', MIX0: '-0.3', MARKS: '1', HOPS: '1',
    ANCHOR: '0.5', ANCHOR_OWN: '1' });
  process.env.KIN = process.env.KK;
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
  const x0 = P.map((p) => Float64Array.from(p.x));
  const res = {};
  for (const gap of [1000, 5000]) {
    while (w.round < BUILD + gap) G.round(w);
    const a = [], b = [], c = [];
    for (let i = 0; i < P.length; i++) for (let k = 0; k < K; k++) {
      a.push(x0[i][k]); b.push(P[i].x[k]); c.push(x0[(i + 17) % P.length][k]);
    }
    const ad = P.map((p) => G.addrOf(w, p));
    // РОДСТВО СВЯЗЕЙ против всех пар -- встроенный нуль
    let lk = 0, ln = 0;
    for (const p of P) for (const l of p.links) { lk += Math.abs(ad[p.id] - ad[l.j]); ln++; }
    let al = 0, an = 0, sp = 0, ed = 0, en = 0;
    for (let i = 0; i < P.length; i++) {
      for (let j = i + 1; j < P.length; j++) { al += Math.abs(ad[i] - ad[j]); an++; sp += G.dist(P[i].x, P[j].x); }
      for (let k = 0; k < K; k++) { if (Math.abs(P[i].x[k]) > 0.95) ed++; en++; }
    }
    const m = ad.reduce((x, y) => x + y, 0) / ad.length;
    res[gap] = { face: cor(a, b), other: cor(a, c),
      kinLink: lk / ln, kinAll: al / an, sp: sp / an, ed: ed / en,
      deg: ln / P.length,
      adSd: Math.sqrt(ad.reduce((x, y) => x + (y - m) ** 2, 0) / ad.length) };
  }
  process.stdout.write(JSON.stringify(res));
  return;
}

const run = (seed, kk) => JSON.parse(execFileSync(process.execPath, [__filename],
  { env: Object.assign({}, process.env, { CHILD: '1', SEED: String(seed), KK: String(kk) }),
    maxBuffer: 1 << 24 }).toString());
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

console.log('ЛИЦО КАК АДРЕС -- ЧЕРНОВИК, вердиктов не будет');
console.log(`впрыск НЕ выключается; сиды ${SEEDS.join(',')}; тяга 0.5, отталкивание -0.3\n`);
console.log(' выбор | через | родство связей | у любых пар | лицо  | отсчёт | разброс | связей | у края');
const rows = [];
for (const kk of [0, 1, -1]) {
  const rs = SEEDS.map((s) => run(s, kk));
  rows.push({ kin: kk, rs });
  for (const gap of [1000, 5000]) {
    const g = (f) => mean(rs.map((r) => f(r[gap])));
    const nm = kk === 0 ? 'жребий' : kk > 0 ? 'похож' : 'непохож';
    console.log(`${nm.padStart(6)} | ${String(gap).padStart(5)} | ` +
      `${g((x) => x.kinLink).toFixed(4).padStart(14)} | ${g((x) => x.kinAll).toFixed(4).padStart(11)} | ` +
      `${g((x) => x.face).toFixed(3).padStart(5)} | ${g((x) => x.other).toFixed(3).padStart(6)} | ` +
      `${g((x) => x.sp).toFixed(4).padStart(7)} | ${g((x) => x.deg).toFixed(1).padStart(6)} | ` +
      `${(g((x) => x.ed) * 100).toFixed(1).padStart(5)}%`);
  }
}
console.log('\nродство связей -- среднее расстояние по адресу между теми, кто связан;');
console.log('у любых пар -- то же между любыми двумя частями. Это встроенный нуль:');
console.log('если выбор по адресу не работает, оба числа совпадут.');
console.log('\nНи одно число не говорит, что так лучше. Правил чтения не объявлено.');
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/kin.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

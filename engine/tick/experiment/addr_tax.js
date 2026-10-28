#!/usr/bin/env node
'use strict';
/* ============================================================
   НАЛОГ, ПЕРЕВЕДЁННЫЙ НА РАССТОЯНИЕ ПО АДРЕСУ -- ЧЕРНОВИК

   Не опыт, вердиктов не будет. Шаг 20: связи заводятся по месту и не
   пересматриваются, когда место меняется; половина графа --
   окаменелость прежнего соседства. Здесь держание далёкой по адресу
   связи сделано дорогим.

   Калибровка по правилу TAX_SPEC2 (размах цены между 10% и 90% связей
   около 50%) даёт TAX_D = 1. Значения сильнее печатаются рядом как
   описание.

   Рядом с устройством ВСЕГДА меряется живость: не выжжен ли граф, не
   замер ли мир, держится ли лицо.
   ============================================================ */
const fs = require('fs');
const { execFileSync } = require('child_process');
const BUILD = 6000, GAP = 2000, N = 256;

if (process.env.CHILD) {
  Object.assign(process.env, { CAP: String(N), BUDGET: String(200 * N / 64),
    BASE: '0.05', HOLD: '0.1', TAX: '40', LEARN: '0.1', W: '20', HEAD: '20',
    GRACE: '30', ROT: '0.01', ROT_UNTIL: '999999', PUSH: '1', MIX0: '-0.3',
    MARKS: '1', HOPS: '1', ANCHOR: '0.5', ANCHOR_OWN: '1', KIN: '1',
    LOOP: '1', KIN_NEAR: '1' });
  if (process.env.TD !== 'off') { process.env.TAX_ADDR = '1'; process.env.TAX_D = process.env.TD; }
  const G = require('../grow.js');
  const K = G.K;
  const w = G.createSeed(+process.env.SEED, false);
  const cor = (a, b) => {
    const n = a.length;
    const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
    let s = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da > 0 && db > 0 ? s / Math.sqrt(da * db) : 0;
  };
  for (let r = 0; r < BUILD; r++) G.round(w);
  const P = w.parts, M = P.length;
  const x0 = P.map((p) => Float64Array.from(p.x));
  const circ0 = P.map((p) => new Set(p.links.map((l) => l.j)));
  G.watch(w);
  for (let r = 0; r < GAP; r++) G.round(w);

  const ad = P.map((p) => G.addrOf(w, p));
  const order = [...Array(M).keys()].sort((a, b) => ad[a] - ad[b]);
  const rank = new Array(M); order.forEach((id, i) => { rank[id] = i; });
  const nb = Array.from({ length: M }, () => new Set());
  const fresh = [], old = [], all = [];
  for (const p of P) for (const l of p.links) {
    nb[p.id].add(l.j); nb[l.j].add(p.id);
    const d = Math.abs(rank[p.id] - rank[l.j]);
    all.push(d);
    const age = w.round - l.born;
    if (age < 100) fresh.push(d); else if (age >= 400) old.push(d);
  }
  const dist = new Array(M).fill(Infinity); dist[0] = 0;
  let fr = [0], k = 0, cov = 1, two = 1;
  while (fr.length) {
    k++; const nx = [];
    for (const i of fr) for (const j of nb[i]) if (dist[j] === Infinity) { dist[j] = k; nx.push(j); }
    fr = nx; if (k === 1) cov += nx.length; if (k <= 2) two += nx.length;
  }
  const a = [], b = [], c = [];
  for (let i = 0; i < M; i++) for (let kk = 0; kk < K; kk++) {
    a.push(x0[i][kk]); b.push(P[i].x[kk]); c.push(x0[(i + 37) % M][kk]);
  }
  let sp = 0, n2 = 0, ed = 0, en = 0, keep = 0, kn = 0;
  for (let i = 0; i < M; i++) {
    for (let j = i + 1; j < M; j += 7) { sp += G.dist(P[i].x, P[j].x); n2++; }
    for (let kk = 0; kk < K; kk++) { if (Math.abs(P[i].x[kk]) > 0.95) ed++; en++; }
    const now = new Set(P[i].links.map((l) => l.j));
    let inter = 0; for (const j of circ0[i]) if (now.has(j)) inter++;
    const uni = circ0[i].size + now.size - inter;
    if (uni > 0) { keep += inter / uni; kn++; }
  }
  const mean = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : NaN);
  process.stdout.write(JSON.stringify({
    deg: all.length / M, nb: nb.reduce((x, s) => x + s.size, 0) / M,
    one: cov / M, two: two / M,
    fresh: mean(fresh), old: mean(old), long: all.filter((v) => v > M / 10).length / all.length,
    face: cor(a, b), other: cor(a, c), keep: keep / kn,
    sp: sp / n2, ed: ed / en, reads: w.stat.readN / GAP / M,
  }));
  return;
}

const run = (seed, td) => JSON.parse(execFileSync(process.execPath, [__filename],
  { env: Object.assign({}, process.env, { CHILD: '1', SEED: String(seed), TD: String(td) }),
    maxBuffer: 1 << 24 }).toString());
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

console.log('НАЛОГ НА РАССТОЯНИЕ ПО АДРЕСУ -- ЧЕРНОВИК, вердиктов не будет');
console.log(`${N} частей, бюджет ${200 * N / 64}, ${BUILD}+${GAP} кругов, сиды 1501-1503\n`);
console.log(' налог | связей | соседей | доля мира | за 2 шага | свежие | старые | длинных | лицо  | отсчёт | круг | чтений | разброс | у края');
const rows = [];
for (const td of ['off', 1, 5, 20]) {
  const rs = [1501, 1502, 1503].map((s) => run(s, td));
  rows.push({ td, rs });
  const g = (f) => mean(rs.map(f));
  console.log(`${String(td).padStart(6)} | ${g((r) => r.deg).toFixed(1).padStart(6)} | ` +
    `${g((r) => r.nb).toFixed(1).padStart(7)} | ${(100 * g((r) => r.nb) / N).toFixed(0).padStart(8)}% | ` +
    `${(100 * g((r) => r.two)).toFixed(0).padStart(8)}% | ${g((r) => r.fresh).toFixed(0).padStart(6)} | ` +
    `${g((r) => r.old).toFixed(0).padStart(6)} | ${(100 * g((r) => r.long)).toFixed(0).padStart(6)}% | ` +
    `${g((r) => r.face).toFixed(3).padStart(5)} | ${g((r) => r.other).toFixed(3).padStart(6)} | ` +
    `${g((r) => r.keep).toFixed(3).padStart(4)} | ${g((r) => r.reads).toFixed(2).padStart(6)} | ` +
    `${g((r) => r.sp).toFixed(4).padStart(7)} | ${(100 * g((r) => r.ed)).toFixed(1).padStart(5)}%`);
}
console.log('\nсвежие/старые -- расстояние по ПОРЯДКУ АДРЕСА у связей моложе 100 и старше 400 кругов (из 256);');
console.log('если окаменелость расчищена, эти два числа сойдутся.');
console.log('круг -- какая доля связей та же через ' + GAP + ' кругов (на пустых числах стенд даёт 0.09).');
console.log('\nНи одно число не говорит, что так лучше. Правил чтения не объявлено.');
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/addr_tax.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

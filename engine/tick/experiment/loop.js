#!/usr/bin/env node
'use strict';
/* ============================================================
   ЗАМКНУТАЯ ПЕТЛЯ -- ЧЕРНОВИК

   Не опыт, вердиктов не будет.

   ГЛАВНАЯ МЕРА -- ИДЁТ ЛИ ЧАСТЬ ЗА СВОИМ КРУГОМ. Берётся адрес части и
   средний адрес тех, с кем она связана, в один и тот же миг. Потом
   смотрится, СДВИНУЛСЯ ли её адрес в сторону круга за следующие N
   кругов. Связь этого сдвига с тем, куда звал круг, и есть петля.

   ПУСТОЙ ОТСЧЁТ, встроенный: то же самое, но вместо связанных берутся
   столько же случайных НЕ связанных частей. Если петли нет, числа
   совпадут.

   Мера направлена во времени: круг был ДО сдвига. Это не отменяет того,
   что часть сама выбирала круг по адресу, -- и потому меряется не
   совпадение, а ДВИЖЕНИЕ.
   ============================================================ */
const fs = require('fs');
const { execFileSync } = require('child_process');
const BUILD = 6000, GAP = 2000;
const SEEDS = [1101, 1102, 1103];

if (process.env.CHILD) {
  Object.assign(process.env, { CAP: '64', BASE: '0.05', HOLD: '0.1', TAX: '40',
    LEARN: '0.1', W: '20', HEAD: '20', GRACE: '30', ROT: '0.01',
    ROT_UNTIL: '999999', PUSH: '1', MIX0: '-0.3', MARKS: '1', HOPS: '1',
    ANCHOR: '0.5', ANCHOR_OWN: '1' });
  process.env.KIN = process.env.KK; process.env.LOOP = process.env.LL;
  const G = require('../grow.js');
  const K = G.K;
  const w = G.createSeed(+process.env.SEED, false);
  const cor = (a, b) => {
    const n = a.length; if (n < 3) return NaN;
    const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
    let s = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da > 0 && db > 0 ? s / Math.sqrt(da * db) : NaN;
  };
  for (let r = 0; r < BUILD; r++) G.round(w);
  const P = w.parts, N = P.length;
  const ad0 = P.map((p) => G.addrOf(w, p));
  const circle0 = P.map((p) => new Set(p.links.map((l) => l.j)));
  // куда звал круг и куда звали случайные не-связанные
  const pull = [], pullNull = [];
  for (let i = 0; i < N; i++) {
    const c = [...circle0[i]].filter((j) => j !== i);
    if (!c.length) { pull.push(NaN); pullNull.push(NaN); continue; }
    pull.push(c.reduce((a, j) => a + ad0[j], 0) / c.length - ad0[i]);
    const out = [];
    for (let j = 0; j < N && out.length < c.length; j++) {
      const t = (i * 7 + j * 13 + 5) % N;
      if (t !== i && !circle0[i].has(t) && !out.includes(t)) out.push(t);
    }
    pullNull.push(out.length ? out.reduce((a, j) => a + ad0[j], 0) / out.length - ad0[i] : NaN);
  }
  for (let r = 0; r < GAP; r++) G.round(w);
  const ad1 = P.map((p) => G.addrOf(w, p));
  const d = [], pu = [], pn = [];
  for (let i = 0; i < N; i++) {
    if (!Number.isFinite(pull[i]) || !Number.isFinite(pullNull[i])) continue;
    d.push(ad1[i] - ad0[i]); pu.push(pull[i]); pn.push(pullNull[i]);
  }
  // держится ли круг общения
  let keep = 0, kn = 0;
  for (let i = 0; i < N; i++) {
    const now = new Set(P[i].links.map((l) => l.j));
    let inter = 0;
    for (const j of circle0[i]) if (now.has(j)) inter++;
    const uni = circle0[i].size + now.size - inter;
    if (uni > 0) { keep += inter / uni; kn++; }
  }
  const m = ad1.reduce((x, y) => x + y, 0) / N;
  let sp = 0, n2 = 0, ed = 0, en = 0, lk = 0, ln = 0, al = 0, an = 0;
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) { sp += G.dist(P[i].x, P[j].x); al += Math.abs(ad1[i] - ad1[j]); n2++; an++; }
    for (let k = 0; k < K; k++) { if (Math.abs(P[i].x[k]) > 0.95) ed++; en++; }
    for (const l of P[i].links) { lk += Math.abs(ad1[i] - ad1[l.j]); ln++; }
  }
  process.stdout.write(JSON.stringify({
    follow: cor(pu, d), followNull: cor(pn, d),
    keep: keep / kn, adSd: Math.sqrt(ad1.reduce((x, y) => x + (y - m) ** 2, 0) / N),
    adEdge: ad1.filter((v) => Math.abs(v) > 0.9).length / N,
    kinLink: lk / ln, kinAll: al / an, sp: sp / n2, ed: ed / en, deg: ln / N,
    met: w.faults.met,
  }));
  return;
}

const run = (seed, kk, ll) => JSON.parse(execFileSync(process.execPath, [__filename],
  { env: Object.assign({}, process.env, { CHILD: '1', SEED: String(seed), KK: String(kk), LL: String(ll) }),
    maxBuffer: 1 << 24 }).toString());
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

console.log('ЗАМКНУТАЯ ПЕТЛЯ -- ЧЕРНОВИК, вердиктов не будет');
console.log(`${BUILD} кругов, затем сдвиг за ${GAP}; сиды ${SEEDS.join(',')}\n`);
console.log(' петля | выбор  | идёт за кругом | отсчёт | круг держится | родство | у любых | разброс адр | у края адр');
const rows = [];
for (const [ll, kk] of [[0, 0], [0, 1], [1, 0], [1, 1], [1, -1]]) {
  const rs = SEEDS.map((s) => run(s, kk, ll));
  rows.push({ loop: ll, kin: kk, rs });
  const g = (f) => mean(rs.map(f));
  const nm = kk === 0 ? 'жребий' : kk > 0 ? 'похож ' : 'непохож';
  console.log(`${(ll ? 'есть' : 'нет ').padStart(6)} | ${nm} | ` +
    `${g((r) => r.follow).toFixed(3).padStart(14)} | ${g((r) => r.followNull).toFixed(3).padStart(6)} | ` +
    `${g((r) => r.keep).toFixed(3).padStart(13)} | ${g((r) => r.kinLink).toFixed(4).padStart(7)} | ` +
    `${g((r) => r.kinAll).toFixed(4).padStart(7)} | ${g((r) => r.adSd).toFixed(4).padStart(11)} | ` +
    `${(g((r) => r.adEdge) * 100).toFixed(1).padStart(10)}%`);
}
console.log('\nидёт за кругом -- связь сдвига адреса части с тем, куда звал её круг;');
console.log('отсчёт -- то же по стольким же СЛУЧАЙНЫМ не связанным. Если петли нет, числа совпадут.');
console.log('круг держится -- какая доля связей та же спустя ' + GAP + ' кругов.');
console.log('\nНи одно число не говорит, что так лучше. Правил чтения не объявлено.');
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/loop.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

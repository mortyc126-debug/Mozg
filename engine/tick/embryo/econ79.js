// Замер шага 79 (PRE79_QECON.md): смерти частей Q, доход и расход взрослых частей Q (и канала 3 для сравнения), потолок платы
const M = require('./neuron2.js'), C = M.CFG, O = M.OCH;
const seed = +process.argv[2], cond = process.argv[3], w = M.create(seed);
const V = 1 + C.SN * C.SN;
for (let r = 1; r < 20000; r++) M.round(w);
let ks = (seed * 2654435761) >>> 0;
const krnd = () => { ks = (ks + 0x6D2B79F5) >>> 0; let t = ks; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const kg = () => Math.sqrt(-2 * Math.log(krnd() + 1e-12)) * Math.cos(2 * Math.PI * krnd());
const deaths = [], acc = { Q: { n: 0, w: 0, rd: 0, ex: 0 }, M3: { n: 0, w: 0, rd: 0, ex: 0 } };
const obsA = [], obsB = [], sq = [];
for (let r = 20000; r <= 80000; r++) {
  const snap = w.parts.filter((p) => p && (p.ch === O + 2 || p.ch === 3)).map((p) => ({ p, h: p.hungry, age: p.age, cr: p.credit, fw: p.fromWorld, fr: p.fromReads }));
  M.round(w);
  for (const s of snap) {
    const p = s.p;
    if (w.parts[p.slot] !== p) { if (p.ch === O + 2) deaths.push({ age: s.age, bank: s.h >= C.DIE }); continue; }
    if (s.age < C.YOUTH) continue;
    const a = p.ch === 3 ? acc.M3 : acc.Q, dw = p.fromWorld - s.fw, dr = p.fromReads - s.fr;
    a.n++; a.w += dw; a.rd += dr; a.ex += dw + dr - (p.credit - s.cr);
  }
  if (r >= 60000) { obsA.push(w.c[O] + C.SN * kg()); obsB.push(w.c[O + 1] + C.SN * kg()); sq.push(w.c[O + 2] + C.SN * kg()); }
}
// потолок: наименьшие квадраты s(t) по A, B на кругах t-1-k, k = 0..6, по всем кругам 60000-80000
const L = 7, X = [], y = [];
for (let t = L; t < sq.length; t++) { const x = [1]; for (let k = 0; k < L; k++) x.push(obsA[t - 1 - k], obsB[t - 1 - k]); X.push(x); y.push(sq[t]); }
const d = X[0].length, A = Array.from({ length: d }, () => new Float64Array(d + 1));
for (let i = 0; i < X.length; i++) for (let a = 0; a < d; a++) { for (let b = 0; b < d; b++) A[a][b] += X[i][a] * X[i][b]; A[a][d] += X[i][a] * y[i]; }
for (let a = 0; a < d; a++) A[a][a] += 1e-6;
for (let c = 0; c < d; c++) { let p = c; for (let r = c + 1; r < d; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]];
  for (let r = 0; r < d; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= d; k++) A[r][k] -= f * A[c][k]; } }
const beta = A.map((row, i) => row[d] / row[i]);
let res = 0, vy = 0; X.forEach((x, i) => { const e = y[i] - x.reduce((s, v, j) => s + v * beta[j], 0); res += e * e; vy += y[i] * y[i]; });
const ceil = Math.max(0, 0.5 * Math.log2(V / (res / X.length)));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const bk = deaths.filter((x) => x.bank), f = (x, k = 3) => (Number.isFinite(x) ? x.toFixed(k) : 'NaN'), per = (a, k) => a.n ? a[k] / a.n : NaN;
console.log([cond, seed, deaths.length, bk.length, med(bk.map((x) => x.age)), bk.filter((x) => x.age >= 1000 && x.age <= 1300).length,
  med(deaths.filter((x) => !x.bank).map((x) => x.age)), acc.Q.n, f(per(acc.Q, 'w')), f(per(acc.Q, 'rd')), f(per(acc.Q, 'ex')),
  acc.M3.n, f(per(acc.M3, 'w')), f(per(acc.M3, 'rd')), f(per(acc.M3, 'ex')), f(ceil), f(vy / X.length)].join('\t'));

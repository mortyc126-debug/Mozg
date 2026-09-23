// Замер строки 8 (PRE58_LINES_5_8.md): доля верного знака отчёта о порядке у частей канала Q; положительный отсчёт -- линейный
// предсказатель по зашумлённым датчикам A и B с запаздываниями 0-6.
const M = require('./neuron2.js');
const seed = +process.argv[2], cond = process.argv[3], C = M.CFG, O = M.OCH;
const w = M.create(seed);
for (let r = 1; r <= 80000; r++) M.round(w);
let ks = (seed * 2654435761) >>> 0;
const krnd = () => { ks = (ks + 0x6D2B79F5) >>> 0; let t = ks; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const kg = () => Math.sqrt(-2 * Math.log(krnd() + 1e-12)) * Math.cos(2 * Math.PI * krnd());
const obsA = [], obsB = [], rep = [];   // rep: [круг, знак]
let hit = 0, tot = 0;
for (let r = 0; r < 20000; r++) {
  const before = w.parts.filter((p) => p && p.ch === O + 2 && p.x).map((p) => [p, p.pred]);
  M.round(w);
  obsA.push(w.c[O] + C.SN * kg()); obsB.push(w.c[O + 1] + C.SN * kg());
  const q = w.c[O + 2];
  if (q !== 0) {
    rep.push([r, Math.sign(q)]);
    for (const [p, pr] of before) if (w.parts[p.slot] === p && pr !== 0) { tot++; if (Math.sign(pr) === Math.sign(q)) hit++; }
  }
}
// положительный отсчёт: наименьшие квадраты по признакам A, B на кругах r-1-k, k = 0..6
const L = 7, X = [], y = [];
for (const [r, s] of rep) { if (r - 1 - (L - 1) < 0) continue; const x = [1]; for (let k = 0; k < L; k++) { x.push(obsA[r - 1 - k], obsB[r - 1 - k]); } X.push(x); y.push(s); }
const d = X[0].length, A = Array.from({ length: d }, () => new Float64Array(d + 1));
for (let i = 0; i < X.length; i++) for (let a = 0; a < d; a++) { for (let b = 0; b < d; b++) A[a][b] += X[i][a] * X[i][b]; A[a][d] += X[i][a] * y[i]; }
for (let a = 0; a < d; a++) A[a][a] += 1e-6;
for (let c = 0; c < d; c++) { let p = c; for (let r = c + 1; r < d; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]];
  for (let r = 0; r < d; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= d; k++) A[r][k] -= f * A[c][k]; } }
const beta = A.map((row, i) => row[d] / row[i]);
let dh = 0; X.forEach((x, i) => { const s = x.reduce((a, v, j) => a + v * beta[j], 0); if (Math.sign(s) === y[i]) dh++; });
const st = M.stats(w);
console.log([cond, seed, tot ? (hit / tot).toFixed(4) : 'NaN', tot, (dh / X.length).toFixed(4), X.length, st.alive, w.parts.filter((p) => p && p.ch === O + 2).length].join('\t'));

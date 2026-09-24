// Ворота шага 69 (PRE69_GATE.md §4): медиана процентилей рангов ВСЕХ линий к A (и к B) среди годных ЛИНИЙ части канала Q;
// рядом, для разбора, -- то же среди всех годных кандидатов
// по мере совпадения cscore; потолки меры строки 8 -- линейный предсказатель знака по A, B с запаздыванием 0 и 0-6.
const M = require('./neuron2.js');
const seed = +process.argv[2], cond = process.argv[3], C = M.CFG, O = M.OCH, N = C.N;
if (!C.CHIST || C.CSEARCH || !C.DLINE || !C.ORDER) throw new Error('ворота: CHIST=1 CSEARCH=0 DLINE>0 ORDER=1');
const w = M.create(seed);
for (let r = 1; r <= 60000; r++) M.round(w);
let ks = (seed * 2654435761) >>> 0;
const krnd = () => { ks = (ks + 0x6D2B79F5) >>> 0; let t = ks; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const kg = () => Math.sqrt(-2 * Math.log(krnd() + 1e-12)) * Math.cos(2 * Math.PI * krnd());
const obsA = [], obsB = [], rep = [];
for (let r = 0; r < 20000; r++) { M.round(w); obsA.push(w.c[O] + C.SN * kg()); obsB.push(w.c[O + 1] + C.SN * kg()); const q = w.c[O + 2]; if (q !== 0) rep.push([r, Math.sign(q)]); }
function decode(L) {                      // наименьшие квадраты, доля верного знака (как в order.js)
  const X = [], y = [];
  for (const [r, s] of rep) { if (r - 1 - (L - 1) < 0) continue; const x = [1]; for (let k = 0; k < L; k++) x.push(obsA[r - 1 - k], obsB[r - 1 - k]); X.push(x); y.push(s); }
  const d = X[0].length, A = Array.from({ length: d }, () => new Float64Array(d + 1));
  for (let i = 0; i < X.length; i++) for (let a = 0; a < d; a++) { for (let b = 0; b < d; b++) A[a][b] += X[i][a] * X[i][b]; A[a][d] += X[i][a] * y[i]; }
  for (let a = 0; a < d; a++) A[a][a] += 1e-6;
  for (let c = 0; c < d; c++) { let p = c; for (let r = c + 1; r < d; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < d; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= d; k++) A[r][k] -= f * A[c][k]; } }
  const beta = A.map((row, i) => row[d] / row[i]);
  let h = 0; X.forEach((x, i) => { if (Math.sign(x.reduce((a, v, j) => a + v * beta[j], 0)) === y[i]) h++; }); return h / X.length;
}
const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const P = w.parts, out = [];
for (const p of P) {
  if (!p || p.ch !== O + 2 || !p.eh || p.eh.length < C.CWIN) continue;
  const all = [], lines = [], sA = [], sB = [];
  for (let j = 0; j < N; j++) for (let k = 0; k < 4; k++) {
    if (!(P[j] && j !== p.slot && !p.links.some((l) => l.j === j && l.k === k))) continue;
    const s = M.cscore(w, p, j, k); all.push(s);
    if (k === 3) { lines.push(s); if (P[j].ch === O) sA.push(s); if (P[j].ch === O + 1) sB.push(s); }
  }
  const pct = (x, ref) => (ref.filter((v) => v < x).length + 0.5 * ref.filter((v) => v === x).length) / ref.length;
  const mp = (xs, ref) => (xs.length ? med(xs.map((x) => pct(x, ref))) : NaN);
  out.push([mp(sA, lines), mp(sB, lines), mp(sA, all), mp(sB, all)]);
}
const f = (x) => (Number.isFinite(x) ? x.toFixed(3) : 'NaN');
console.log([cond, seed, out.length, ...[0, 1, 2, 3].map((i) => out.map((o) => f(o[i])).join(',')), decode(1).toFixed(4), decode(7).toFixed(4), rep.length].join('\t'));

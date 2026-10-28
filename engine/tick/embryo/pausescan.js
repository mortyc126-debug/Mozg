// Замер шага 65: радиус паузы перед каждой из 100 пауз по 30 кругов, ведущий вектор, петли медленного канала, разгон.
const M = require('./neuron2.js'), LIN = require('./lin.js');
const seed = +process.argv[2], C = M.CFG, SCH = M.SCH, FCH = C.EAT ? (C.DEEP ? 10 : 8) : -1;
const w = M.create(seed);
for (let r = 1; r <= 100000; r++) M.round(w);
const grp = (ch) => (ch === SCH ? 0 : ch === FCH ? 4 : ch === 9 ? 3 : ch >= 3 && ch <= 7 ? 2 : 1);
const Sp = () => w.parts.filter((p) => p && p.ch === SCH);
const rms = (A) => Math.sqrt(A.reduce((s, p) => s + p.pred * p.pred, 0) / Math.max(1, A.length));
for (let c = 0; c < 100; c++) {
  for (let r = 1; r <= 100; r++) M.round(w);
  const A = LIN.build(w, C, 'LC'), prt = A.parts;
  const idx = []; prt.forEach((p, k) => { if (p.ch === SCH) idx.push(2 * k, 2 * k + 1); });
  const n2 = idx.length, S = new Float64Array(n2 * n2);
  for (let a = 0; a < n2; a++) for (let b = 0; b < n2; b++) S[a * n2 + b] = A.M[idx[a] * A.n + idx[b]];
  const E = LIN.eig([A])[0], ES = n2 ? LIN.eig([{ M: S, n: n2 }])[0] : { r: 0 };
  const sh = [0, 0, 0, 0, 0]; E.sh.forEach((v, i) => { sh[grp(prt[i >> 1].ch)] += v; });
  const dg = Math.max(...prt.map((p) => Math.abs(p.wSelf + p.ws)));
  const s0 = rms(Sp()); let blow = 0;
  for (let k = 1; k <= 30; k++) { M.pauseRound(w); const q = rms(Sp()) / (s0 || 1); blow = Number.isFinite(q) ? Math.max(blow, q) : Infinity; }
  console.log([seed, c, E.r.toFixed(4), ES.r.toFixed(4), blow.toExponential(2), ...sh.map((v) => v.toFixed(3)), dg.toFixed(3), Sp().length].join('\t'));
}

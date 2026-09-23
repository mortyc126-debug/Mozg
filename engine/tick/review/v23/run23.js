// Один прогон: доля верных, чистый доход на добытчика за круг, частота взгляда, общение через мир
const M = require('./neuron2.js');
const seed = +process.argv[2], cond = process.argv[3];
const w = M.create(seed), R = M.CFG.ROUNDS;
for (let r = 1; r <= R; r++) M.round(w);
const S = w.fs, C = M.CFG, sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const food = sum(S.sF), acts = sum(S.sA), occ = sum(S.occ);
const net = occ ? (food - C.ACT * acts - C.LOOK * S.looks) / occ : NaN;
const st = M.stats(w).food;
const n = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : 'NaN');
console.log([cond, seed, n(S.acts ? S.hits / S.acts : NaN), n(net), n(acts ? S.looks / acts : NaN), n(S.n ? S.hOne / S.n : NaN),
  st.alive, n(st.rate, 3), n(S.bA ? S.bH / S.bA : NaN), S.bA, n(S.kA ? S.kH / S.kA : NaN), S.kA].join('\t'));

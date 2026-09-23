// Замер строки 5 (PRE58_LINES_5_8.md): сбережение прошлого. Аргументы: сид, правило прошлого, P2, правило проверки.
const M = require('./neuron2.js');
const seed = +process.argv[2], past = +process.argv[3], P2 = +process.argv[4], T = +process.argv[5], C = M.CFG;
const V = 1 + C.SN * C.SN;
const w = M.create(seed);
w.rel3 = past; for (let r = 1; r <= 60000; r++) M.round(w);
w.rel3 = 2;    for (let r = 1; r <= P2; r++) M.round(w);
w.rel3 = T;
let sum = 0;
for (let r = 1; r <= 300; r++) {
  const before = w.parts.filter((p) => p && p.ch === 3 && p.x).map((p) => [p, p.pred]);
  M.round(w);
  let s = 0, n = 0; for (const [p, pr] of before) if (w.parts[p.slot] === p) { s += (p.s - pr) ** 2; n++; }
  sum += n ? s / n : V;
}
console.log([process.env.LABEL, seed, past, P2, T, (sum / 300 / V).toFixed(5)].join('\t'));

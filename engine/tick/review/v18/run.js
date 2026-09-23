// Один прогон одного условия: печатает замеры слоя еды одной строкой
const M = require('./neuron2.js');
const seed = +process.argv[2], cond = process.argv[3];
const w = M.create(seed), R = M.CFG.ROUNDS;
for (let r = 1; r <= R; r++) M.round(w);
const s = M.stats(w), f = s.food;
const n = (v, d = 4) => (v === null || Number.isNaN(v) ? 'NaN' : (+v).toFixed(d));
console.log([cond, seed, n(f.share), n(f.rate), n(f.winners), n(f.burn), n(f.varF), n(f.sf),
  n(f.relay), n(f.bare), f.nRelay, f.nBare, f.acts, f.alive, n(f.gAct), n(f.net, 3), n(f.give, 3),
  s.alive, n(s.bitsX, 2), n(s.bits9, 2), n(s.right, 3), n(s.nul, 3), f.byK].join('\t'));

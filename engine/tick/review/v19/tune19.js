// Правило §8: каждый сдвиг испробован >= 200 раз на добытчика за измеряемую половину,
// и таблица устойчива (argmax совпадает не реже 80% между замерами через 10000 кругов).
// На основную меру не смотрим.
const M = require('./neuron2.js');
const seed = 1, R = M.CFG.ROUNDS, MP = M.CFG.M, NF = 8, CH = 10;
const w = M.create(seed);
const arg = (p) => { let b = 0; for (let i = 1; i < MP; i++) if (p.q[i] > p.q[b]) b = i; return b; };
let snap = null, same = 0, tot = 0;
for (let r = 1; r <= R; r++) {
  M.round(w);
  if (r === Math.floor(R * 0.7)) { snap = new Map();
    for (const p of w.parts) if (p && p.ch === CH) snap.set(p.slot, arg(p)); }
  if (r === Math.floor(R * 0.8) && snap) {
    for (const p of w.parts) if (p && p.ch === CH && snap.has(p.slot)) { tot++; if (arg(p) === snap.get(p.slot)) same++; }
  }
}
const s = M.stats(w).food, use = s.dUse.split(' ').map((x) => +x.split(':')[1].replace('%',''));
const per = use.map((pc) => Math.round(s.acts * pc / 100 / NF));
console.log(`QLR=${M.CFG.QLR} EXPL=${M.CFG.EXPL}: испробований на добытчика по сдвигам ${per.join(' ')} (нужно >=200)` +
  ` | устойчивость argmax ${tot ? (100*same/tot).toFixed(0) : '-'}% из ${tot} (нужно >=80)`);

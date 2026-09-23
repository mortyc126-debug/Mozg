// разбор после чтения, не засчитывается: в каком цикле и в каком канале начинается взрыв
const M = require('./neuron2.js'), seed = +process.argv[2], w = M.create(seed);
for (let r = 1; r <= 60000; r++) M.round(w);
const CH = 11;
const byCh = () => { const s = new Array(CH).fill(0), n = new Array(CH).fill(0); for (const p of w.parts) if (p) { s[p.ch] += p.pred * p.pred; n[p.ch]++; } return s.map((v, i) => Math.sqrt(v / Math.max(1, n[i]))); };
const big = () => { let b = null; for (const p of w.parts) if (p && (!b || Math.abs(p.pred) > Math.abs(b.pred))) b = p; return b; };
for (const T of [10, 30]) for (let c = 0; c < 20; c++) {
  for (let r = 0; r < 200; r++) M.round(w);
  const b0 = byCh(); let worst = 0, wc = -1, wk = 0;
  for (let k = 1; k <= T; k++) { M.worldStep(w); M.pauseRound(w); const b = byCh(); b.forEach((v, i) => { const q = v / (b0[i] || 1); if (q > worst) { worst = q; wc = i; wk = k; } }); }
  if (worst > 2) { const p = big(); console.log(`T=${T} цикл ${c}: худший канал ${wc}, x${worst.toExponential(1)} на круге ${wk}; самая громкая часть: канал ${p.ch}, wSelf ${p.wSelf.toFixed(2)}, ws ${p.ws.toFixed(2)}, связей ${p.links.length}, веса ${p.links.map((l) => `${w.parts[l.j] ? w.parts[l.j].ch : '-'}/${l.k}:${l.w.toFixed(2)}`).join(' ')}`); }
}

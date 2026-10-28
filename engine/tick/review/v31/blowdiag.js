// разбор после чтения, не засчитывается: где начинается взрыв в тишине при HOLD=1
const M = require('./neuron2.js'), seed = +process.argv[2], w = M.create(seed);
for (let r = 1; r <= 60000; r++) M.round(w);
const CH = Math.max(...w.parts.filter(Boolean).map((p) => p.ch)) + 1;
const byCh = () => { const s = new Array(CH).fill(0), n = new Array(CH).fill(0); for (const p of w.parts) if (p) { s[p.ch] += p.pred * p.pred; n[p.ch]++; } return s.map((v, i) => Math.sqrt(v / Math.max(1, n[i]))); };
const b0 = byCh();
const g = (p) => p.wSelf + p.ws;   // усиление части на себя при подстановке ожидания
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`сид ${seed}: a+ws по каналам (медиана): ` + [...Array(CH).keys()].map((c) => { const A = w.parts.filter((p) => p && p.ch === c); return A.length ? `${c}:${med(A.map(g)).toFixed(2)}` : `${c}:-`; }).join(' '));
for (let k = 1; k <= 30; k++) { M.worldStep(w); M.pauseRound(w);
  if ([1, 3, 5, 10, 20, 30].includes(k)) console.log(`  круг ${String(k).padStart(2)}: RMS/до по каналам ` + byCh().map((v, i) => `${i}:${(v / (b0[i] || 1)).toExponential(0)}`).join(' ')); }

const M = require('./neuron2.js');
const seed = +process.argv[2], w = M.create(seed);
const hist = new Map(); let rich = 0, n = 0, maxc = -1e9;
for (let r = 1; r <= 100000; r++) {
  M.round(w);
  if (r % 100 === 0) {
    const d9 = w.parts.filter((p) => p && p.ch === 9);
    hist.set(d9.length, (hist.get(d9.length) || 0) + 1); n++;
    for (const p of d9) { if (p.credit >= 60 && p.gain > 0) rich++; maxc = Math.max(maxc, p.credit); }
  }
}
const ks = [...hist.keys()].sort((a,b)=>a-b);
console.log(`сид ${seed}: частей в канале 9 -- ` + ks.map(k=>`${k}:${(100*hist.get(k)/n).toFixed(0)}%`).join(' ') +
  ` | замеров с готовым к размножению ${rich} | наибольшая копилка ${maxc.toFixed(0)} (цена копии 60)`);

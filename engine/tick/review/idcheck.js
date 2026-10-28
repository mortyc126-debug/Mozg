const A = require('./v13/neuron2.js'), B = require('./v14/neuron2.js');
const seed = +process.argv[2], wa = A.create(seed), wb = B.create(seed);
for (let r = 1; r <= 20000; r++) {
  A.round(wa); B.round(wb);
  if (r % 2000 === 0) {
    const f = (w) => w.parts.map(p => p ? `${p.slot}:${p.credit.toFixed(12)}:${p.pred.toFixed(12)}:${p.links.length}` : '-').join('|');
    if (f(wa) !== f(wb)) { console.log(`сид ${seed}: РАСХОЖДЕНИЕ на круге ${r}`); process.exit(0); }
  }
}
console.log(`сид ${seed}: побитово одинаковы 20000 кругов`);

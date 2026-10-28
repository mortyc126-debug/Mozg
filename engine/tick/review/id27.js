const A = require('./v26/neuron2.js'), B = require('./v27/neuron2.js');
const seed = +process.argv[2], wa = A.create(seed), wb = B.create(seed);
const f = (w) => w.parts.map(p => p ? `${p.slot}:${p.credit.toFixed(12)}:${p.pred.toFixed(12)}:${p.mse.toFixed(12)}:${p.links.length}` : '-').join('|');
if (wa.parts.length !== wb.parts.length) { console.log('разное число мест'); process.exit(1); }
for (let r = 1; r <= 30000; r++) { A.round(wa); B.round(wb);
  if (r % 2500 === 0 && f(wa) !== f(wb)) { console.log(`сид ${seed}: РАСХОЖДЕНИЕ на круге ${r}`); process.exit(1); } }
console.log(`сид ${seed}: побитово одинаковы 30000 кругов`);

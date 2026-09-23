const A = require('./v14/neuron2.js'), B = require('./v15/neuron2.js');
const seed = +process.argv[2], wa = A.create(seed), wb = B.create(seed);
const f = (w) => w.parts.map(p => p ? `${p.slot}:${p.credit.toFixed(12)}:${p.pred.toFixed(12)}:${p.wSelf.toFixed(12)}:${p.links.length}:${p.g.a===undefined?p.g.lr:p.g.a+','+p.g.b+','+p.g.c}` : '-').join('|');
for (let r = 1; r <= 30000; r++) {
  A.round(wa); B.round(wb);
  if (r % 3000 === 0 && f(wa) !== f(wb)) { console.log(`сид ${seed}: РАСХОЖДЕНИЕ на круге ${r}`); process.exit(0); }
}
console.log(`сид ${seed}: v14 и v15 побитово одинаковы 30000 кругов`);

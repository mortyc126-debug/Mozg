// шаг 83: в пробе строки 8 (только жизнь, без тишины) LCAP=1 ничего не меняет -- побитово
const A = require('./history/neuron2_s83.js'), B = require('./neuron2.js');
const seed = +process.argv[2], wa = A.create(seed), wb = B.create(seed);
const f = (w) => w.parts.map(p => p ? `${p.slot}:${p.credit.toFixed(12)}:${p.pred.toFixed(12)}:${p.links.length}` : '-').join('|');
for (let r = 1; r <= 30000; r++) { A.round(wa); B.round(wb); if (r % 2500 === 0 && f(wa) !== f(wb)) { console.log(`сид ${seed}: РАСХОЖДЕНИЕ на круге ${r}`); process.exit(1); } }
console.log(`сид ${seed} (LCAP=${B.CFG.LCAP} LEXP=${B.CFG.LEXP} ORDER=${B.CFG.ORDER} QPAY=${B.CFG.QPAY}): без тишины побитово одинаковы 30000 кругов`);

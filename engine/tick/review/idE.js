// v35 против зародыша вне тишины: жизнь, пауза шагов 36-37 и снова жизнь -- побитово
const A = require('./v35/neuron2.js'), B = require('../embryo/neuron2.js');
const seed = +process.argv[2], wa = A.create(seed), wb = B.create(seed);
const f = (w) => w.parts.map(p => p ? `${p.slot}:${p.credit.toFixed(12)}:${p.pred.toFixed(12)}:${p.mse.toFixed(12)}:${p.wSelf.toFixed(12)}:${p.links.length}` : '-').join('|');
for (let r = 1; r <= 30000; r++) { A.round(wa); B.round(wb);
  if (r % 5000 === 0) { for (let k = 0; k < 20; k++) { A.pauseRound(wa); B.pauseRound(wb); } }
  if (r % 2500 === 0 && f(wa) !== f(wb)) { console.log(`сид ${seed}: РАСХОЖДЕНИЕ на круге ${r}`); process.exit(1); } }
console.log(`сид ${seed}: побитово одинаковы 30000 кругов с паузами`);

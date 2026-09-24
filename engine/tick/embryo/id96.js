// шаг 96: при OGMAX=3 ODMAX=2 OP=0.1 движок побитово равен движку шага 95
const A = require('./history/neuron2_s95.js'), B = require(process.env.ENG || './neuron2.js');
const seed = +process.argv[2], wa = A.create(seed), wb = B.create(seed);
const f = (w) => w.parts.map(p => p ? `${p.slot}:${p.credit.toFixed(12)}:${p.pred.toFixed(12)}:${p.links.length}:${p.hb}` : '-').join('|');
for (let r = 1; r <= 30000; r++) { A.round(wa); B.round(wb); if (r % 2500 === 0 && f(wa) !== f(wb)) { console.log(`сид ${seed}: РАСХОЖДЕНИЕ на круге ${r}`); process.exit(1); } }
console.log(`сид ${seed} (ORDER=${B.CFG.ORDER} OGMAX=${B.CFG.OGMAX} ODMAX=${B.CFG.ODMAX} OP=${B.CFG.OP} HID=${B.CFG.HID}): побитово одинаковы 30000 кругов`);

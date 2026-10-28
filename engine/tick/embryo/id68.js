// шаг 68: при CSEARCH=0 (и при CHIST=1 CSEARCH=0) движок побитово равен движку прогона 8: жизнь, паузы, свободная активность
const A = require('./history/neuron2_run8.js'), B = require('./neuron2.js');
const seed = +process.argv[2], wa = A.create(seed), wb = B.create(seed);
const f = (w) => w.parts.map(p => p ? `${p.slot}:${p.credit.toFixed(12)}:${p.pred.toFixed(12)}:${p.mse.toFixed(12)}:${p.wSelf.toFixed(12)}:${p.links.length}:${p.hungry}` : '-').join('|');
for (let r = 1; r <= 30000; r++) { A.round(wa); B.round(wb);
  if (r % 5000 === 0) { for (let k = 0; k < 20; k++) { A.pauseRound(wa); B.pauseRound(wb); } for (let k = 0; k < 60; k++) { A.freeRound(wa); B.freeRound(wb); } }
  if (r % 2500 === 0 && f(wa) !== f(wb)) { console.log(`сид ${seed}: РАСХОЖДЕНИЕ на круге ${r}`); process.exit(1); } }
console.log(`сид ${seed} (CHIST=${B.CFG.CHIST} ORDER=${B.CFG.ORDER} DLINE=${B.CFG.DLINE}): побитово одинаковы 30000 кругов с паузами и свободной активностью`);

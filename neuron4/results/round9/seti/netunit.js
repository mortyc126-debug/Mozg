process.argv = ['node', 'x', 'H=16', 'WIN=4', 'LR=0.01'];
const { makeMLP } = require(require('path').join(__dirname, '../../../tools/nets.js')), { stream } = require(require('path').join(__dirname, '../../../src/rng'));
const rng = stream(1, 'т'), n = 3, net = makeMLP(n, rng); let err = 0, cnt = 0;
// задача: y(t+1) = x(t-1) по первому нерву (задержка 2), нервы -- случайные 0/1
const hist = [];
for (let t = 0; t < 20000; t++) { const o = Float64Array.from({ length: n }, () => (rng() < 0.5 ? 1 : 0)); o[2] = hist.length > 1 ? hist[hist.length - 2][0] : 0; hist.push(o);
  const y = net.step(o); if (t > 18000) { const target = hist[hist.length - 1][0]; /* next o[2] = this o[0]... */ } }
// проверка: после учёбы прогноз нерва 2 на следующий круг = o[0] прошлого круга
let ok = 0, N = 0; for (let t = 0; t < 2000; t++) { const o = Float64Array.from({ length: n }, () => (rng() < 0.5 ? 1 : 0)); o[2] = hist[hist.length - 2][0]; hist.push(o); const y = net.step(o); const nextTarget = hist[hist.length - 2][0]; if ((y[2] > 0.5 ? 1 : 0) === hist[hist.length - 2][0]) ok++; N++; }
console.log('MLP задержка: точность прогноза', (ok / N).toFixed(3));

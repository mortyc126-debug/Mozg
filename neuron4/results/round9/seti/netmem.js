// Проверка сети на памяти разговора. По умолчанию вопрос -- через 1 круг (XDMIN=XDMAX=1), как в раунде 9. На экзамене вопрос
// через 3-12 кругов: XDMIN=3 XDMAX=12 (разбор 22.10: без отвлекающих нервов тогда 47%, а не 100%). XND -- отвлекающих нервов.
process.argv = ['node', 'x', 'H=32', 'WIN=16', 'LR=0.003', 'SKIP=' + (process.env.SKIP || 0)];
const { makeMLP } = require(require('path').join(__dirname, '../../../tools/nets.js')), { stream } = require(require('path').join(__dirname, '../../../src/rng'));
const K = require(require('path').join(__dirname, '../../../src/knobs')), { WorldX } = require(require('path').join(__dirname, '../../../src/worldx'));
const cfg = K.makeConfig({ WORLD: 'exam', EXAM: 'память', XND: +(process.env.XND ?? 12), ROUNDS: 20000, XDMIN: +(process.env.XDMIN || 1), XDMAX: +(process.env.XDMAX || 1) });
const W = new WorldX(cfg, 1), n = W.n, obs = new Float64Array(n), net = makeMLP(n, stream(1, 'с'));
const names = W.nerves.map((nv) => nv.ch.name || nv.kind), rv = names.map((x, i) => [x, i]).filter(([x]) => x.startsWith('ответ')).map(([, i]) => i), q = names.indexOf('что было?');
let pend = null, ok = 0, N = 0;
for (let r = 1; r <= 20000; r++) { W.observe(obs); if (pend) { const a = rv.map((i) => obs[i]), ans = a.indexOf(Math.max(...a)); if (r > 10000) { N++; if (pend === ans) ok++; } pend = null; }
  const y = Array.from(net.step(obs)); if (obs[q] > 0.5) { const p = rv.map((i) => y[i]); pend = p.indexOf(Math.max(...p)); if (pend < 0) pend = 0; } W.advance(null); }
console.log('XND', cfg.XND, 'моя мера: точность', (ok / N).toFixed(3), N);

// Сколько примерок делает строитель в эпохах мира эпох со спячкой и без: проверка догадки «спящие каналы выпадают из очереди
// строителя, и примерок на живой мир становится меньше» (разбор 22.10, раздел о спячке в ИТОГ.md). По каждой эпохе: примерки
// строителя на каналах живого мира и на прочих, органы, сколько каналов живого мира и прочих спит в среднем.
//   HIB=0|1|2 SEED=3 ROUNDS=32000 node results/razbor/budget.js
const R = require('path').join(__dirname, '../..');
const K = require(R + '/src/knobs'), { WorldEp } = require(R + '/src/worldep'), { Brain } = require(R + '/src/market');
const HIB = +(process.env.HIB || 0), seed = +(process.env.SEED || 3), ROUNDS = +(process.env.ROUNDS || 32000);
const cfg = K.makeConfig({ SQ: 1, RENT: 0.05, MFEAT: 6, CHOOSE: 1, CIMIT: 1, CWATCH: 80, CPROD: 4, CFEAT: 8, BRAIN: 8, HIB, ROUNDS, EPL: 8000, WORLD: 'exam' });
const W = new WorldEp(cfg, seed), B = new Brain(cfg, W, seed);
const inW = (c, a) => c.k >= W.xs[a].off && c.k < W.xs[a].off + W.xs[a].n;
let scan0 = [0, 0], sl = [0, 0], b0 = 0;
for (let r = 1; r <= ROUNDS; r++) { const a = W.active; B.step(); W.score(B);
  const scan = [0, 0]; for (const c of B.ch) { const i = inW(c, a) ? 0 : 1; scan[i] += c.memScans || 0; if (c.asleep) sl[i]++; }
  if (r % cfg.EPL === 0) { const w = W.xs[a], nl = w.n, no = B.ch.length - nl;
    console.log(`HIB=${HIB} мир ${seed}, эпоха ${r / cfg.EPL - 1} (${W.names[a]}): примерок строителя на живом мире ${scan[0] - scan0[0]}, на прочих ${scan[1] - scan0[1]}; построено органов ${B.mem.built - b0}; спит в среднем: живых каналов ${(sl[0] / cfg.EPL).toFixed(1)} из ${nl}, прочих ${(sl[1] / cfg.EPL).toFixed(1)} из ${no}`);
    b0 = B.mem.built; sl = [0, 0];
    // следующая эпоха -- другой живой мир: счёт примерок по каналам надо разложить заново
    scan0 = [0, 0]; for (const c of B.ch) scan0[inW(c, W.active) ? 0 : 1] += c.memScans || 0; } }

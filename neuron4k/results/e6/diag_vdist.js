// Э6, диагностика (не предрегистрирована): ценность V целиком (нервы + ψ) по настоящему расстоянию до хищника, вторая
// половина жизни. Запуск: node results/e6/diag_vdist.js $PWD <KBITE> <MVPSI> <сид>
const R = process.argv[2], KB = +process.argv[3], PSI = +process.argv[4], seed = +process.argv[5];
const K = require(R + '/src/knobs'), { WorldBody } = require(R + '/src/worldbody'), { Brain } = require(R + '/src/market');
const cfg = K.makeConfig({ SQ: 1, RENT: 0.05, MFEAT: 6, WORLD: 'body', ROUNDS: 40000, BRAIN: 9, KWATER: 1, KSAT: 1, KTWIN: 1, KPAINEV: 1, KDEATH: 1, KDNERVE: 1, KDPEN: 30, KPRED: 1, MVAL: 2, MNOPE: 1, MLOAN: 1000, KEXP: 4, MEXP: 2, MAVOID: 4, MBLEND: 2, KBITE: KB, MVPSI: PSI });
const W = new WorldBody(cfg, seed), B = new Brain(cfg, W, seed), bins = [2, 4, 8, 15, 1e9], s = bins.map(() => [0, 0]);
for (let r = 1; r <= 40000; r++) { B.step(); if (r <= 20000) continue; const v = [...B.vrs.values()][0]; if (!v || !v.ok) continue;
  const row = (v.n - 1) % cfg.MVH, d = Math.hypot(W.x - W.pred.x, W.y - W.pred.y), i = bins.findIndex((b) => d < b); s[i][0] += v.Vrow(v, row); s[i][1]++; }
console.log(`KBITE=${KB} MVPSI=${PSI} сид ${seed}: средняя V по расстоянию до хищника ` + bins.map((b, i) => `<${b > 1e8 ? '∞' : b}: ${(s[i][0] / Math.max(1, s[i][1])).toFixed(2)} (${s[i][1]})`).join('; '));

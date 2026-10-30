// Э5в, диагностика (не предрегистрирована): куда поворачивают рули целей. Запуск: node results/e5c/diag_dir.js $PWD 30 1
const R = process.argv[2], KB = +process.argv[3], seed = +process.argv[4]; const K = require(R + '/src/knobs'), { WorldBody } = require(R + '/src/worldbody'), { Brain } = require(R + '/src/market');
const cfg = K.makeConfig({ SQ: 1, RENT: 0.05, MFEAT: 6, WORLD: 'body', ROUNDS: 40000, BRAIN: 9, KWATER: 1, KSAT: 1, KTWIN: 1, KPAINEV: 1, KDEATH: 1, KDNERVE: 1, KDPEN: 30, KPRED: 1, MVAL: 2, MNOPE: 1, MLOAN: 1000, KEXP: 4, MEXP: 2, MAVOID: 4, MBLEND: 2, KBITE: KB });
const W = new WorldBody(cfg, seed), B = new Brain(cfg, W, seed); const st = { away: [0, 0], awayNear: [0, 0], food: [0, 0] };
const side = (tx, ty) => { const a = Math.atan2(ty - W.y, tx - W.x) - W.th; return Math.sign(Math.sin(a)); };
for (let r = 1; r <= 40000; r++) { const s0 = { px: W.pred.x, py: W.pred.y, fx: W.food && W.food.x, fy: W.food && W.food.y }, d = Math.hypot(W.x - s0.px, W.y - s0.py), ps = side(s0.px, s0.py), fs = W.food ? side(s0.fx, s0.fy) : 0;
  B.step(); if (r < 20000) continue; const v = [...B.vrs.values()][0]; if (!v || !B.exp || !B.exp.prec) continue; const props = B.exp.prec[(v.n - 1) % cfg.MVH] || [];
  for (const p of props) { if (!p.u) continue; if (p.key[0] === '-') { const ok = Math.sign(p.u) === -ps ? 1 : 0; st.away[0] += ok; st.away[1]++; if (d < 8) { st.awayNear[0] += ok; st.awayNear[1]++; } }
    else if (fs) { st.food[0] += Math.sign(p.u) === fs ? 1 : 0; st.food[1]++; } } }
const f = (a) => `${(100 * a[0] / Math.max(1, a[1])).toFixed(0)}% из ${a[1]}`;
console.log(`KBITE=${KB} сид ${seed}: руль «от» поворачивает прочь от хищника ${f(st.away)}; когда хищник ближе 8: ${f(st.awayNear)}; руль «к» поворачивает к еде ${f(st.food)}`);

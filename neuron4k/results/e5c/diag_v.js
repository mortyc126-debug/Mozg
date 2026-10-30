// Э5в, диагностика (не предрегистрирована): коэффициенты ценности V мотора. Запуск: node results/e5c/diag_v.js $PWD 30
const R = process.argv[2], KB = +process.argv[3]; const K = require(R + '/src/knobs'), { WorldBody } = require(R + '/src/worldbody'), { Brain } = require(R + '/src/market');
const cfg = K.makeConfig({ SQ: 1, RENT: 0.05, MFEAT: 6, WORLD: 'body', ROUNDS: 40000, BRAIN: 9, KWATER: 1, KSAT: 1, KTWIN: 1, KPAINEV: 1, KDEATH: 1, KDNERVE: 1, KDPEN: 30, KPRED: 1, MVAL: 2, MNOPE: 1, MLOAN: 1000, KEXP: 4, MEXP: 2, MAVOID: 4, MBLEND: 2, KBITE: KB });
const W = new WorldBody(cfg, 1), B = new Brain(cfg, W, 1);
for (let r = 1; r <= 40000; r++) B.step();
for (const [k, v] of B.vrs) if (v.b) { console.log('мотор нерва', k, 'V:'); v.ids.forEach((id, i) => { const nv = W.nerves && W.nerves[B.goods.nerve ? B.goods.nerve[id] : -1]; console.log('  ', (nv && nv.kind) || id, v.b[1 + i].toFixed(3)); }); }

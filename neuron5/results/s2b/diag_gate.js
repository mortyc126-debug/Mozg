// Ступень 2б, диагностика (не предрегистрирована): есть ли в мире компромисс «бежать только при страхе». Веса заданы
// рукой и не учатся (BLR=0): у «от хищника» вес = max(0, a + g · c), c = страх / средний - 1; остальные рефлексы -- 1.
// Запуск: node results/s2b/diag_gate.js <сид> <a> <g> [KBITE] -> строка
const path = require('path'), R = path.join(__dirname, '..', '..', 'src');
const { make } = require(R + '/config'), { World } = require(R + '/world'), { Brain } = require(R + '/brain');
const seed = +process.argv[2], a = +process.argv[3], g = +process.argv[4], KB = +process.argv[5] || 10;
const cfg = make({ BG: 1, BCTX: 1, BLR: 0, BSIG: 0, KBITE: KB, ROUNDS: 20000 }), W = new World(cfg, seed), B = new Brain(cfg, W, seed);
B.bg.al[2] = a; B.bg.ga[2] = g; for (let t = 1; t <= cfg.ROUNDS; t++) B.step();
const r = W.result(); console.log(JSON.stringify({ seed, a, g, KB, comfort: r.comfort, eat: r.eat, bites: r.bites }));

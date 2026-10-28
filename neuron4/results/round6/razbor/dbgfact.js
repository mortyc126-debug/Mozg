const R=require('path').join(__dirname,'../../..');
const K = require(R + '/src/knobs'), { WorldX } = require(R + '/src/worldx'), { Brain } = require(R + '/src/market'), CP = require(R + '/src/compose');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')).map(([k, v]) => [k, isNaN(+v) ? v : +v])); const seed = args.SEED || 1; delete args.SEED; const RN = args.RN || 6000; delete args.RN;
const BRAIN = { SQ: 1, RENT: 0.05, MFEAT: 6, CHOOSE: 1, CIMIT: 1, CWATCH: 80, CPROD: 4, CFEAT: 8 };
const cfg = K.makeConfig({ ...BRAIN, ...args, WORLD: 'exam', XND: 12 }); const W = new WorldX(cfg, seed), B = new Brain(cfg, W, seed);
const target = W.nerves.findIndex((n) => (n.ch.name || n.kind) === 'свойство');
// перехват: какие сборки примерены для канала свойства и есть ли среди них по-ключу
const orig = CP.candidates; CP.candidates = function (B2, c, w0, t1, res, rng) { const C = orig.apply(this, arguments); if (c.k === target) { const pk = C.list.filter((n) => n.op === "по-ключу"); console.log(`круг ${B2.t}: примерка канала ${c.k}: в бюджете ${C.list.length} из ${C.total}, по-ключу ${pk.length}: ` + [...new Set(C.all.filter((n) => n.op === "по-ключу").map((n) => CP.key(n)))].slice(0, 6).join(" ")); } return C; };
for (let r = 1; r <= RN; r++) { B.step(); W.score(B); }
console.log(B.mem.log.filter((l) => /примерка .* канал (\d+)/.test(l) && l.includes('канал ' + target + ' ')).slice(0, 30).join('\n'));

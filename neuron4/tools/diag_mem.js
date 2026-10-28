// вскрытие памяти (раунд 6): какие органы построил строитель в мире экзамена.  node tools/diag_mem.js EXAM=факт SEED=1 [ручки]
const path = require('path'), R = path.join(__dirname, '..');
const K = require(R + '/src/knobs'), { WorldX } = require(R + '/src/worldx'), { Brain } = require(R + '/src/market');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')).map(([k, v]) => [k, isNaN(+v) ? v : +v])); const seed = args.SEED || 1; delete args.SEED;
const BRAIN = { SQ: 1, RENT: 0.05, MFEAT: 6, CHOOSE: 1, CIMIT: 1, CWATCH: 80, CPROD: 4, CFEAT: 8 };
const cfg = K.makeConfig({ ...BRAIN, ...args, WORLD: 'exam', XND: args.XND || 12 }); const W = new WorldX(cfg, seed), B = new Brain(cfg, W, seed);
for (let r = 1; r <= cfg.ROUNDS; r++) { B.step(); W.score(B); }
console.log('нервы:', W.nerves.map((n, i) => i + ':' + (n.ch.name || n.kind)).join(' '));
console.log(B.mem.log.filter((l) => !/примерка|группы/.test(l)).slice(0, 400).join('\n'));
console.log('живые органы:', B.mem.organs.map((o) => o.key).join(' | '));
console.log(JSON.stringify(W.result()));

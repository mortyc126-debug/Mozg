// разбор ворот шага 69 (после чтения): какие связи к A и B уже есть у частей канала Q на круге 80000
const M = require('./neuron2.js'), C = M.CFG, O = M.OCH;
const seed = +process.argv[2], cond = process.argv[3], w = M.create(seed);
for (let r = 1; r <= 80000; r++) M.round(w);
const nm = ['д', 'п', 'с', 'л'];
const rows = w.parts.filter((p) => p && p.ch === O + 2).map((p) => p.links.filter((l) => w.parts[l.j] && (w.parts[l.j].ch === O || w.parts[l.j].ch === O + 1))
  .map((l) => (w.parts[l.j].ch === O ? 'A' : 'B') + nm[l.k] + (l.age >= C.TRIAL ? '' : '?')).join('+') || '-');
console.log([cond, seed, rows.join(' ')].join('\t'));

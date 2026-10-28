// Разбор ТЕЛО-1 (не предрегистрирован): еда, касания и средний |поворот| по отрезкам жизни в 5000 кругов
const M = require(process.env.ENG || './neuron2.js');
const w = M.create(+process.argv[2]), out = [];
let e = 0, t = 0, a = 0, sg = 0;
for (let r = 1; r <= M.CFG.ROUNDS; r++) { M.round(w); e += w.b.eat; t += w.b.touch; a += Math.abs(w.b.turn); sg += w.b.turn;
  if (r % 5000 === 0) { out.push(`${r / 1000}k: ел ${e} кас ${t} |пов| ${(a / 5000).toFixed(2)} пов ${(sg / 5000).toFixed(2)}`); e = t = a = sg = 0; } }
console.log(process.argv[3], process.argv[2], '\n  ' + out.join('\n  '));

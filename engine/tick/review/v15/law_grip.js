// Есть ли отбору за что ухватиться: связь удалённости закона части от LMS с её битами и доходом
const M = require('./neuron2.js');
const w = M.create(+process.argv[2] || 1), END = +process.argv[3] || 50000;
const cor = (a, b) => { const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let s = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da > 0 && db > 0 ? s / Math.sqrt(da * db) : 0; };
const D = [], B = [], G = [];
for (let r = 1; r <= END; r++) {
  M.round(w);
  if (r > END / 2 && r % 100 === 0) for (const p of w.parts) if (p && p.ch >= 3 && p.age > 300) {
    D.push(Math.abs(Math.log(p.g.b / p.g.a)) + p.g.c / p.g.a);   // насколько закон части далёк от LMS
    B.push(p.bits); G.push(p.gain);
  }
}
const q = (a, t) => [...a].sort((x, y) => x - y)[Math.floor(t * a.length)];
console.log(`сид ${process.argv[2]}: замеров ${D.length} | удалённость от LMS: четверти ${q(D, 0.25).toFixed(2)} / ${q(D, 0.5).toFixed(2)} / ${q(D, 0.75).toFixed(2)}` +
  ` | связь удалённости с битами ${cor(D, B).toFixed(2)}, с доходом ${cor(D, G).toFixed(2)}`);

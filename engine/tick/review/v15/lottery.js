// Насколько отбор может наклонить жребий: сколько соперников в котле и во сколько раз
// самый доходный доходнее среднего. При равных доходах выбор -- чистый жребий.
const M = require('./nfit.js');
const w = M.create(+process.argv[2]); w.blog = [];
for (let r = 1; r <= 60000; r++) { M.round(w); if (r === 10000) w.blog = []; }
const B = w.blog, q = (f, t) => B.map(f).sort((x, y) => x - y)[Math.floor(t * B.length)];
console.log(`сид ${process.argv[2]}: рождений ${B.length} | соперников в котле: четверти ${q(e=>e.n,0.25)} / ${q(e=>e.n,0.5)} / ${q(e=>e.n,0.75)}` +
  ` | самый доходный доходнее среднего в ${q(e=>e.spread,0.25).toFixed(2)} / ${q(e=>e.spread,0.5).toFixed(2)} / ${q(e=>e.spread,0.75).toFixed(2)} раза`);

const M = require('./neuron2.js');
const seed = +process.argv[2], w = M.create(seed);
for (let r = 1; r <= 100000; r++) M.round(w);
const P = w.parts, good = ['датчик','прогноз','сигнал'];
const r2z = (q) => q.zz > 1e-9 ? q.cz*q.cz/q.zz : 0, r2p = (q) => q.pp > 1e-9 ? q.cp*q.cp/q.pp : 0;
console.log(`сид ${seed}, глубина ${process.env.DEEP}`);
for (const p of P) if (p && p.ch === 9) {
  console.log(` часть канала 9 (место ${p.slot}), бит ${p.bits.toFixed(2)}:`);
  for (const l of p.links) {
    const q = P[l.j]; if (!q) continue;
    console.log(`   <- канал ${q.ch} ${good[l.k]}, вес ${l.w.toFixed(2)}, возраст ${l.age}, r^2 товара с нужным прошлым: сигнал ${r2z(q).toFixed(2)} прогноз ${r2p(q).toFixed(2)}`);
    if (l.k === 2) for (const m of q.links) { const o = P[m.j]; if (o && m.age >= 20) console.log(`        сигнал собран из: канал ${o.ch} ${good[m.k]}, u ${m.u.toFixed(2)}`); }
  }
}
// у кого вообще товар несёт нужное прошлое
const car = P.filter(q => q && q.ch !== 9 && (r2z(q) >= 0.25 || r2p(q) >= 0.25));
console.log(` носители: ` + car.map(q => `к${q.ch}(сиг ${r2z(q).toFixed(2)}, прог ${r2p(q).toFixed(2)})`).join(' '));
// распределение r^2 прогноза у частей канала 8 -- проверка, не стоит ли порог 0.25 ровно на них
const c8 = P.filter(q => q && q.ch === 8).map(q => r2p(q).toFixed(3));
console.log(` r^2 ПРОГНОЗА частей канала 8 (порог носителя 0.25): ` + c8.join(' '));

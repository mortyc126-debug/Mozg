// §10 п.2: при EAT=0 мир обязан воспроизводить прежний до последнего разряда
const A = require('./v16/neuron2.js'), B = require('./v18/neuron2.js');
const seed = +process.argv[2], wa = A.create(seed), wb = B.create(seed);
const f = (w) => w.parts.map(p => p ? `${p.slot}:${p.credit.toFixed(12)}:${p.pred.toFixed(12)}:${p.wSelf.toFixed(12)}:${p.mse.toFixed(12)}:${p.links.length}:${p.links.map(l=>l.j+','+l.k+','+l.w.toFixed(10)+','+l.u.toFixed(10)+','+l.age).join(';')}` : '-').join('|');
if (wa.parts.length !== wb.parts.length) { console.log(`сид ${seed}: РАЗНОЕ ЧИСЛО МЕСТ ${wa.parts.length} и ${wb.parts.length}`); process.exit(1); }
for (let r = 1; r <= 30000; r++) {
  A.round(wa); B.round(wb);
  if (r % 2500 === 0 && f(wa) !== f(wb)) { console.log(`сид ${seed}: РАСХОЖДЕНИЕ на круге ${r}`); process.exit(1); }
}
console.log(`сид ${seed}: побитово одинаковы 30000 кругов (мест ${wa.parts.length})`);

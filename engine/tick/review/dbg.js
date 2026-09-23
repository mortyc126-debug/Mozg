const A = require('./v19/neuron2.js'), B = require('./v20/neuron2.js');
const wa = A.create(1), wb = B.create(1);
const snap = (w) => w.parts.map(p => p ? [p.credit, p.pred, p.s, p.ate, p.links.length] : null);
for (let r = 1; r <= 3000; r++) {
  A.round(wa); B.round(wb);
  const a = snap(wa), b = snap(wb);
  for (let i = 0; i < a.length; i++) {
    if ((a[i] === null) !== (b[i] === null)) { console.log(`круг ${r}: место ${i} -- один пуст, другой нет`); process.exit(0); }
    if (!a[i]) continue;
    for (let j = 0; j < a[i].length; j++) if (a[i][j] !== b[i][j]) {
      console.log(`круг ${r}: место ${i}, поле ${['credit','pred','s','ate','links'][j]}: ${a[i][j]} против ${b[i][j]}`);
      console.log(`   abar ${wa.abar} против ${wb.abar} | fq ${wa.fq} против ${wb.fq}`);
      process.exit(0); }
  }
}
console.log('совпадают 3000 кругов');

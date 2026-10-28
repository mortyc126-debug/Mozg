// Есть ли у добытчиков доход помимо еды: платят ли им за чтение?
const M = require('./neuron2.js');
const w = M.create(1);
for (let r = 1; r <= 60000; r++) M.round(w);
const CH = M.CFG.DEEP ? 10 : 8, F = w.parts.filter(p => p && p.ch === CH);
const med = (a) => a.length ? [...a].sort((x,y)=>x-y)[a.length>>1] : NaN;
console.log(`добытчиков живых ${F.length} | за круг: от еды ${med(F.map(p=>p.ate/Math.max(1,p.age))).toFixed(3)},` +
  ` от чтения ${med(F.map(p=>p.fromReads/Math.max(1,p.age))).toFixed(3)}, от мира ${med(F.map(p=>p.fromWorld/Math.max(1,p.age))).toFixed(3)}` +
  ` | аренда 0.4`);

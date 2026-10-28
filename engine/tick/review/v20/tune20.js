// §9: цена возмущения при SLR=0 не больше 2 п.п.; множитель устойчив (70% и 80% прогона в пределах SIG).
const M = require('./neuron2.js');
const R = M.CFG.ROUNDS, CH = 10;
const w = M.create(1); let s7 = null, s8 = null, s5 = null;
const med = (a) => a.length ? [...a].sort((x,y)=>x-y)[a.length>>1] : NaN;
for (let r = 1; r <= R; r++) { M.round(w);
  if (r === Math.floor(R*0.5)) s5 = med(w.parts.filter(p=>p&&p.ch===CH).map(p=>p.mul));
  if (r === Math.floor(R*0.7)) s7 = med(w.parts.filter(p=>p&&p.ch===CH).map(p=>p.mul));
  if (r === Math.floor(R*0.8)) s8 = med(w.parts.filter(p=>p&&p.ch===CH).map(p=>p.mul)); }
const f = M.stats(w).food;
console.log(`SIG=${M.CFG.SIG} SLR=${M.CFG.SLR}\tдоля ${(100*f.share).toFixed(2)}%\tмножитель ${(+f.gain).toFixed(3)}` +
  `\tна 70% ${s7===null?'-':s7.toFixed(3)} на 80% ${s8===null?'-':s8.toFixed(3)}` +
  `\tразница ${s7!==null&&s8!==null?Math.abs(s8-s7).toFixed(3):'-'} (порог ${M.CFG.SIG})	дрейф 50%->конец ${s5===null?'-':(Math.abs((+M.stats(w).food.gain)-s5)).toFixed(3)}`);

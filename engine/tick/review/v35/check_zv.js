// проверка реализации: при замороженных хозяйстве и связях круг свободной активности = тишина шага 45 (worldStep + pauseRound)
const M = require('./neuron2.js'), seed = +process.argv[2];
const a = M.create(seed), b = M.create(seed);
for (let r = 1; r <= 60000; r++) { M.round(a); M.round(b); }
let d = 0;
for (let k = 1; k <= 30; k++) {
  const zv = a.parts.map((p) => p && p.zv); M.freeRound(a); a.parts.forEach((p, i) => { if (p) p.zv = zv[i]; }); M.worldStep(b); M.pauseRound(b);
  a.parts.forEach((p, i) => { if (p) d = Math.max(d, Math.abs(p.pred - b.parts[i].pred), Math.abs(p.z - b.parts[i].z)); });
}
console.log(`сид ${seed}: наибольшее расхождение прогнозов и сигналов за 30 кругов тишины ${d.toExponential(1)} -> ${d <= 1e-9 ? 'совпадает' : 'НЕ совпадает'}`);

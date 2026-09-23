// §2.1 хочет считать биты против дисперсии, которую мир меряет сам. §9.2 хочет побитовую
// тождественность при FOOD=0. Совместимы ли? Смотрим, как гуляет измеряемая дисперсия датчика.
const M = require('./neuron2.js');
const w = M.create(1), CH = 8, sum = new Float64Array(CH), sum2 = new Float64Array(CH);
const ema = new Float64Array(CH).fill(1.01), spread = [];
let n = 0;
for (let r = 1; r <= 60000; r++) {
  M.round(w);
  for (let k = 0; k < CH; k++) {
    const s = w.c[k] + 0.1 * (Math.random() * 2 - 1) * 0; // берём сам канал: датчик = канал + шум
    sum[k] += w.c[k]; sum2[k] += w.c[k] * w.c[k];
    ema[k] += 0.02 * (w.c[k] * w.c[k] + 0.01 - ema[k]);   // окно как у BETA
  }
  n++;
  if (r > 10000 && r % 100 === 0) for (let k = 0; k < CH; k++) spread.push(ema[k]);
}
const q = (t) => [...spread].sort((a, b) => a - b)[Math.floor(t * spread.length)];
console.log(`истинная V = 1 + SN^2 = 1.0100`);
console.log(`измеряемая дисперсия в окне BETA: четверти ${q(0.05).toFixed(3)} / ${q(0.25).toFixed(3)} / ${q(0.5).toFixed(3)} / ${q(0.75).toFixed(3)} / ${q(0.95).toFixed(3)}`);
const b = (V) => 0.5 * Math.log2(V / 0.5);
console.log(`при mse = 0.5 это даёт бит: от ${b(q(0.05)).toFixed(3)} до ${b(q(0.95)).toFixed(3)} вместо ${b(1.01).toFixed(3)} -- разброс ${(100*(b(q(0.95))-b(q(0.05)))/b(1.01)).toFixed(0)}% платы`);

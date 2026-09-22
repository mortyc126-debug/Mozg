// строка 305 делит на sqrt(p.zv) без защиты (в строке 337 есть +1e-9). Насколько близко zv подходит к нулю?
const M = require('./neuron2.js');
const seed = +process.argv[2], w = M.create(seed);
let minzv = Infinity, bad = 0, big = 0;
for (let r = 1; r <= 60000; r++) {
  M.round(w);
  for (const p of w.parts) if (p) {
    if (p.zv < minzv) minzv = p.zv;
    if (!Number.isFinite(p.z) || !Number.isFinite(p.uSelf) || !Number.isFinite(p.pred)) bad++;
    if (Math.abs(p.uSelf) >= 8) big++;
  }
}
console.log(`сид ${seed}: наименьшее zv ${minzv.toExponential(2)} | не-чисел ${bad} | uSelf на пределе ${big}`);

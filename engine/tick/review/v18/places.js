// Проверка пола: равновероятны ли доли во ВТОРОЙ половине, где меряем?
// Если нет -- постоянная стратегия «называть самую толстую долю» бьёт 1/M, и пол не 25%.
const M = require('./neuron2.js');
const seed = +process.argv[2], R = M.CFG.ROUNDS, MP = M.CFG.M, CH = 10;
const w = M.create(seed); const cnt = new Array(MP).fill(0);
const binOf = (w, v) => { if (!w.fq) return -1; let i = 0; while (i < w.fq.length && v >= w.fq[i]) i++; return i; };
for (let r = 1; r <= R; r++) { M.round(w);
  if (r > R / 2) { const b = binOf(w, w.c[CH]); if (b >= 0) cnt[b]++; } }
const t = cnt.reduce((a, b) => a + b, 0);
const sh = cnt.map((c) => 100 * c / t);
console.log(`${process.argv[3]}\tсид ${seed}\tдоли мест: ${sh.map((x) => x.toFixed(1) + '%').join(' ')}\tсамая толстая ${Math.max(...sh).toFixed(1)}%`);

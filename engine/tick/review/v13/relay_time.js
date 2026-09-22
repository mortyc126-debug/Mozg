// доля времени, когда канал 9 заметно выше потолка без передатчика (0.36 бита), и самый длинный такой отрезок
const M = require('./neuron2.js');
const seed = +process.argv[2], w = M.create(seed);
let on = 0, n = 0, run = 0, best = 0;
for (let r = 1; r <= 100000; r++) {
  M.round(w);
  if (r % 500 === 0) {
    const s = M.stats(w); n++;
    if (s.alive && s.bits9 > 0.6) { on++; run += 500; best = Math.max(best, run); } else run = 0;
  }
}
console.log(`сид ${seed}: передатчик работает ${(100 * on / n).toFixed(0)}% времени, самый длинный отрезок ${best} кругов`);

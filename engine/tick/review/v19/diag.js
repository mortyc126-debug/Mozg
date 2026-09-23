// Почему таблица выбрала d=0: насколько собственный толчок велик по сравнению с шириной доли?
const M = require('./neuron2.js');
const seed = +process.argv[2], R = M.CFG.ROUNDS, MP = M.CFG.M, CH = 10;
const L = M.CFG.LOOP, FD = Math.sqrt(1 + L * L * (MP * MP - 1) / 12);
const w = M.create(seed); let sk = 0, nk = 0;
for (let r = 1; r <= R; r++) { M.round(w); if (r > R / 2 && w.acts.length) { sk += w.acts.length; nk++; } }
const k = sk / Math.max(1, nk);
const q = w.fq;
const widths = []; for (let i = 1; i < q.length; i++) widths.push(q[i] - q[i-1]);
const push = L / (k * FD);          // сдвиг F, если сменить названную долю на соседнюю
console.log(`сид ${seed}: действующих в круге в среднем ${k.toFixed(2)} | границы долей ${q.map(x=>x.toFixed(3)).join(' ')}` +
  ` | ширина средних долей ${widths.map(x=>x.toFixed(3)).join(' ')}`);
console.log(`   собственный толчок при смене доли на соседнюю: ${push.toFixed(3)} -- это ${(100*push/widths[0]).toFixed(0)}% ширины доли`);

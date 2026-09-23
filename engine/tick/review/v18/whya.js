// Почему в нуле А доля 20%, если жребий обязан давать 25%?
const M = require('./neuron2.js');
const seed = +process.argv[2], R = M.CFG.ROUNDS, MP = M.CFG.M, CH = 10;
const w = M.create(seed);
const binOf = (w, v) => { if (!w.fq) return -1; let i = 0; while (i < w.fq.length && v >= w.fq[i]) i++; return i; };
let acts = 0, hits = 0, bad = 0, dead = 0;
const named = new Array(MP).fill(0), truth = new Array(MP).fill(0);
const orig = M.round;
for (let r = 1; r <= R; r++) {
  const before = w.acts.map((a) => ({ ...a }));       // действия, названные в прошлом круге
  M.round(w);
  if (r > R / 2 && before.length) {
    const t = binOf(w, w.c[CH]);                      // но w.c уже НОВОЕ -- это и есть цель
    if (t < 0) { bad += before.length; continue; }
    truth[t]++;
    for (const a of before) { acts++; named[a.place]++; if (a.place === t) hits++;
      if (!w.parts[a.slot]) dead++; }
  }
}
const pc = (a) => a.map((x, i) => `${i}:${(100*x/a.reduce((p,q)=>p+q,0)).toFixed(1)}%`).join(' ');
console.log(`сид ${seed}: действий ${acts}, попаданий ${(100*hits/acts).toFixed(1)}%, без границ ${bad}, продавец умер ${dead}`);
console.log(`   названные места: ${pc(named)}`);
console.log(`   истинные места:  ${pc(truth)}`);

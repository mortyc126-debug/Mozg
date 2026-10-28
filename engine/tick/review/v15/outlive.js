// Переживает ли постройка свои части? Длина непрерывной работы цепочки против срока жизни части.
const M = require('./neuron2.js');
const { PRUNE, TRIAL } = M.CFG;
const carZ = (q) => q.zz > 1e-9 && q.cz * q.cz / q.zz >= 0.25;
const carP = (q) => q.pp > 1e-9 && q.cp * q.cp / q.pp >= 0.25;
const seed = +process.argv[2], w = M.create(seed);
const live = (w) => { const s = new Set();
  for (const p of w.parts) if (p && p.ch === 9) for (const l of p.links) { const q = w.parts[l.j];
    if (q && l.age >= TRIAL && Math.abs(l.w) * Math.sqrt(l.r2 || 1) >= PRUNE && ((l.k === 2 && carZ(q)) || (l.k === 1 && carP(q)))) s.add(l.j); }
  return s; };
let run = 0, best = 0, bestDeaths = 0, deaths = 0, ages = [];
let prevAge = new Map();
for (let r = 1; r <= 100000; r++) {
  M.round(w);
  const cur = live(w), P = w.parts;
  for (const [slot, a] of prevAge) if (!P[slot] || P[slot].age !== a + 1) { if (r > 1000) ages.push(a); }
  // смерти среди тех, кто в этот миг держал цепочку
  for (const slot of cur) { const q = P[slot]; if (prevAge.has(slot) && (!q || q.age !== prevAge.get(slot) + 1)) deaths++; }
  if (cur.size) { run++; if (run > best) { best = run; bestDeaths = deaths; } } else { run = 0; deaths = 0; }
  prevAge = new Map(); for (const p of P) if (p) prevAge.set(p.slot, p.age);
}
const med = (a) => (a.length ? [...a].sort((x,y)=>x-y)[a.length>>1] : NaN);
console.log(`сид ${seed}: самый длинный непрерывный отрезок работы цепочки ${best} кругов; срок жизни части (медиана) ${med(ages)} кругов; смен посредника за этот отрезок ${bestDeaths}`);

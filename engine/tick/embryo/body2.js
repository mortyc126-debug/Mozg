// Боковой опыт ТЕЛО-2 (PRE_BODY2.md): любопытство в лабиринте. Аргументы: сид, условие; TRAJ=файл -- траектории конца фазы А и конца жизни
const M = require(process.env.ENG || './neuron2.js');
const seed = +process.argv[2], cond = process.argv[3], C = M.CFG;
const w = M.create(seed);
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
let floorErr = NaN, incA = NaN, motA = [], Lmin1 = NaN, open1 = NaN;
for (let r = 1; r <= C.ROUNDS; r++) {
  M.round(w);
  if (r % 1000 === 0 && r <= C.PHA) motA.push(w.b.nMot || 0);
  if (r === C.PHA) { floorErr = med(w.parts.filter((p) => p && p.ch === 5 && p.x).map((p) => p.mse)) / (1 + C.SN * C.SN);
    incA = (w.bInc || 0) / C.PHA; Lmin1 = w.b.mz.Lmin; open1 = w.b.mz.open; }
}
const b = w.b, opt1 = Lmin1 / C.SPEED, opt2 = b.mz.Lmin / C.SPEED;
const lat = (T) => T.map(([l, ok]) => (ok ? l : C.TOUT));
const LB = lat(b.trials[0]), LC = lat(b.trials[1]);
const okB = b.trials[0].filter((x) => x[1]).length, okC = b.trials[1].filter((x) => x[1]).length;
const third = Math.max(1, Math.floor(LB.length / 3));
const first3 = LB.slice(0, 3).reduce((a, x) => a + x, 0) / Math.max(1, Math.min(3, LB.length));
if (process.env.TRAJ) require('fs').writeFileSync(process.env.TRAJ, JSON.stringify({ seed, cond, G: C.MG, wall1: null, tr: b.tr }));
console.log([cond, seed, C.MG, f(b.vis.size / open1, 3), okB, LB.length, f(med(LB) / opt1, 2), f(first3, 0), f(med(LB.slice(0, third)), 0), f(med(LB.slice(-third)), 0),
  okC, LC.length, f(med(LC) / opt2, 2), f(med(LC) / med(LB), 3), f(floorErr, 3), f(motA.reduce((a, x) => a + x, 0) / motA.length, 2), Math.min(...motA), f(incA, 3), Lmin1, b.mz.Lmin].join('\t'));

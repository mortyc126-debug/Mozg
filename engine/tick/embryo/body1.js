// Боковой опыт ТЕЛО-1 (PRE_BODY1.md): зародыш в теле на плоскости. Аргументы: сид, условие; TRAJ=файл -- записать траекторию
const M = require(process.env.ENG || './neuron2.js');
const seed = +process.argv[2], cond = process.argv[3], C = M.CFG;
const w = M.create(seed);
const nm = [];
for (let r = 1; r <= C.ROUNDS; r++) { M.round(w); if (r % 1000 === 0) nm.push(w.b.nMot || 0); }
const b = w.b, S = b.st, f = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const corr = S.nc > 2 ? (S.sxy / S.nc - (S.sx / S.nc) * (S.sy / S.nc)) / Math.sqrt((S.sxx / S.nc - (S.sx / S.nc) ** 2) * (S.syy / S.nc - (S.sy / S.nc) ** 2)) : NaN;
// ответ на вспышку: средний |поворот| в 3 круга после неё минус средний |поворот| вне таких окон
const tl = b.tl, near = new Uint8Array(tl.length + 4);
for (const i of b.fl) for (let k = 1; k <= 3; k++) near[i + k] = 1;
let bs = 0, bn = 0; for (let i = 0; i < tl.length; i++) if (!near[i]) { bs += Math.abs(tl[i]); bn++; }
const base = bn ? bs / bn : NaN;
const resp = (fl) => { let s = 0, n = 0; for (const i of fl) for (let k = 1; k <= 3; k++) if (i + k < tl.length) { s += Math.abs(tl[i + k]); n++; } return n ? s / n - base : NaN; };
const F = b.fl, early = resp(F.slice(0, 200)), late = resp(F.slice(-200));
const motAlive = nm.slice(nm.length / 2);
if (process.env.TRAJ) require('fs').writeFileSync(process.env.TRAJ, JSON.stringify({ seed, cond, BA: C.BA, RF: C.RF, tr: b.tr }));
console.log([cond, seed, f(1000 * S.eat / S.n, 3), f(1000 * S.touch / S.n, 3), f(corr), f(motAlive.reduce((a, x) => a + x, 0) / motAlive.length, 2),
  Math.min(...motAlive), w.parts.filter(Boolean).length, S.offN ? f(1000 * S.offEat / S.offN, 3) : 'NaN', f(early), f(late), F.length, f(base)].join('\t'));

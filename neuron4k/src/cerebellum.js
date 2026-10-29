'use strict';
// Мозжечок (нейрон Колонии, опыт Э2 -- results/e2/ПЛАН.md, БИОЛОГИЯ.md). Прямая модель: по записи мотора (раз в подгонку)
// для каждого нерва x_k(t+1) - x_k(t) ~ b0 + b x(t) + u(t) (c0 + c x(t)), u(t) -- копия команды этого круга; у всех нервов
// одна матрица признаков. Каждый круг после команды -- прогноз нервов следующего круга x~(t+1). Руль цели (src/expmotor.js)
// видит и нервы, и прогноз -- сколько веса дать прогнозу, решает его подгонка. CER=1 -- с копией команды, CER=2 -- без неё
// (контроль: признаки только [1, x]).
const { solve } = require('./linalg');

const dimOf = (cfg, F) => (cfg.CER === 1 ? 2 * F + 2 : F + 1);
function feat(cfg, x, u, F, f) { f[0] = 1; for (let k = 0; k < F; k++) f[1 + k] = x[k]; if (cfg.CER === 1) { f[F + 1] = u; for (let k = 0; k < F; k++) f[F + 2 + k] = u * x[k]; } return f; }

// запись круга: строка row записи мотора уже заполнена нервами x и командой u
function record(B, m, v, x, row) {
  const cfg = B.cfg, F = v.F, c = v.ce || (v.ce = { W: null, pred: null, prevx: null, xt: new Float32Array(cfg.MVH * F), se: new Float64Array(F), sn: new Float64Array(F), n: 0 });
  // мера (вторая половина жизни): ошибка прогноза против «будет как сейчас»
  if (B.t > cfg.ROUNDS / 2 && c.pred && c.prevx) { for (let k = 0; k < F; k++) { c.se[k] += (x[k] - c.pred[k]) ** 2; c.sn[k] += (x[k] - c.prevx[k]) ** 2; } c.n++; }
  for (let k = 0; k < F; k++) c.xt[row * F + k] = c.pred ? c.pred[k] : x[k];   // прогноз этого круга, сделанный в прошлом -- для подгонки руля
  c.prevx = Float64Array.from(x);
  if (!c.W) { c.pred = null; return; }
  const u = v.u[row], f = feat(cfg, x, u, F, new Float64Array(dimOf(cfg, F))), p = new Float64Array(F);
  for (let k = 0; k < F; k++) { let s = 0; const w = c.W[k]; for (let i = 0; i < f.length; i++) s += w[i] * f[i]; p[k] = x[k] + s; }
  c.pred = p; B.led.work(m, F * f.length); B.cerStat = c; B.cerIds = v.ids;
}
// подгонка прямой модели по записи
function fit(B, m, v, T, ord) {
  const cfg = B.cfg, F = v.F, d = dimOf(cfg, F), A = new Float64Array(d * d), cv = Array.from({ length: F }, () => new Float64Array(d)), yy = new Float64Array(F);
  const x = new Float64Array(F), f = new Float64Array(d);
  for (let i = 0; i < T - 1; i++) { const r = ord[i], r1 = ord[i + 1]; for (let k = 0; k < F; k++) x[k] = v.x[r * F + k]; feat(cfg, x, v.u[r], F, f);
    for (let a = 0; a < d; a++) for (let b = 0; b <= a; b++) A[a * d + b] += f[a] * f[b];
    for (let k = 0; k < F; k++) { const y = v.x[r1 * F + k] - x[k]; yy[k] += y * y; for (let a = 0; a < d; a++) cv[k][a] += f[a] * y; } }
  for (let a = 0; a < d; a++) for (let b = 0; b < a; b++) A[b * d + a] = A[a * d + b];
  const mask = new Float64Array(d).fill(1e-3); mask[0] = 0; const W = [];
  for (let k = 0; k < F; k++) { const r = solve(A, cv[k], d, yy[k], mask); W.push(r ? Float64Array.from(r.w) : new Float64Array(d)); }
  B.led.work(m, T * (d * d + d * F) + F * d * d * d);
  (v.ce || (v.ce = { W: null, pred: null, prevx: null, xt: new Float32Array(cfg.MVH * F), se: new Float64Array(F), sn: new Float64Array(F), n: 0 })).W = W;
}
module.exports = { record, fit };

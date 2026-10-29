'use strict';
// Мозжечок (нейрон Колонии, опыт Э2 -- results/e2/ПЛАН.md, БИОЛОГИЯ.md). Прямая модель: по записи мотора (раз в подгонку)
// для каждого нерва x_k(t+1) - x_k(t) ~ b0 + b x(t) + u(t) (c0 + c x(t)), u(t) -- копия команды этого круга; у всех нервов
// одна матрица признаков. Каждый круг после команды -- прогноз нервов следующего круга x~(t+1). Руль цели (src/expmotor.js)
// видит и нервы, и прогноз -- сколько веса дать прогнозу, решает его подгонка. CER=1 -- с копией команды, CER=2 -- без неё
// (контроль: признаки только [1, x]).
// Э3 (results/e3/ПЛАН.md): CER=3 (с копией) и 4 (без) -- мозжечок-оценщик. Ожидание x~(t) = x̄(t-1) + Δ(x̄(t-1), u(t-1)),
// оценка x̄(t) = x~(t) + K_k (x(t) - x~(t)); доверие нерву K_k из KGRID -- то, при котором ожидание по записи лучше всего
// угадывает следующее чтение (установившийся коэффициент Калмана), K = 1 -- оценка равна нерву. Мотор ожиданий видит только x̄.
const { solve } = require('./linalg');

const KGRID = [0.1, 0.2, 0.3, 0.5, 0.7, 1];
const copy = (cfg) => cfg.CER === 1 || cfg.CER === 3;
const dimOf = (cfg, F) => (copy(cfg) ? 2 * F + 2 : F + 1);
function feat(cfg, x, u, F, f) { f[0] = 1; for (let k = 0; k < F; k++) f[1 + k] = x[k]; if (copy(cfg)) { f[F + 1] = u; for (let k = 0; k < F; k++) f[F + 2 + k] = u * x[k]; } return f; }

// запись круга: строка row записи мотора уже заполнена нервами x и командой u
const newState = (cfg, F) => ({ W: null, pred: null, prevx: null, xt: new Float32Array(cfg.MVH * F), se: new Float64Array(F), sn: new Float64Array(F), n: 0,
  xb: new Float32Array(cfg.MVH * F), K: new Float64Array(F).fill(1), prior: null, mse: { est: 0, raw: 0, n: 0 } });
// оценка нерва k сейчас (для команды мотора): ожидание + доверие нерву × расхождение
function estNow(v, k, raw) { const c = v.ce; return c && c.prior ? c.prior[k] + c.K[k] * (raw - c.prior[k]) : raw; }
function record(B, m, v, x, row) {
  const cfg = B.cfg, F = v.F, c = v.ce || (v.ce = newState(cfg, F));
  if (cfg.CER >= 3) { estimate(B, m, v, x, row, c); return; }
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
  const c = v.ce || (v.ce = newState(cfg, F)); c.W = W;
  if (cfg.CER >= 3) chooseK(B, m, v, T, ord, c);
}
// Э3: оценка круга -- по ожиданию и чтению нерва; мера -- ошибка против настоящего (без шума) значения запахов
function estimate(B, m, v, x, row, c) {
  const cfg = B.cfg, F = v.F, xb = new Float64Array(F);
  for (let k = 0; k < F; k++) xb[k] = c.prior ? c.prior[k] + c.K[k] * (x[k] - c.prior[k]) : x[k];
  for (let k = 0; k < F; k++) c.xb[row * F + k] = xb[k];
  if (B.t > cfg.ROUNDS / 2 && B.world.nerves) { const G = B.goods; for (let k = 0; k < F; k++) { const nv = B.world.nerves[G.nerve[v.ids[k]]]; if (!nv || !/^запах/.test(nv.kind)) continue;
      const tr = nv.ch.val; c.mse.est += (xb[k] - tr) ** 2; c.mse.raw += (x[k] - tr) ** 2; c.mse.n++; } B.cerStat = c; B.cerIds = v.ids; }
  if (!c.W) { c.prior = null; return; }
  const f = feat(cfg, xb, v.u[row], F, new Float64Array(dimOf(cfg, F))), p = new Float64Array(F);
  for (let k = 0; k < F; k++) { let s = 0; const w = c.W[k]; for (let i = 0; i < f.length; i++) s += w[i] * f[i]; p[k] = xb[k] + s; }
  c.prior = p; B.led.work(m, F * f.length + 2 * F);
}
// Э3: доверие нерву -- то K, при котором ожидание по записи лучше всего угадывает следующее чтение (прочие нервы -- как прочитаны)
function chooseK(B, m, v, T, ord, c) {
  const cfg = B.cfg, F = v.F, d = dimOf(cfg, F), f = new Float64Array(d), xm = new Float64Array(F);
  for (let k = 0; k < F; k++) { let bestK = 1, bestE = Infinity;
    for (const K of KGRID) { let est = v.x[ord[0] * F + k], e2 = 0;
      for (let i = 1; i < T; i++) { const r0 = ord[i - 1], r = ord[i]; for (let j = 0; j < F; j++) xm[j] = v.x[r0 * F + j]; xm[k] = est;
        feat(cfg, xm, v.u[r0], F, f); let s = 0; const w = c.W[k]; for (let a = 0; a < d; a++) s += w[a] * f[a]; const prior = est + s, inn = v.x[r * F + k] - prior; e2 += inn * inn; est = prior + K * inn; }
      if (e2 < bestE) { bestE = e2; bestK = K; } }
    c.K[k] = bestK; }
  B.led.work(m, F * KGRID.length * T * (d + F));
}
module.exports = { record, fit, estNow };

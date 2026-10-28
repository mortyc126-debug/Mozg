#!/usr/bin/env node
'use strict';
// Раунд 9, этап 2: обычные нейросети в мирах экзамена -- для честного сравнения цены и учёбы. Сеть живёт той же жизнью,
// что мозг: каждый круг видит нервы, учится предсказывать нервы следующего круга (онлайн, без повторов), её прогноз мир
// меряет той же мерой (W.score через «части» с прогнозом).
//   NET=mlp -- полносвязная по окну из WIN последних кругов, скрытый слой H (tanh)
//   NET=rnn -- рекуррентная (Элман, tanh), скрытый слой H, обратный проход через WIN кругов раз в WIN кругов
// Учёба -- Adam (LR). Операции на круг -- умножения-сложения вперёд и назад (как «работа» мозга -- счёт арифметики).
//   node tools/nets.js NET=mlp|rnn H=32 [WIN=16] [LR=0.003] [EXAMS=факт,память,сложение,перенос] [SEEDS=1-4] [ROUNDS=20000]
const K = require('../src/knobs');
const { WorldX } = require('../src/worldx');
const { stream } = require('../src/rng');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; }).map(([k, v]) => [k, isNaN(+v) ? v : +v]));
const NET = args.NET || 'mlp', H = args.H || 32, WIN = args.WIN || 16, LR = args.LR || 0.003;
const exams = String(args.EXAMS || 'факт,память,сложение,перенос').split(','), [s0, s1] = String(args.SEEDS || '1-4').split('-').map(Number);
const ROUNDS = args.ROUNDS || 20000;

class Adam { constructor(n) { this.m = new Float64Array(n); this.v = new Float64Array(n); this.t = 0; }
  step(w, g, lr) { this.t++; const b1 = 0.9, b2 = 0.999, c1 = 1 - b1 ** this.t, c2 = 1 - b2 ** this.t;
    for (let i = 0; i < w.length; i++) { const gi = Math.max(-5, Math.min(5, g[i])); this.m[i] = b1 * this.m[i] + (1 - b1) * gi; this.v[i] = b2 * this.v[i] + (1 - b2) * gi * gi; w[i] -= lr * (this.m[i] / c1) / (Math.sqrt(this.v[i] / c2) + 1e-8); g[i] = 0; } } }
const randn = (rng) => rng.gauss();

// MLP: x = последние WIN кругов (n * WIN), h = tanh(W1 x + b1), y = W2 h + b2. Каждый круг: шаг учёбы на прошлом прогнозе
// SKIP=1 -- и прямая линейная связь окна с выходом (y = W2 h + Ws x + b2): сеть не хуже линейной регрессии по окну
const SKIP = args.SKIP || 0;
function makeMLP(n, rng) {
  const I = n * WIN, P = I * H + H + H * n + n + (SKIP ? n * I : 0), w = new Float64Array(P), g = new Float64Array(P), opt = new Adam(P), oWs = I * H + H + H * n + n;
  const s1 = 1 / Math.sqrt(I), s2 = 1 / Math.sqrt(H); for (let i = 0; i < I * H; i++) w[i] = s1 * randn(rng); for (let i = I * H + H; i < I * H + H + H * n; i++) w[i] = s2 * randn(rng);
  const oW1 = 0, ob1 = I * H, oW2 = ob1 + H, ob2 = oW2 + H * n, hist = new Float64Array(I), h = new Float64Array(H), y = new Float64Array(n);
  let x = new Float64Array(I), ops = 0;
  const fwd = (xin) => { for (let j = 0; j < H; j++) { let s = w[ob1 + j]; for (let i = 0; i < I; i++) s += w[oW1 + j * I + i] * xin[i]; h[j] = Math.tanh(s); }
    for (let k = 0; k < n; k++) { let s = w[ob2 + k]; for (let j = 0; j < H; j++) s += w[oW2 + k * H + j] * h[j]; if (SKIP) for (let i = 0; i < I; i++) s += w[oWs + k * I + i] * xin[i]; y[k] = s; } ops += I * H + H * n + (SKIP ? n * I : 0); };
  return { P, step(obs) {
    // учёба: прошлый прогноз (по x) против нынешних нервов
    { const e = new Float64Array(n); for (let k = 0; k < n; k++) e[k] = y[k] - obs[k];
      const dh = new Float64Array(H); for (let k = 0; k < n; k++) { g[ob2 + k] += e[k]; for (let j = 0; j < H; j++) { g[oW2 + k * H + j] += e[k] * h[j]; dh[j] += e[k] * w[oW2 + k * H + j]; } if (SKIP) for (let i = 0; i < I; i++) g[oWs + k * I + i] += e[k] * x[i]; }
      for (let j = 0; j < H; j++) { const d = dh[j] * (1 - h[j] * h[j]); g[ob1 + j] += d; for (let i = 0; i < I; i++) g[oW1 + j * I + i] += d * x[i]; }
      opt.step(w, g, LR); ops += 2 * (I * H + H * n + (SKIP ? n * I : 0)) + P; }
    hist.copyWithin(n, 0, I - n); for (let k = 0; k < n; k++) hist[k] = obs[k]; x = Float64Array.from(hist); fwd(x); return y; }, ops: () => ops };
}
// RNN (Элман): h_t = tanh(Wx o_t + Wh h_{t-1} + b), y_t = Wy h_t + c -- прогноз o_{t+1}. Обратный проход через WIN кругов
// раз в WIN кругов (усечённый)
function makeRNN(n, rng) {
  const P = H * n + H * H + H + n * H + n, w = new Float64Array(P), g = new Float64Array(P), opt = new Adam(P);
  const oWx = 0, oWh = H * n, ob = oWh + H * H, oWy = ob + H, oc = oWy + n * H;
  for (let i = 0; i < H * n; i++) w[oWx + i] = randn(rng) / Math.sqrt(n); for (let i = 0; i < H * H; i++) w[oWh + i] = 0.9 * randn(rng) / Math.sqrt(H); for (let i = 0; i < n * H; i++) w[oWy + i] = randn(rng) / Math.sqrt(H);
  let h = new Float64Array(H), ops = 0; const y = new Float64Array(n), buf = [];   // буфер: { o, hPrev, h, y }
  return { P, step(obs) {
    if (buf.length) buf[buf.length - 1].target = Float64Array.from(obs);
    if (buf.length >= WIN && buf[buf.length - 1].target) {   // обратный проход по буферу
      let dhNext = new Float64Array(H);
      for (let s = buf.length - 1; s >= 0; s--) { const B = buf[s], e = new Float64Array(n); for (let k = 0; k < n; k++) e[k] = B.y[k] - B.target[k];
        const dh = Float64Array.from(dhNext); for (let k = 0; k < n; k++) { g[oc + k] += e[k]; for (let j = 0; j < H; j++) { g[oWy + k * H + j] += e[k] * B.h[j]; dh[j] += e[k] * w[oWy + k * H + j]; } }
        const da = new Float64Array(H); for (let j = 0; j < H; j++) da[j] = dh[j] * (1 - B.h[j] * B.h[j]);
        dhNext = new Float64Array(H);
        for (let j = 0; j < H; j++) { g[ob + j] += da[j]; for (let i = 0; i < n; i++) g[oWx + j * n + i] += da[j] * B.o[i]; for (let i = 0; i < H; i++) { g[oWh + j * H + i] += da[j] * B.hPrev[i]; dhNext[i] += da[j] * w[oWh + j * H + i]; } }
        ops += 2 * (n * H + H * n + H * H); }
      opt.step(w, g, LR); ops += P; buf.length = 0; }
    const hPrev = h; h = new Float64Array(H);
    for (let j = 0; j < H; j++) { let s = w[ob + j]; for (let i = 0; i < n; i++) s += w[oWx + j * n + i] * obs[i]; for (let i = 0; i < H; i++) s += w[oWh + j * H + i] * hPrev[i]; h[j] = Math.tanh(s); }
    for (let k = 0; k < n; k++) { let s = w[oc + k]; for (let j = 0; j < H; j++) s += w[oWy + k * H + j] * h[j]; y[k] = s; }
    ops += n * H + H * H + H * n;
    buf.push({ o: Float64Array.from(obs), hPrev, h, y: Float64Array.from(y), target: null });
    return y; }, ops: () => ops };
}

module.exports = { makeMLP, makeRNN };
const XK = { 'сложение': { XK: 10 } };
if (require.main === module) for (const ex of exams) {
  const res = [];
  for (let seed = s0; seed <= s1; seed++) {
    const cfg = K.makeConfig({ WORLD: 'exam', EXAM: ex, XND: 12, ROUNDS, ...(XK[ex] || {}), ...(args.XDMIN ? { XDMIN: args.XDMIN, XDMAX: args.XDMAX } : {}) });
    const W = new WorldX(cfg, seed), n = W.n, rng = stream(seed, 'сеть'), net = NET === 'rnn' ? makeRNN(n, rng) : makeMLP(n, rng);
    const fakeB = { ch: Array.from({ length: n }, () => ({ parts: [{ pred: 0 }], mean: 0 })) }, obs = new Float64Array(n), t0 = Date.now();
    for (let r = 1; r <= ROUNDS; r++) { W.observe(obs); const y = net.step(obs); for (let k = 0; k < n; k++) fakeB.ch[k].parts[0].pred = y[k]; W.advance(null); W.score(fakeB); }
    if (process.env.NETDBG) console.log(JSON.stringify(W.st.slice(-6)));
    res.push({ seed, n, P: net.P, ops: net.ops() / ROUNDS, ms: (Date.now() - t0) / ROUNDS, res: W.result() });
  }
  const r0 = res[0];
  console.log(`${NET}${SKIP ? '+skip' : ''} H=${H} WIN=${WIN} | ${ex}: параметров ${r0.P}, ${(r0.ops / 1000).toFixed(1)} тыс. оп. за круг | ` + res.map((r) => JSON.stringify(Object.fromEntries(Object.entries(r.res).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, +v.toFixed(2)])))).join(' '));
}

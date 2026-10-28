// Замеры PREHOLD.md: доля знания о L, пронесённого сквозь тишину (мир живёт, датчики молчат).
const M = require('./neuron2.js'), LIN = require('./lin.js');
const seed = +process.argv[2], cond = process.argv[3], C = M.CFG, SCH = M.SCH;
const w = M.create(seed);
for (let r = 1; r <= 59000; r++) M.round(w);
let ks = (seed * 2654435761) >>> 0;
const krnd = () => { ks = (ks + 0x6D2B79F5) >>> 0; let t = ks; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const kg = () => Math.sqrt(-2 * Math.log(krnd() + 1e-12)) * Math.cos(2 * Math.PI * krnd());
// Калман: m, P -- оценка L в текущем круге; наблюдение есть, только если прошлый круг был кругом жизни
const R = C.SSIG * C.SSIG + C.SN * C.SN, rho = C.SRHO;
let m = 0, P = 1, sensed = false;
function kal() {
  if (sensed) { const y = w.c[SCH] + C.SN * kg(); const K = P / (P + R); m += K * (y - m); P *= 1 - K; }
  const kp = rho * m; m = kp; P = rho * rho * P + (1 - rho * rho); return kp;   // прогноз L следующего круга
}
const life = () => { const kp = kal(); M.round(w); sensed = true; return kp; };
const silent = () => { kal(); M.worldStep(w); M.pauseRound(w); sensed = false; };
const Sp = () => w.parts.filter((p) => p && p.ch === SCH);
const all = () => w.parts.filter(Boolean);
const rms = (A, f) => Math.sqrt(A.reduce((s, p) => s + f(p) ** 2, 0) / Math.max(1, A.length));
for (let r = 1; r <= 1000; r++) life();                 // Калман входит в установившийся режим
const acc = () => ({ net: 0, nul: 0, kal: 0, n: 0 });
const add = (a, preds, kp, L) => { for (const x of preds) { a.net += (x - L) ** 2; a.nul += L * L; a.kal += (kp - L) ** 2; a.n++; } };
const H = (a) => (a.nul - a.net) / (a.nul - a.kal);
const out = {};
let blow = 0;
for (const T of [10, 30]) {
  const h0 = acc(), hT = acc(), act = [];
  for (let c = 0; c < 20; c++) {
    for (let r = 1; r < 200; r++) life();
    const pr0 = Sp().map((p) => p.pred), kp0 = life(); add(h0, pr0, kp0, w.L);   // последний круг жизни: контроль H(0)
    const s0 = rms(Sp(), (p) => p.pred), a0 = rms(all(), (p) => p.pred);
    // замер радиуса: только чтение состояния, мир не трогается
    const dead = !all().length;   // мир погиб -- мерить нечего (объявлено: после гибели не считается)
    const mats = dead ? [] : ['LC', 'C', 'H'].map((md) => LIN.build(w, C, md)), E = dead ? [] : LIN.eig(mats), prt = dead ? [] : mats[0].parts;
    const grp = (ch) => (ch === SCH ? 0 : ch === 9 ? 3 : ch >= 3 && ch <= 7 ? 2 : 1), sh = [0, 0, 0, 0];
    if (!dead) E[0].sh.forEach((v, i) => { sh[grp(prt[i >> 1].ch)] += v; });
    const dg = Math.max(...prt.map((p) => Math.abs(p.wSelf + p.ws)));
    let bl = 0;
    for (let k = 1; k <= T; k++) { silent(); const q = rms(all(), (p) => p.pred) / a0; blow = Math.max(blow, q); bl = Number.isNaN(q) ? NaN : Math.max(bl, q); }
    if (!dead) console.log(['С', cond, seed, T, c, ...E.map((e) => e.r.toFixed(4)), ...E.map((e) => e.s.toFixed(4)), dg.toFixed(4), ...sh.map((v) => v.toFixed(3)), bl, prt.length].join('\t'));
    act.push(rms(Sp(), (p) => p.pred) / s0);
    const prT = Sp().map((p) => p.pred), kpT = life(); add(hT, prT, kpT, w.L);   // первый круг жизни после тишины
  }
  out[T] = { h0: H(h0), hT: H(hT), act: act.sort((a, b) => a - b)[10] };
}
const st = M.stats(w);
// прежнее мерило шага 36: пауза с замороженным миром, активность прогнозов и сигналов на 200-м круге
const A = all(), p0 = rms(A, (p) => p.pred), z0 = rms(A, (p) => p.z) || 1;
for (let k = 1; k <= 200; k++) M.pauseRound(w);
const f = (x) => (Number.isFinite(x) ? x.toFixed(3) : 'NaN');
console.log(['И', cond, seed, f(out[10].h0), f(out[10].hT), f(out[30].h0), f(out[30].hT), f(out[10].act), f(out[30].act), f(blow),
  f(st.bitsX), f(st.right), (rms(A, (p) => p.pred) / p0).toExponential(2), (rms(A, (p) => p.z) / z0).toExponential(2), Sp().length].join('\t'));

const M = require('./neuron2.js');
const seed = +process.argv[2], cond = process.argv[3], C = M.CFG, SCH = M.SCH;
const w = M.create(seed);
for (let r = 1; r <= 60000; r++) M.round(w);
const Sp = () => w.parts.filter((p) => p && p.ch === SCH);
let ks = (seed * 2654435761) >>> 0;
const krnd = () => { ks = (ks + 0x6D2B79F5) >>> 0; let t = ks; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const kg = () => Math.sqrt(-2 * Math.log(krnd() + 1e-12)) * Math.cos(2 * Math.PI * krnd());
const acc = () => ({ n: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0 });
const add = (a, x, y) => { a.n++; a.sx += x; a.sy += y; a.sxx += x * x; a.syy += y * y; a.sxy += x * y; };
const r2 = (a) => { const cx = a.sxx - a.sx * a.sx / a.n, cy = a.syy - a.sy * a.sy / a.n, cxy = a.sxy - a.sx * a.sy / a.n; return cx > 0 && cy > 0 ? cxy * cxy / (cx * cy) : NaN; };
const net = acc(), naive = acc(), kal = acc(), alive = [], bx = [];
const R = C.SSIG * C.SSIG + C.SN * C.SN, rho = C.SRHO; let m = 0, Pp = 1;
for (let r = 1; r <= 5000; r++) {
  const S = Sp(); alive.push(S.length); const pr = S.map((p) => [p.pred, p.s]);
  const y = w.c[SCH] + C.SN * kg();
  const K = Pp / (Pp + R); m += K * (y - m); const P = (1 - K) * Pp; const kp = rho * m; Pp = rho * rho * P + (1 - rho * rho);
  M.round(w); const L = w.L;
  for (const [pred, s] of pr) { add(net, pred, L); add(naive, s, L); } add(kal, kp, L);
  if (r % 250 === 0) bx.push(M.stats(w).bitsX);
}
const med = (a) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2) : NaN; };
const aS = med(Sp().map((p) => p.wSelf)), ageS = med(Sp().map((p) => p.age)), wsS = med(Sp().map((p) => p.ws)), wsX = med(w.parts.filter((p) => p && p.ch >= 3 && p.ch <= 7).map((p) => p.ws));
const st = M.stats(w);
const rms = () => { const A = Sp(); return Math.sqrt(A.reduce((a, p) => a + p.pred * p.pred, 0) / Math.max(1, A.length)); };
let r10 = NaN, r20 = NaN; for (let k = 1; k <= 20; k++) { M.pauseRound(w); if (k === 10) r10 = rms(); if (k === 20) r20 = rms(); }
const gain = r10 > 0 ? Math.pow(r20 / r10, 1 / 10) : 0;
console.log([cond, seed, med(alive), r2(net).toFixed(3), r2(naive).toFixed(3), r2(kal).toFixed(3), med(bx).toFixed(3),
  gain.toFixed(3), wsS.toFixed(3), wsX.toFixed(3), st.right.toFixed(3), st.nul.toFixed(3), aS.toFixed(3), ageS].join('\t'));

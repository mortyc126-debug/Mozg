// Медленный мир: накапливает ли сеть свидетельства во времени. Главная мера -- r2 прогнозов частей S с L(t+1).
const M = require('./neuron2.js');
const seed = +process.argv[2], C = M.CFG, SCH = M.SCH, TRIAL = C.TRIAL;
const w = M.create(seed);
for (let r = 1; r <= 60000; r++) M.round(w);
const Sparts = () => w.parts.filter((p) => p && p.ch === SCH);
// собственный генератор для датчикового шума фильтра, чтобы не трогать мир
let ks = (seed * 2654435761) >>> 0;
const krnd = () => { ks = (ks + 0x6D2B79F5) >>> 0; let t = ks; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const kg = () => Math.sqrt(-2 * Math.log(krnd() + 1e-12)) * Math.cos(2 * Math.PI * krnd());
const acc = () => ({ n: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0 });
const add = (a, x, y) => { a.n++; a.sx += x; a.sy += y; a.sxx += x * x; a.syy += y * y; a.sxy += x * y; };
const r2 = (a) => { const cx = a.sxx - a.sx * a.sx / a.n, cy = a.syy - a.sy * a.sy / a.n, cxy = a.sxy - a.sx * a.sy / a.n; return cx > 0 && cy > 0 ? cxy * cxy / (cx * cy) : NaN; };
const net = acc(), naive = acc(), kal = acc(); const alive = [];
const R = C.SSIG * C.SSIG + C.SN * C.SN, rho = C.SRHO; let m = 0, Pp = 1;
for (let r = 1; r <= 5000; r++) {
  const S = Sparts(); alive.push(S.length);
  const pr = S.map((p) => [p.pred, p.s]);
  const y = w.c[SCH] + C.SN * kg();                         // наблюдение, как у датчика части
  const K = Pp / (Pp + R); m += K * (y - m); const P = (1 - K) * Pp; const kpred = rho * m; Pp = rho * rho * P + (1 - rho * rho);
  M.round(w);
  const L = w.L;                                            // L(t+1) -- то, что прогнозы целили
  for (const [pred, s] of pr) { add(net, pred, L); add(naive, s, L); }
  add(kal, kpred, L);
}
// связи частей S на прогнозы и сигналы других частей S
const S = Sparts(); let linked = 0; const ws = [];
for (const p of S) { let has = false;
  for (const l of p.links) { const q = w.parts[l.j]; if (q && q.ch === SCH && l.k >= 1 && l.age >= TRIAL) { has = true; ws.push(Math.abs(l.w)); } }
  if (has) linked++; }
// цена забывания на S: 10 циклов «200 жизни -- пауза 50 -- 20 жизни»
const V = 1 + C.SSIG * C.SSIG + C.SN * C.SN;
const live = () => { const prev = new Map(); for (const p of w.parts) if (p && p.ch === SCH) prev.set(p, p.pred);
  M.round(w); const e = new Map(); for (const p of w.parts) if (p && prev.has(p)) e.set(p, (p.s - prev.get(p)) ** 2); return e; };
const costs = [], raw = [];
for (let c = 0; c < 10; c++) {
  const bs = new Map(), bn = new Map();
  for (let r = 1; r <= 200; r++) { const e = live(); if (r > 150) for (const [p, v] of e) { bs.set(p, (bs.get(p) || 0) + v); bn.set(p, (bn.get(p) || 0) + 1); } }
  const base = new Map(); for (const [p, v] of bs) if (bn.get(p) === 50) base.set(p, v / 50);
  for (let k = 0; k < 50; k++) M.pauseRound(w);
  const ex = new Map(), seen = new Map();
  for (let r = 1; r <= 20; r++) { const e = live(); for (const [p, v] of e) if (base.has(p)) { ex.set(p, (ex.get(p) || 0) + v - base.get(p)); seen.set(p, (seen.get(p) || 0) + 1); } }
  let num = 0, den = 0, cnt = 0; for (const [p, v] of ex) if (seen.get(p) === 20) { num += v; den += V - base.get(p); cnt++; }
  costs.push(den !== 0 ? num / den : NaN); raw.push(cnt ? num / cnt : NaN);
}
// усиление возвратного пути на S в паузе
const rms = () => { const A = Sparts(); return Math.sqrt(A.reduce((a, p) => a + p.pred * p.pred, 0) / Math.max(1, A.length)); };
let r10 = NaN, r20 = NaN; for (let k = 1; k <= 20; k++) { M.pauseRound(w); if (k === 10) r10 = rms(); if (k === 20) r20 = rms(); }
const gain = r10 > 0 ? Math.pow(r20 / r10, 1 / 10) : 0;
const med = (a) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2) : NaN; };
const st = M.stats(w);
console.log([seed, med(alive), r2(net).toFixed(3), r2(naive).toFixed(3), r2(kal).toFixed(3), `${linked}/${S.length}`, med(ws).toFixed(3),
  gain.toFixed(3), med(costs).toFixed(2), med(raw).toFixed(3), st.right.toFixed(3), st.nul.toFixed(3)].join('\t'));

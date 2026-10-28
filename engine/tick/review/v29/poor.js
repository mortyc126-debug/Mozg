// Замеры PREPOOR.md: раскладка дохода частей медленного канала и повтор разбора шага 39.
const M = require('./neuron2.js');
const seed = +process.argv[2], cond = process.argv[3], C = M.CFG, SCH = M.SCH;
const w = M.create(seed);
for (let r = 1; r <= 60000; r++) M.round(w);
const P = () => w.parts;
const isX = (p) => p.ch >= 3 && p.ch <= 7;
let ks = (seed * 2654435761) >>> 0;
const krnd = () => { ks = (ks + 0x6D2B79F5) >>> 0; let t = ks; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const kg = () => Math.sqrt(-2 * Math.log(krnd() + 1e-12)) * Math.cos(2 * Math.PI * krnd());
const acc = () => ({ n: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0 });
const add = (a, x, y) => { a.n++; a.sx += x; a.sy += y; a.sxx += x * x; a.syy += y * y; a.sxy += x * y; };
const r2 = (a) => { const cx = a.sxx - a.sx * a.sx / a.n, cy = a.syy - a.sy * a.sy / a.n, cxy = a.sxy - a.sx * a.sy / a.n; return cx > 0 && cy > 0 ? cxy * cxy / (cx * cy) : NaN; };
const net = acc(), naive = acc(), kal = acc(), alive = [];
const R = C.SSIG * C.SSIG + C.SN * C.SN, rho = C.SRHO, VS = 1 + R; let m = 0, Pp = 1, kpPrev = null, seK = 0, nK = 0;
const inc = { S: { world: 0, reads: 0, n: 0, spend: 0, ns: 0 }, X: { world: 0, reads: 0, n: 0, spend: 0, ns: 0 } };
let buyS = 0, buyX = 0, nRound = 0;                  // платные связи, читающие части S: из S и из других каналов
for (let r = 1; r <= 5000; r++) {
  const A = P().filter(Boolean), S = A.filter((p) => p.ch === SCH);
  alive.push(S.length);
  for (const p of A) for (const l of p.links) {
    const q = P()[l.j]; if (!q || q.ch !== SCH || (C.FREE_TRY > 0 && l.age < C.TRIAL)) continue;
    if (p.ch === SCH) buyS++; else buyX++;
  }
  nRound++;
  const before = A.map((p) => [p, p.fromWorld, p.fromReads, p.credit]);
  const pr = S.map((p) => [p.pred, p.s]);
  const y = w.c[SCH] + C.SN * kg();                  // датчик наблюдателя -- той же природы, что у частей
  if (kpPrev !== null) { seK += (y - kpPrev) ** 2; nK++; }
  const K = Pp / (Pp + R); m += K * (y - m); const Pq = (1 - K) * Pp; const kp = rho * m; Pp = rho * rho * Pq + (1 - rho * rho);
  kpPrev = kp;
  const births0 = w.births;
  M.round(w); const L = w.L;
  for (const [pred, s] of pr) { add(net, pred, L); add(naive, s, L); } add(kal, kp, L);
  for (const [p, fw, fr, c] of before) {
    if (w.parts[p.slot] !== p) continue;             // умерла за круг -- не считается
    const g = p.ch === SCH ? inc.S : isX(p) ? inc.X : null; if (!g) continue;
    const dw = p.fromWorld - fw, dr = p.fromReads - fr; g.world += dw; g.reads += dr; g.n++;
    let sp = dw + dr - (C.SPROTECT && p.ch === SCH ? 0 : C.RENT) - (p.credit - c);   // прочий расход: свои чтения и поиск
    if (sp > C.BIRTH / 2) sp -= C.BIRTH;               // родила за круг
    if (p.credit < C.CAP && sp >= -1e-9) { g.spend += sp; g.ns++; }   // упор в потолок искажает -- не считается
  }
}
const med = (a) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2) : NaN; };
const Sp = P().filter((p) => p && p.ch === SCH);
const ceil = 0.5 * Math.log2(VS / (seK / nK));
const f = (x, d = 3) => Number.isFinite(x) ? x.toFixed(d) : 'NaN';
console.log([cond, seed, med(alive), f(r2(net)), f(r2(naive)), f(r2(kal)),
  f(med(Sp.map((p) => p.wSelf))), med(Sp.map((p) => p.age)),
  f(inc.S.world / inc.S.n), f(inc.S.reads / inc.S.n), f(inc.S.spend / inc.S.ns),
  f(inc.X.world / inc.X.n), f(inc.X.reads / inc.X.n), f(inc.X.spend / inc.X.ns),
  f(ceil), f(buyS / nRound, 2), f(buyX / nRound, 2), P().filter(Boolean).length].join('\t'));

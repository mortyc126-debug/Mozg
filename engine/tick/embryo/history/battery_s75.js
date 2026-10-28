// Батарея зародыша (BATTERY.md): все строки в одном мире. Режим 'зародыш' или 'нульА'.
const M = require('./neuron2.js');
const seed = +process.argv[2], mode = process.argv[3], C = M.CFG, SCH = M.SCH;
const f = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const w = M.create(seed);
// с шага 74: счёт катастроф -- рост в тишине (только чтения): пик > 10·вход и пик > 20
const mxp = () => { let m = 0; for (const p of w.parts) if (p) m = Math.max(m, Math.abs(p.pred)); return m; };
let cat = 0, gmax = 0, sil = null;
const silBeg = () => { sil = { a: mxp(), pk: 0 }; };
const silStep = () => { sil.pk = Math.max(sil.pk, mxp()); };
const silEnd = () => { const g = sil.pk / Math.max(sil.a, 1e-9); if (g > gmax) gmax = g; if (sil.pk > 10 * sil.a && sil.pk > 20) cat++; };
if (mode === 'нульА') {
  for (let r = 1; r <= 100000; r++) M.round(w);
  const st = M.stats(w);
  console.log(['нульА', seed, f(st.food ? st.food.share : NaN), st.alive].join('\t'));
  process.exit(0);
}
if (mode === 'проверка3') {
  for (let r = 1; r <= 60000; r++) M.round(w);
}
// 1. жизнь; с 60000-го круга -- замер канала 9 и смены состава
let st = {}, alive = NaN, hold9 = NaN, kept = NaN, chBits = [NaN, NaN, NaN, NaN]; const Hs = {};
if (mode !== 'проверка3') {
let at60 = null; const b9 = [];
for (let r = 1; r <= 100000; r++) {
  M.round(w);
  if (r === 60000) at60 = w.parts.filter(Boolean);
  if (r >= 60000 && r % 1000 === 0) b9.push(M.stats(w).bits9);
}
st = M.stats(w); alive = st.alive;
hold9 = b9.filter((x) => x > 0.6).length / b9.length;
kept = at60.filter((p) => w.parts[p.slot] === p).length / at60.length;
chBits = [3, 4, 5, 7].map((c) => med(w.parts.filter((p) => p && p.ch === c).map((p) => p.bits)));
// 2. строка 0: циклы тишины, как в шагах 42-45
let ks = (seed * 2654435761) >>> 0;
const krnd = () => { ks = (ks + 0x6D2B79F5) >>> 0; let t = ks; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const kg = () => Math.sqrt(-2 * Math.log(krnd() + 1e-12)) * Math.cos(2 * Math.PI * krnd());
const R = C.SSIG * C.SSIG + C.SN * C.SN, rho = C.SRHO;
let m = 0, P = 1, sensed = false;
function kal() {
  if (sensed) { const y = w.c[SCH] + C.SN * kg(); const K = P / (P + R); m += K * (y - m); P *= 1 - K; }
  const kp = rho * m; m = kp; P = rho * rho * P + (1 - rho * rho); return kp;
}
const life = () => { const kp = kal(); M.round(w); sensed = true; return kp; };
const silent = () => { kal(); M.worldStep(w); M.pauseRound(w); sensed = false; };
const Sp = () => w.parts.filter((p) => p && p.ch === SCH);
for (let r = 1; r <= 1000; r++) life();
const acc = () => ({ net: 0, nul: 0, kal: 0 });
const add = (a, preds, kp, L) => { for (const x of preds) { a.net += (x - L) ** 2; a.nul += L * L; a.kal += (kp - L) ** 2; } };
const H = (a) => (a.nul - a.net) / (a.nul - a.kal);
// с шага 63: 100 циклов (100 кругов жизни -- тишина), суммы на выход; H строки 0 -- отношение сумм по всем сидам
for (const T of [10, 30]) {
  const hT = acc();
  for (let c = 0; c < 100; c++) {
    for (let r = 1; r <= 100; r++) life();
    silBeg(); for (let k = 1; k <= T; k++) { silent(); silStep(); } silEnd();
    const prT = Sp().map((p) => p.pred), kpT = life(); add(hT, prT, kpT, w.L);
  }
  Hs[T] = H(hT); Hs['s' + T] = [hT.net, hT.nul, hT.kal];
}
// 3. строка 3 прямо: 40 кругов жизни, 100 кругов свободной активности, 45 кругов жизни (замер 6-45), как в шаге 46
}
const V = 1 + C.SN * C.SN, VS = 1 + C.SSIG * C.SSIG + C.SN * C.SN, MIX = [3, 4, 5, 6, 7];
function lifeRec(a) {
  const before = w.parts.filter((p) => p && p.x).map((p) => [p, p.pred]);
  M.round(w);
  const s = {}, n = {};
  for (const [p, pr] of before) { if (w.parts[p.slot] !== p) continue; s[p.ch] = (s[p.ch] || 0) + (p.s - pr) ** 2; n[p.ch] = (n[p.ch] || 0) + 1; }
  if (!a) return;
  for (const c of MIX) { a.mix += n[c] ? s[c] / n[c] : V; a.nm++; }
  a.S += n[SCH] ? s[SCH] / n[SCH] : VS; a.nS++;
}
const tacc = () => ({ mix: 0, nm: 0, S: 0, nS: 0 });
// с шага 50: цикл строки 3 повторяется 5 раз, между циклами 960 кругов жизни; квадраты ошибок -- по всем циклам
const FF = +(process.env.FREE_F ?? 100), FL = +(process.env.FREE_L ?? 1000), WIPE3 = +(process.env.WIPE3 ?? 0);
// с шага 75: отрицательный контроль меры строк 3 -- в конце тишины у частей медленного канала стираются веса
const wipe = () => { if (!WIPE3) return; for (const p of w.parts) if (p && p.ch === SCH) { p.wSelf = 0; p.ws = 0; for (const l of p.links) { l.w = 0; if (l.tw) l.tw.fill(0); } } };
const pre = tacc(), post = tacc();
for (let c = 0; c < 5; c++) {
  if (c) for (let r = 1; r <= 960; r++) M.round(w);
  for (let r = 1; r <= 40; r++) lifeRec(pre);
  silBeg(); for (let k = 1; k <= FF; k++) { M.freeRound(w); silStep(); } silEnd(); wipe();
  for (let r = 1; r <= 45; r++) lifeRec(r > 5 ? post : null);
}
const Rmix = (V - post.mix / post.nm) / (V - pre.mix / pre.nm), RS = (VS - post.S / post.nS) / (VS - pre.S / pre.nS);
// с шага 57: строка «3 длинная тишина» -- 3 цикла по 1000 кругов свободной активности
const preL = tacc(), postL = tacc();
for (let c = 0; c < 3; c++) {
  for (let r = 1; r <= 960; r++) M.round(w);
  for (let r = 1; r <= 40; r++) lifeRec(preL);
  silBeg(); for (let k = 1; k <= FL; k++) { M.freeRound(w); silStep(); } silEnd(); wipe();
  for (let r = 1; r <= 45; r++) lifeRec(r > 5 ? postL : null);
}
const RmixL = (V - postL.mix / postL.nm) / (V - preL.mix / preL.nm), RSL = (VS - postL.S / postL.nS) / (VS - preL.S / preL.nS);
console.log([mode, seed, alive, f(st.right), f(st.nul), f(st.bits9), f(hold9), f(kept), chBits.map((x) => f(x, 3)).join(','),
  f(st.food ? st.food.share : NaN), f(Hs[10]), f(Hs[30]), f(Rmix), f(RS), f(RmixL), f(RSL), (Hs.s10 || []).map((x) => x.toFixed(6)).join(','), (Hs.s30 || []).map((x) => x.toFixed(6)).join(','), `${cat},${gmax.toExponential(3)}`,
  [pre, post].flatMap((a) => [a.mix, a.nm, a.S, a.nS]).map((x) => x.toFixed(6)).join(','), [preL, postL].flatMap((a) => [a.mix, a.nm, a.S, a.nS]).map((x) => x.toFixed(6)).join(',')].join('\t'));

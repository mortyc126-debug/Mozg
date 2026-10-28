// Разбор шага 71 (PRE71_4302.md): путь батареи зародыша побитово, только чтения; по циклам строк 0 и 3 -- радиус 'LC',
// наибольшие |прогноз| и веса по каналам, порча весов в первом круге жизни после тишины
const M = require('./neuron2.js');
const seed = +process.argv[2], mode = process.argv[3], C = M.CFG, SCH = M.SCH;
const f = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const w = M.create(seed);
const LIN = require('./lin.js');
const GR = (ch) => (ch <= 2 || ch === 8 ? 'ист' : ch <= 7 ? 'смеси' : ch === 9 ? 'к9' : ch === SCH ? 'S' : 'еда');
const A_ = () => w.parts.filter(Boolean);
const maxPred = () => { let m = 0, who = null; for (const p of A_()) if (Math.abs(p.pred) > m) { m = Math.abs(p.pred); who = p; } return [m, who]; };
const maxPredS = () => Math.max(0, ...A_().filter((p) => p.ch === SCH).map((p) => Math.abs(p.pred)));
const wts = () => new Map(A_().map((p) => [p, { self: Math.abs(p.wSelf + p.ws), lw: p.links.map((l) => [l, Math.abs(l.w), Math.abs(l.u)]) }]));
const maxW = () => { let m = 0; for (const p of A_()) { m = Math.max(m, Math.abs(p.wSelf + p.ws)); for (const l of p.links) m = Math.max(m, Math.abs(l.w)); } return m; };
function jumps(before) {                  // рост больше чем вдвое и за 2 за первый круг жизни
  const out = [];
  for (const [p, b] of before) { if (w.parts[p.slot] !== p) continue;
    const s = Math.abs(p.wSelf + p.ws); if (s > 2 && s > 2 * b.self) out.push(`${GR(p.ch)}#${p.slot} себя ${b.self.toFixed(2)}->${s.toFixed(2)}`);
    for (const [l, a, u] of b.lw) { if (l.dead) continue; const x = Math.abs(l.w), y = Math.abs(l.u);
      if (x > 2 && x > 2 * a) out.push(`${GR(p.ch)}#${p.slot} w<-${w.parts[l.j] ? GR(w.parts[l.j].ch) : '?'}#${l.j}/${l.k} ${a.toFixed(2)}->${x.toFixed(2)}`);
      if (y > 2 && y > 2 * u) out.push(`${GR(p.ch)}#${p.slot} u<-#${l.j}/${l.k} ${u.toFixed(2)}->${y.toFixed(2)}`); } }
  return out;
}
function share(e, parts) { const sh = {}; e.sh.forEach((v, i) => { const g = GR(parts[i >> 1].ch); sh[g] = (sh[g] || 0) + v; }); return Object.entries(sh).sort((a, b) => b[1] - a[1]).map(([g, v]) => `${g} ${v.toFixed(2)}`).join(', '); }
function describe(p, tag) {
  console.log(`  ${tag}: часть #${p.slot} канал ${p.ch} (${GR(p.ch)}), прогноз ${p.pred.toExponential(2)}, wSelf ${p.wSelf.toFixed(3)}, ws ${p.ws.toFixed(3)}, uSelf ${p.uSelf.toFixed(3)}, zv ${p.zv.toExponential(2)}, r2s ${p.r2s.toExponential(2)}`);
  for (const l of p.links) { const q = w.parts[l.j]; console.log(`    <- #${l.j} ${q ? 'канал ' + q.ch + ' (' + GR(q.ch) + ')' : 'мертва'} товар ${l.k} w ${l.w.toFixed(3)} u ${l.u.toFixed(3)} r2 ${l.r2.toExponential(2)} возраст ${l.age} ${q ? 'его прогноз ' + q.outP.toExponential(2) + ' сигнал ' + q.zOut.toFixed(2) : ''}`); }
}
let first = null, w0 = NaN;
const flag = (phase, c, m, who) => { if (!first && m > 20) { first = { phase, c }; console.log(`ПЕРВОЕ ПРЕВЫШЕНИЕ 20: фаза ${phase}, цикл ${c}, |прогноз| ${m.toExponential(2)}`); describe(who, 'часть'); } };
if (mode !== 'зародыш') throw new Error('только зародыш');
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
w0 = maxW(); console.log(`до строки 0: наибольший вес ${w0.toFixed(2)}, наибольший |прогноз| ${maxPred()[0].toFixed(2)}`);
for (const T of [10, 30]) {
  const hT = acc();
  for (let c = 0; c < 100; c++) {
    let lm = 0, lwho = null; for (let r = 1; r <= 100; r++) { life(); const [m, who] = maxPred(); if (m > lm) { lm = m; lwho = who; } }
    flag(`жизнь перед тишиной T=${T}`, c, lm, lwho);
    const Bm = LIN.build(w, C, 'LC'), e = LIN.eig([Bm])[0], wb = maxW(), e0 = LIN.eig([LIN.build(w, C, '0')])[0];
    let mx = 0, mS = 0, mwho = null; for (let k = 1; k <= T; k++) { silent(); const [m, who] = maxPred(); if (m > mx) { mx = m; mwho = who; } mS = Math.max(mS, maxPredS()); }
    flag(`тишина T=${T}`, c, mx, mwho);
    const before = wts();
    const prT = Sp().map((p) => p.pred), kpT = life(); const net0 = hT.net; add(hT, prT, kpT, w.L);
    const [m1, who1] = maxPred(); flag(`первый круг жизни после T=${T}`, c, m1, who1);
    const J = jumps(before);
    if (e.r > 1 || mx > 20 || m1 > 20 || J.length || lm > 20)
      console.log(`T=${T} цикл ${c}: радиус ${e.r.toFixed(4)}, без подстановки ${e0.r.toFixed(4)} (r^T ${Math.pow(e.r, T).toExponential(2)}; ведущий: ${share(e, Bm.parts)}), вес до ${wb.toFixed(2)}, |прогноз| жизнь ${lm.toFixed(2)} тишина ${mx.toExponential(2)} (S ${mS.toExponential(2)}) после ${m1.toExponential(2)}, вклад ${(hT.net - net0).toExponential(2)}${J.length ? ' | ПОРЧА: ' + J.slice(0, 6).join('; ') + (J.length > 6 ? ` ... всего ${J.length}` : '') : ''}`);
  }
  console.log(`T=${T}: ткань ${hT.net.toExponential(6)}, нуль ${hT.nul.toFixed(3)}, оптимум ${hT.kal.toFixed(3)}; наибольший вес ${maxW().toFixed(2)}`);
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
const FF = +(process.env.FREE_F ?? 100);
const pre = tacc(), post = tacc();
console.log(`перед строкой 3: наибольший вес ${maxW().toFixed(2)} (до строки 0 -- ${w0.toFixed(2)}), |прогноз| ${maxPred()[0].toExponential(2)}`);
for (let c = 0; c < 5; c++) {
  if (c) for (let r = 1; r <= 960; r++) M.round(w);
  for (let r = 1; r <= 40; r++) lifeRec(pre);
  const Bm = LIN.build(w, C, 'LC'), e = LIN.eig([Bm])[0], wb = maxW();
  let mx = 0, mwho = null; for (let k = 1; k <= FF; k++) { M.freeRound(w); const [m, who] = maxPred(); if (m > mx) { mx = m; mwho = who; } }
  flag('свободная активность строки 3', c, mx, mwho);
  console.log(`строка 3 цикл ${c}: радиус ${e.r.toFixed(4)} (ведущий: ${share(e, Bm.parts)}), вес до ${wb.toFixed(2)}, после ${maxW().toFixed(2)}, |прогноз| в свободной активности ${mx.toExponential(2)}`);
  for (let r = 1; r <= 45; r++) lifeRec(r > 5 ? post : null);
}
const Rmix = (V - post.mix / post.nm) / (V - pre.mix / pre.nm), RS = (VS - post.S / post.nS) / (VS - pre.S / pre.nS);
// с шага 57: строка «3 длинная тишина» -- 3 цикла по 1000 кругов свободной активности
const preL = tacc(), postL = tacc();
for (let c = 0; c < 3; c++) {
  for (let r = 1; r <= 960; r++) M.round(w);
  for (let r = 1; r <= 40; r++) lifeRec(preL);
  for (let k = 1; k <= 1000; k++) M.freeRound(w);
  for (let r = 1; r <= 45; r++) lifeRec(r > 5 ? postL : null);
}
console.log(`RS ${RS.toFixed(6)}`);
const RmixL = (V - postL.mix / postL.nm) / (V - preL.mix / preL.nm), RSL = (VS - postL.S / postL.nS) / (VS - preL.S / preL.nS);
console.log([mode, seed, alive, f(st.right), f(st.nul), f(st.bits9), f(hold9), f(kept), chBits.map((x) => f(x, 3)).join(','),
  f(st.food ? st.food.share : NaN), f(Hs[10]), f(Hs[30]), f(Rmix), f(RS), f(RmixL), f(RSL), (Hs.s10 || []).map((x) => x.toFixed(6)).join(','), (Hs.s30 || []).map((x) => x.toFixed(6)).join(',')].join('\t'));

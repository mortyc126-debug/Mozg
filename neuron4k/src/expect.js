'use strict';
// Органы ожидания (мотор ожиданий, шаг М1 -- results/kolonia/ПЛАН_М1.md, ИССЛЕДОВАНИЕ_МОТОР.md; KEXP). Мозг сам находит
// события: круг, где польза (общий сигнал, без шума) изменилась больше чем в EVZ раз против её обычного изменения. Польза
// вернулась в следующем круге (скачок обратного знака, по величине от половины до двух) -- конец того же события (удар длится
// круг). Вид события (поправка ПЛАН_М1.md §7) -- знак скачка пользы и его величина ступенями по 4 раза; нерв с самым большим
// скачком только записывается (по нервам вид рассыпался: при смерти прыгают и «смерть», и сытость, и запахи). Меток нет. Вид, повторившийся EVMIN раз после круга FIRST, получает орган ожидания (видов с
// органом -- не больше MAXT). Орган -- как орган страха (src/fear.js): учит ожидаемые события своего вида с затуханием
// y(t) = сумма KFGAM^(k-1) событие(t+k) по нервам и их квадратам, выход -- товар «ожидание»; доход за ожидание -- в круг
// своего события KFPAY (среднее ожидание за BEFORE кругов до него - среднее вообще); кредит FCRED без налога до первой
// подгонки, кредитная линия MLOAN, банкротство -- новый орган через REBORN кругов. Правда мира (съел, умер, удар) мозгу не
// видна -- она только считается для мер (B.exp.tr, B.exp.tot).
// М2 (results/kolonia/ПЛАН_М2.md): цена вида w(x) = c0 + c x -- скачок пользы в круге события по нервам перед ним (все, кроме
// двигателя), гребень, подгонка после каждого события с PMIN-го. Цена принадлежит виду, не органу. В М2 она ни на что не
// влияет и работы не стоит (поведение -- как в М1 бит в бит); мера -- связь цены с настоящей сытостью и точность.
// MEXP=3 (М3г, ПЛАН_М3г.md): цена -- по нервам и их квадратам, w(x) = c0 + сумма (c_k x_k + d_k x_k²): прирост от еды по
// устройству мира квадратичен по сытости, и квадрат ловит «ноль при полной сытости».
// KEXP=2 (М3, results/kolonia/ПЛАН_М3.md §1 с поправкой §8): вид -- как в М1 (знак и величина скачка пользы); положительные
// события (еда, вода) внутри ступени величины делятся по прототипу набора скачков: нервы, у которых среднее за 3 круга после
// события (круг события и два следующих) отличается от среднего за 3 круга до него больше чем на JZ обычных разбросов этой
// разности, с её знаком. Событие идёт к виду своей ступени с самым похожим прототипом (взвешенный Жаккар по частотам
// «нерв-знак»), если похожесть не меньше JSIM; иначе -- новый вид; пустой набор -- к основе ступени. Вид назначается через
// 2 круга после события, и для органа событие -- в круге назначения. Видов с органом -- не больше MAXT2. KEXP=1 -- виды М1-М2.
// KEXP=3 (М3б, ПЛАН_М3б.md): положительные события делятся только по прототипу набора -- одна группа на все величины
// (вид -- «что», а «сколько» -- цена); отрицательные -- как при KEXP=2.
const { solve } = require('./linalg');
const LAG = 150, FIT = 200, BEFORE = 50, REBORN = 500, FCRED = 1500, FIRST = 1000, FORGET = 1 - 1 / 5000, EVZ = 10, EVMIN = 3, MAXT = 6, PMIN = 5, JZ = 4, JSIM = 0.3, MAXT2 = 8;

function openOrgan(B, T, d) {
  T.built++;
  T.org = B.led.open('ожидание', 'bank', FCRED, { d, A: new Float64Array(d * d), cv: new Float64Array(d), yy: 0, n: 0, w: null, ring: new Float64Array(LAG * d), dr: new Float64Array(LAG),
    fr: new Float64Array(BEFORE), fm: 0, fn: 0, born: B.t, mem: d * d + LAG * (d + 1) + BEFORE });
}

function step(B) {
  const cfg = B.cfg, W = B.world, G = B.goods, led = B.led, t = B.t;
  if (!B.exp) { if (B.ch.length < W.n) return; const ks = B.ch.filter((c) => c.k !== W.motorNerve).map((c) => c.k);
    B.exp = { ks, types: new Map(), sC: 0, nC: 0, sx: new Float64Array(B.ch.length), nx: 0, lastC: null, lastX: new Float64Array(B.ch.length), organs: 0,
      tot: { 'еда': 0, 'еда-мелкая': 0, 'вода': 0, 'вода-мелкая': 0, 'смерть': 0, 'укус': 0, 'удар': 0 }, hist: [], jd: new Float64Array(B.ch.length), jn: 0, pend: [], nid: 0 }; }
  const X = B.exp, C = W.comfort(), late = t > cfg.ROUNDS / 2;
  // правда мира для мер: что случилось в прошлом шаге мира
  const truth = W.died ? 'смерть' : W.biteNow ? 'укус' : W.ateNow >= 0.1 ? 'еда' : W.ateNow > 0 ? 'еда-мелкая' : W.drankNow >= 0.1 ? 'вода' : W.drankNow > 0 ? 'вода-мелкая' : W.painNow ? 'удар' : 'другое';   // еда почти сытым (прирост < 0.1) -- не событие по замыслу
  if (late && truth !== 'другое') X.tot[truth]++;
  // событие: скачок пользы; вид -- нерв с самым большим скачком
  let ev = null;
  if (X.lastC !== null) {
    const dC = C - X.lastC; let best = -1, bz = 0, bd = 0;
    for (const k of X.ks) { const dx = G.val[B.ch[k].good] - X.lastX[k], s = X.sx[k]; if (X.nx >= 50 && s > 0 && Math.abs(dx) / s > bz) { bz = Math.abs(dx) / s; best = k; bd = dx; }
      X.sx[k] += (Math.abs(dx) - X.sx[k]) / Math.min(X.nx + 1, 100); }
    X.nx++;
    const back = X.lastEv && X.lastEv.t === t - 1 && dC * X.lastEv.dC < 0 && Math.abs(dC) > 0.5 * Math.abs(X.lastEv.dC) && Math.abs(dC) < 2 * Math.abs(X.lastEv.dC);   // польза вернулась -- конец того же события
    if (cfg.KEXP >= 2) { if (X.nC >= 50 && Math.abs(dC) > EVZ * X.sC && !back) { X.pend.push({ t, dC, base: `${dC > 0 ? '+' : '-'}${Math.floor(Math.log(Math.abs(dC) / (EVZ * X.sC)) / Math.log(4))}`, truth: late ? truth : null, fp: X.ks.map((k) => X.lastX[k]) }); X.lastEv = { t, dC }; }
      else if (!back) { X.sC += (Math.abs(dC) - X.sC) / Math.min(X.nC + 1, 100); X.nC++; } }
    else if (X.nC >= 50 && Math.abs(dC) > EVZ * X.sC && !back) { const size = Math.floor(Math.log(Math.abs(dC) / (EVZ * X.sC)) / Math.log(4)), key = `${dC > 0 ? '+' : '-'}${size}`;
      let T = X.types.get(key); if (!T) X.types.set(key, T = { key, cnt: 0, org: null, good: -1, next: FIRST, deaths: 0, built: 0, paid: 0, tr: { 'еда': 0, 'еда-мелкая': 0, 'смерть': 0, 'удар': 0, 'другое': 0 }, nv: new Map(), ant: { B: 0, Bn: 0, A: 0, An: 0, buf: [] },
        pr: { A: new Float64Array((X.ks.length + 1) ** 2), cv: new Float64Array(X.ks.length + 1), yy: 0, n: 0, w: null }, ps: { rel: [], pS: 0, pN: 0, sp: 0, se: 0, spp: 0, see: 0, spe: 0, n: 0 } });
      T.cnt++; if (late) T.tr[truth]++; if (best >= 0) T.nv.set(best, (T.nv.get(best) || 0) + 1); ev = T; X.lastEv = { t, dC };
      // М2: цена -- предсказание до события (для меры), затем подгонка по нервам перед событием
      const P = T.pr, dp = X.ks.length + 1, fp = new Float64Array(dp); fp[0] = 1; for (let i = 0; i < X.ks.length; i++) fp[1 + i] = X.lastX[X.ks[i]];
      if (late && P.w) { let p = 0; for (let i = 0; i < dp; i++) p += P.w[i] * fp[i]; T.ps.rel.push(Math.abs(p - dC) / Math.abs(dC)); T.ps.pS += p; T.ps.pN++; }
      for (let i = 0; i < dp; i++) { P.cv[i] += fp[i] * dC; for (let j = 0; j < dp; j++) P.A[i * dp + j] += fp[i] * fp[j]; } P.yy += dC * dC; P.n++;
      if (P.n >= PMIN) { const mask = new Float64Array(dp).fill(1e-3); mask[0] = 0; const r = solve(P.A, P.cv, dp, P.yy, mask); if (r) P.w = Float64Array.from(r.w); } }
    else if (!back) { X.sC += (Math.abs(dC) - X.sC) / Math.min(X.nC + 1, 100); X.nC++; } }
  X.lastC = C; for (const k of X.ks) X.lastX[k] = G.val[B.ch[k].good];
  if (cfg.KEXP >= 2) ev = typeStep(B, X, t, late);
  // М2, мера: цена по нынешним нервам против настоящей сытости (мир знает), вторая половина жизни
  if (late && W.E !== undefined) for (const T of X.types.values()) { if (!T.pr.w) continue; const p = priceAt(cfg, T, X.ks.map((k) => X.lastX[k]));
    const s = T.ps, e = W.E; s.sp += p; s.se += e; s.spp += p * p; s.see += e * e; s.spe += p * e; s.n++; }
  // органы: рождение
  const d = 2 * X.ks.length + 1;
  for (const T of X.types.values()) if (!T.org && T.cnt >= EVMIN && t >= T.next && (T.built > 0 || X.organs < (cfg.KEXP >= 2 ? MAXT2 : MAXT))) { if (T.good < 0) { T.good = G.add('ожидание', 'world', -1, t); X.organs++; } openOrgan(B, T, d); }
  // признаки этого круга
  let f = null;
  for (const T of X.types.values()) { const o = T.org; if (!o) { if (T.good >= 0) G.val[T.good] = 0; continue; }
    if (!f) { f = new Float64Array(d); f[0] = 1; for (let i = 0; i < X.ks.length; i++) { const x = G.val[B.ch[X.ks[i]].good]; f[1 + 2 * i] = x; f[2 + 2 * i] = x * x; } }
    let psi = 0; if (o.w) for (let i = 0; i < d; i++) psi += o.w[i] * f[i];
    const mine = ev === T ? 1 : 0;
    // доход за ожидание
    if (mine && o.w && o.fn >= BEFORE) { let s = 0; for (let i = 0; i < BEFORE; i++) s += o.fr[i]; const pay = cfg.KFPAY * (s / BEFORE - o.fm);
      if (cfg.KECON && t > cfg.KCHILD) {}   // Э1: после детства доход за ожидание не платится
      else if (pay > 0) led.earn('world', o, pay, 'мир->ожидание: доход за ожидание'); else if (pay < 0) led.move(o, 'world', -pay, 'ожидание->мир: не ждал');
      T.paid += pay; }
    if (o.w) { o.fr[o.fn % BEFORE] = psi; o.fn++; o.fm += (psi - o.fm) / Math.min(o.fn, 5000); }
    G.val[T.good] = psi;
    // мера: ожидание за BEFORE кругов до своего события и в остальные круги (вторая половина жизни)
    if (late && o.w) { const a = T.ant; if (mine) { for (const v of a.buf) { a.B += v; a.Bn++; } a.buf = []; }
      a.buf.push(psi); if (a.buf.length > BEFORE) { a.A += a.buf.shift(); a.An++; } }
    // учёба: строка круга t - LAG получает цель -- события своего вида после неё
    const slot = t % LAG; o.dr[slot] = mine; o.n++;
    if (o.n > LAG) { const r = o.ring.subarray(slot * d, slot * d + d); let y = 0, g = 1;
      for (let k = 1; k < LAG; k++) { y += g * o.dr[(slot + k) % LAG]; g *= cfg.KFGAM; } y += g * mine;
      for (let i = 0; i < d * d; i++) o.A[i] *= FORGET; for (let i = 0; i < d; i++) o.cv[i] *= FORGET; o.yy = o.yy * FORGET + y * y;
      for (let i = 0; i < d; i++) { o.cv[i] += r[i] * y; for (let j = 0; j <= i; j++) o.A[i * d + j] += r[i] * r[j]; } }
    o.ring.set(f, slot * d);
    led.work(o, 2 * d * d + 2 * LAG + 2 * d);
    if (o.n > LAG + 1000 && (t - o.born) % FIT === 0) { const A = Float64Array.from(o.A); for (let i = 0; i < d; i++) for (let j = 0; j < i; j++) A[j * d + i] = A[i * d + j];
      const mask = new Float64Array(d).fill(1e-3); mask[0] = 0; const r = solve(A, o.cv, d, o.yy, mask); led.work(o, d * d * d); if (r) o.w = Float64Array.from(r.w); }
    // хозяйство -- как у органа страха
    o.age++; led.rent(o, cfg.RENT); o.inc = 0;
    if (o.w && o.credit > cfg.CAP) led.move(o, 'bank', o.credit - cfg.CAP, 'ожидание->банк: налог сверх потолка');
    o.hungry = o.credit < 0 ? o.hungry + 1 : 0;
    if (o.hungry > cfg.DIE && !(cfg.MLOAN && o.credit > -cfg.MLOAN)) { led.close(o); T.org = null; T.next = t + REBORN; T.deaths++; G.val[T.good] = 0; } }
}
// KEXP=2: история нервов, разброс разности средних, назначение вида событию двухкруговой давности
// признаки цены: [1, x] или (MEXP=3) [1, x, x²]
const priceDim = (cfg, n) => (cfg.MEXP === 3 ? 2 * n + 1 : n + 1);
function priceFeat(cfg, xs) { const n = xs.length, f = new Float64Array(priceDim(cfg, n)); f[0] = 1; for (let i = 0; i < n; i++) { f[1 + i] = xs[i]; if (cfg.MEXP === 3) f[1 + n + i] = xs[i] * xs[i]; } return f; }
function priceAt(cfg, T, xs) { const w = T.pr.w; if (!w) return null; const f = priceFeat(cfg, xs); let p = 0; for (let i = 0; i < f.length; i++) p += w[i] * f[i]; return p; }
function newType(X, key, cfg) {
  const dp = priceDim(cfg, X.ks.length);
  return { key, cnt: 0, org: null, good: -1, next: FIRST, deaths: 0, built: 0, paid: 0, tr: { 'еда': 0, 'еда-мелкая': 0, 'вода': 0, 'вода-мелкая': 0, 'смерть': 0, 'укус': 0, 'удар': 0, 'другое': 0 }, nv: new Map(), ant: { B: 0, Bn: 0, A: 0, An: 0, buf: [] },
    pr: { A: new Float64Array(dp * dp), cv: new Float64Array(dp), yy: 0, n: 0, w: null }, ps: { rel: [], pS: 0, pN: 0, sp: 0, se: 0, spp: 0, see: 0, spe: 0, n: 0 }, proto: new Map(), pn: 0 };
}
function typeStep(B, X, t, late) {
  X.hist.push(X.ks.map((k) => X.lastX[k])); if (X.hist.length > 6) X.hist.shift(); if (X.hist.length < 6) { X.pend = X.pend.filter((p) => p.t > t - 2); return null; }
  const n = X.ks.length, diff = new Float64Array(n);
  for (let i = 0; i < n; i++) diff[i] = (X.hist[3][i] + X.hist[4][i] + X.hist[5][i] - X.hist[0][i] - X.hist[1][i] - X.hist[2][i]) / 3;
  const p = X.pend.length && X.pend[0].t === t - 2 ? X.pend.shift() : null; X.pend = X.pend.filter((q) => q.t > t - 2);
  if (!p) { for (let i = 0; i < n; i++) X.jd[i] += (Math.abs(diff[i]) - X.jd[i]) / Math.min(X.jn + 1, 200); X.jn++; return null; }
  if (X.jn < 50) return null;
  const S = []; for (let i = 0; i < n; i++) if (Math.abs(diff[i]) > JZ * 1.25 * X.jd[i]) S.push(`${X.ks[i]}${diff[i] > 0 ? '+' : '-'}`);
  let T = null, bs = -1;
  const grp = (B.cfg.KEXP === 3 && p.dC > 0) || B.cfg.KEXP === 4 ? (p.dC > 0 ? '+' : '-') : p.base;   // KEXP=3: положительные -- одна группа на все величины; 4 -- и отрицательные (Э4)
  if ((p.dC > 0 || B.cfg.KEXP === 4) && S.length) { for (const Q of X.types.values()) { if (Q.base !== grp || !Q.pn) continue; let inS = 0, all = 0; for (const [j, c] of Q.proto) { all += c / Q.pn; if (S.includes(j)) inS += c / Q.pn; }
      const sim = inS / (all + S.length - inS); if (sim > bs) { bs = sim; T = Q; } }
    if (!T || bs < JSIM) { T = newType(X, `${grp}.${X.nid++}`, B.cfg); T.base = grp; X.types.set(T.key, T); } }
  else { T = X.types.get(grp); if (!T) { T = newType(X, grp, B.cfg); T.base = grp; X.types.set(T.key, T); } }
  T.pn++; for (const j of S) T.proto.set(j, (T.proto.get(j) || 0) + 1);
  T.cnt++; if (late && p.truth) T.tr[p.truth]++;
  if (B.cfg.MEXP === 4) { (T.evs || (T.evs = [])).push([p.fp, p.dC]); if (T.evs.length > 300) T.evs.shift(); }   // М3д: события для цены по нерву нужды
  // цена (М2) -- по нервам перед событием
  const P = T.pr, fp = priceFeat(B.cfg, p.fp), dp = fp.length;
  if (late && P.w) { let q = 0; for (let i = 0; i < dp; i++) q += P.w[i] * fp[i]; T.ps.rel.push(Math.abs(q - p.dC) / Math.abs(p.dC)); T.ps.pS += q; T.ps.pN++; }
  for (let i = 0; i < dp; i++) { P.cv[i] += fp[i] * p.dC; for (let j = 0; j < dp; j++) P.A[i * dp + j] += fp[i] * fp[j]; } P.yy += p.dC * p.dC; P.n++;
  if (P.n >= PMIN) { const mask = new Float64Array(dp).fill(1e-3); mask[0] = 0; const r = solve(P.A, P.cv, dp, P.yy, mask); if (r) P.w = Float64Array.from(r.w); }
  return T;
}
// итог для мер: виды событий с правдой и ожиданием
function summary(B, kinds) {
  const X = B.exp; if (!X) return null;
  return { tot: X.tot, types: [...X.types.values()].map((T) => ({ key: T.key, nerve: T.nv.size ? kinds[[...T.nv.entries()].sort((a, b) => b[1] - a[1])[0][0]] : null, cnt: T.cnt, built: T.built, deaths: T.deaths, alive: !!T.org, paid: T.paid, tr: T.tr,
    antB: T.ant.Bn ? T.ant.B / T.ant.Bn : null, antA: T.ant.An ? T.ant.A / T.ant.An : null, price: priceSum(T),
    proto: T.proto ? [...T.proto.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([j, c]) => `${kinds[parseInt(j, 10)]}${j.slice(-1)} ${(c / T.pn).toFixed(2)}`) : undefined,
    goal: T.goal ? { rounds: T.goal.rounds, fits: T.goal.fits, F: +T.goal.F.toFixed(2) } : undefined, sig: T.sig ? T.sig.map((k) => kinds[k]) : undefined,
    need: T.need ? { nerve: kinds[T.need.k], c: T.need.c.map((x) => +x.toFixed(3)) } : undefined })), goals: X.goalRounds || null };
}
function priceSum(T) {
  const s = T.ps, rel = s.rel.slice().sort((a, b) => a - b), den = Math.sqrt((s.n * s.spp - s.sp * s.sp) * (s.n * s.see - s.se * s.se));
  return { n: T.pr.n, corrE: s.n > 2 && den > 0 ? (s.n * s.spe - s.sp * s.se) / den : null, predMean: s.pN ? s.pS / s.pN : null, relMed: rel.length ? rel[rel.length >> 1] : null };
}
module.exports = { step, summary, priceAt };

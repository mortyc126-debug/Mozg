'use strict';
// Орган клонов (PLAN.md, п. 3.5) -- четвёртая заготовка строителя памяти. Граф клонов -- скрытая марковская модель, где у
// каждого знака C своих скрытых состояний-«клонов» (Dedieu et al. 2019, Raju et al. 2024): клон помнит, в каком контексте
// знак встретился, и так модель держит контексты любой длины, не храня их списком.
//
// Мозг не знает, что нервы -- знаки одного потока. Строитель сам находит «нервы одного выбора»: двузначные нервы (у каждого
// два уровня), из которых в каждом круге высок ровно один (catGroup). Знак круга -- какой из них высок; ни один -- «прочее»
// (редкие знаки, которых на записи не было). Строит орган, только если поток знаков вообще предсказуем по прошлому: пары
// «знак -> следующий» на чётных кругах записи объясняют нечётные (и наоборот) лучше частот хотя бы на CGAIN бита; в мире
// цифр десять меток -- тоже «нервы одного выбора», но цифры идут наугад, и органа нет.
//
// Орган каждый круг: вера в клоны нынешнего знака (проход вперёд, C x C), ответ -- вероятность каждого знака в следующем
// круге, товар на канал: ожидаемое значение нерва (нижний уровень + вероятность x размах). Учёба -- Баум -- Велш по своему
// архиву знаков (до CARCH): при постройке CEMI0 проходов по записи, потом проход раз в CEMEV кругов. Счёт переходов хранится
// блоками C x C только для встреченных пар знаков. Орган -- участник рынка, как другие органы памяти: аренда за ячейки и
// работу, роялти от частей, доля прибыли строителю.

// ---------------------------------------------------------------- нервы одного выбора
function catGroup(B) {
  const cfg = B.cfg, G = B.goods, T = B.t, t0 = Math.max(1, T - cfg.H + 1), n = T - t0 + 1;
  if (n < 300) return null;
  const bin = [];
  for (const q of B.ch) {
    const v = new Float64Array(n); for (let t = t0; t <= T; t++) v[t - t0] = G.at(t, q.good);
    let lo = Infinity, hi = -Infinity; for (const x of v) { if (x < lo) lo = x; if (x > hi) hi = x; }
    if (!(hi - lo > 1e-6)) continue;
    // два уровня: медианы ниже и выше середины, близко к ним -- почти все значения
    for (let it = 0; it < 2; it++) { const mid = (lo + hi) / 2, a = [], b = []; for (const x of v) (x > mid ? b : a).push(x);
      if (!a.length || !b.length) break; a.sort((x, y) => x - y); b.sort((x, y) => x - y); lo = a[a.length >> 1]; hi = b[b.length >> 1]; }
    const r = hi - lo, mid = (lo + hi) / 2; if (!(r > 1e-6)) continue;
    let near = 0, up = 0; for (const x of v) { if (Math.abs(x - lo) < 0.25 * r || Math.abs(x - hi) < 0.25 * r) near++; if (x > mid) up++; }
    if (near >= 0.97 * n && up > 0 && up < 0.6 * n) bin.push({ k: q.k, lo, hi, mid, h: v.map((x) => (x > mid ? 1 : 0)) });
  }
  B.led.work(B.mem.agent, n * B.ch.length * 6);
  // жадно: убирать нерв, без которого больше кругов «высок ровно один», пока таких не станет 97%
  let S = bin.slice();
  const frac = (S) => { let ok = 0; for (let i = 0; i < n; i++) { let s = 0; for (const x of S) s += x.h[i]; if (s === 1) ok++; } return ok / n; };
  let f = frac(S);
  while (S.length >= 3 && f < 0.97) { let bi = -1, bf = -1; for (let i = 0; i < S.length; i++) { const g = frac(S.filter((_, j) => j !== i)); if (g > bf) { bf = g; bi = i; } }
    S.splice(bi, 1); f = bf; }
  B.led.work(B.mem.agent, n * bin.length * bin.length);
  if (S.length < 3 || f < 0.97) return null;
  S.sort((x, y) => x.k - y.k);
  return { ks: S.map((x) => x.k), lo: S.map((x) => x.lo), hi: S.map((x) => x.hi), mid: S.map((x) => x.mid), frac: f };
}
// знак круга t (или нынешний): какой нерв группы высок сильнее всех; ни один -- «прочее» (номер ks.length)
function symAt(B, g, t) { const G = B.goods; let best = g.ks.length, bv = 0;
  for (let i = 0; i < g.ks.length; i++) { const v = t === undefined ? G.val[B.ch[g.ks[i]].good] : G.at(t, B.ch[g.ks[i]].good), z = (v - g.mid[i]) / (g.hi[i] - g.lo[i]); if (z > bv) { bv = z; best = i; } }
  return best; }
// предсказуем ли поток по прошлому знаку: пары «знак -> следующий» против частот, каждая пара -- по всем остальным парам
// записи (без себя самой); бит на знак и его z (в мире цифр метки идут наугад -- выигрыш меньше нуля)
function bigramGain(B, g) {
  const cfg = B.cfg, T = B.t, t0 = Math.max(1, T - cfg.H + 1), A = g.ks.length + 1, s = [];
  for (let t = t0; t <= T; t++) s.push(symAt(B, g, t));
  const nab = new Float64Array(A * A), na = new Float64Array(A), nb = new Float64Array(A); let n = 0;
  for (let i = 0; i + 1 < s.length; i++) { nab[s[i] * A + s[i + 1]]++; na[s[i]]++; nb[s[i + 1]]++; n++; }
  const be = 2; let m1 = 0, m2 = 0;
  for (let i = 0; i + 1 < s.length; i++) { const a = s[i], b = s[i + 1], pu = (nb[b] - 1 + 0.5) / (n - 1 + 0.5 * A), pb = (nab[a * A + b] - 1 + be * pu) / (na[a] - 1 + be), x = Math.log2(pb / pu); m1 += x; m2 += x * x; }
  B.led.work(B.mem.agent, s.length * 8);
  const mu = m1 / n, sd = Math.sqrt(Math.max(1e-12, m2 / n - mu * mu));
  return mu * Math.sqrt(n) / sd > 3 ? mu : Math.min(mu, 0);
}

// ---------------------------------------------------------------- модель
const blk = (o, a, b) => o.N.get(a * o.A + b);
// производные счёта: у каждого клона -- всего исходов и исходов по знакам; частоты знаков
function derive(o) {
  const A = o.A, C = o.C; o.tot.fill(0); o.S.fill(0); const u = new Float64Array(A).fill(0.5); let nu = 0.5 * A;
  for (const [key, M] of o.N) { const a = Math.floor(key / A), b = key % A;
    for (let c = 0; c < C; c++) { let s = 0; for (let j = 0; j < C; j++) s += M[c * C + j]; o.S[(a * C + c) * A + b] += s; o.tot[a * C + c] += s; u[b] += s; nu += s; } }
  o.ucnt = u; o.unu = nu; o.u = u.map((x) => x / nu); o.cells = o.N.size * C * C;
  // сглаживание клона -- к паре знаков «a -> b» (а она -- к частотам): у клона исходов мало, у знака -- в C раз больше
  const bg = o.bg || (o.bg = new Float64Array(A * A));
  for (let a = 0; a < A; a++) { let ta = 0; for (let c = 0; c < C; c++) ta += o.tot[a * C + c];
    for (let b = 0; b < A; b++) { let sb = 0; for (let c = 0; c < C; c++) sb += o.S[(a * C + c) * A + b]; bg[a * A + b] = (sb + o.u[b]) / (ta + 1); } }
}
// матрица шага a -> b: M[c, j] = P(b | клон c знака a) x P(клон j | c, b)
function stepM(o, a, b) {
  const A = o.A, C = o.C, cfg = o.cfg, be = cfg.CBETA, ga = cfg.CGAM, M = new Float64Array(C * C), N = blk(o, a, b);
  for (let c = 0; c < C; c++) { const s = (a * C + c), pb = (o.S[s * A + b] + be * o.bg[a * A + b]) / (o.tot[s] + be);
    if (N) { const den = o.S[s * A + b] + C * ga; for (let j = 0; j < C; j++) M[c * C + j] = pb * (N[c * C + j] + ga) / den; }
    else for (let j = 0; j < C; j++) M[c * C + j] = pb / C; }
  return M;
}
// один проход Баума -- Велша по архиву: счёт переходов заново (ожидаемый по нынешней модели)
function emPass(o, seq, step = null) {
  const A = o.A, C = o.C, L = seq.length; if (L < 3) return 0;
  const cache = new Map(), getM = (a, b) => { const k = a * A + b; let M = cache.get(k); if (!M) { M = stepM(o, a, b); cache.set(k, M); } return M; };
  const al = new Float64Array(L * C), sc = new Float64Array(L); let ll = 0;
  for (let j = 0; j < C; j++) al[j] = 1 / C; sc[0] = 1;
  for (let t = 1; t < L; t++) { const M = getM(seq[t - 1], seq[t]), p = (t - 1) * C, q = t * C; let s = 0;
    for (let j = 0; j < C; j++) { let v = 0; for (let c = 0; c < C; c++) v += al[p + c] * M[c * C + j]; al[q + j] = v; s += v; }
    s = Math.max(s, 1e-300); for (let j = 0; j < C; j++) al[q + j] /= s; sc[t] = s; ll += Math.log2(s); }
  const E = new Map(); let be = new Float64Array(C).fill(1), nb = new Float64Array(C);
  for (let t = L - 1; t >= 1; t--) { const a = seq[t - 1], b = seq[t], M = getM(a, b), p = (t - 1) * C, k = a * A + b;
    let X = E.get(k); if (!X) { X = new Float64Array(C * C); E.set(k, X); }
    for (let c = 0; c < C; c++) { const ac = al[p + c] / sc[t]; let v = 0; for (let j = 0; j < C; j++) { const m = M[c * C + j] * be[j]; X[c * C + j] += ac * m; v += m; } nb[c] = v / sc[t]; }
    [be, nb] = [nb, be]; }
  let ops = 4 * C * C * L + cache.size * C * C;
  if (!step) o.N = E;
  else {                                     // пошаговый Баум -- Велш (Liang, Klein 2009): счёт -- смесь старого и окна, окно -- в масштабе архива
    const { eta, scale } = step;
    for (const [k, X] of o.N) { if (!E.has(k)) { for (let q = 0; q < X.length; q++) X[q] *= 1 - eta; } }
    for (const [k, X] of E) { let Y = o.N.get(k); if (!Y) { Y = new Float64Array(C * C); o.N.set(k, Y); } for (let q = 0; q < X.length; q++) Y[q] = (1 - eta) * Y[q] + eta * scale * X[q]; }
    for (const [k, Y] of o.N) { let s = 0; for (let q = 0; q < Y.length; q++) s += Y[q]; if (s < 1e-3) o.N.delete(k); }
    ops += o.N.size * C * C * 2; }
  derive(o);
  return { ll: -ll / (L - 1), ops };
}

// ---------------------------------------------------------------- орган
function buildClones(B, g, gain) {
  const cfg = B.cfg, G = B.goods, M = B.mem, a = M.agent, T = B.t, t0 = Math.max(1, T - cfg.H + 1);
  const A = g.ks.length + 1, C = cfg.CLC;
  const o = B.led.open('память', a, cfg.CCRED, { type: 'клоны', key: `клоны ${M.built}`, ...g, A, C, cfg, payTo: false, incLast: 0, born: T, client: g.ks[0],
    cap: cfg.CCRED, N: new Map(), tot: new Float64Array(A * C), S: new Float64Array(A * C * A), u: new Float64Array(A).fill(1 / A), cells: 0,
    arch: new Uint8Array(cfg.CARCH), n: 0, al: new Float64Array(C).fill(1 / C), cur: -1, P: new Float64Array(A).fill(1 / A), Pk: null, mem: 8 });
  // архив -- знаки записи; счёт для начала -- по встреченным парам, с разбросом по клонам (иначе клоны одинаковы навсегда)
  for (let t = t0; t <= T; t++) o.arch[o.n++ % cfg.CARCH] = symAt(B, g, t);
  const seq = Array.from(o.arch.subarray(0, o.n));
  for (let i = 0; i + 1 < seq.length; i++) { const k = seq[i] * A + seq[i + 1]; let X = o.N.get(k); if (!X) { X = new Float64Array(C * C); for (let q = 0; q < C * C; q++) X[q] = (0.5 + B.rng()) / (C * C); o.N.set(k, X); } else for (let q = 0; q < C * C; q++) X[q] += (0.5 + B.rng()) / (C * C); }
  derive(o);
  o.bc = new Float64Array(A * A); o.bn = new Float64Array(A); for (let i = 0; i + 1 < seq.length; i++) { o.bc[seq[i] * A + seq[i + 1]]++; o.bn[seq[i]]++; }
  o.lw = [0, 0]; o.sC = 0; o.sB = 0; o.sM = 0; o.sN = 0;
  let ops = 0, r = null; for (let i = 0; i < cfg.CEMI0; i++) { r = emPass(o, seq); ops += r.ops; }
  B.led.work(a, ops);
  o.llFit = r ? r.ll : NaN; o.nLast = seq.length; o.tLast = T;
  // вера -- по проходу записи
  o.cur = seq[seq.length - 1]; o.al.fill(1 / C); predict(o);
  o.outs = g.ks.map((k) => G.add('память', o, -1, T));
  o.Pk = new Float64Array(B.ch.length).fill(o.P[A - 1] / Math.max(1, B.ch.length - g.ks.length));
  for (let i = 0; i < g.ks.length; i++) { G.val[o.outs[i]] = g.lo[i] + o.P[i] * (g.hi[i] - g.lo[i]); o.Pk[g.ks[i]] = o.P[i]; }
  M.organs.push(o); M.keys.add(o.key); M.built++;
  M.log.push(`круг ${T}: нервы одного выбора -- ${g.ks.length} (высок ровно один в ${(100 * g.frac).toFixed(0)}% кругов), поток предсказуем по прошлому знаку на ${gain.toFixed(2)} бита -- орган «${o.key}», клонов ${C} на знак (запись: ${o.llFit.toFixed(2)} бита на знак)`);
  return o;
}
// ответ: смесь графа клонов и пар знаков, которые орган считает и онлайн (вес -- по недавним битам каждого; граф клонов
// на малом архиве переучен и сначала хуже пар -- без смеси части бросали орган, и он разорялся, не дождавшись данных)
function predict(o) {
  const A = o.A, C = o.C, a = o.cur, P = o.P, Pc = o.Pc || (o.Pc = new Float64Array(A)), Pb = o.Pb || (o.Pb = new Float64Array(A)); Pc.fill(0);
  if (a < 0) { P.set(o.u); Pc.set(o.u); Pb.set(o.u); return; }
  for (let c = 0; c < C; c++) { const s = a * C + c, w = o.al[c] / (o.tot[s] + o.cfg.CBETA); if (!(w > 0)) continue;
    for (let b = 0; b < A; b++) Pc[b] += w * (o.S[s * A + b] + o.cfg.CBETA * o.bg[a * A + b]); }
  let z = 0; for (let b = 0; b < A; b++) z += Pc[b]; for (let b = 0; b < A; b++) Pc[b] /= z || 1;
  const bc = o.bc, na = o.bn[a]; for (let b = 0; b < A; b++) Pb[b] = (bc[a * A + b] + o.u[b]) / (na + 1);
  const m = Math.max(o.lw[0], o.lw[1]), w0 = Math.exp(o.lw[0] - m), w1 = Math.exp(o.lw[1] - m), lam = w0 / (w0 + w1);
  for (let b = 0; b < A; b++) P[b] = lam * Pc[b] + (1 - lam) * Pb[b];
  o.lam = lam;
}
// круг органа: знак этого круга -> вера в его клоны -> ответ о следующем; раз в CEMEV кругов -- проход учёбы по архиву
function cloneStep(B, o) {
  const cfg = B.cfg, G = B.goods, A = o.A, C = o.C, b = symAt(B, o);
  let ops = 0;
  if (o.cur >= 0) { const a = o.cur, M = stepM(o, a, b), nal = new Float64Array(C); let s = 0;
    for (let j = 0; j < C; j++) { let v = 0; for (let c = 0; c < C; c++) v += o.al[c] * M[c * C + j]; nal[j] = v; s += v; }
    // CONL: счёт переходов и онлайн -- по вере вперёд (без прохода назад): дёшево, C x C за знак
    if (cfg.CONL && s > 0) { const k = a * A + b; let X = o.N.get(k); if (!X) { X = new Float64Array(C * C); o.N.set(k, X); o.cells += C * C; }
      for (let c = 0; c < C; c++) { let r = 0; const ac = o.al[c] / s; for (let j = 0; j < C; j++) { const x = ac * M[c * C + j]; X[c * C + j] += x; r += x; } o.S[(a * C + c) * A + b] += r; o.tot[a * C + c] += r; }
      o.ucnt[b]++; o.unu++; o.u[b] = o.ucnt[b] / o.unu;
      let ta = 0; for (let c = 0; c < C; c++) ta += o.tot[a * C + c];
      for (let bb = 0; bb < A; bb++) { let sb = 0; for (let c = 0; c < C; c++) sb += o.S[(a * C + c) * A + bb]; o.bg[a * A + bb] = (sb + o.u[bb]) / (ta + 1); }
      ops += 2 * C * C + 2 * A * C; }
    for (let j = 0; j < C; j++) nal[j] = s > 0 ? nal[j] / s : 1 / C; o.al = nal; ops += 2 * C * C; }
  if (o.cur >= 0) { const a = o.cur; o.lw[0] = 0.995 * o.lw[0] + Math.log(Math.max(1e-9, o.Pc[b])); o.lw[1] = 0.995 * o.lw[1] + Math.log(Math.max(1e-9, o.Pb[b]));
    o.bc[a * A + b]++; o.bn[a]++; o.sC -= Math.log2(Math.max(1e-9, o.Pc[b])); o.sB -= Math.log2(Math.max(1e-9, o.Pb[b])); o.sM -= Math.log2(Math.max(1e-9, o.P[b])); o.sN++; }
  o.cur = b; o.arch[o.n++ % cfg.CARCH] = b;
  // когда учиться: CEMG > 1 -- когда архив вырос в CEMG раз с прошлой учёбы (CEMK проходов), иначе раз в CEMEV кругов
  const due = cfg.CEMG > 1 ? Math.min(o.n, cfg.CARCH) >= cfg.CEMG * (o.nLast || 1) || (o.n >= cfg.CARCH && B.t - (o.tLast || 0) >= cfg.CEMEV) : B.t - (o.tLast || o.born) >= cfg.CEMEV;
  if (due) for (let it = 0; it < (cfg.CEMG > 1 ? cfg.CEMK : 1); it++) {
    o.nLast = Math.min(o.n, cfg.CARCH); o.tLast = B.t;
    // CEMW = 0: проход по всему архиву; иначе -- шаг по последним CEMW знакам (дешевле в CARCH / CEMW раз)
    // учиться -- на свои: проход по стольким последним знакам архива, сколько орган оплатит сверх долга за прошлую работу
    const afford = Math.floor((o.credit - cfg.PCPU * ((o.owe || 0) + o.opsRound)) / (cfg.PCPU * 4 * C * C));
    const L = Math.min(o.n, cfg.CEMW || cfg.CARCH, cfg.CARCH, cfg.CPAYS ? afford : Infinity), seq = new Array(Math.max(0, L));
    if (L < 300) { o.tLast = B.t - cfg.CEMEV + 100; o.skips = (o.skips || 0) + 1; break; }
    o.Llast = L; for (let i = 0; i < L; i++) seq[i] = o.arch[(o.n - L + i) % cfg.CARCH];
    o.k = (o.k || 0) + 1;
    const step = cfg.CEMW ? { eta: Math.max(Math.pow(o.k + 2, -0.7), cfg.CEMEV / cfg.CARCH), scale: Math.min(o.n, cfg.CARCH) / Math.max(1, L - 1) } : null;
    const r = emPass(o, seq, step); ops += r.ops; o.llFit = r.ll; }
  predict(o); ops += C * A + 3 * A;
  o.Pk.fill(o.P[A - 1] / Math.max(1, B.ch.length - o.ks.length));   // «прочее» -- поровну нервам вне группы
  for (let i = 0; i < o.ks.length; i++) { G.val[o.outs[i]] = o.lo[i] + o.P[i] * (o.hi[i] - o.lo[i]); o.Pk[o.ks[i]] = o.P[i]; }
  o.mem = 8 + o.cells + Math.ceil(cfg.CARCH / 8) + A * C * (A + 1) + A * (A + 1);
  B.led.work(o, ops);
}

// ---------------------------------------------------------------- орган контекстов
// Вторая заготовка для потока знаков (как память контекста правок 31-32 нейрона-3): счёт «после каких L последних знаков
// что шло» для L = 0..CTXL, ответ -- интерполяция Виттена -- Белла от короткого контекста к длинному. Учится каждый круг
// (один счёт на длину), прохода по архиву нет -- дёшево, но памяти столько, сколько встретилось разных контекстов.
// Рынок выбирает между ним и графом клонов: оба продают по товару на нерв группы, оба живут на роялти.
function buildCtx(B, g, gain) {
  const cfg = B.cfg, G = B.goods, M = B.mem, a = M.agent, T = B.t, t0 = Math.max(1, T - cfg.H + 1), A = g.ks.length + 1;
  const o = B.led.open('память', a, cfg.CCRED, { type: 'контекст', key: `контекст ${M.built}`, ...g, A, cfg, payTo: false, incLast: 0, born: T, client: g.ks[0], cap: cfg.CCRED,
    tabs: Array.from({ length: cfg.CTXL + 1 }, () => new Map()), hist: [], cells: 0, P: new Float64Array(A).fill(1 / A), Pk: null, mem: 8 });
  for (let t = t0; t <= T; t++) ctxLearn(o, symAt(B, g, t));
  ctxPredict(o);
  o.outs = g.ks.map(() => G.add('память', o, -1, T));
  o.Pk = new Float64Array(B.ch.length).fill(o.P[A - 1] / Math.max(1, B.ch.length - g.ks.length));
  for (let i = 0; i < g.ks.length; i++) { G.val[o.outs[i]] = g.lo[i] + o.P[i] * (g.hi[i] - g.lo[i]); o.Pk[g.ks[i]] = o.P[i]; }
  B.led.work(a, (T - t0) * (cfg.CTXL + 1) * 4);
  M.organs.push(o); M.keys.add(o.key); M.built++;
  M.log.push(`круг ${T}: нервы одного выбора -- ${g.ks.length}, поток предсказуем по прошлому знаку на ${gain.toFixed(2)} бита -- орган «${o.key}», контексты до ${cfg.CTXL} знаков`);
  return o;
}
const ctxKey = (h, L) => { let k = L; for (let j = h.length - L; j < h.length; j++) k = k * 64 + h[j] + 1; return k; };
function ctxLearn(o, x) {
  const h = o.hist;
  for (let L = 0; L <= o.cfg.CTXL && L <= h.length; L++) { const key = ctxKey(h, L), tab = o.tabs[L];
    let e = tab.get(key); if (!e) { e = { n: 0, c: new Map() }; tab.set(key, e); o.cells += 2; }
    if (!e.c.has(x)) o.cells += 2; e.n++; e.c.set(x, (e.c.get(x) || 0) + 1); }
  h.push(x); if (h.length > o.cfg.CTXL) h.shift();
}
function ctxPredict(o) {
  const A = o.A, P = o.P, h = o.hist; P.fill(1 / A);
  for (let L = 0; L <= o.cfg.CTXL && L <= h.length; L++) { const e = o.tabs[L].get(ctxKey(h, L)); if (!e) break;
    const u = e.c.size; for (let b = 0; b < A; b++) P[b] = ((e.c.get(b) || 0) + u * P[b]) / (e.n + u); }
}
function ctxStep(B, o) {
  const G = B.goods, b = symAt(B, o), A = o.A;
  ctxLearn(o, b); ctxPredict(o);
  o.Pk.fill(o.P[A - 1] / Math.max(1, B.ch.length - o.ks.length));
  for (let i = 0; i < o.ks.length; i++) { G.val[o.outs[i]] = o.lo[i] + o.P[i] * (o.hi[i] - o.lo[i]); o.Pk[o.ks[i]] = o.P[i]; }
  o.mem = 8 + o.cells; B.led.work(o, (o.cfg.CTXL + 1) * (A + 6));
}
module.exports = { catGroup, bigramGain, buildClones, cloneStep, symAt, buildCtx, ctxStep };

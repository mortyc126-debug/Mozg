'use strict';
// Органы памяти по спросу (нейрон-4; как органы-программы правок 73-74 нейрона-3, но участники того же рынка с той же книгой).
// Строитель памяти рождается по нужде (есть плохо понятые каналы) с кредитом от банка. Раз в MSCAN кругов он берёт самые
// плохо понятые каналы, которые давно не смотрел (по одному на MDUE таких, не больше MPER), и примеряет по записи две заготовки:
//   кольцо    «нерв j d кругов назад» (d = 1..MDMAX): товар -- значение нерва j d кругов назад; ячеек памяти -- d + 1;
//   таблица   «что шло за таким же уровнем нерва j»: уровни нерва j -- по разрывам в его значениях на записи (иначе 8 долей
//             поровну); в ячейке уровня -- значение канала в круге после последнего такого уровня; ячеек -- число уровней.
//   похожесть «что шло после самых похожих прошлых кругов» (хэш-память правки 68 нейрона-3): ключи -- до SIMKM нервов, сильнее
//             всех связанных с каналом кругом позже (вес -- |корреляция|); свой архив до SIMA кругов; поиск -- SIMT хэш-таблиц по
//             SIMB знаков случайных проекций, в ячейке -- SIMSL последних кругов; ответ -- среднее канала после SIMK самых
//             похожих. Орган растёт по спросу: если у другого плохо понятого канала ключи во многом те же (SIMSHARE и больше),
//             строитель не строит новый орган, а добавляет этому выход (десять меток мира цифр читают одни и те же пиксели).
//   клоны    граф клонов для потока знаков (src/clones.js): строитель сам находит «нервы одного выбора» и проверяет, что
//             поток предсказуем по прошлому знаку; один орган на группу, товар -- на каждый её нерв.
// Примерка: доля остатка канала, объяснённая товаром на чётных кругах, и проверка на нечётных (с одним знаком). Лучший, если
// он объясняет больше MGAIN, становится органом: строитель платит за постройку, прогревает товар по записи (его прошлые
// значения пишутся в запись -- части могут проверить его сразу, урок PRWARM правки 73) и приносит его частям канала-заказчика
// (адресная доставка, урок PRDIR правки 74). Орган платит аренду за ячейки и работу, получает роялти от тех, кто его читает,
// отдаёт долю строителю; в долгу дольше DIE кругов -- умирает. Неудачная примерка -- канал откладывается (вдвое дольше).
const { solve } = require('./linalg');
const CL = require('./clones');
const CP = require('./compose');

function init(B) { B.mem = { agent: null, organs: [], built: 0, scanned: 0, log: [], keys: new Set() }; B.orgGoods = []; }

// насколько канал не понят: лучшая ошибка частей против разброса канала (1 -- никто ничего не объяснил)
function unexplained(B, c) { let e = 1; for (const p of c.parts) if (p.age > 50) e = Math.min(e, p.mse / Math.max(c.var, 1e-9)); return e; }   // ошибка прогноза в жизни, а не подгонки на той же записи: с 16 входами подгонка подстраивается под шум

// товары органов этого круга -- до записи
function sell(B) {
  const G = B.goods;
  for (const o of B.mem.organs) {
    if (o.type === 'похожесть') { simStep(B, o); continue; }
    if (o.type === 'клоны') { CL.cloneStep(B, o); continue; }
    if (o.type === 'контекст') { CL.ctxStep(B, o); continue; }
    if (o.type === 'пара') { G.val[o.good] = paraStep(o, (k) => G.val[B.ch[k].good]); B.led.work(o, 2 + o.K.length); continue; }
    if (o.type === 'сборка') { G.val[o.good] = o.f((k) => G.val[B.ch[k].good]); B.led.work(o, o.size); continue; }
    if (o.type === 'последний') { lastStep(o, (k) => G.val[B.ch[k].good]); if (o.offer) offerOut(o, (i, v) => { G.val[o.outs[i]] = v; }); else for (let i = 0; i < o.outs.length; i++) G.val[o.outs[i]] = lastOut(o, i, (k) => G.val[B.ch[k].good]); if (!o.free) B.led.work(o, 2 + 2 * o.X.length); continue; }
    if (o.type === 'защёлка' || o.type === 'след') { G.val[o.good] = wmStep(o, o.xo ? wmConc(G, o.xo) : G.val[B.ch[o.x].good], G.val[B.ch[o.g].good], o.h >= 0 ? G.val[B.ch[o.h].good] : 0); B.led.work(o, 3); continue; }
    if (o.type === 'кольцо') G.val[o.good] = o.d === 0 ? G.val[B.ch[o.j].good] : G.at(B.t - o.d, B.ch[o.j].good);
    else { const kg = B.ch[o.j].good, tg = B.ch[o.k].good;
      if (o.prevBin >= 0 && o.prevP > 0.9) o.last[o.prevBin] = G.val[tg];   // за уровнем прошлого круга шло вот это
      const [y, bin, pr] = softRead(o, G.val[kg]); o.prevBin = bin; o.prevP = pr; G.val[o.good] = y; }
    B.led.work(o, 2);
  }
}
// рабочая память (WMEM=1) -- две заготовки на пару нервов (что x, когда g):
//   защёлка  «x в последний раз, когда был g»: держит значение x, снятое в круге события g, до следующего g (что видел
//            родитель, когда смотрел в последний раз); может читаться только в круге события h (когда спросили «где?»);
//   след     «g сейчас и x недавно»: след события x гаснет за круг в WLAM раз; товар -- след x в круге события g (о чём
//            говорили до вопроса «что было?»).
function wmStep(o, x, g, h) {
  if (o.type === 'защёлка') { if (g > o.mg) o.v = x; return o.h >= 0 && o.h !== undefined ? (h > o.mh ? o.v : 0) : o.v; }
  if (o.xo) o.tr = x !== 0 ? x : o.lam * o.tr;   // содержимое -- понятие: след несёт его значение со знаком («куда»)
  else o.tr = Math.max(x > o.mx ? 1 : 0, o.lam * o.tr);
  return g > o.mg ? o.tr : 0;
}
// PARA=1 -- пара (связь с одного раза): слова группы X (взаимоисключающие: «вверх» / «вниз») звучат вместе со словами-ключами K
// («имя 0» ... «имя 3»). Орган запоминает для каждого ключа, какое слово группы прозвучало с ним в последний раз, и когда ключ
// звучит один, вспоминает: товар -- 1, если с этим ключом в последний раз звучало слово m группы. Одного раза хватает: «имя 2
// вверх» -- и через сколько угодно кругов «имя 2» напомнит «вверх», пока о нём не скажут другое.
function lastStep(o, val) {
  for (let i = 0; i < o.X.length; i++) if (val(o.X[i][0]) > o.X[i][1]) { o.prevCur = o.cur; o.cur = i; break; }
  return lastOut(o, o.m, val);
}
// WOFFER: выходы органа «для решений» -- последнее и предпоследнее событие группы (первое слово фразы -- предпоследнее, когда звучит второе)
function offerOut(o, put) { const n = o.X.length; for (let i = 0; i < n; i++) { put(i, o.cur === i ? 1 : 0); put(n + i, o.prevCur === i ? 1 : 0); } }
function lastOut(o, m, val) { const out = o.cur === m ? 1 : 0; return o.g >= 0 ? (val(o.g) > o.mg ? out : 0) : out; }   // выход для слова m (орган отдаёт по товару на каждое слово группы)
function paraStep(o, val) {
  let mem = -1; for (let i = 0; i < o.X.length; i++) if (val(o.X[i][0]) > o.X[i][1]) { mem = i; break; }
  let out = 0;
  for (const [k, mk] of o.K) if (val(k) > mk) { if (mem >= 0) o.st.set(k, mem); else if (o.st.get(k) === o.m) out = 1; }
  return mem >= 0 ? 0 : out;
}
// значение понятия в этом круге -- прямо по его нервам (товар понятия считается после памяти)
function wmConc(G, oc) { if (!oc.alive) return 0; let v = 0; for (const [id, q] of oc.views) if (G.val[id] > q.mid) v += q.w; return v; }
// MCONC=1 -- память видит через понятия (как части, src/concepts.js reperceive): у органа рабочей памяти содержимое -- нерв
// понятия («вверх при втором»). Строитель пробует такой же орган с самим понятием («куда при втором»); если подгонка частей,
// которые берут орган, не хуже, чем на CTIE, части берут новый, а старый остаётся без дохода. Так знание, выученное на одном
// слове, не остаётся частным: «второе вниз» читается тем же органом.
function wmThrough(B, fitErr) {
  const cfg = B.cfg, G = B.goods, M = B.mem, CC = B.cc, a = M.agent; if (!a || !a.alive) return; let n = 0;
  for (const o of M.organs.slice()) {
    if ((o.type !== 'след' && o.type !== 'защёлка') || o.xo || n >= cfg.CREP) continue;
    const oc = CC.viewOf.get(B.ch[o.x].good); if (!oc || !oc.alive || !G.alive[oc.good]) continue;
    if (B.t - (o.ccTried ?? -1e9) < 5 * cfg.CSCAN) continue; o.ccTried = B.t;
    const users = []; for (const c of B.ch) for (const p of c.parts) { const i = p.inputs.indexOf(o.good); if (i >= 0) users.push([c, p, i]); }
    const key = `${o.type} «${oc.key}»/${o.g}/${o.h}`; if (!users.length || M.keys.has(key)) continue; n++;
    const o2 = B.led.open('память', a, cfg.OCRED, { type: o.type, x: o.x, xo: oc, g: o.g, mg: o.mg, h: o.h, mh: o.mh, mx: 0, key, mem: 6, payTo: false, incLast: 0, born: B.t, client: o.client, v: 0, tr: 0, lam: cfg.WLAM });
    o2.good = G.add('память', o2, -1, B.t);
    const T = B.t, t0 = Math.max(1, T - cfg.H + 1, G.since[oc.good] + 1, G.since[B.ch[o.g].good] + 1, o.h >= 0 ? G.since[B.ch[o.h].good] + 1 : 0);
    for (let t = t0; t < T; t++) G.rec[G.row(t) + o2.good] = wmStep(o2, G.at(t, oc.good), G.at(t, B.ch[o.g].good), o.h >= 0 ? G.at(t, B.ch[o.h].good) : 0);
    G.since[o2.good] = t0 - 1; let e0 = 0, e1 = 0, ops = 4 * cfg.H, ok = true;
    for (const [c, p, i] of users) { const alt = p.inputs.slice(); alt[i] = o2.good; const r0 = fitErr(B, c, p.inputs), r1 = fitErr(B, c, alt); if (!r0 || !r1) { ok = false; break; } e0 += r0.mse; e1 += r1.mse; ops += r0.ops + r1.ops; }
    B.led.work(a, ops);
    if (!ok || e1 > e0 * (1 + cfg.CTIE) + 1e-12) { B.led.close(o2); G.kill(o2.good); continue; }
    M.organs.push(o2); M.keys.add(key); M.built++; B.orgGoods = organGoods(B);
    for (const [, p, i] of users) { p.inputs[i] = o2.good; p.x = null; B.memOf(p); B.fit(p); }
    M.log.push(`круг ${B.t}: ${o.type} «${o.key}» -- через понятие «${oc.key}» (частей: ${users.length})`);
  }
}
const binOf = (o, v) => { let i = 0; while (i < o.cuts.length && v > o.cuts[i]) i++; return i; };
// мягкое чтение таблицы: уровень ключа по правдоподобию (шум sig) -- выход -- среднее значений соседних уровней с весами;
// запись -- только когда уровень ясен (вероятность больше 0.9). Без собранной сетки -- жёсткие доли.
function softRead(o, v) {
  if (!o.st) { const b = binOf(o, v); return [o.last[b], b, 1]; }
  const x = (v - o.off) / o.st, k0 = Math.round(x); let zs = 0, out = 0, bb = -1, pb = 0;
  for (let k = k0 - 1; k <= k0 + 1; k++) { const cpos = o.off + k * o.st, p = Math.exp(-((v - cpos) ** 2) / (2 * o.sig * o.sig)), b = binOf(o, cpos);
    zs += p; out += p * o.last[b]; if (p > pb) { pb = p; bb = b; } }
  return [zs > 0 ? out / zs : o.last[binOf(o, v)], bb, zs > 0 ? pb / zs : 0];
}
// уровни нерва -- по собранности фаз (как PRTREF правки 74 нейрона-3): шаг сетки s, при котором значения ложатся в одну фазу
// (|среднее exp(2 pi i v / s)| велико); из собранных шагов берётся самый крупный (половина шага собрана так же, удвоенный --
// нет), сдвиг -- по углу фазы. Собранного шага нет -- 8 долей поровну.
function levels(vals) {
  const n = vals.length, mean = vals.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(vals.reduce((a, x) => a + (x - mean) ** 2, 0) / n) || 1;
  const R = (st) => { let c = 0, sn = 0; for (const v of vals) { const ph = 2 * Math.PI * v / st; c += Math.cos(ph); sn += Math.sin(ph); } return [Math.hypot(c, sn) / n, Math.atan2(sn, c)]; };
  const steps = []; for (let i = 0; i < 80; i++) steps.push(0.05 * sd * Math.pow(40, i / 79));
  const rs = steps.map((st) => R(st)), rmax = Math.max(...rs.map((x) => x[0]));
  let pick = -1; for (let i = 0; i < steps.length; i++) if (rs[i][0] >= Math.max(0.25, 0.6 * rmax)) pick = i;
  const sorted = Float64Array.from(vals).sort();
  if (pick >= 0) {
    while (pick > 0 && rs[pick - 1][0] > rs[pick][0]) pick--;   // к вершине собранности
    let st = steps[pick], best = rs[pick];                       // и тонко: +-6%
    for (let i = -20; i <= 20; i++) { const s2 = steps[pick] * (1 + 0.003 * i), r2 = R(s2); if (r2[0] > best[0]) { best = r2; st = s2; } }
    rs[pick] = best;
    const off = best[1] / (2 * Math.PI) * st, lo = sorted[0], hi = sorted[n - 1], cuts = [];
    for (let k = Math.floor((lo - off) / st) - 1; k <= Math.ceil((hi - off) / st) + 1; k++) { const cpt = off + (k + 0.5) * st; if (cpt > lo && cpt < hi) cuts.push(cpt); }
    // шум чтения -- из собранности: R = exp(-2 pi^2 sig^2 / st^2)
    if (cuts.length >= 1 && cuts.length <= 31) return { cuts, st, off, sig: st * Math.sqrt(Math.max(1e-6, -Math.log(Math.max(1e-6, rs[pick][0]))) / (2 * Math.PI * Math.PI)) }; }
  const q = []; for (let i = 1; i < 8; i++) q.push(sorted[Math.floor(i * n / 8)]); return { cuts: q };
}

// ---------------------------------------------------------------- похожесть
const TMAX = 16;
// ключи для канала c: нервы с наибольшей |корреляцией| «нерв в круге t -- канал в круге t+1» на записи (за вычетом уровня случайности)
function simKeys(B, c, t0, t1) {
  const cfg = B.cfg, G = B.goods, n = t1 - t0 + 1, floor = 2 / Math.sqrt(n), sc = [];
  let sy = 0, syy = 0; for (let t = t0; t <= t1; t++) { const y = G.at(t + 1, c.good); sy += y; syy += y * y; }
  const vy = syy / n - (sy / n) ** 2; if (!(vy > 1e-9)) return null;
  const CH = B.vis ? B.vis(c) : B.ch;   // REG: только свой отдел и сцена
  for (const q of CH) { let sx = 0, sxx = 0, sxy = 0; for (let t = t0; t <= t1; t++) { const x = G.at(t, q.good), y = G.at(t + 1, c.good); sx += x; sxx += x * x; sxy += x * y; }
    const vx = sxx / n - (sx / n) ** 2; if (!(vx > 1e-9)) continue;
    const r = Math.abs((sxy / n - (sx / n) * (sy / n)) / Math.sqrt(vx * vy)); if (r > floor) sc.push([q.k, r - floor, sx / n, Math.sqrt(vx)]); }
  B.led.work(B.mem.agent, CH.length * n * 5);
  const top = sc.sort((a, b) => b[1] - a[1]).slice(0, cfg.SIMKM).sort((a, b) => a[0] - b[0]);
  // sig: связан ли канал с прошлым круга вообще -- самая сильная связь против порога на число нервов (у пикселя следующей
  // картинки связи нет, но из 70 нервов какие-то случайно выше 2/sqrt(n): рост давал им выходы и забивал орган)
  const sig = top.length ? Math.max(...top.map((x) => x[1] + floor)) * Math.sqrt(n) > Math.sqrt(2 * Math.log(Math.max(2, B.ch.length))) + 1.5 : false;
  return top.length ? { keys: top.map((x) => x[0]), kw: top.map((x) => x[1]), mu: top.map((x) => x[2]), sd: top.map((x) => x[3]), sig } : null;
}
// одна строка ключей (нормированных, с весом) в круге t записи, или нынешняя
function simZ(B, o, t) { const G = B.goods, m = o.keys.length, z = new Float64Array(m);
  for (let i = 0; i < m; i++) { const v = t === undefined ? G.val[B.ch[o.keys[i]].good] : G.at(t, B.ch[o.keys[i]].good); z[i] = o.kw[i] * (v - o.mu[i]) / (o.sd[i] || 1); } return z; }
function simIds(o, z) { const cfg = o.cfg, m = z.length, ids = new Int32Array(cfg.SIMT);
  for (let t = 0; t < cfg.SIMT; t++) { let id = 0; for (let b = 0; b < cfg.SIMB; b++) { const off = (t * cfg.SIMB + b) * m; let v = 0; for (let i = 0; i < m; i++) v += o.R[off + i] * z[i]; if (v > 0) id |= 1 << b; } ids[t] = (t << cfg.SIMB) | id; }
  return ids; }
function simInsert(o, z, ids, ys) {           // строка r = o.n: ключи и что шло после (по выходам)
  const cfg = o.cfg, m = z.length, r = o.n++, slot = r % cfg.SIMA;
  o.Z.set(z, slot * m); for (let j = 0; j < TMAX; j++) o.Y[slot * TMAX + j] = j < ys.length ? ys[j] : NaN;
  for (const cell of ids) { o.cells[cell * cfg.SIMSL + o.pos[cell]] = r; o.pos[cell] = (o.pos[cell] + 1) % cfg.SIMSL; }
}
function simQuery(o, z, ids) {                // SIMK самых похожих строк архива; ответ -- по каждому выходу среднее того, что шло после
  const cfg = o.cfg, m = z.length, K = cfg.SIMK, bd = new Float64Array(K).fill(Infinity), bb = new Int32Array(K).fill(-1), seen = new Set(); let ops = 0;
  for (const cell of ids) for (let j = 0; j < cfg.SIMSL; j++) { const r = o.cells[cell * cfg.SIMSL + j]; if (r < 0 || o.n - r > cfg.SIMA || seen.has(r)) continue; seen.add(r);
    const off = (r % cfg.SIMA) * m; let d = 0; for (let i = 0; i < m && d < bd[K - 1]; i++) { const y = o.Z[off + i] - z[i]; d += y * y; } ops += m;
    if (d < bd[K - 1]) { let q = K - 1; while (q > 0 && bd[q - 1] > d) { bd[q] = bd[q - 1]; bb[q] = bb[q - 1]; q--; } bd[q] = d; bb[q] = r; } }
  const out = new Float64Array(o.targets.length);
  o.targets.forEach((tg, j) => { let s = 0, n = 0; for (let q = 0; q < K; q++) if (bb[q] >= 0) { const y = o.Y[(bb[q] % cfg.SIMA) * TMAX + j]; if (Number.isFinite(y)) { s += y; n++; } } out[j] = n ? s / n : tg.mean; });
  return [out, ops + cfg.SIMT * cfg.SIMB * m];
}
// круг органа: сначала в архив -- прошлый круг (теперь видно, что шло после него), потом поиск по нынешнему
function simStep(B, o) {
  const G = B.goods;
  if (o.prevZ) simInsert(o, o.prevZ, o.prevIds, o.targets.map((tg) => G.val[B.ch[tg.k].good]));
  const z = simZ(B, o), ids = simIds(o, z), [out, ops] = simQuery(o, z, ids);
  o.targets.forEach((tg, j) => { G.val[tg.good] = out[j]; });
  o.prevZ = z; o.prevIds = ids; B.led.work(o, ops + 4 * z.length);
}
// новый выход (канал k): товар, прогрев по записи -- прошлые ответы пишутся в запись, что шло после -- в архив, где запись помнит
function simAddTarget(B, o, c) {
  const cfg = B.cfg, G = B.goods, T = B.t, t0 = Math.max(1, T - cfg.H + 1), j = o.targets.length;
  const tg = { k: c.k, good: G.add('память', o, -1, T), mean: c.mean }; o.targets.push(tg);
  for (let r = Math.max(0, o.n - cfg.SIMA); r < o.n; r++) { const tr = o.rowT[r % cfg.SIMA]; if (tr >= t0 && tr + 1 <= T) o.Y[(r % cfg.SIMA) * TMAX + j] = G.at(tr + 1, c.good); }
  // прошлые ответы нового выхода -- заново по архиву, только из строк раньше каждого круга
  let first = T;
  for (let t = Math.max(t0, T - cfg.SIMWARM); t < T; t++) { const z = simZ(B, o, t), ids = simIds(o, z);
    const [out] = simQuery({ ...o, n: Math.min(o.n, o.rowOf(t)) }, z, ids); G.rec[G.row(t) + tg.good] = out[j]; first = Math.min(first, t); }
  G.since[tg.good] = first - 1; B.led.work(B.mem.agent, Math.min(T - t0, cfg.SIMWARM) * (cfg.SIMT * cfg.SIMB * o.keys.length + 64 * o.keys.length));
  B.orgGoods = organGoods(B);
  return tg;
}
const organGoods = (B) => B.mem.organs.flatMap((x) => (x.type === 'похожесть' ? x.targets.map((t) => t.good) : x.type === 'клоны' || x.type === 'контекст' || x.type === 'последний' ? x.outs : [x.good]));

// примерка заготовок к остатку канала c на записи; возвращает лучшую или null
// PLONG: пара по долгой записи событий (src/market.js lrecPush). Ключи и группы -- знакомые слова; орган проигрывается по
// записи по порядку; мера -- связь выхода органа в кругах чтения (ключ звучит один) с каналом кругом позже
function paraLong(B, c) {
  const G = B.goods, rows = B.lrec.rows, R = rows.length, out = { best: null, n: 0, ops: 0 }; if (R < 50 || !B.evc) return out;
  const span = Math.max(1, rows[R - 1].t - rows[0].t + 1), on = new Map();
  for (const q of B.ch) { if (q === c || !B.evc.known.has(q.good)) continue; const mid = B.evc.mids.get(q.good) ?? 0.5, ix = [];
    for (let i = 0; i < R; i++) if (rows[i].v[q.k] > mid) ix.push(i); if (ix.length >= 3 && ix.length / span <= 0.3) on.set(q.k, { ix, set: new Set(ix), mid }); }
  out.ops += R * B.ch.length;
  const ks = [...on.keys()].sort((a, b) => on.get(b).ix.length - on.get(a).ix.length).slice(0, 16), co = (a, b) => { let n = 0; for (const i of on.get(a).ix) if (on.get(b).set.has(i)) n++; return n; };
  const next = (i) => (i + 1 < R && rows[i + 1].t === rows[i].t + 1 ? rows[i + 1].e[c.k] : 0);   // ошибка прогноза канала кругом позже
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = ks[i], b = ks[j]; if (co(a, b) > 0) continue;
    // ключ -- слово, которое заметную долю своих раз (не меньше четверти) звучит со словом группы, а не совпало с ним наугад
    const K = ks.filter((k) => k !== a && k !== b && co(k, a) + co(k, b) >= Math.max(2, 0.25 * on.get(k).ix.length)); if (!K.length) continue;
    for (const m of [0, 1]) { out.n++; const st = new Map(); let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
      for (let r = 0; r < R; r++) { const v = rows[r].v, mem = v[a] > on.get(a).mid ? 0 : v[b] > on.get(b).mid ? 1 : -1; let read = false, x = 0;
        for (const k of K) if (v[k] > on.get(k).mid) { if (mem >= 0) st.set(k, mem); else if (st.has(k)) { read = true; if (st.get(k) === m) x = 1; } }
        if (read) { const y = next(r); n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; } }
      out.ops += R * (2 + K.length);
      const vx = sxx - sx * sx / n, vy = syy - sy * sy / n, cv = sxy - sx * sy / n; if (n < 10 || !(vx > 1e-9) || !(vy > 1e-9)) continue;
      const r2 = cv * cv / (vx * vy), z = Math.sqrt(r2 * n), w = cv / vx;
      if (!out.best || z > out.best.z) out.best = { g: r2, z, tpl: { type: 'пара', X: [[a, on.get(a).mid], [b, on.get(b).mid]], K: K.map((k) => [k, on.get(k).mid]), m, long: { w, b: sy / n - w * sx / n, n } } }; } }
  return out;
}
function scan(B, c) {
  const cfg = B.cfg, G = B.goods, a = B.mem.agent, T = B.t, n = Math.min(cfg.MWIN, cfg.H - cfg.MDMAX - 2);
  const t1 = T - 1, t0 = Math.max(1, t1 - n + 1);
  if (t1 - t0 < 100) return null;
  // остаток лучшей части канала (без частей -- сам канал без среднего)
  let best = null; for (const p of c.parts) if (!best || (p.fitMse ?? 9) < (best.fitMse ?? 9)) best = p;
  // остаток без выбросов: всплески редких нервов (пиксель, который почти всегда ноль) давали ложные совпадения
  const mkRes = (t0, t1) => { const res = new Float64Array(t1 - t0 + 1);
    for (let t = t0; t <= t1; t++) { let s = best ? best.b : c.mean; if (best) for (let i = 0; i < best.inputs.length; i++) s += best.w[i] * valAtD(G, t, best.inputs[i]); res[t - t0] = G.at(t + 1, c.good) - s; }
    let m = 0, v = 0; for (const r of res) { m += r / res.length; } for (const r of res) v += (r - m) ** 2 / res.length; const lim = 4 * Math.sqrt(v); for (let i = 0; i < res.length; i++) res[i] = Math.max(m - lim, Math.min(m + lim, res[i]));
    return { res, t0, t1 }; };
  const W0 = mkRes(t0, t1);
  let ops = W0.res.length * 4; const ntests = { 'кольцо': 0, 'таблица': 0, 'похожесть': 0 };
  // порог с поправкой на число гипотез -- у каждой заготовки свой: z = r sqrt(m) на каждой половине больше sqrt(2 ln N) + 1.5
  const score = (f, kind, Wn = W0, noSup = false) => { ntests[kind]++;        // f(t) -> значение товара в круге t (или NaN); доля остатка на чётных и проверка на нечётных
    const { res, t0, t1 } = Wn, s = [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]], xs = new Float64Array(res.length); let xm = 0, xv = 0, nx = 0;
    for (let t = t0; t <= t1; t++) { const x = f(t); xs[t - t0] = x; if (Number.isFinite(x)) { xm += x; xv += x * x; nx++; } }
    if (nx < 60) return [0, 0];
    xm /= nx; const xl = 4 * Math.sqrt(Math.max(1e-12, xv / nx - xm * xm));   // и товар без выбросов
    for (let t = t0; t <= t1; t++) { let x = xs[t - t0]; if (!Number.isFinite(x)) continue; x = Math.max(xm - xl, Math.min(xm + xl, x)); xs[t - t0] = x; const r = res[t - t0], h = s[t & 1]; h[0]++; h[1] += x; h[2] += r; h[3] += x * x; h[4] += r * r; h[5] += x * r; }
    // опора: ни одна точка не даёт больше четверти связи (у почти постоянного нерва с редкими всплесками одно совпадение
    // всплесков давало корреляцию под 1)
    if (!noSup && cfg.SUPLOO) for (const par of [0, 1]) {   // правка «опора» (results/opora/): без двух самых весомых точек связь та же по знаку и не меньше трети
      const [m, sx, sr, , , sxr] = s[par]; if (m < 30) continue; const mx = sx / m, mr = sr / m, cv = sxr - sx * sr / m; let i1 = -1, i2 = -1, c1 = -1, c2 = -1;
      for (let t = t0 + ((t0 & 1) === par ? 0 : 1); t <= t1; t += 2) { const x = xs[t - t0]; if (!Number.isFinite(x)) continue; const c = Math.abs((x - mx) * (res[t - t0] - mr));
        if (c > c1) { c2 = c1; i2 = i1; c1 = c; i1 = t; } else if (c > c2) { c2 = c; i2 = t; } }
      let m2 = m, sx2 = sx, sr2 = sr, sxr2 = sxr; for (const t of [i1, i2]) if (t >= 0) { const x = xs[t - t0], r = res[t - t0]; m2--; sx2 -= x; sr2 -= r; sxr2 -= x * r; }
      const cv2 = sxr2 - sx2 * sr2 / m2;
      if (!(cv2 * cv > 0) || Math.abs(cv2) / m2 < Math.abs(cv) / m / 3) return [0, 0]; }
    else if (!noSup) for (const par of [0, 1]) { const [m, sx, sr, , , sxr] = s[par]; if (m < 30) continue; const mx = sx / m, mr = sr / m, cv = sxr - sx * sr / m; let mc = 0;
      for (let t = t0 + ((t0 & 1) === par ? 0 : 1); t <= t1; t += 2) { const x = xs[t - t0]; if (Number.isFinite(x)) mc = Math.max(mc, Math.abs((x - mx) * (res[t - t0] - mr))); }
      if (mc > 0.25 * Math.abs(cv)) return [0, 0]; }
    ops += 8 * res.length;
    const g = s.map(([m, sx, sr, sxx, srr, sxr]) => { if (m < 30) return [0, 0, 0]; const vx = sxx - sx * sx / m, vr = srr - sr * sr / m, cv = sxr - sx * sr / m; return vx > 1e-9 && vr > 1e-9 ? [cv, cv * cv / (vx * vr), m] : [0, 0, 0]; });
    if (!(g[0][0] * g[1][0] > 0)) return [0, 0];
    return [Math.min(g[0][1], g[1][1]), Math.min(Math.sqrt(g[0][1] * g[0][2]), Math.sqrt(g[1][1] * g[1][2]))];   // доля и z
  };
  // кандидаты: нервы, которые сами хуже всего предсказуемы (их прошлое -- новое знание), и нервы наугад
  // кольца (дорогая примерка: задержки x круги) -- по карте мира и наугад; таблицы (один проход) -- по всем нервам
  const CH = B.vis ? B.vis(c) : B.ch, CHs = new Set(CH);   // REG: строитель смотрит только свой отдел и сцену
  const order = CH.map((q) => [q, unexplained(B, q)]).sort((x, y) => y[1] - x[1]).map((x) => x[0]);
  const ringC = new Set(order.slice(0, cfg.MCAND)); for (const id of B.unexplMap().slice(0, cfg.MCAND)) { const q = B.ch[B.goods.nerve[id]]; if (CHs.has(q)) ringC.add(q); }
  // CRNG: у строителя свой жребий (B.crng) -- сколько и когда он примеряет, не меняет жребия частей и понятий
  const brng = cfg.CRNG ? (B.crng = B.crng || require('./rng').stream(B.seed, 'сборщик')) : B.rng;
  for (let i = 0; i < cfg.MCAND / 2; i++) ringC.add(CH[brng.int(CH.length)]);
  const best3 = { 'кольцо': { g: cfg.MGAIN, z: 0, tpl: null }, 'таблица': { g: cfg.MGAIN, z: 0, tpl: null }, 'похожесть': { g: cfg.MGAIN, z: 0, tpl: null } };
  for (const q of CH) {
    const qg = q.good;
    if (ringC.has(q)) for (let d = 1; d <= cfg.MDMAX; d++) {
      const [g, z] = score((t) => (t - d >= Math.max(1, G.since[qg]) ? G.at(t - d, qg) : NaN), 'кольцо');
      if (g > best3['кольцо'].g) best3['кольцо'] = { g, z, tpl: { type: 'кольцо', j: q.k, d } }; }
    if (q === c) continue;
    // уровни нерва -- раз в 2 000 кругов, хранятся у его канала (их ищут для многих заказчиков)
    if (!q.lv || B.t - q.lvT > 2000) { const vals = []; for (let t = t0; t <= t1; t++) vals.push(G.at(t, qg)); q.lv = levels(vals); q.lvT = B.t; ops += 121 * vals.length * 3; }
    const lv = q.lv, o = { ...lv, last: new Float64Array(lv.cuts.length + 1) }; let prev = -1, pp = 0;
    const [g, z] = score((t) => { if (prev >= 0 && pp > 0.9) o.last[prev] = G.at(t, c.good); const [y, bn, pr] = softRead(o, G.at(t, qg)); prev = bn; pp = pr; return y; }, 'таблица');
    if (g > best3['таблица'].g) best3['таблица'] = { g, z, tpl: { type: 'таблица', j: q.k, k: c.k, ...lv } };
  }
  // рабочая память: пары (x, g), g -- нерв-событие; x -- любой нерв (защёлка) или событие (след)
  // окно -- вся запись (события редки: в 128 кругах их единицы)
  if (cfg.WMEM) { const EV = require('./concepts').events, ev = new Map(), w0 = Math.max(1, T - cfg.H + 2), Ww = mkRes(w0, t1);
    // ev -- события (включены не больше 30% кругов): следы и «в круге h»; gs -- условия защёлки: двухуровневые нервы, включённые
    // не всегда (родитель смотрит -- полжизни)
    const gs = new Map();
    for (const q of CH) { const e = G.since[q.good] < w0 ? EV(B, q.good, w0, t1) : null; if (e && e.f <= 0.3 && e.n >= 5) ev.set(q.k, e.mid); if (e && e.f <= 0.7 && e.n >= 5) gs.set(q.k, e.mid); }
    ntests['защёлка'] = 0; ntests['след'] = 0; best3['защёлка'] = { g: cfg.MGAIN, z: 0, tpl: null }; best3['след'] = { g: cfg.MGAIN, z: 0, tpl: null };
    // защёлка может быть и «в круге h»: h -- одно из двух событий, сильнее всех связанных с каналом кругом позже (вопрос, на
    // который канал отвечает); без h -- -1
    const hs = [...ev.keys()].filter((k) => k !== c.k).map((k) => { let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; const hg = B.ch[k].good;
      for (let t = w0; t <= t1; t++) { const x = G.at(t, hg) > ev.get(k) ? 1 : 0, y = G.at(t + 1, c.good); n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
      const vx = sxx - sx * sx / n, vy = syy - sy * sy / n; return [k, vx > 0 && vy > 0 ? Math.abs(sxy - sx * sy / n) / Math.sqrt(vx * vy) : 0]; }).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
    // WMEMN > 0: не все пары (на теле в 88 нервов перебор пар стоил строителю ~1 млн операций за круг), а условия -- WMEMN
    // событий, сильнее всех связанных с каналом кругом позже, и столько же наугад; содержимое -- 2 WMEMN нервов наугад и события
    let gList = [...gs], xList = CH;
    if (cfg.WMEMN) { const corr = (k) => { let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; const hg = B.ch[k].good, md = gs.get(k);
        for (let t = w0; t <= t1; t++) { const x = G.at(t, hg) > md ? 1 : 0, y = G.at(t + 1, c.good); n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
        const vx = sxx - sx * sx / n, vy = syy - sy * sy / n; return vx > 0 && vy > 0 ? Math.abs(sxy - sx * sy / n) / Math.sqrt(vx * vy) : 0; };
      const top = [...gs.keys()].filter((k) => k !== c.k).map((k) => [k, corr(k)]).sort((a, b) => b[1] - a[1]).slice(0, cfg.WMEMN).map((x) => x[0]);
      const gSet = new Set(top), ks = [...gs.keys()]; if (ks.length) for (let i = 0; i < 4 * cfg.WMEMN && gSet.size < 2 * cfg.WMEMN; i++) gSet.add(ks[brng.int(ks.length)]);   // (условий нет -- нечего и брать)
      gList = [...gSet].map((k) => [k, gs.get(k)]);
      const xs = new Set([...ev.keys()].map((k) => B.ch[k])); for (let i = 0; i < 8 * cfg.WMEMN && xs.size < ev.size + 2 * cfg.WMEMN; i++) xs.add(CH[brng.int(CH.length)]);
      xList = [...xs]; ops += gs.size * (t1 - w0) * 3; }
    for (const [gk, mg] of gList) for (const xq of xList) { if (xq.k === gk || xq === c) continue; const xg = xq.good, gg = B.ch[gk].good;
      if (G.since[xg] >= w0) continue;
      for (const hk of [-1, ...hs]) { if (hk === gk) continue; const hg = hk >= 0 ? B.ch[hk].good : -1, mh = hk >= 0 ? ev.get(hk) : 0;
        // память должна нести знание сверх своего условия чтения: если в кругах чтения защёлка почти постоянна, она -- то же,
        // что сам нерв h (или константа), а не память
        { const o2 = { type: 'защёлка', mg, v: 0, h: -1 }; let n = 0, sm = 0, sq = 0;
          for (let t = w0; t <= t1; t++) { const v = wmStep(o2, G.at(t, xg), G.at(t, gg), 0); if (hk < 0 || G.at(t, hg) > mh) { n++; sm += v; sq += v * v; } }
          ops += 2 * (t1 - w0); if (n < 10 || sq / n - (sm / n) ** 2 < 0.04) continue; }
        const o = { type: 'защёлка', mg, v: 0, h: hk, mh }; const [g, z] = score((t) => wmStep(o, G.at(t, xg), G.at(t, gg), hk >= 0 ? G.at(t, hg) : 0), 'защёлка', Ww);
        if (g > best3['защёлка'].g) best3['защёлка'] = { g, z, tpl: { type: 'защёлка', x: xq.k, g: gk, mg, h: hk, mh } }; }
      // WLAM2, WLAM3: следы и с другими сроками угасания (долгая память -- через 15-30 кругов след 0.85 почти погас)
      if (ev.has(xq.k) && ev.has(gk)) for (const lam of [cfg.WLAM, cfg.WLAM2, cfg.WLAM3]) { if (!(lam > 0)) continue; const o = { type: 'след', mg, mx: ev.get(xq.k), lam, tr: 0, h: -1 }; const [g, z] = score((t) => wmStep(o, G.at(t, xg), G.at(t, gg)), 'след', Ww);
        if (g > best3['след'].g) best3['след'] = { g, z, tpl: { type: 'след', x: xq.k, g: gk, mg, mx: ev.get(xq.k), h: -1, ...(lam !== cfg.WLAM ? { lam } : {}) } }; } } }
  // пара: группы из двух взаимоисключающих слов и их ключи -- слова, с которыми они звучали вместе
  if (cfg.WMEM && cfg.PARA) { const EV = require('./concepts').events, w0 = Math.max(1, T - cfg.H + 2), Wp = mkRes(w0, t1), on = new Map();
    for (const q of CH) { if (q === c || G.since[q.good] >= w0) continue; const e = EV(B, q.good, w0, t1); if (e && e.f <= 0.3 && e.n >= 3) on.set(q.k, e); }
    const ks = [...on.keys()].sort((a, b) => on.get(b).n - on.get(a).n).slice(0, 16), co = (a, b) => { const x = on.get(a).on, y = on.get(b).on; let n = 0; for (let i = 0; i < x.length; i++) if (x[i] && y[i]) n++; return n; };
    ops += ks.length * ks.length * (t1 - w0); ntests['пара'] = 0; best3['пара'] = { g: cfg.MGAIN, z: 0, tpl: null };
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = ks[i], b = ks[j]; if (co(a, b) > 0) continue;
      const K = ks.filter((k) => k !== a && k !== b && co(k, a) + co(k, b) >= 2); if (!K.length) continue;
      for (const m of [0, 1]) { const o = { type: 'пара', X: [[B.ch[a].good, on.get(a).mid], [B.ch[b].good, on.get(b).mid]], K: K.map((k) => [B.ch[k].good, on.get(k).mid]), m, st: new Map() };
        const [g, z] = score((t) => paraStep(o, (id) => G.at(t, id)), 'пара', Wp); ops += (t1 - w0) * (2 + K.length);
        if (g > best3['пара'].g) best3['пара'] = { g, z, tpl: { type: 'пара', X: [[a, on.get(a).mid], [b, on.get(b).mid]], K: K.map((k) => [k, on.get(k).mid]), m } }; } } }
  // WLAST -- «последний из группы»: события, которые никогда не звучат вместе (слова a / b / c), -- одна группа; орган помнит,
  // какое из них прозвучало последним, без угасания, пока не прозвучит другое (о чём говорили -- через сколько угодно кругов;
  // первое слово фразы -- пока не придёт второе). Товар -- 1, если последним было слово m (можно -- только в круге события h)
  if (cfg.WMEM && cfg.WLAST) { const EV = require('./concepts').events, w0 = Math.max(1, T - cfg.H + 2), Wl = mkRes(w0, t1), on = new Map();
    for (const q of B.ch) { if (q === c || G.since[q.good] >= w0) continue; const e = EV(B, q.good, w0, t1); if (e && e.f <= 0.3 && e.n >= 3) on.set(q.k, e); }
    const ks = [...on.keys()].sort((a, b) => on.get(b).n - on.get(a).n).slice(0, 16), co = (a, b) => { const x = on.get(a).on, y = on.get(b).on; let n = 0; for (let i = 0; i < x.length; i++) if (x[i] && y[i]) n++; return n; };
    const groups = new Map();
    // группа -- альтернативы: не звучат вместе и звучат примерно одинаково часто (вопрос и ответ -- тоже не вместе со словом, но они -- не его соседи по выбору)
    const near = (a, b) => { const r = on.get(a).n / on.get(b).n; return r > 0.25 && r < 4; };
    for (const a of ks) { const gr = [a], byN = ks.filter((b) => b !== a).sort((x, y) => Math.abs(Math.log(on.get(x).n / on.get(a).n)) - Math.abs(Math.log(on.get(y).n / on.get(a).n)));
      for (const b of byN) if (gr.every((x) => co(x, b) === 0 && near(x, b))) { gr.push(b); if (gr.length >= 6) break; }
      if (gr.length >= 2) { gr.sort((x, y) => x - y); groups.set(gr.join(','), gr); } }
    const corr = (k) => { let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; const e = on.get(k);
      for (let t = w0; t < t1; t++) { const x = e.on[t - w0], y = G.at(t + 1, c.good); n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
      const vx = sxx - sx * sx / n, vy = syy - sy * sy / n; return vx > 0 && vy > 0 ? Math.abs(sxy - sx * sy / n) / Math.sqrt(vx * vy) : 0; };
    if (process.env.DBGMEM) B.mem.log.push(`  группы ${B.t} канал ${c.k}: события ${ks.map((k) => B.world.truth()[k] + k + '(' + on.get(k).n + ')').join(' ')} | ` + [...groups.values()].slice(0, 8).map((g) => g.map((k) => B.world.truth()[k] + k).join('/')).join('; '));
    const hsL = ks.map((k) => [k, corr(k)]).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);   // только с условием чтения (вопрос): память без него -- постоянный признак, части цепляются за него и в других делах
    ops += ks.length * ks.length * (t1 - w0) + ks.length * (t1 - w0); ntests['последний'] = 0; best3['последний'] = { g: cfg.MACC ? cfg.MGAIN / 3 : cfg.MGAIN, z: 0, tpl: null };
    for (const gr0 of [...groups.values()].slice(0, 8)) for (const hk of hsL) { const gr = gr0.filter((k) => k !== hk); if (gr.length < 2) continue;   // событие-условие чтения (вопрос) -- не член группы
      for (let m = 0; m < gr.length; m++) { const o = { type: 'последний', X: gr.map((k) => [B.ch[k].good, on.get(k).mid]), m, g: hk >= 0 ? B.ch[hk].good : -1, mg: hk >= 0 ? on.get(hk).mid : 0, cur: -1 };
        const [g, z] = score((t) => lastStep(o, (id) => G.at(t, id)), 'последний', Wl, !!cfg.MACC);   // с MACC правило опоры заменяет повторение от окна к окну (ops += (t1 - w0) * (2 + gr.length) -- в ветке закомментировано)
        // MACC=2: и с правилом опоры -- если без него держится только на нескольких кругах, гипотеза «слабая» и строится лишь
        // после повторения на трёх отрезках записи (иначе «последний» на 7% остатка спорил в сложении с понятием)
        let weak = false; if (cfg.MACC >= 2 && g > best3['последний'].g) { o.cur = -1; o.prevCur = undefined; const [, zs] = score((t) => lastStep(o, (id) => G.at(t, id)), 'последний', Wl, false); ntests['последний']--; weak = !(zs > 0); }
        if (g > best3['последний'].g) best3['последний'] = { g, z, weak, tpl: { type: 'последний', X: gr.map((k) => [k, on.get(k).mid]), m, g: hk, mg: hk >= 0 ? on.get(hk).mid : 0 } }; } } }
  // PLONG: пара по долгой записи событий -- если на записи товаров её не видно (вопрос через 100-400 кругов: в 512 кругах
  // один-два эпизода). Порог тот же: z больше sqrt(2 ln N) + 1.5 по числу примерок
  if (cfg.WMEM && cfg.PARA && cfg.PLONG && B.lrec && !(best3['пара'] && best3['пара'].tpl && best3['пара'].z > Math.sqrt(2 * Math.log(Math.max(2, ntests['пара']))) + 1.5)) {
    const L = paraLong(B, c); ops += L.ops; ntests['пара'] = (ntests['пара'] || 0) + L.n;
    if (L.best && L.best.z > Math.sqrt(2 * Math.log(Math.max(2, ntests['пара']))) + 1.5) best3['пара'] = L.best; }
  // COMP: сборки из кирпичиков (src/compose.js) -- по всей записи. Поправка на число примерок -- по числу всех сборок этой формы
  // для канала (а не только примеренных сейчас): что не примерено сейчас, примеряется позже. Доказательство копится только с
  // нового отрезка записи (как MACC=2): z складываются над корнем из числа отрезков
  // CRNG: у сборщика свой жребий -- его перебор не сдвигает жребий остального мозга (понятия, части): иначе одно лишнее
  // слово языка меняло всю дальнейшую жизнь, и сравнение мозгов тонуло в разбросе от жребия
  const crng = brng;
  if (cfg.COMP) { const w0 = Math.max(1, T - cfg.H + 2), Wc = mkRes(w0, t1), C = CP.candidates(B, c, w0, t1, Wc, crng); ops += C.ops;
    ntests['сборка'] = 0; best3['сборка'] = { g: cfg.MGAIN, z: 0, tpl: null }; const M = B.mem; M.cacc = M.cacc || new Map();
    M.ctries = M.ctries || new Map(); M.ctries.set(c.k, (M.ctries.get(c.k) || 0) + C.list.length);   // сколько сборок примерено для канала (мера этапа 3)
    // CFAST=3: счёт без сброса (накопить с λ = 1 без сброса) не примеряется: в жизни он растёт до потолка и стоит -- часы
    // эпохи, а не память о событиях (при примерке с чистого начала окна он ещё растёт, и проверки его не видят)
    const clock = (q) => (q.op === 'накопить' && q.lam === 1 && !q.z) || ['a', 'b', 'w', 'v', 'r', 'z'].some((k) => q[k] && clock(q[k]));
    for (const n of C.list) { if (cfg.CFAST >= 3 && clock(n)) continue; const f = CP.compile(n), sz = CP.size(n); let tt = -1, v = 0, prev = NaN, ch = 0; const ys = cfg.CFAST ? new Float64Array(t1 - w0 + 1) : null;
      const [g, z] = score((t) => { if (t !== tt) { v = f((k) => G.at(t, B.ch[k].good)); tt = t; if (v !== prev) ch++; prev = v; if (ys) ys[t - w0] = v; } return v; }, 'сборка', Wc); ops += (t1 - w0) * sz;
      // память, которая на записи почти не меняется (ступенька «однажды было» -- держать(событие, единица)), объясняет не
      // события, а сдвиг среднего остатка; такая не примеряется
      if (!(z > 1) || ch < 8) continue;
      // CFAST: и не примеряются (1) пересказ -- сборка почти совпадает со своей копией без памяти; (2) часы -- больше половины
      // разброса выхода медленное (скользящее среднее за 32 круга): счёт без сброса и защёлка без чтения отмечают не
      // события, а эпоху жизни (сдвиг мира), и части держатся за них вместо понятий
      if (ys && z > 1) { const ff = CP.compileFresh(n), L = ys.length; let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
        for (let i = 0; i < L; i++) { const t = w0 + i, x = ys[i], y = ff((k) => G.at(t, B.ch[k].good)); sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
        const vx = sxx - sx * sx / L, vy = syy - sy * sy / L; ops += L * sz * 2;
        if (vx > 1e-12 && vy > 1e-12 && (sxy - sx * sy / L) / Math.sqrt(vx * vy) > 0.95) continue;
        let a2 = 0, sl = 0, sl2 = 0; const Wn = 32, ma = []; for (let i = 0; i < L; i++) { a2 += ys[i]; if (i >= Wn) a2 -= ys[i - Wn]; if (i >= Wn - 1) ma.push(a2 / Wn); }
        for (const m of ma) { sl += m; sl2 += m * m; } const vs = ma.length ? sl2 / ma.length - (sl / ma.length) ** 2 : 0;
        if (vx > 1e-12 && vs > 0.5 * vx / L) continue;
        // CFAST=2: и часы за чтением -- по ряду ненулевых выходов (круги, где сборка что-то говорит): счёт без сброса,
        // прочитанный при событии, и «обычное», которое сползает, -- медленные и в этом ряду (скользящее среднее по 8)
        // CFAST=3: проверки за чтением -- по второй половине окна: сборка проигрывается с начала окна с чистым состоянием, и в
        // первой половине счёт без сброса ещё растёт, а давно не писанная защёлка ещё свежа; в жизни орган давно прогрет
        const h0 = cfg.CFAST >= 3 ? L >> 1 : 0;
        if (cfg.CFAST >= 2) { const nz = []; for (let i = h0; i < L; i++) if (ys[i] !== 0) nz.push(ys[i]);
          if (nz.length >= 16) { let m1 = 0, q1 = 0; for (const x of nz) { m1 += x; q1 += x * x; } m1 /= nz.length; const vn = q1 / nz.length - m1 * m1;
            let b2 = 0; const mb = []; for (let i = 0; i < nz.length; i++) { b2 += nz[i]; if (i >= 8) b2 -= nz[i - 8]; if (i >= 7) mb.push(b2 / 8); }
            let s1 = 0, s2 = 0; for (const m of mb) { s1 += m; s2 += m * m; } const vb = s2 / mb.length - (s1 / mb.length) ** 2;
            if (vn > 1e-9 && vb > 0.5 * vn) continue; }
          // и память должна нести знание сверх своего условия чтения (как у ручной защёлки): в кругах r выход почти
          // постоянен -- это сам нерв r (защёлка, которую давно не писали, -- то же, что «звучит r»)
          if (n.op === 'при' || n.op === 'отклонение') { const rf = CP.compile(n.r); let nr = 0, sm = 0, sq = 0, chg = 0, pv = NaN;
            for (let i = 0; i < L; i++) { const t = w0 + i; if (rf((k) => G.at(t, B.ch[k].good)) && i >= h0) { nr++; sm += ys[i]; sq += ys[i] * ys[i]; if (nr > 1 && Math.abs(ys[i] - pv) > 1e-6) chg++; pv = ys[i]; } }
            if (nr < (h0 ? 6 : 10) || sq / nr - (sm / nr) ** 2 < 0.05 * sq / nr + 1e-9) continue;
            // CFAST=3: и меняться от чтения к чтению -- ступенька (счёт за окно до сдвига мира, потом постоянный) меняется
            // в нескольких чтениях из десятков; память о событиях -- в заметной доле
            if (cfg.CFAST >= 3 && chg < Math.max(4, 0.15 * nr)) continue; } } }
      const ak = c.k + ' ' + CP.key(n), a = M.cacc.get(ak) || { z: 0, g: 0, n: 0, t: -Infinity }; if (w0 > a.t) { a.z += z; a.g += g; a.n++; a.t = t1; M.cacc.set(ak, a); }
      // CRPT: сборка строится, только если повторилась на CRPT непересекающихся отрезках записи (сила -- средняя по ним):
      // чёт/нечет одного окна не отличает закономерность от совпадения этого окна
      if (cfg.CRPT && a.n < cfg.CRPT) continue;
      const za = cfg.CRPT ? a.z / Math.sqrt(a.n) : Math.max(z, a.z / Math.sqrt(a.n)), ga = a.n > 1 ? a.g / a.n : g;
      // при равной силе -- меньшая сборка (проще объяснение)
      if (ga > best3['сборка'].g * (1 + 0.02 * (sz - (best3['сборка'].sz || sz)))) best3['сборка'] = { g: ga, z: za, sz, tpl: { type: 'сборка', prog: n } }; }
    ntests['сборка'] = Math.max(2, C.total);
    // PLONG: если по записи товаров сборка не нашлась -- те же сборки по долгой записи событий (вопрос через сотни кругов:
    // в 512 кругах записи один-два эпизода)
    const zc = Math.sqrt(2 * Math.log(ntests['сборка'])) + 1.5;
    if (cfg.PLONG && B.lrec && !(best3['сборка'].tpl && best3['сборка'].z > zc)) { const CL2 = CP.candidatesLong(B, c, crng); ops += CL2.ops; const zl = Math.sqrt(2 * Math.log(Math.max(2, CL2.total))) + 1.5;
      // CFAST: по долгой записи -- только сборки из событий, редких и в окне записи (меньше 8 раз): частое событие окно видит
      // само, с проверкой на нечётных кругах; у долгой записи её нет, и на частых событиях она находила совпадения
      const rareW = new Map(), isRare = (k, md) => { if (!rareW.has(k)) { let n2 = 0; const gk = B.ch[k].good; for (let t = w0; t <= t1; t++) if (G.at(t, gk) > md) n2++; rareW.set(k, n2 < 8); ops += t1 - w0; } return rareW.get(k); };
      for (const n of CL2.list) { if (cfg.CFAST >= 3 && clock(n)) continue; if (cfg.CFAST) { const lv = []; (function walk(q) { if (q.op === 'событие') lv.push([q.k, q.mid]); if (q.K) for (const x of q.K) lv.push(x); for (const k of ['a', 'b', 'w', 'v', 'r', 'z']) if (q[k]) walk(q[k]); })(n); if (!lv.every(([k, md]) => isRare(k, md))) continue; }
        const L = CP.scoreLong(B, c, n); if (!L) break; ops += L.ops;
      if (L.z > zl && L.g > cfg.MGAIN && L.g > (best3['сборка'].long ? best3['сборка'].g : 0)) best3['сборка'] = { g: L.g, z: Math.max(L.z, zc + 1e-9), long: true, tpl: { type: 'сборка', prog: n, long: { w: L.w, n: L.n } } }; } } }
  // похожесть: ключи по записи, ответ на каждом круге окна -- по более ранним кругам записи (точный перебор)
  // окно похожести -- вся запись, кроме первых 128 кругов (им не с чем сравнивать): на 128 кругах окна колец (по 64 на
  // половину) порог требовал объяснить 11% остатка, и метка «8» оставалась без органа и без частей
  if (cfg.SIM) { const K0 = Math.max(1, T - cfg.H + 1), sk = simKeys(B, c, Math.max(K0, t0 - 256), t1), Ws = T - K0 > 300 ? mkRes(K0 + 128, t1) : W0;
    if (sk) { const m = sk.keys.length, z = (t) => sk.keys.map((k, i) => sk.kw[i] * (G.at(t, B.ch[k].good) - sk.mu[i]) / (sk.sd[i] || 1));
      const Zc = new Map(); const zz = (t) => { if (!Zc.has(t)) Zc.set(t, z(t)); return Zc.get(t); };
      const [g, zt] = score((t) => { const zq = zz(t), bd = new Float64Array(cfg.SIMK).fill(Infinity), bb = new Int32Array(cfg.SIMK).fill(-1);
        for (let r = K0; r < t; r++) { const zr = zz(r); let d = 0; for (let i = 0; i < m && d < bd[cfg.SIMK - 1]; i++) { const y = zr[i] - zq[i]; d += y * y; }
          if (d < bd[cfg.SIMK - 1]) { let q = cfg.SIMK - 1; while (q > 0 && bd[q - 1] > d) { bd[q] = bd[q - 1]; bb[q] = bb[q - 1]; q--; } bd[q] = d; bb[q] = r; } }
        let s2 = 0, n2 = 0; for (const r of bb) if (r >= 0) { s2 += G.at(r + 1, c.good); n2++; } return n2 ? s2 / n2 : NaN; }, 'похожесть', Ws);
      ops += Ws.res.length * (T - K0) * m / 2;
      if (g > best3['похожесть'].g) best3['похожесть'] = { g, z: zt, tpl: { type: 'похожесть', k: c.k, ...sk } }; } }
  B.led.work(a, ops);
  // из заготовок, прошедших свой порог, -- та, что объясняет больше
  let top = null;
  // MACC: редкие события -- в одном окне записи их мало; доказательство гипотезы копится от примерки к примерке (z
  // складываются: z1 + ... + zn над корнем из n), так заготовка, которая раз за разом лучшая, проходит порог со временем
  for (const [kind, b] of Object.entries(best3)) { const zc = Math.sqrt(2 * Math.log(Math.max(2, ntests[kind]))) + 1.5; let z = b.z, g = b.g;
    if (cfg.MACC && b.tpl && (kind === 'последний' || kind === 'след' || kind === 'защёлка')) { const M = B.mem, key = c.k + ' ' + JSON.stringify(b.tpl, (k, v) => (k === 'mg' || k === 'mx' || k === 'mh' ? undefined : k === 'X' ? v.map((x) => x[0]) : v)); /* без порогов: они чуть разные в каждом окне */ M.acc = M.acc || new Map();
      // MACC=2: копится только доказательство с нового отрезка записи. Примерки одного канала идут чаще, чем сменяется запись
      // (окна по 512 кругов перекрываются), и одна и та же удача считалась по нескольку раз: z росло как корень из числа
      // примерок, а не из данных, -- орган «последний» строился на 7% остатка и в сложении спорил с понятием
      const a = M.acc.get(key) || { z: 0, g: 0, n: 0, t: -Infinity }, fresh = cfg.MACC < 2 || t0 > a.t;
      if (fresh) { a.z += b.z; a.g += b.g; a.n++; a.t = t1; M.acc.set(key, a); }
      z = a.n ? a.z / Math.sqrt(a.n) : b.z; g = a.n ? a.g / a.n : b.g;
      // и заниженная планка (доля MGAIN / 3) и «слабая» гипотеза (без правила опоры) -- только после повторения на трёх
      // отрезках записи; с одного окна гипотеза проходит по обычной планке и с правилом опоры
      if (cfg.MACC >= 2 && a.n < 3 && (g < cfg.MGAIN || b.weak)) continue; }
    if (b.tpl && z > zc && (!top || g > top.g)) top = { ...b, g, z }; }
  if (process.env.DBGMEM) B.mem.log.push(`  примерка ${B.t} канал ${c.k} (${B.world.truth()[c.k]}, непонятость ${unexplained(B, c).toFixed(2)}): ` + Object.entries(best3).map(([k, b]) => `${k} g=${b.g.toFixed(2)} z=${b.z.toFixed(1)}/${(Math.sqrt(2 * Math.log(Math.max(2, ntests[k]))) + 1.5).toFixed(1)}`).join(', '));
  return top ? { ...top.tpl, gain: top.g } : null;
}
const valAtD = (G, t, d) => { const o = G.row(t); if (typeof d === 'number') return G.rec[o + d]; let v = 1; for (const id of d) v *= G.rec[o + id]; return Math.max(-16, Math.min(16, v)); };

function build(B, c, tpl) {
  const cfg = B.cfg, G = B.goods, a = B.mem.agent, M = B.mem;
  if (tpl.type === 'похожесть') return buildSim(B, c, tpl);
  if (tpl.type === 'защёлка' || tpl.type === 'след') return buildWM(B, c, tpl);
  if (tpl.type === 'пара') return buildPara(B, c, tpl);
  if (tpl.type === 'последний') return buildLast(B, c, tpl);
  if (tpl.type === 'сборка') return buildComp(B, c, tpl);
  const key = tpl.type === 'кольцо' ? `кольцо ${tpl.j}/${tpl.d}` : `таблица ${tpl.j}->${tpl.k}`;
  if (M.keys.has(key)) return null;
  const cells = tpl.type === 'кольцо' ? tpl.d + 1 : tpl.cuts.length + 1;
  const o = B.led.open('память', a, cfg.OCRED, { ...tpl, key, mem: 4 + cells, payTo: false, incLast: 0, born: B.t, client: c.k });
  if (o.type === 'таблица') { o.last = new Float64Array(cells); o.prevBin = -1; }
  o.good = G.add('память', o, -1, B.t);
  // прогрев: прошлые значения товара -- в запись
  const T = B.t, t0 = Math.max(1, T - cfg.H + 1); let first = T;
  if (o.type === 'кольцо') { const qg = B.ch[o.j].good; for (let t = t0; t < T; t++) if (t - o.d >= Math.max(t0, G.since[qg])) { G.rec[G.row(t) + o.good] = G.at(t - o.d, qg); first = Math.min(first, t); } }
  else { const kg = B.ch[o.j].good, tg = B.ch[o.k].good; let prev = -1;
    let pp = 0; for (let t = Math.max(t0, G.since[kg]); t < T; t++) { if (prev >= 0 && pp > 0.9) o.last[prev] = G.at(t, tg); const [y, bn, pr] = softRead(o, G.at(t, kg)); prev = bn; pp = pr; G.rec[G.row(t) + o.good] = y; first = Math.min(first, t); }
    o.prevBin = prev; o.prevP = pp; }
  G.since[o.good] = first - 1;
  B.led.work(a, 4 * cfg.H);
  M.organs.push(o); M.keys.add(key); M.built++; B.orgGoods = organGoods(B);
  M.log.push(`круг ${B.t}: для канала ${c.k} -- ${o.type === 'кольцо' ? `кольцо «нерв ${o.j} за ${o.d} кругов»` : `таблица «за уровнем нерва ${o.j}», уровней ${o.cuts.length + 1}`} (объясняет ${(100 * tpl.gain).toFixed(0)}% остатка)`);
  // адресная доставка: части заказчика берут товар и подгоняют веса (за счёт строителя); частей нет -- строитель приводит одну
  if (!c.parts.length) { c.fails = 0; B.newPart(c, a, cfg.START, null); B.stat.imm++; }
  for (const p of c.parts) if (p.inputs.length < cfg.LMAX) { p.inputs.push(o.good); p.w = Float64Array.from([...p.w, 0]); p.x = null; B.memOf(p); const o0 = p.opsRound; B.fit(p); const used = p.opsRound - o0; p.opsRound = o0; B.led.work(a, used); }
  return o;
}

function buildWM(B, c, tpl) {
  const cfg = B.cfg, G = B.goods, a = B.mem.agent, M = B.mem, key = `${tpl.type} ${tpl.x}/${tpl.g}/${tpl.h}` + (tpl.lam ? `/${tpl.lam}` : '');
  if (M.keys.has(key)) return null;
  const o = B.led.open('память', a, cfg.OCRED, { ...tpl, key, mem: 6, payTo: false, incLast: 0, born: B.t, client: c.k, v: 0, tr: 0, lam: tpl.lam ?? cfg.WLAM });
  o.good = G.add('память', o, -1, B.t);
  const T = B.t, t0 = Math.max(1, T - cfg.H + 1, G.since[B.ch[o.x].good] + 1, G.since[B.ch[o.g].good] + 1);
  for (let t = t0; t < T; t++) G.rec[G.row(t) + o.good] = wmStep(o, G.at(t, B.ch[o.x].good), G.at(t, B.ch[o.g].good), o.h >= 0 ? G.at(t, B.ch[o.h].good) : 0);
  G.since[o.good] = t0 - 1; B.led.work(a, 4 * cfg.H);
  M.organs.push(o); M.keys.add(key); M.built++; B.orgGoods = organGoods(B);
  M.log.push(`круг ${B.t}: для канала ${c.k} -- ${o.type === 'защёлка' ? `защёлка «нерв ${o.x}, каким был при нерве ${o.g}»${o.h >= 0 ? `, в круге нерва ${o.h}` : ''}` : `след «нерв ${o.x} недавно, в круге нерва ${o.g}»`} (объясняет ${(100 * tpl.gain).toFixed(0)}% остатка)`);
  deliver(B, c, o.good);
  return o;
}
function buildPara(B, c, tpl) {
  const cfg = B.cfg, G = B.goods, a = B.mem.agent, M = B.mem, key = `пара ${tpl.X.map((x) => x[0]).join('/')}:${tpl.m}`;
  if (M.keys.has(key)) return null;
  const o = B.led.open('память', a, cfg.OCRED, { ...tpl, key, st: new Map(), mem: 6 + tpl.K.length, payTo: false, incLast: 0, born: B.t, client: c.k });
  o.good = G.add('память', o, -1, B.t);
  const T = B.t, t0 = Math.max(1, T - cfg.H + 1, ...[...tpl.X, ...tpl.K].map(([k]) => G.since[B.ch[k].good] + 1));
  // PLONG: орган, найденный по долгой записи, сначала проигрывает её -- помнит факты, сказанные задолго до записи товаров
  if (tpl.long && B.lrec) { for (const r of B.lrec.rows) { if (r.t >= t0) break; paraStep(o, (k) => r.v[k]); } B.led.work(a, B.lrec.rows.length * (2 + o.K.length)); }
  for (let t = t0; t < T; t++) G.rec[G.row(t) + o.good] = paraStep(o, (k) => G.at(t, B.ch[k].good));
  G.since[o.good] = t0 - 1; B.led.work(a, 4 * cfg.H);
  // и канал помнит связь с опорой на долгую запись (KPRIOR): n кругов чтения как старые наблюдения -- подгонка на записи
  // товаров, где таких кругов один-два, её не сотрёт
  if (tpl.long && cfg.KPRIOR) { c.keep = c.keep || new Map(); c.keep.set('g' + o.good, { d: o.good, w: tpl.long.w, n: tpl.long.n, t: B.t - cfg.H - 1 }); }
  M.organs.push(o); M.keys.add(key); M.built++; B.orgGoods = organGoods(B);
  M.log.push(`круг ${B.t}: для канала ${c.k} -- пара «нервы ${tpl.X.map((x) => x[0]).join(' / ')} при ключах ${tpl.K.map((x) => x[0]).join(', ')}, слово ${tpl.m}» (объясняет ${(100 * tpl.gain).toFixed(0)}% остатка)`);
  deliver(B, c, o.good);
  return o;
}
// COMP: орган-сборка. Прогрев: сборка проигрывается по записи (её прошлые значения -- в запись) и продолжает жить с того же
// состояния. Аренда -- за кирпичики (память) и шаги (работа), как у всех органов
function buildComp(B, c, tpl) {
  const cfg = B.cfg, G = B.goods, a = B.mem.agent, M = B.mem, key = 'сборка ' + CP.key(tpl.prog);
  if (M.keys.has(key)) return null;
  const sz = CP.size(tpl.prog), o = B.led.open('память', a, cfg.OCRED, { type: 'сборка', prog: tpl.prog, key, size: sz, mem: 4 + sz, payTo: false, incLast: 0, born: B.t, client: c.k });
  o.f = CP.compile(tpl.prog); o.good = G.add('память', o, -1, B.t);
  o.evl = []; (function lv(n) { if (n.op === 'событие') o.evl.push([n.k, n.mid]); if (n.K) for (const x of n.K) o.evl.push(x); for (const k of ['a', 'b', 'w', 'v', 'r', 'z']) if (n[k]) lv(n[k]); })(tpl.prog);
  const T = B.t, t0 = Math.max(1, T - cfg.H + 1);
  // найденная по долгой записи -- сначала проигрывает её (помнит давнее), и канал помнит связь с опорой на неё (KPRIOR)
  if (tpl.long && B.lrec) { for (const r of B.lrec.rows) { if (r.t >= t0) break; o.f((k) => r.v[k]); } B.led.work(a, B.lrec.rows.length * sz); }
  for (let t = t0; t < T; t++) G.rec[G.row(t) + o.good] = o.f((k) => G.at(t, B.ch[k].good));
  G.since[o.good] = t0 - 1; B.led.work(a, 4 * cfg.H * sz);
  if (tpl.long && cfg.KPRIOR) { c.keep = c.keep || new Map(); c.keep.set('g' + o.good, { d: o.good, w: tpl.long.w, n: tpl.long.n, t: B.t - cfg.H - 1 }); }
  M.organs.push(o); M.keys.add(key); M.built++; B.orgGoods = organGoods(B);
  M.log.push(`круг ${B.t}: для канала ${c.k} -- сборка «${CP.show(tpl.prog)}» (объясняет ${(100 * tpl.gain).toFixed(0)}% остатка; примерено сборок для канала: ${(M.ctries && M.ctries.get(c.k)) || 0})`);
  deliver(B, c, o.good);
  return o;
}
function buildLast(B, c, tpl) {
  const cfg = B.cfg, G = B.goods, a = B.mem.agent, M = B.mem, key = `последний ${tpl.X.map((x) => x[0]).join('/')}:${tpl.m}:${tpl.g}`;
  if (M.keys.has(key)) return null;
  const o = B.led.open('память', a, cfg.OCRED, { ...tpl, key, cur: -1, mem: 4 + tpl.X.length, payTo: false, incLast: 0, born: B.t, client: c.k });
  o.outs = tpl.X.map(() => G.add('память', o, -1, B.t)); o.good = o.outs[tpl.m];
  const T = B.t, t0 = Math.max(1, T - cfg.H + 1, ...tpl.X.map(([k]) => G.since[B.ch[k].good] + 1), tpl.g >= 0 ? G.since[B.ch[tpl.g].good] + 1 : 1);
  for (let t = t0; t < T; t++) { const val = (k) => G.at(t, B.ch[k].good); lastStep(o, val); for (let i = 0; i < o.outs.length; i++) G.rec[G.row(t) + o.outs[i]] = lastOut(o, i, val); }
  for (const id of o.outs) G.since[id] = t0 - 1; B.led.work(a, 4 * cfg.H * o.outs.length);
  M.organs.push(o); M.keys.add(key); M.built++; B.orgGoods = organGoods(B);
  M.log.push(`круг ${B.t}: для канала ${c.k} -- последний из группы «нервы ${tpl.X.map((x) => x[0]).join(' / ')}, слово ${tpl.m}${tpl.g >= 0 ? `, в круге нерва ${tpl.g}` : ''}» (объясняет ${(100 * tpl.gain).toFixed(0)}% остатка)`);
  deliver(B, c, o.good);
  return o;
}
// похожесть: орган с почти теми же ключами есть -- ему новый выход; нет -- новый орган с архивом, прогретым по записи
function buildSim(B, c, tpl) {
  const cfg = B.cfg, G = B.goods, a = B.mem.agent, M = B.mem;
  if (M.organs.some((x) => x.type === 'похожесть' && x.targets.some((t) => t.k === c.k))) return null;   // второй орган похожести тому же каналу -- двойник
  let o = M.organs.find((x) => x.type === 'похожесть' && x.targets.length < TMAX && !x.targets.some((t) => t.k === c.k) && tpl.keys.filter((k) => x.keys.includes(k)).length >= cfg.SIMSHARE * tpl.keys.length);
  let grew = !!o;
  if (!o) {
    // ключи органа -- общие для всех, кому он подойдёт: объединение ключей частично понятых каналов, во многом совпадающих с
    // ключами заказчика; вес нерва -- наибольший из нужных им (у каждой цифры свои различающие пиксели)
    { const T = B.t, t1 = T - 1, t0 = Math.max(1, T - cfg.H + 1), W = new Map(), MU = new Map(), SD = new Map();
      const addK = (sk) => sk.keys.forEach((k, i) => { if (!W.has(k) || W.get(k) < sk.kw[i]) W.set(k, sk.kw[i]); MU.set(k, sk.mu[i]); SD.set(k, sk.sd[i]); });
      addK(tpl);
      for (const q of B.ch) { if (q === c) continue; const u = unexplained(B, q); if (u <= cfg.MNEED || u > 0.95) continue;
        const sk = simKeys(B, q, Math.max(t0, t1 - 255), t1); if (sk && sk.sig && sk.keys.filter((k) => tpl.keys.includes(k)).length >= cfg.SIMSHARE * sk.keys.length) addK(sk); }
      const top = [...W.entries()].sort((x, y) => y[1] - x[1]).slice(0, cfg.SIMKM).map((x) => x[0]).sort((x, y) => x - y);
      tpl = { ...tpl, keys: top, kw: top.map((k) => W.get(k)), mu: top.map((k) => MU.get(k)), sd: top.map((k) => SD.get(k)) }; }
    const m = tpl.keys.length, key = `похожесть ${M.built}`;
    o = B.led.open('память', a, cfg.SCRED, { type: 'похожесть', key, keys: tpl.keys, kw: tpl.kw, mu: tpl.mu, sd: tpl.sd, targets: [], cfg, payTo: false, incLast: 0, born: B.t,
      mem: 8 + cfg.SIMA * (m + TMAX) + (cfg.SIMT << cfg.SIMB) * cfg.SIMSL, n: 0, Z: new Float32Array(cfg.SIMA * m), Y: new Float32Array(cfg.SIMA * TMAX).fill(NaN),
      cells: new Int32Array((cfg.SIMT << cfg.SIMB) * cfg.SIMSL).fill(-1), pos: new Uint8Array(cfg.SIMT << cfg.SIMB), R: new Int8Array(cfg.SIMT * cfg.SIMB * m), rowT: new Int32Array(cfg.SIMA) });
    for (let i = 0; i < o.R.length; i++) o.R[i] = B.rng() < 0.5 ? -1 : 1;
    // архив из записи: строка круга t -- ключи круга t; номер строки по кругу -- для прогрева новых выходов
    const T = B.t, t0 = Math.max(1, T - cfg.H + 1), base = o.n, rowAt = new Map();
    for (let t = t0; t < T; t++) { const z = simZ(B, o, t); rowAt.set(t, o.n); o.rowT[o.n % cfg.SIMA] = t; simInsert(o, z, simIds(o, z), []); }
    o.rowOf = (t) => (rowAt.has(t) ? rowAt.get(t) : t < t0 ? base : o.n);
    o.prevZ = null; B.led.work(a, (T - t0) * cfg.SIMT * cfg.SIMB * m);
    M.organs.push(o); M.keys.add(key); M.built++;
  }
  const tg = simAddTarget(B, o, c);
  // строка, которую орган вставит в этом круге, -- нынешний круг
  M.log.push(`круг ${B.t}: для канала ${c.k} -- ${grew ? `выход у органа «${o.key}»` : `похожесть «${o.key}», ключей ${o.keys.length}`} (объясняет ${(100 * tpl.gain).toFixed(0)}% остатка)`);
  deliver(B, c, tg.good);
  if (!grew) grow(B, o);
  return o;
}
// рост по спросу: частично понятым каналам (не шуму) с во многом теми же ключами -- выход у этого органа (ключи -- дёшево)
function grow(B, o) {
  const cfg = B.cfg, M = B.mem, T = B.t, t1 = T - 1, t0 = Math.max(1, T - cfg.H + 1);
  for (const q of B.ch) { if (o.targets.length >= TMAX || !M.agent) break;
    { const u = unexplained(B, q); if (o.targets.some((x) => x.k === q.k) || u <= cfg.MNEED || u > 0.95) continue; }   // совсем непредсказуемые (шум) -- нет
    const sk = simKeys(B, q, Math.max(t0, t1 - 255), t1); if (!sk || !sk.sig || sk.keys.filter((k) => o.keys.includes(k)).length < cfg.SIMSHARE * sk.keys.length) continue;
    const t2 = simAddTarget(B, o, q); deliver(B, q, t2.good); q.memNext = B.t + cfg.MSCAN * 4;
    M.log.push(`круг ${B.t}: для канала ${q.k} -- выход у органа «${o.key}» (ключи во многом те же)`); }
}
function deliver(B, c, good) {               // адресная доставка за счёт строителя; частей нет -- строитель приводит одну
  const cfg = B.cfg, a = B.mem.agent;
  if (!c.parts.length) { c.fails = 0; B.newPart(c, a, cfg.START, null); B.stat.imm++; }
  for (const p of c.parts) if (p.inputs.length < cfg.LMAX) { p.inputs.push(good); p.w = Float64Array.from([...p.w, 0]); p.x = null; B.memOf(p); const o0 = p.opsRound; B.fit(p); const used = p.opsRound - o0; p.opsRound = o0; B.led.work(a, used); }
}

// WOFFER: память, предложенная решениям. Группы событий, которые никогда не звучат вместе и звучат примерно одинаково часто
// (звуки, слова), -- до WOFFER групп; по каждой -- орган «последний» с выходами «последнее» и «предпоследнее» событие группы.
// Ни одному каналу он не доставляется: его товары видят органы выбора и берут, если они объясняют плату
function offer(B) {
  const cfg = B.cfg, G = B.goods, M = B.mem, EV = require('./concepts').events, T = B.t, w0 = Math.max(1, T - cfg.H + 2), t1 = T - 1, on = new Map();
  if ((M.offered || 0) >= cfg.WOFFER) return;
  for (const q of B.ch) { if (G.since[q.good] >= w0) continue; const e = EV(B, q.good, w0, t1); if (e && e.f <= 0.5 && e.n >= 10) on.set(q.k, e); }   // звуки речи звучат часто -- до половины кругов
  const ks = [...on.keys()].sort((a, b) => on.get(b).n - on.get(a).n).slice(0, 16), co = (a, b) => { const x = on.get(a).on, y = on.get(b).on; let n = 0; for (let i = 0; i < x.length; i++) if (x[i] && y[i]) n++; return n; };
  const near = (a, b) => { const r = on.get(a).n / on.get(b).n; return r > 0.25 && r < 4; };
  const cands = [];   // сначала -- самые большие группы (звуки одного рта), без пересечений
  for (const a of ks) { const gr = [a], byN = ks.filter((b) => b !== a).sort((x, y) => Math.abs(Math.log(on.get(x).n / on.get(a).n)) - Math.abs(Math.log(on.get(y).n / on.get(a).n)));
    for (const b of byN) if (gr.every((x) => co(x, b) === 0 && near(x, b))) { gr.push(b); if (gr.length >= 6) break; }
    if (gr.length >= 2) cands.push(gr.sort((x, y) => x - y)); }
  cands.sort((x, y) => y.length - x.length);
  for (const gr of cands) { if ((M.offered || 0) >= cfg.WOFFER) break; const key = `предложение ${gr.join('/')}`;
    if (M.keys.has(key) || M.organs.some((o) => o.offer && gr.some((k) => o.X.some((x) => x[0] === k)))) continue;
    const o = B.led.open('память', 'bank', 0, { type: 'последний', X: gr.map((k) => [k, on.get(k).mid]), m: 0, g: -1, mg: 0, cur: -1, prevCur: -1, key, free: true, offer: true, mem: 4, payTo: false, incLast: 0, born: T, client: -1 });
    o.outs = [...gr, ...gr].map(() => G.add('память', o, -1, T)); o.good = o.outs[0];
    const t0 = Math.max(1, T - cfg.H + 1, ...gr.map((k) => G.since[B.ch[k].good] + 1));
    for (let t = t0; t < T; t++) { lastStep(o, (k) => G.at(t, B.ch[k].good)); offerOut(o, (i, v) => { G.rec[G.row(t) + o.outs[i]] = v; }); }
    for (const id of o.outs) G.since[id] = t0 - 1;
    M.organs.push(o); M.keys.add(key); M.offered = (M.offered || 0) + 1; B.orgGoods = organGoods(B);
    M.log.push(`круг ${T}: память для решений -- последнее и предпоследнее из группы «нервы ${gr.join(' / ')}»`); }
}
function think(B) {
  const cfg = B.cfg, M = B.mem; if (!cfg.MEM) return;
  if (B.t % cfg.MSCAN !== 0 || B.t < cfg.H) return;
  if (cfg.WOFFER && B.t % (4 * cfg.MSCAN) === 0) offer(B);
  if (B.t % (5 * cfg.MSCAN) === 0 && M.agent) for (const o of M.organs) if (o.type === 'похожесть') grow(B, o);   // готовые органы похожести растут по спросу
  // кому нужна память: канал плохо понят и давно не смотрен
  // MNEW: канал, который ожил (разброс вчетверо больше, чем при прошлой примерке: молчавший нерв ответа заговорил), смотрится
  // снова сразу -- прежние неудачи были о другом канале. Иначе после многих неудач на молчании (откладывание вдвое) новый
  // смысл канала ждал примерки 6 000 кругов
  if (cfg.MNEW) for (const c of B.ch) if (c.memVar !== undefined && c.var > 4 * Math.max(c.memVar, 1e-4)) { c.memFails = 0; c.memNext = 0; c.memVar = c.var; }
  const due = B.ch.filter((c) => !c.asleep && unexplained(B, c) > cfg.MNEED && B.t >= (c.memNext || 0));
  if (!due.length) return;
  if (!M.agent) M.agent = B.led.open('строитель', 'bank', cfg.BCRED, { payTo: false, mem: 8 });
  // нервы одного выбора и орган клонов -- раз в 1 000 кругов, пока органа нет (не нашлось -- через 4 000)
  // две заготовки для потока знаков: граф клонов (CLONES) и счёт контекстов (CTX); нет живой -- строится заново
  const needC = cfg.CLONES && !M.organs.some((o) => o.type === 'клоны'), needX = cfg.CTX && !M.organs.some((o) => o.type === 'контекст');
  if ((needC || needX) && B.t % 1000 === 0 && B.t >= (M.cloneNext || 0)) {
    const g = CL.catGroup(B), gain = g ? CL.bigramGain(B, g) : 0;
    if (g && gain > cfg.CGAIN) { for (const o of [needC ? CL.buildClones(B, g, gain) : null, needX ? CL.buildCtx(B, g, gain) : null]) if (o) {
      B.orgGoods = organGoods(B); for (let i = 0; i < o.ks.length; i++) deliver(B, B.ch[o.ks[i]], o.outs[i]); } }
    else { M.cloneNext = B.t + 4000; if (g && process.env.DBGMEM) M.log.push(`  круг ${B.t}: нервы одного выбора -- ${g.ks.length}, но поток по прошлому знаку не предсказуем (${gain.toFixed(3)} бита)`); }
    if (!M.agent) return; }
  // очередь: сначала те, где ещё не искали; среди них -- самые «обучаемые»: понятые частично (непонятость x понятость + малая
  // добавка непонятости), а не совсем непредсказуемые -- те скорее шум (пиксели случайной картинки); как исследование по
  // прогрессу обучения (Oudeyer, Kaplan 2007)
  const learn = (c) => { const u = unexplained(B, c); return u * (1 - u) + 0.05 * u; };
  // CSWEEP: канал, который перебирают без откладывания, не должен занимать строителя целиком -- в очереди первыми те, кого
  // смотрели меньше всего раз
  if (cfg.CSWEEP) due.sort((x, y) => (x.memScans || 0) - (y.memScans || 0) || learn(y) - learn(x)); else
  due.sort((x, y) => (x.memFails || 0) - (y.memFails || 0) || learn(y) - learn(x));
  for (const c of due.slice(0, Math.min(cfg.MPER, Math.ceil(due.length / cfg.MDUE)))) {   // примерок за раз -- по непонятости мира: одна на MDUE непонятых каналов
    if (!M.agent) break;
    if (B.t < (c.memNext || 0)) continue;     // в этом же круге канал уже получил выход органа (рост) -- остаток ещё без него
    M.scanned++; c.memScans = (c.memScans || 0) + 1;
    const tpl = scan(B, c);
    const o = tpl ? build(B, c, tpl) : null;
    c.memFails = o ? 0 : cfg.CSWEEP && c.sweepLeft > 0 ? (c.memFails || 0) : (c.memFails || 0) + 1;   // CSWEEP: пока язык не пройден весь -- не неудача
    c.memNext = B.t + cfg.MSCAN * 4 * 2 ** Math.min(c.memFails, 4);   // не нашлось -- смотреть вдвое реже
    if (cfg.MNEW) c.memVar = c.var;
  }
}

function economy(B) {
  const cfg = B.cfg, M = B.mem, led = B.led;
  for (const o of M.organs.slice()) {
    if (o.free) { o.age++; continue; }   // WOFFER: память для решений -- общая, без аренды (органы выбора за товары не платят)
    // HIB (раунд 9): орган, чей заказчик спит, спит с ним -- без аренды и без голода
    if (cfg.HIB && o.client !== undefined && B.ch[o.client] && B.ch[o.client].asleep) { o.age++; o.hungry = 0; o.incLast = o.inc; o.inc = 0; continue; }
    // CGROW (раунд 7): сборка, прожившая 500 кругов в плюсе, отдаёт языку свои части с состоянием (держать / накопить /
    // по-ключу со всем, что под ними) -- со своими нервами: они становятся листьями «что держать», из них собираются органы
    // глубже (как DreamCoder: удачный кусок программы -- новое слово языка). До 8 последних слов
    if (cfg.CGROW && o.type === 'сборка' && !o.inWords && o.age >= 500 && o.incAvg > (o.rentAvg ?? 0)) { o.inWords = true; M.words = M.words || [];
      (function walk(n) { if (n.op === 'держать' || n.op === 'накопить' || n.op === 'по-ключу') { const k = CP.key(n); if (!M.words.some((w) => CP.key(w) === k)) { M.words.push(n); if (M.words.length > 8) M.words.shift(); M.log.push(`круг ${B.t}: новое слово языка -- «${CP.show(n)}» (из «${CP.show(o.prog)}»)`); } }
        for (const q of ['a', 'b', 'w', 'v', 'r', 'z']) if (n[q]) walk(n[q]); })(o.prog); }
    // CLIB: сборка, прожившая 500 кругов в плюсе, -- в библиотеку (её устройство пробуется первым на других каналах)
    if (cfg.CLIB && o.type === 'сборка' && !o.inLib && o.age >= 500 && o.incAvg > (o.rentAvg ?? 0)) { o.inLib = true; M.lib = M.lib || []; if (!M.lib.some((p) => CP.shape(p) === CP.shape(o.prog))) { M.lib.push(o.prog); M.log.push(`круг ${B.t}: в библиотеку -- устройство «${CP.shape(o.prog)}» (из «${CP.show(o.prog)}»)`); } }
    // PLONG: пара платит за место, только когда звучат её слова: хранить факт дёшево, дорого -- читать
    let idle = false; if (cfg.PLONG && o.type === 'пара') { idle = true; const G = B.goods; for (const [k, md] of [...o.X, ...o.K]) if (G.val[B.ch[k].good] > md) { idle = false; break; } }
    if (cfg.PLONG && o.type === 'сборка' && o.evl && o.evl.length) { idle = true; const G = B.goods; for (const [k, md] of o.evl) if (G.val[B.ch[k].good] > md) { idle = false; break; } }   // и сборка из событий
    o.age++; let rent; if (idle) { const m0 = o.mem; o.mem = 0; rent = led.rent(o, 0); o.mem = m0; } else rent = led.rent(o, cfg.RENT);
    const inc = o.inc; o.incLast = inc; o.inc = 0; o.incAvg += 0.01 * (inc - o.incAvg);
    if (inc > rent && M.agent && M.agent.alive) led.move(o, M.agent, cfg.ESHARE * (inc - rent), 'память->строитель: доля строителя');   // доля прибыли, а не дохода
    const cap = o.cap || cfg.CAP; if (o.credit > cap) led.move(o, 'bank', o.credit - cap, 'память->банк: налог сверх потолка');   // орган клонов копит на проход учёбы
    o.hungry = o.credit < 0 ? o.hungry + 1 : 0;
    if (o.hungry > cfg.DIE) {
      led.close(o); M.organs.splice(M.organs.indexOf(o), 1); M.keys.delete(o.key);
      const G = B.goods, deadAll = o.type === 'похожесть' ? o.targets.map((t) => t.good) : o.type === 'клоны' || o.type === 'контекст' || o.type === 'последний' ? o.outs : [o.good];
      for (const dead of deadAll) { G.kill(dead);
        for (const q of B.ch) { for (const p of q.parts) { const i = p.inputs.indexOf(dead); if (i >= 0) { p.inputs.splice(i, 1); p.w = Float64Array.from([...p.w.slice(0, i), ...p.w.slice(i + 1)]); p.share = null; p.x = null; B.memOf(p); } }
          if (q.note && q.note.inputs.includes(dead)) q.note = null; } }
      B.orgGoods = organGoods(B);
      M.log.push(`круг ${B.t}: орган памяти «${o.key}» разорился`);
    }
  }
  const a = M.agent;
  if (a) { a.age++; led.rent(a, cfg.RENT); a.incLast = a.inc; a.inc = 0;
    if (a.credit > 4 * cfg.CAP) led.move(a, 'bank', a.credit - 4 * cfg.CAP, 'строитель->банк: налог сверх потолка');
    a.hungry = a.credit < 0 ? a.hungry + 1 : 0;
    if (a.hungry > cfg.DIE) { led.close(a); M.agent = null; } }
}
module.exports = { init, sell, think, economy, unexplained, wmThrough };

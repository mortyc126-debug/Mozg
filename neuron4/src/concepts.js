'use strict';
// Орган понятий (CONC=1). Понятие -- общая переменная за несколькими нервами, которые играют одну и ту же роль в том, что
// мозг предсказывает. Пример: часть канала «предмет» читает слово a с весом 0.97 и слово b с весом 0.95 -- значит, a и b
// для неё одно и то же (два имени одной вещи). Или часть читает «первое × вверх» с весом +1 и «первое × вниз» с весом -1 --
// значит, «вверх» и «вниз» -- одна переменная «куда» со знаком. Понятие -- товар: сумма своих нервов с весами,
// C = sum w_i [x_i включён]. Его покупают части, как любой товар, и платят ему роялти; не покупают -- оно разоряется.
//
// Что делает понятие большим, чем сумма нервов, -- два правила:
//   1. Веса понятия не забываются, пока нерв молчит. Если слово b долго не звучит, часть канала теряет вход b (его нет на
//      записи), а понятие помнит, что b -- то же, что a.
//   2. Мозг видит через понятия. Вход, в котором есть нерв понятия, части берут в виде понятия, если оно объясняет почти
//      столько же (не хуже чем на CTIE): поиск части сравнивает лучшего кандидата с ним же через понятие, а при рождении
//      понятия и раз в CSCAN кругов строитель предлагает частям заменить такие входы. Так свойство, выученное с одним
//      именем, привязывается к понятию -- и переносится на другое имя, которого рядом со свойством никогда не было.
//
// Кто может стать понятием: нервы-события (нерв почти всегда в покое, «включён» не больше CACT доли кругов) и
// взаимоисключающие (вместе почти никогда) -- имена, категории, стороны. Сигналы, которые меняются всё время (смеси,
// пиксели), не объединяются: у них «та же роль» значит другое.
const isProd = (d) => typeof d !== 'number';
const leavesOf = (d) => (isProd(d) ? d : [d]);
const keyOf = (d) => (isProd(d) ? 'p' + d.join(',') : 'g' + d);

function init(B) { B.cc = { list: [], viewOf: new Map(), log: [], built: 0 }; B.ccGoods = []; }

// значение понятия в этом круге -- до записи
function sell(B) {
  const G = B.goods;
  for (const o of B.cc.list) G.val[o.good] = valOf(o, (id) => G.val[id]), B.led.work(o, o.views.size);
}
// значение понятия: каждый нерв-вид читается как событие (выше своей середины -- 1, иначе 0; шум покоя не проходит), с весом
const valOf = (o, get) => { let v = 0; for (const [id, q] of o.views) if (get(id) > q.mid) v += q.w; return v; };
// признак d, где нерв-вид заменён понятием (все вхождения); степень одного нерва-события -- само событие (x^k = x), поэтому
// и через понятие -- само понятие; null -- нечего заменять
// «было или ждал» слова (FILL, src/market.js) для понятий -- то же слово: понятие строится и читается по самому нерву
const base = (G, id) => (G.kind[id] === 'ожидание' && G.owner[id] ? G.owner[id].good : id);
function through(B, d) {
  const G = B.goods, L = leavesOf(d); let changed = false;
  const out = L.map((id) => { const o = B.cc.viewOf.get(id) || B.cc.viewOf.get(base(G, id)); if (o && o.alive && G.alive[o.good]) { changed = true; return o.good; } return id; });
  if (!changed) return null;
  if (L.length > 1 && L.every((id) => id === L[0])) return out[0];
  // понятие дважды в одном признаке (не степень одного нерва) -- это уже «величина» понятия, а не оно само: не заменять
  const cnt = new Map(); for (const id of out) if (G.kind[id] === 'понятие') cnt.set(id, (cnt.get(id) || 0) + 1);
  for (const n of cnt.values()) if (n > 1) return null;
  out.sort((a, b) => a - b);
  return out.length === 1 ? out[0] : out;
}
// событийность нерва на записи: доля кругов «включён» (выше середины размаха)
function events(B, id, t0, t1) {
  const G = B.goods; let lo = Infinity, hi = -Infinity; for (let t = t0; t <= t1; t++) { const v = G.at(t, id); if (v < lo) lo = v; if (v > hi) hi = v; }
  const mid = (lo + hi) / 2, on = new Uint8Array(t1 - t0 + 1); let n = 0; if (!(hi - lo > 0.5)) return null;
  for (let t = t0; t <= t1; t++) if (G.at(t, id) > mid) { on[t - t0] = 1; n++; }
  return { on, n, f: n / (t1 - t0 + 1), mid, hi };
}
// опора сочетания (ESUP): в скольких кругах записи t0..t1 все его слова-события звучали вместе. Слово-событие -- нерв, который
// включён не больше CACT кругов, или понятие (включено, когда не 0); остальные листья (непрерывные нервы, прогнозы) опоры не
// требуют. Сочетание слов, которое ни разу не прозвучало, -- только шум чтения нервов: вес, подогнанный на шуме, на новом
// сочетании дал бы что попало. Значение сочетания мозг должен брать из его частей. Нет слов-событий -- Infinity.
// ev -- кэш событийности нервов на этот же отрезок записи
function support(B, d, t0, t1, ev) {
  const G = B.goods, on = []; let ops = 0;
  for (const id of new Set(isProd(d) ? d : [d])) {
    if (G.kind[id] === 'понятие') { on.push((t) => G.at(t, id) !== 0); continue; }
    if (G.kind[id] === 'ожидание' && B.evc && G.owner[id]) { const nid = G.owner[id].good; if (B.evc.known.has(nid)) { const mid = B.evc.mids.get(nid) ?? 0.5; on.push((t) => G.at(t, id) > mid); } continue; }
    if (G.kind[id] !== 'нерв') continue;
    // слово, которое мозг знает как слово (B.evc, src/market.js), -- по его середине, даже если на отрезке оно молчит
    if (B.evc && B.evc.known.has(id)) { const mid = B.evc.mids.get(id) ?? 0.5; on.push((t) => G.at(t, id) > mid); continue; }
    if (!ev.has(id)) { const e = events(B, id, t0, t1); ev.set(id, e && e.f <= B.cfg.CACT ? e : null); ops += 2 * (t1 - t0 + 1); }
    const e = ev.get(id); if (e) on.push((t) => e.on[t - t0] === 1);
  }
  if (!on.length) return { n: Infinity, ops };
  let n = 0; for (let t = t0; t <= t1; t++) { let all = true; for (const f of on) if (!f(t)) { all = false; break; } if (all) n++; }
  return { n, ops: ops + (t1 - t0 + 1) * on.length };
}
// один признак против нерва канала кругом позже: наклон и z (r sqrt(n)) на записи
function uni(B, c, d, t0, t1) {
  const G = B.goods; let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let t = Math.max(t0, ...leavesOf(d).map((id) => G.since[id] + 1)); t < t1; t++) { let x = 1; for (const id of leavesOf(d)) x *= G.at(t, id); const y = G.at(t + 1, c.good); n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
  if (n < 50) return null; const vx = sxx - sx * sx / n, vy = syy - sy * sy / n, cv = sxy - sx * sy / n; if (!(vx > 1e-9 && vy > 1e-9)) return null;
  return { s: cv / vx, z: cv / Math.sqrt(vx * vy) * Math.sqrt(n) };
}
// два входа части -- одна роль: одинаковые наборы листьев, кроме того, что x всюду заменён на y
function swapOf(d1, d2) {
  const a = leavesOf(d1).slice().sort((p, q) => p - q), b = leavesOf(d2).slice().sort((p, q) => p - q); if (a.length !== b.length) return null;
  const cnt = new Map(); for (const v of a) cnt.set(v, (cnt.get(v) || 0) + 1); for (const v of b) cnt.set(v, (cnt.get(v) || 0) - 1);
  const xs = [...cnt].filter(([, n]) => n > 0), ys = [...cnt].filter(([, n]) => n < 0);
  if (xs.length !== 1 || ys.length !== 1 || xs[0][1] !== -ys[0][1]) return null;
  return [xs[0][0], ys[0][0]];
}
// ошибка подгонки набора входов на записи (без отпускания входов) -- для замены входа понятием
function fitErr(B, c, inputs) {
  const G = B.goods, [t0, t1] = B.window([c.good, ...inputs]), nr = t1 - t0 + 1, L = inputs.length, m = L + 1; if (nr < 40) return null;
  const A = new Float64Array(m * m), cv = new Float64Array(m), f = new Float64Array(m); let yy = 0;
  const val = (t, d) => { const o = G.row(t); if (!isProd(d)) return G.rec[o + d]; let v = 1; for (const id of d) v *= G.rec[o + id]; return Math.max(-16, Math.min(16, v)); };
  for (let t = t0; t <= t1; t++) { for (let i = 0; i < L; i++) f[i] = val(t, inputs[i]); f[L] = 1; const y = G.at(t + 1, c.good); yy += y * y;
    for (let i = 0; i < m; i++) { cv[i] += f[i] * y; for (let j = 0; j <= i; j++) A[i * m + j] += f[i] * f[j]; } }
  for (let i = 0; i < m; i++) for (let j = 0; j < i; j++) A[j * m + i] = A[i * m + j];
  const mask = new Float64Array(m); for (let i = 0; i < L; i++) mask[i] = B.cfg.RIDGE;
  const r = require('./linalg').solve(A, cv, m, yy, mask); return r ? { mse: r.sse / nr, ops: nr * m * m } : null;
}

// сон (src/market.js): все проходы понятий сразу, без расписания
function sleep(B) { const cfg = B.cfg; if (B.t < cfg.H) return; detect(B); reperceive(B); if (cfg.SCHEMA) schema(B); if (cfg.MCONC) require('./memory').wmThrough(B, fitErr); }
function think(B) {
  const cfg = B.cfg; if (!cfg.CONC || B.t % cfg.CSCAN !== 0 || B.t < cfg.H) return;
  detect(B); reperceive(B); if (cfg.SCHEMA) schema(B); if (cfg.MCONC) require('./memory').wmThrough(B, fitErr);
}
// SCHEMA=1 -- схема (аналогия ролей). Канал c1 объяснён признаком «x × понятие» (первый предмет = «первое» × «куда»), а канал
// c2 -- одним нервом-событием y («второе»). Гипотеза аналогии: y для c2 -- то же, что x для c1, и c2 устроен так же. Строитель
// пробует у части c2 признак «y × понятие» вместо «y»; если подгонка не хуже чем на CTIE, часть берёт его. Так отношение,
// выученное на одном предмете, переходит на другой -- и мозг понимает сочетание, которого ни разу не слышал.
function schema(B) {
  const cfg = B.cfg, G = B.goods, CC = B.cc, t1 = B.t - 1, t0 = Math.max(1, B.t - cfg.H + 1); let n = 0;
  const best = (c) => { let bp = null; for (const p of c.parts) if (p.age >= 50 && p.share && (!bp || p.mse < bp.mse)) bp = p; return bp && p0bits(bp, cfg) ? bp : null; };
  const isConc = (id) => G.kind[id] === 'понятие';
  const evOK = (id0) => { const id = base(G, id0); if (G.kind[id] !== 'нерв' || CC.viewOf.has(id)) return false; const e = events(B, id, t0, t1); return e && e.f <= cfg.CACT && e.n >= 10; };
  // образцы: главный вход части (доля не меньше CSCH), в нём понятия и ровно один нерв-событие x
  const tpl = [];
  for (const c of B.ch) { const p = best(c); if (!p) continue;
    p.inputs.forEach((d, i) => { if (p.share[i] < cfg.CSCH || !isProd(d)) return; const L = leavesOf(d), nv = L.filter((id) => !isConc(id));
      if (nv.length === 1 && L.some(isConc) && evOK(nv[0])) tpl.push({ c, d, x: nv[0] }); }); }
  if (!tpl.length) return;
  for (const c2 of B.ch) { const p = best(c2); if (!p) continue;
    for (let i = 0; i < p.inputs.length; i++) {
      if (p.share[i] < cfg.CSCH) continue; const L = leavesOf(p.inputs[i]); if (!L.every((id) => id === L[0]) || !evOK(L[0])) continue;
      const y = L[0];
      for (const T of tpl) { if (T.c === c2 || T.x === y || n >= cfg.CREP) continue;
        const d2 = leavesOf(T.d).map((id) => (id === T.x ? y : id)).sort((a, b) => a - b), k = keyOf(d2);
        if (p.inputs.some((q) => keyOf(q) === k)) continue;
        p.schTried = p.schTried || new Map(); if (B.t - (p.schTried.get(k) ?? -1e9) < 5 * cfg.CSCAN) continue; p.schTried.set(k, B.t);
        const alt = p.inputs.slice(); alt[i] = d2; const e0 = fitErr(B, c2, p.inputs), e1 = fitErr(B, c2, alt); n++; if (!e0 || !e1) continue;
        const o = G.owner[leavesOf(T.d).find(isConc)]; if (o && o.alive) B.led.work(o, e0.ops + e1.ops);
        if (e1.mse <= e0.mse * (1 + cfg.CTIE) + 1e-12) { p.inputs[i] = d2; p.x = null; B.memOf(p); B.fit(p); B.stat.schema = (B.stat.schema || 0) + 1;
          CC.log.push(`круг ${B.t}: схема -- канал ${c2.k} как канал ${T.c.k}: нерв ${G.nerve[y]} в роли нерва ${G.nerve[T.x]}`); break; }
      }
    }
  }
}
const p0bits = (p, cfg) => p.bitsAvg >= cfg.CBITS;
// поиск понятий: пары входов одной части с одной ролью и сравнимыми весами, нервы -- события и взаимоисключающие
function detect(B) {
  const cfg = B.cfg, G = B.goods, CC = B.cc, t1 = B.t - 1, t0 = Math.max(1, B.t - cfg.H + 1); let ops = 0;
  const ev = new Map(), evOf = (id) => { if (!ev.has(id)) { ev.set(id, G.kind[id] === 'нерв' && G.since[id] < t0 ? events(B, id, t0, t1) : null); ops += 3 * (t1 - t0); } return ev.get(id); };
  for (const c of B.ch) for (const p of c.parts) {
    if (p.age < 50 || !p.share || p.inputs.length < 2 || p.bitsAvg < cfg.CBITS) continue;   // часть, которая что-то знает
    for (let i = 0; i < p.inputs.length; i++) for (let j = i + 1; j < p.inputs.length; j++) {
      if (p.share[i] < cfg.CSHARE || p.share[j] < cfg.CSHARE) continue;
      const sw = swapOf(p.inputs[i], p.inputs[j]); if (!sw) continue;
      // роль -- по данным, а не только по весам части (веса шумной части бывают случайными): каждый вход по отдельности
      // предсказывает нерв канала надёжно (z больше CZ), и действия сравнимы
      const u1 = uni(B, c, p.inputs[i], t0, t1), u2 = uni(B, c, p.inputs[j], t0, t1); ops += 4 * (t1 - t0);
      if (!u1 || !u2 || Math.abs(u1.z) < cfg.CZ || Math.abs(u2.z) < cfg.CZ) continue;
      const [x, y] = sw.map((id) => base(G, id)), r = u2.s / u1.s; if (!(Math.abs(r) >= 1 / cfg.CRAT && Math.abs(r) <= cfg.CRAT)) continue;
      const ex = evOf(x), ey = evOf(y); if (!ex || !ey || ex.f > cfg.CACT || ey.f > cfg.CACT || ex.n < 10 || ey.n < 10) continue;
      let both = 0; for (let k = 0; k < ex.on.length; k++) if (ex.on[k] && ey.on[k]) both++; ops += ex.on.length;
      if (both > 0.2 * Math.min(ex.n, ey.n)) continue;   // включаются вместе -- не имена одного, а разные вещи
      const ox = CC.viewOf.get(x), oy = CC.viewOf.get(y);
      if (ox && oy) continue;
      if (ox) { ox.views.set(y, { w: ox.views.get(x).w * r, mid: ey.mid }); CC.viewOf.set(y, ox); warm(B, ox); CC.log.push(`круг ${B.t}: в понятие «${ox.key}» -- нерв ${G.nerve[y]} (как нерв ${G.nerve[x]}, вес ${ox.views.get(y).w.toFixed(2)}; канал ${c.k})`); continue; }
      if (oy) { oy.views.set(x, { w: oy.views.get(y).w / r, mid: ex.mid }); CC.viewOf.set(x, oy); warm(B, oy); CC.log.push(`круг ${B.t}: в понятие «${oy.key}» -- нерв ${G.nerve[x]} (как нерв ${G.nerve[y]}; канал ${c.k})`); continue; }
      const o = B.led.open('понятие', 'bank', cfg.CNCRED, { key: `понятие ${CC.built}`, views: new Map([[x, { w: 1, mid: ex.mid }], [y, { w: r, mid: ey.mid }]]), payTo: false, incLast: 0, born: B.t, mem: 8 });
      o.good = G.add('понятие', o, -1, B.t); CC.viewOf.set(x, o); CC.viewOf.set(y, o); CC.list.push(o); CC.built++; warm(B, o);
      B.ccGoods = CC.list.map((q) => q.good);
      CC.log.push(`круг ${B.t}: понятие «${o.key}» -- нервы ${G.nerve[x]} и ${G.nerve[y]} в одной роли у канала ${c.k} (вес ${r.toFixed(2)})`);
    }
  }
  if (CC.list.length) B.led.work(CC.list[0], ops);
}
// прогрев: прошлые значения понятия -- в запись (части могут проверить его сразу)
function warm(B, o) {
  const cfg = B.cfg, G = B.goods, T = B.t, t0 = Math.max(1, T - cfg.H + 1); let first = T;
  for (let t = t0; t < T; t++) { let ok = true; for (const id of o.views.keys()) if (G.since[id] >= t) { ok = false; break; } if (ok) { G.rec[G.row(t) + o.good] = valOf(o, (id) => G.at(t, id)); first = Math.min(first, t); } }
  G.since[o.good] = first - 1; o.mem = 8 + 2 * o.views.size; B.led.work(o, (T - t0) * o.views.size);
}
// мозг видит через понятия: входы частей, где есть нерв понятия, -- заменить понятием, если подгонка не хуже чем на CTIE
function reperceive(B) {
  const cfg = B.cfg, N = B.ch.length; let n = 0; B.cc.rot = ((B.cc.rot || 0) + 1) % Math.max(1, N);
  for (let kk = 0; kk < N; kk++) { const c = B.ch[(B.cc.rot + kk) % N]; for (const p of c.parts) {
    if (n >= cfg.CREP) return;
    for (let i = 0; i < p.inputs.length; i++) {
      const d2 = through(B, p.inputs[i]); if (d2 === null) continue;
      const have = new Set(p.inputs.map(keyOf));
      // CMERGE: вход через понятие уже есть у части -- частный вход («второе x вверх» рядом с «второе x куда») лишний, если без
      // него подгонка не хуже: на записи они звучат вместе, и вес делится между ними наугад, а на новом сочетании («второе вниз»)
      // работает только общий. Мозг держит общее объяснение, а частное отпускает
      if (have.has(keyOf(d2))) { if (!cfg.CMERGE) continue;
        const tk = 'm' + keyOf(p.inputs[i]); p.ccTried = p.ccTried || new Map(); if (B.t - (p.ccTried.get(tk) ?? -1e9) < 5 * cfg.CSCAN) continue; p.ccTried.set(tk, B.t);
        const vb = (id) => B.cc.viewOf.get(id) || B.cc.viewOf.get(base(B.goods, id)), o = vb(leavesOf(p.inputs[i]).find((id) => vb(id))), alt = p.inputs.filter((_, k) => k !== i);
        const e0 = fitErr(B, c, p.inputs), e1 = fitErr(B, c, alt); n++; if (!e0 || !e1) continue; B.led.work(o, e0.ops + e1.ops);
        if (e1.mse <= e0.mse * (1 + cfg.CTIE) + 1e-12) { p.inputs = alt; p.w = Float64Array.from(p.w.filter((_, k) => k !== i)); p.share = null; p.x = null; B.memOf(p); B.fit(p); B.stat.merge = (B.stat.merge || 0) + 1; break; }
        continue; }
      const tk = keyOf(p.inputs[i]); p.ccTried = p.ccTried || new Map(); if (B.t - (p.ccTried.get(tk) ?? -1e9) < 5 * cfg.CSCAN) continue; p.ccTried.set(tk, B.t);
      const vb = (id) => B.cc.viewOf.get(id) || B.cc.viewOf.get(base(B.goods, id)), o = vb(leavesOf(p.inputs[i]).find((id) => vb(id))), alt = p.inputs.slice(); alt[i] = d2;
      const e0 = fitErr(B, c, p.inputs), e1 = fitErr(B, c, alt); n++; if (!e0 || !e1) continue;
      B.led.work(o, e0.ops + e1.ops);
      if (e1.mse <= e0.mse * (1 + cfg.CTIE) + 1e-12) { p.inputs[i] = d2; p.x = null; B.memOf(p); B.fit(p); B.stat.reperc = (B.stat.reperc || 0) + 1; break; }
    }
  } }
}
function economy(B) {
  const cfg = B.cfg, CC = B.cc, led = B.led, G = B.goods; if (!cfg.CONC) return;
  for (const o of CC.list.slice()) {
    o.age++; led.rent(o, cfg.RENT);
    o.incLast = o.inc; o.incAvg += 0.01 * (o.inc - o.incAvg); o.inc = 0;
    if (o.credit > cfg.CAP) led.move(o, 'bank', o.credit - cfg.CAP, 'понятие->банк: налог сверх потолка');
    o.hungry = o.credit < 0 ? o.hungry + 1 : 0;
    if (o.hungry > cfg.DIE) {
      led.close(o); CC.list.splice(CC.list.indexOf(o), 1); for (const id of o.views.keys()) if (CC.viewOf.get(id) === o) CC.viewOf.delete(id);
      const dead = o.good; G.kill(dead);
      for (const q of B.ch) { for (const p of q.parts) for (let i = p.inputs.length - 1; i >= 0; i--) if (leavesOf(p.inputs[i]).includes(dead)) { p.inputs.splice(i, 1); p.w = Float64Array.from([...p.w.slice(0, i), ...p.w.slice(i + 1)]); p.share = null; p.x = null; B.memOf(p); }
        if (q.note && q.note.inputs.some((d) => leavesOf(d).includes(dead))) q.note = null; }
      B.ccGoods = CC.list.map((q) => q.good);
      CC.log.push(`круг ${B.t}: понятие «${o.key}» разорилось`);
    }
  }
}
// признак с понятием и его же нервом-видом -- вырожденный (понятие на своём событии -- то же событие с весом): не брать
function degenerate(B, d) {
  if (!isProd(d)) return false; const G = B.goods;
  for (const id of d) if (G.kind[id] === 'понятие') { const o = G.owner[id]; if (o && o.views && d.some((q) => o.views.has(q) || o.views.has(base(G, q)))) return true; }
  return false;
}
module.exports = { init, sell, think, sleep, economy, through, degenerate, events, support, fitErr };

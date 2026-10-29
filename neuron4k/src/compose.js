'use strict';
// COMP=1 -- сборщик органов (раунд 6, results/round6/ПЛАН.md). Вместо готовых заготовок памяти («защёлка», «след», «пара»,
// «последний из группы») строитель собирает орган из кирпичиков и примеряет его по записи той же мерой, что и заготовки:
// доля остатка канала на чётных кругах с проверкой на нечётных, правило опоры, поправка на число примерок.
//
// Язык кирпичиков (v1; заморожен до опытов нового рода -- этап 4 плана):
//   событие(x)          1, если нерв x выше своей середины
//   значение(x)         значение нерва x
//   единица             1
//   или(a, b), и(a, b)  логика
//   задержка(a, d)      a d кругов назад
//   держать(w, v)       состояние: в круге, где w, запомнить v; иначе -- прежнее
//   накопить(w, λ)      состояние: S <- λ S + w (λ = 1 -- счёт, λ < 1 -- след)
//   по-ключу(K, w, v)   адресная память: в круге «ключ k и w» запомнить v для k; в круге «ключ k без w» -- вспомнить
//   при(r, a)           a, если r; иначе 0
// Сборка -- дерево из этих кирпичиков; у каждого состояния своя память. compile(n) даёт шаг f(get): get(k) -- значение нерва k
// в этом круге; f -- выход сборки в этом круге (состояние обновляется). Каждый compile -- новая копия со своим состоянием.

function compile(n) {
  switch (n.op) {
    case 'событие': return (get) => (get(n.k) > n.mid ? 1 : 0);
    case 'значение': return (get) => get(n.k);
    case 'единица': return () => 1;
    case 'или': { const a = compile(n.a), b = compile(n.b); return (get) => { const x = a(get), y = b(get); return x || y ? 1 : 0; }; }
    case 'и': { const a = compile(n.a), b = compile(n.b); return (get) => { const x = a(get), y = b(get); return x && y ? 1 : 0; }; }
    case 'задержка': { const a = compile(n.a), buf = new Float64Array(n.d); let i = 0;
      return (get) => { const out = buf[i]; buf[i] = a(get); i = (i + 1) % n.d; return out; }; }
    case 'держать': { const w = compile(n.w), v = compile(n.v); let S = 0;
      return (get) => { const wv = w(get), vv = v(get); if (wv) S = vv; return S; }; }
    case 'накопить': { const w = compile(n.w); let S = 0;
      if (n.z) { const z = compile(n.z); let zp = 0;   // v2: сброс -- кругом позже события z (прочитал -- забыл)
        return (get) => { if (zp) S = 0; S = Math.min(16, n.lam * S + w(get)); zp = z(get); return S; }; }
      return (get) => { S = Math.min(16, n.lam * S + w(get)); return S; }; }
    case 'по-ключу': { const w = compile(n.w), v = compile(n.v), M = new Map();
      return (get) => { const wv = w(get), vv = v(get); let out = 0;
        for (const [k, m] of n.K) if (get(k) > m) { if (wv) M.set(k, vv); else if (M.has(k)) out = M.get(k); }
        return out; }; }
    case 'при': { const r = compile(n.r), a = compile(n.a); return (get) => { const av = a(get); return r(get) ? av : 0; }; }
    // v2: отклонение(r, a) -- в круге r: насколько a выше своего обычного в кругах r (среднее по прошлым r, до 200); иначе 0
    case 'отклонение': { const r = compile(n.r), a = compile(n.a); let m = 0, c = 0;
      return (get) => { const av = a(get); if (!r(get)) return 0; const out = c ? av - m : 0; c = Math.min(200, c + 1); m += (av - m) / c; return out; }; }
    default: throw new Error(`кирпичика ${n.op} нет`);
  }
}
// та же сборка без памяти: состояния не помнят прошлых кругов (держать -- v в круге w, иначе 0; накопить -- w; по-ключу --
// ничего; отклонение -- без обычного). Сборка, которая на записи почти совпадает со своей копией без памяти, -- не память,
// а пересказ нынешних нервов (CFAST)
function compileFresh(n) {
  switch (n.op) {
    case 'событие': case 'значение': case 'единица': case 'задержка': return compile(n);
    case 'или': case 'и': { const a = compileFresh(n.a), b = compileFresh(n.b); return n.op === 'или' ? (get) => { const x = a(get), y = b(get); return x || y ? 1 : 0; } : (get) => { const x = a(get), y = b(get); return x && y ? 1 : 0; }; }
    case 'держать': { const w = compileFresh(n.w), v = compileFresh(n.v); return (get) => { const wv = w(get), vv = v(get); return wv ? vv : 0; }; }
    case 'накопить': { const w = compileFresh(n.w); return (get) => w(get); }
    case 'по-ключу': return () => 0;
    case 'при': { const r = compileFresh(n.r), a = compileFresh(n.a); return (get) => { const av = a(get); return r(get) ? av : 0; }; }
    // «обычное» отклонения -- не память о событиях, а мерка: у копии оно то же
    case 'отклонение': { const r = compileFresh(n.r), a = compileFresh(n.a); let m = 0, c = 0;
      return (get) => { const av = a(get); if (!r(get)) return 0; const out = c ? av - m : 0; c = Math.min(200, c + 1); m += (av - m) / c; return out; }; }
  }
}
// ключ сборки (без середин событий: они чуть разные в каждом окне записи) и размер (число кирпичиков)
function key(n) {
  switch (n.op) {
    case 'событие': return `с${n.k}`; case 'значение': return `з${n.k}`; case 'единица': return '1';
    case 'или': case 'и': { const [x, y] = [key(n.a), key(n.b)].sort(); return `${n.op}(${x},${y})`; }
    case 'задержка': return `зд(${key(n.a)},${n.d})`;
    case 'держать': return `д(${key(n.w)},${key(n.v)})`;
    case 'накопить': return n.z ? `н(${key(n.w)},${n.lam},сб${key(n.z)})` : `н(${key(n.w)},${n.lam})`;
    case 'по-ключу': return `к[${n.K.map((x) => x[0]).sort((a, b) => a - b).join(',')}](${key(n.w)},${key(n.v)})`;
    case 'при': return `при(${key(n.r)},${key(n.a)})`;
    case 'отклонение': return `откл(${key(n.r)},${key(n.a)})`;
  }
}
function size(n) { let s = 1; for (const c of ['a', 'b', 'w', 'v', 'r', 'z']) if (n[c]) s += size(n[c]); return s + (n.K ? n.K.length - 1 : 0); }
// по-русски, с номерами нервов
function show(n) {
  switch (n.op) {
    case 'событие': return `событие(${n.k})`; case 'значение': return `значение(${n.k})`; case 'единица': return 'единица';
    case 'или': case 'и': return `${n.op}(${show(n.a)}, ${show(n.b)})`;
    case 'задержка': return `задержка(${show(n.a)}, ${n.d})`;
    case 'держать': return `держать(${show(n.w)}, ${show(n.v)})`;
    case 'накопить': return n.z ? `накопить(${show(n.w)}, ${n.lam}, сброс ${show(n.z)})` : `накопить(${show(n.w)}, ${n.lam})`;
    case 'по-ключу': return `по-ключу([${n.K.map((x) => x[0]).join(', ')}], ${show(n.w)}, ${show(n.v)})`;
    case 'при': return `при(${show(n.r)}, ${show(n.a)})`;
    case 'отклонение': return `отклонение(${show(n.r)}, ${show(n.a)})`;
  }
}
// сборки из готовых листьев. E -- события: { k, mid, n, on[] } (on -- включено ли в каждой строке источника); cn -- связь
// события с каналом кругом позже; vals -- значения нервов. Формы -- держать / накопить / по-ключу с чтением и без
// CLIB: библиотека (как DreamCoder: удачная программа становится словом языка). Сборка, которая стала органом и окупилась,
// хранится в библиотеке устройством (без своих нервов), см. build. variants -- замена одного события (не используется)
function variants(prog, E) {
  const out = [], paths = []; (function walk(n, path) { if (n.op === 'событие') paths.push(path); for (const k of ['a', 'b', 'w', 'v', 'r', 'z']) if (n[k]) walk(n[k], [...path, k]); })(prog, []);
  const clone = (n) => JSON.parse(JSON.stringify(n));
  for (const path of paths) for (const e of E) { const q = clone(prog); let x = q; for (const k of path) x = x[k]; if (x.k === e.k) continue; x.k = e.k; x.mid = e.mid; out.push(q); }
  out.push(clone(prog)); return out;
}
// устройство сборки -- её ключ без номеров нервов
function shape(n) {
  switch (n.op) {
    case 'событие': return 'с'; case 'значение': return 'з'; case 'единица': return '1';
    case 'или': case 'и': { const [x, y] = [shape(n.a), shape(n.b)].sort(); return `${n.op}(${x},${y})`; }
    case 'задержка': return `зд(${shape(n.a)},${n.d})`; case 'держать': return `д(${shape(n.w)},${shape(n.v)})`;
    case 'накопить': return n.z ? `н(${shape(n.w)},${n.lam},сб${shape(n.z)})` : `н(${shape(n.w)},${n.lam})`; case 'по-ключу': return `к${n.K.length}(${shape(n.w)},${shape(n.v)})`;
    case 'при': return `при(${shape(n.r)},${shape(n.a)})`;
    case 'отклонение': return `откл(${shape(n.r)},${shape(n.a)})`;
  }
}
function build(E, cn, vals, rng, budget, lib, v2, fair, words, struct) {
  const co = (a, b) => { let n = 0; for (let i = 0; i < a.on.length; i++) if (a.on[i] && b.on[i]) n++; return n; };
  const ev1 = (e) => ({ op: 'событие', k: e.k, mid: e.mid });
  // запись (w): одно событие, пара взаимоисключающих (никогда вместе, звучат примерно одинаково часто) и группы побольше (до 6:
  // жадно -- к событию добавляются события, взаимоисключающие со всеми в группе: слова a / b / c)
  const W = E.map((e) => ({ n: ev1(e), on: e.on, members: [e] }));
  const alt = (a, b) => { const r = a.n / b.n; return co(a, b) === 0 && r > 0.25 && r < 4; };
  for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) { const a = E[i], b = E[j]; if (alt(a, b)) W.push({ n: { op: 'или', a: ev1(a), b: ev1(b) }, on: a.on.map((x, t) => (x || b.on[t] ? 1 : 0)), members: [a, b] }); }
  const gseen = new Set();
  for (const a of E) { const gr = [a]; for (const b of E) if (b !== a && gr.every((x) => alt(x, b))) { gr.push(b); if (gr.length >= 6) break; }
    if (gr.length < 3) continue; const gk = gr.map((x) => x.k).sort((x, y) => x - y).join(','); if (gseen.has(gk)) continue; gseen.add(gk);
    let n = ev1(gr[0]); for (let i = 1; i < gr.length; i++) n = { op: 'или', a: n, b: ev1(gr[i]) };
    W.push({ n, on: gr[0].on.map((_, t) => (gr.some((x) => x.on[t]) ? 1 : 0)), members: gr }); }
  // что держать (v): события, значения нервов, единица; условия чтения (r): без условия и два события, сильнее всех
  // связанных с каналом кругом позже
  // CGROW: и слова языка -- части своих окупившихся органов (вкладываются целиком, у каждой копии своё состояние)
  const V = [...E.map(ev1), ...vals, { op: 'единица' }, ...(words || [])];
  // CSTRUCT (раунд 8): слова структуры до всякого дохода -- у каждой группы взаимоисключающих событий слово «последнее в
  // группе было первым её членом» (держать(группа, событие(член))). Не по каналу (знак канала тут ни при чём), а по самой
  // группе: самые живые -- у кого реже всего звучащий член звучит чаще всего (поток альтернатив, а не редкое событие рядом
  // с частым); до 6 групп
  if (struct) { const gs = W.filter((w) => w.members.length >= 2).map((w) => [w, Math.min(...w.members.map((m) => m.n))]).sort((a, b) => b[1] - a[1]).slice(0, 6);
    for (const [w] of gs) V.push({ op: 'держать', w: w.n, v: ev1(w.members[0]) }); }
  const R = [null, ...[...E].sort((x, y) => (cn.get(y.k) || 0) - (cn.get(x.k) || 0)).slice(0, 2).map(ev1)];
  // v2 (CV2): и два события, сильнее всех связанных с размахом канала кругом позже (|канал - среднее|): вопрос, после
  // которого канал отвечает то плюсом, то минусом, со знаком канала не связан
  if (v2) for (const e of [...E].sort((x, y) => (v2.get(y.k) || 0) - (v2.get(x.k) || 0)).slice(0, 2)) if (!R.some((r) => r && r.k === e.k)) R.push(ev1(e));
  const out = [], seen = new Set(), add = (n) => { const k = key(n); if (!seen.has(k)) { seen.add(k); out.push(n); } };
  const read = (r, a) => (r ? { op: 'при', r, a } : a);
  for (const w of W) {
    for (const r of R) { for (const v of V) if (!(v.op === 'событие' && w.members.some((m) => m.k === v.k) && w.members.length === 1)) add(read(r, { op: 'держать', w: w.n, v }));
      for (const lam of [0.85, 1]) add(read(r, { op: 'накопить', w: w.n, lam }));
      // v2: счёт до вопроса (сброс кругом позже чтения) и чтение отклонением от обычного при r
      if (v2 && r) for (const lam of [1, 0.85]) { const acc = { op: 'накопить', w: w.n, lam, z: r }; add({ op: 'отклонение', r, a: acc }); add({ op: 'при', r, a: acc }); add({ op: 'отклонение', r, a: { op: 'накопить', w: w.n, lam } }); }
      if (v2 && r) for (const v of V) if (!(v.op === 'событие' && w.members.some((m) => m.k === v.k) && w.members.length === 1)) add({ op: 'отклонение', r, a: { op: 'держать', w: w.n, v } }); }
    // ключи -- события (не из записи), которые не меньше четверти своих раз звучат вместе с записью
    const K = E.filter((e) => !w.members.includes(e) && co(e, { on: w.on }) >= Math.max(2, 0.25 * e.n)).map((e) => [e.k, e.mid]);
    if (K.length) for (const v of V) add({ op: 'по-ключу', K, w: w.n, v });
  }
  // порядок: сначала сборки, у которых есть лист, связанный с каналом кругом позже (внимание к тому, что предвещает канал), --
  // по сильнейшему такому листу, с долей случайности; что не вошло в бюджет, примеряется в следующий раз
  const leaves = (n, acc) => { if (n.op === 'событие') acc.push(n.k); if (n.K) for (const [k] of n.K) acc.push(k); for (const c2 of ['a', 'b', 'w', 'v', 'r', 'z']) if (n[c2]) leaves(n[c2], acc); return acc; };
  const cw = (k) => Math.max(cn.get(k) || 0, v2 ? v2.get(k) || 0 : 0);
  const pr = out.map((n) => [n, Math.max(0, ...leaves(n, []).map(cw)) * (0.7 + 0.6 * rng())]); pr.sort((x, y) => y[1] - x[1]);
  let list = pr.map((x) => x[0]);
  // CFAIR: бюджет поровну между семействами форм (держать / накопить / по-ключу / их чтения): богаче язык -- а старые формы
  // не вытесняются из бюджета новыми; внутри семейства -- прежний порядок внимания
  if (fair) { const fam = (n) => (n.op === 'при' || n.op === 'отклонение' ? n.op + '/' + n.a.op + (n.a.z ? 'сб' : '') : n.op), F = new Map();
    for (const n of list) { const f = fam(n); if (!F.has(f)) F.set(f, []); F.get(f).push(n); }
    const fl = [...F.values()], out2 = []; for (let i = 0; out2.length < list.length; i++) for (const q of fl) if (i < q.length) out2.push(q[i]); list = out2; }
  // библиотека -- устройства (сборка без своих нервов: «при(событие, держать(или(событие x3), событие))»): сборки того же
  // устройства, что уже окупались, пробуются первыми, в своём порядке внимания
  if (lib && lib.length) { const sh = new Set(lib.map(shape)); list = [...list.filter((n) => sh.has(shape(n))), ...list.filter((n) => !sh.has(shape(n)))]; }
  return { list: list.slice(0, budget), all: list, total: out.length, ops: E.length * E.length * (E[0] ? E[0].on.length : 0) };
}
const corr = (xs, ys) => { let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; for (let i = 0; i < xs.length; i++) { const x = xs[i], y = ys[i]; if (!Number.isFinite(x) || !Number.isFinite(y)) continue; n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
  const vx = sxx - sx * sx / n, vy = syy - sy * sy / n; return n > 30 && vx > 0 && vy > 0 ? Math.abs(sxy - sx * sy / n) / Math.sqrt(vx * vy) : 0; };
// кандидаты по записи товаров w0..t1: события окна (нерв включён не больше 30% кругов, не меньше 3 раз), значения шести нервов,
// сильнее всех связанных с остатком канала
function candidates(B, c, w0, t1, res, rng) {
  const G = B.goods, EV = require('./concepts').events, ev = [];
  for (const q of B.ch) { if (q === c || G.since[q.good] >= w0) continue; const e = EV(B, q.good, w0, t1); if (e && e.f <= 0.3 && e.n >= 3) ev.push({ k: q.k, mid: e.mid, n: e.n, on: e.on }); }
  ev.sort((a, b) => b.n - a.n); let E = ev.slice(0, 16); const L = t1 - w0 + 1;
  const next = new Float64Array(L); for (let t = w0; t <= t1; t++) next[t - w0] = t < t1 ? G.at(t + 1, c.good) : NaN;
  // CSWEEP: событий больше 16 -- половина самых частых, половина самых связанных с каналом кругом позже (со знаком или с
  // размахом): редкие имена, о которых спрашивают, не вытесняются частыми событиями фона
  if (B.cfg.CSWEEP && ev.length > 16) { let m = 0, k = 0; for (const x of next) if (Number.isFinite(x)) { m += x; k++; } m /= Math.max(1, k); const mag = next.map((x) => Math.abs(x - m));
    const rel = (e) => Math.max(corr(e.on, next), corr(e.on, mag)), top = ev.slice(0, 8), rest = ev.slice(8).map((e) => [e, rel(e)]).sort((a, b) => b[1] - a[1]).slice(0, 8).map((x) => x[0]);
    E = [...top, ...rest]; }
  const cn = new Map(E.map((e) => [e.k, corr(e.on, next)]));
  let v2 = null; if (B.cfg.CV2) { let m = 0, n = 0; for (const x of next) if (Number.isFinite(x)) { m += x; n++; } m /= Math.max(1, n); const mag = next.map((x) => Math.abs(x - m)); v2 = new Map(E.map((e) => [e.k, corr(e.on, mag)])); }
  const vals = B.ch.filter((q) => q !== c).map((q) => { const xs = [], ys = []; for (let t = res.t0; t <= res.t1; t++) { xs.push(G.since[q.good] >= t ? NaN : G.at(t, q.good)); ys.push(res.res[t - res.t0]); } return [q.k, corr(xs, ys)]; })
    .sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k]) => ({ op: 'значение', k }));
  const C = build(E, cn, vals, rng, B.cfg.CBUD, B.cfg.CLIB ? B.mem.lib : null, v2, B.cfg.CFAIR, B.cfg.CGROW ? B.mem.words : null, B.cfg.CSTRUCT); C.ops += E.length * L * 2 + B.ch.length * (res.t1 - res.t0);
  if (B.cfg.CSWEEP) sweep(B, c, C); return C;
}
// CSWEEP: перебор без повторов -- для канала помнится, какие сборки уже примерены; в бюджет сначала не примеренные (в порядке
// внимания). Пока язык не пройден весь, строитель не откладывает канал (c.sweepLeft > 0, см. memory.js think); прошёл весь --
// новый круг перебора
function sweep(B, c, C) {
  const M = B.mem; M.ctried = M.ctried || new Map(); let S = M.ctried.get(c.k); if (!S) { S = new Set(); M.ctried.set(c.k, S); }
  // половина бюджета -- по вниманию, как без CSWEEP (сильные кандидаты примеряются снова: доказательство копится по
  // отрезкам), половина -- ещё не примеренные
  const top = C.all.slice(0, B.cfg.CBUD >> 1), inTop = new Set(top);
  let fresh = C.all.filter((n) => !inTop.has(n) && !S.has(key(n))); if (!fresh.length) { S.clear(); fresh = C.all.filter((n) => !inTop.has(n)); }
  const pick = fresh.slice(0, B.cfg.CBUD - top.length); for (const n of [...top, ...pick]) S.add(key(n));
  C.list = [...top, ...pick];
  c.sweepLeft = fresh.length - pick.length;
}
// кандидаты по долгой записи событий (PLONG): события -- знакомые слова, которые звучат на ней не меньше 3 раз и не чаще 30%
// кругов; связь с каналом -- с его ошибкой прогноза в строке кругом позже
function candidatesLong(B, c, rng) {
  const rows = B.lrec.rows, R = rows.length; if (R < 50 || !B.evc) return { list: [], total: 0, ops: 0 };
  const span = Math.max(1, rows[R - 1].t - rows[0].t + 1), E = [];
  for (const q of B.ch) { if (q === c || !B.evc.known.has(q.good)) continue; const mid = B.evc.mids.get(q.good) ?? 0.5, on = new Uint8Array(R); let n = 0;
    for (let i = 0; i < R; i++) if (rows[i].v[q.k] > mid) { on[i] = 1; n++; } if (n >= 3 && n / span <= 0.3) E.push({ k: q.k, mid, n, on }); }
  E.sort((a, b) => b.n - a.n); E.length = Math.min(E.length, 16);
  const next = new Float64Array(R); for (let i = 0; i < R; i++) next[i] = i + 1 < R && rows[i + 1].t === rows[i].t + 1 ? rows[i + 1].e[c.k] : NaN;
  const cn = new Map(E.map((e) => [e.k, corr(e.on, next)]));
  let v2 = null; if (B.cfg.CV2) { let m = 0, n = 0; for (const x of next) if (Number.isFinite(x)) { m += x; n++; } m /= Math.max(1, n); const mag = next.map((x) => Math.abs(x - m)); v2 = new Map(E.map((e) => [e.k, corr(e.on, mag)])); }
  const C = build(E, cn, [], rng, B.cfg.CBUD, B.cfg.CLIB ? B.mem.lib : null, null, B.cfg.CFAIR); C.ops += E.length * R * 2 + R * B.ch.length; return C;
}
// по долгой записи событий (PLONG, src/market.js lrecPush): сборка проигрывается по её строкам по порядку (между строками ничего
// редкого не звучало -- сборки из событий там не меняются); мера -- связь выхода сборки с ошибкой прогноза канала кругом позже
// (то, чего части не ждали). Возвращает долю, z и наклон (вес связи для канала)
function scoreLong(B, c, n) {
  const rows = B.lrec.rows, R = rows.length; if (R < 50) return null; const f = compile(n), lv = [];
  (function walk(q) { if (q.op === 'событие') lv.push([q.k, q.mid]); if (q.K) for (const x of q.K) lv.push(x); for (const k of ['a', 'b', 'w', 'v', 'r', 'z']) if (q[k]) walk(q[k]); })(n);
  let m = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  let prev = NaN, ch = 0;
  for (let i = 0; i < R; i++) { const v = rows[i].v, x = f((k) => v[k]); if (x !== prev) ch++; prev = x; if (i + 1 < R && rows[i + 1].t === rows[i].t + 1 && lv.some(([k, md]) => v[k] > md)) { const y = rows[i + 1].e[c.k]; m++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; } }
  // только круги, где звучит хоть одно событие сборки: в остальных она лишь хранит, и связь -- в кругах, где она вспоминает
  if (m < 10 || ch < 8) return { g: 0, z: 0, ops: R * size(n) };
  const vx = sxx - sx * sx / m, vy = syy - sy * sy / m, cv = sxy - sx * sy / m;
  const r2 = vx > 1e-9 && vy > 1e-9 ? cv * cv / (vx * vy) : 0;
  // и то, что сборка говорит, должно быть разным (иначе связь -- просто среднее ошибки в кругах её событий)
  return { g: r2, z: Math.sqrt(r2 * m), w: vx > 1e-9 ? cv / vx : 0, n: m, ops: R * size(n) };
}
// CLONGF (правка «опора-2», results/opora2/): по долгой записи -- те же проверки, что CFAST на окне: (1) пересказ -- выход по
// строкам почти равен копии без памяти; (2) в строках, где звучит условие чтения (при / отклонение), выход почти постоянен.
// Возвращает true, если сборку примерять не надо
function longReject(B, n) {
  const rows = B.lrec.rows, R = rows.length; const f = compile(n), ff = compileFresh(n), rf = n.op === 'при' || n.op === 'отклонение' ? compile(n.r) : null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, nr = 0, sm = 0, sq = 0;
  for (let i = 0; i < R; i++) { const v = rows[i].v, get = (k) => v[k], x = f(get), y = ff(get); sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    if (rf && rf(get)) { nr++; sm += x; sq += x * x; } }
  const vx = sxx - sx * sx / R, vy = syy - sy * sy / R;
  if (vx > 1e-12 && vy > 1e-12 && (sxy - sx * sy / R) / Math.sqrt(vx * vy) > 0.95) return true;
  if (rf && (nr < 6 || sq / nr - (sm / nr) ** 2 < 0.05 * sq / nr + 1e-9)) return true;
  return false;
}
// SUPLOO=2 (правка «опора-3», results/opora3/): сборка с чтением при r -- память о других событиях: среди записываемых
// событий памяти (w у держать / накопить) есть хоть одно не из условия чтения r. След или пересказ самого r -- не такая
function otherMem(n) {
  if (n.op !== 'при' && n.op !== 'отклонение') return false;
  const ev = (q, acc) => { if (q.op === 'событие') acc.add(q.k); for (const k of ['a', 'b', 'w', 'v', 'r', 'z']) if (q[k]) ev(q[k], acc); return acc; };
  const rk = ev(n.r, new Set()), wk = new Set(); let mem = false;
  (function walk(q) { if (q.op === 'держать' || q.op === 'накопить') { mem = true; ev(q.w, wk); } for (const k of ['a', 'b', 'w', 'v', 'r', 'z']) if (q[k]) walk(q[k]); })(n.a);
  return mem && [...wk].some((k) => !rk.has(k));   // хоть одно записываемое событие -- не из условия чтения (поправка после первой пробы, ПЛАН.md §6)
}
module.exports = { otherMem, compileFresh, compile, key, size, show, shape, candidates, candidatesLong, scoreLong, variants, longReject };

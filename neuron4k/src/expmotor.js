'use strict';
// Мотор ожиданий (М3 -- results/kolonia/ПЛАН_М3.md §2, ИССЛЕДОВАНИЕ_МОТОР.md §4.3; MEXP=1 при MVAL=2 и KEXP). У каждого вида
// события с подогнанным органом ожидания (src/expect.js) и ценой -- свой руль: по записи мотора (те же нервы, что у органа)
// подгонка psi_e(t+1) - psi_e(t) ~ b0 + b (x - mu) + u (a0 + a_e (x - mu)) -- как linFit мотора MVAL=2, но цель --
// изменение ожидания этого события, а не прирост общей пользы. psi_e по записи считается нынешними весами органа, а нервы,
// которые двигает сам мотор (положение), в нём заморожены на среднем: иначе руль находит петлю «повернул -- изменился мой
// поворот» (как ловушка кружения, правка 49 нейрона-3).
// Заметность цели (поправка ПЛАН_М3.md §8) -- ожидаемый выигрыш от её руля в этом круге: s_e = |цена_e(x)| · u_e² / g_e, где
// u_e = g_e a_e (x - mu) -- команда цели, а прирост ожидания по модели руля -- u_e · a_e (x - mu) = u_e² / g_e. Цель, на которую
// руль не влияет, не выбирается, как бы дорого ни стоило её событие. И только руль, который правда объясняет изменение
// ожидания: F-отношение подгонки с членами направления u (x - mu) против подгонки без них (с u) -- не меньше FMIN (иначе ложный малый эффект,
// умноженный на большую цену редкого события, перевешивает настоящий руль к еде). Действует одна цель -- самая заметная, нынешняя
// держится, пока другая не обгонит её в HOLD раз. Цели -- только «к» (цена > 0): избегание («от» смерти, удара) -- шаг М4
// (поправка ПЛАН_М3.md §8, п. 5). Пока руля нет ни у одной цели -- команда прежнего мотора (возврат null).
// MEXP=2 (М3в, ПЛАН_М3в.md): цель руля -- не ожидание, а сигнатура вида: сумма нервов, которые в событиях вида падают не реже
// чем в половине (у еды -- её запахи: еда исчезла), кроме своих нервов мотора. Сигнал каждого круга; органу ожидания цель
// не нужна -- нужны цена и сигнатура.
// MEXP=3 (М3г, ПЛАН_М3г.md): то же, цена квадратичная (src/expect.js), и «нет цели -- нет тяги»: когда руль цели уже бывал, а
// сейчас ни одна цель не заметна, команда -- 0 (только проба MVSIG), а не прежний мотор.
// MEXP=4 (М3д, ПЛАН_М3д.md): руль по сигнатуре (как MEXP=2); нерв нужды вида -- самый частый нерв, который в его событиях
// растёт (не реже NEEDF); цена -- c0 + c1 n + c2 n² по нерву нужды перед событием (последние 300 событий вида, гребень);
// заметность цели -- цена сейчас (выбирает нужда, руль ведёт); нет цели -- прежний мотор.
const { solve } = require('./linalg');
const { priceAt } = require('./expect');
const ECON = require('./econ');
const CER = require('./cerebellum');
// Э2 (нейрон Колонии, CER): руль цели видит и нервы x, и прогноз мозжечка x~ (src/cerebellum.js) -- признаков вдвое больше;
// цель руля (сигнатура) -- по нервам.
const HOLD = 1.2, FMIN = 3, NEEDF = 0.3;
// Э5 (нейрон Колонии, MBLEND=1 -- results/e5/ПЛАН.md): отдел выбора учит смесь. Каждая цель с рулём предлагает команду
// (цель «к» -- u_e, «от» -- -u_e) в своей обстановке (у «к» -- цена сейчас, у «от» -- страх / средний страх). Команда --
// G · сумма (α_e + γ_e · обстановка_e) · предложение_e; веса -- подгонкой, как у прежнего мотора: прирост пользы с ценностью
// d(t+1) ~ b0 + b (x - mu) + u (a0 + сумма (α_e пр_e + γ_e пр_e обст_e)). Пока весов нет -- самая заметная цель (MAVOID).
// Э5б (MBLEND=2 -- results/e5b/ПЛАН.md): учёба по пробам. Команда -- сумма (α_e + ξ_e + (γ_e + ζ_e) · обстановка_e) ·
// предложение_e в единицах руля; пробы ξ, ζ ~ N(0, MBSIG) -- новые каждые MBOUT кругов (свой жребий «проба»). Итог пробы --
// сумма прироста пользы с ценностью за её круги минус ожидаемое по нервам в её начале; наклон итога по пробе каждой
// цели и его ошибка -- шаг веса MBLR · clip(t, -3, 3). Новая цель начинает с α = 0.5, γ = 0.
const T0 = (Q) => Q.key[0];
const { stream } = require('./rng');

// подогнанные цели: вид с живым органом (веса), ценой и (для команды) рулём
const ready = (T, cfg) => (cfg.MEXP >= 2 ? (T.pr.w || cfg.MEXP === 4) && T.pn : T.org && T.org.w && T.pr.w);
// сигнатура вида -- номера столбцов записи (порядок X.ks) нервов, которые в его событиях падают не реже чем в половине
const sigOf = (X, Q, use) => X.ks.map((k, i) => ((Q.proto.get(`${k}-`) || 0) / Q.pn >= 0.5 && use[i] ? i : -1)).filter((i) => i >= 0);

function fit(B, m, v, T, ord) {
  const cfg = B.cfg, X = B.exp, W = B.world; if (!X || m.port.k !== W.motorNerve) return;
  const F = v.F, n = X.ks.length; if (F !== n) return;   // запись мотора -- те же нервы, что у органов
  const own = new Set(cfg.MNOPE ? (m.port.eff || []).map((e) => B.ch[e.j] && B.ch[e.j].good) : []), use = v.ids.map((id) => !own.has(id));
  const est = cfg.CER >= 3 && v.ce, FZ = cfg.CER && cfg.CER < 3 && v.ce ? 2 * F : F, zx = (r, k) => (est ? v.ce.xb[r * F + k] : k < F ? v.x[r * F + k] : v.ce.xt[r * F + k - F]), useZ = FZ > F ? [...use, ...use] : use;   // Э2: нервы и прогноз мозжечка; Э3: только оценка мозжечка
  const mu = new Float64Array(FZ); for (let i = 0; i < T; i++) for (let k = 0; k < FZ; k++) mu[k] += zx(ord[i], k) / T;
  for (const Q of X.types.values()) { if (!ready(Q, cfg)) continue; let psi;
    if (cfg.MEXP === 4) needFit(X, Q, use);
    if (cfg.MEXP >= 2) { const S = sigOf(X, Q, use); Q.sig = S.map((i) => X.ks[i]); if (!S.length) { Q.goal = null; continue; } psi = (r) => { let s = 0; for (const i of S) s += zx(r, i); return s; };
      if (cfg.MAWAY && T0(Q) === '-' && S.length === 2) { awayFit(B, m, v, T, ord, Q, S, zx, FZ, mu); continue; } }   // Э7: руль «от» по разнице сторон
    else { const w = Q.org.w; psi = (r) => { let s = w[0]; for (let k = 0; k < F; k++) { const x = use[k] ? v.x[r * F + k] : mu[k]; s += w[1 + 2 * k] * x + w[2 + 2 * k] * x * x; } return s; }; }
    const d = 2 * FZ + 2, A = new Float64Array(d * d), cv = new Float64Array(d), f = new Float64Array(d); let yy = 0, prev = psi(ord[0]);
    for (let i = 0; i < T - 1; i++) { const r = ord[i], nx = psi(ord[i + 1]), y = nx - prev, u = v.u[r]; prev = nx; yy += y * y;
      f[0] = 1; for (let k = 0; k < FZ; k++) f[1 + k] = zx(r, k) - mu[k]; f[FZ + 1] = u; for (let k = 0; k < FZ; k++) f[FZ + 2 + k] = useZ[k] ? u * f[1 + k] : 0;
      for (let a = 0; a < d; a++) { cv[a] += f[a] * y; for (let b = 0; b <= a; b++) A[a * d + b] += f[a] * f[b]; } }
    for (let a = 0; a < d; a++) for (let b = 0; b < a; b++) A[b * d + a] = A[a * d + b];
    const mask = new Float64Array(d).fill(1e-3); mask[0] = 0;
    const r = solve(A, cv, d, yy, mask); B.led.work(m, T * (d * d + 2 * FZ) + (r ? r.ops : 0)); if (!r) continue;
    // F-отношение: подгонка без членов направления (первые FZ + 2 признаков: 1, x - mu, u) против полной
    const d0 = FZ + 2, A0 = new Float64Array(d0 * d0); for (let a = 0; a < d0; a++) for (let b = 0; b < d0; b++) A0[a * d0 + b] = A[a * d + b];
    const r0 = solve(A0, cv.subarray(0, d0), d0, yy, mask.subarray(0, d0)); if (!r0) continue;
    const sse = (w, k) => { let s = yy; for (let a = 0; a < k; a++) { s -= 2 * w[a] * cv[a]; for (let b = 0; b < k; b++) s += w[a] * w[b] * A[a * d + b]; } return Math.max(1e-12, s); };
    const s1 = sse(r.w, d), s0 = sse(r0.w, d0), nu = Math.max(1, useZ.filter(Boolean).length), Fr = ((s0 - s1) / nu) / (s1 / Math.max(1, T - 1 - d));
    const a = Array.from({ length: FZ }, (_, k) => (useZ[k] ? r.w[FZ + 2 + k] : 0));
    let s2 = 0; for (let i = 0; i < T; i++) { let s = 0; for (let k = 0; k < FZ; k++) s += a[k] * (zx(ord[i], k) - mu[k]); s2 += s * s; }
    const g = cfg.MVGAIN / Math.sqrt(Math.max(1e-12, s2 / T));
    Q.goal = { a: a.map((x) => Math.max(-8, Math.min(8, g * x))), g, mu, F: Fr, fits: (Q.goal ? Q.goal.fits : 0) + 1, rounds: Q.goal ? Q.goal.rounds : 0 }; }
}

// Э7 (нейрон Колонии, MAWAY -- results/e7/ПЛАН.md, шаг С5): руль цели «от» с сигнатурой из двух нервов a, b -- в готовой
// форме «по разнице сторон»: Δ(x_a + x_b) ~ c0 + c (x - mu) + u (a0 + a_D (D - mu_D)), D = x_a - x_b. Поворот меняет разницу
// сторон, а погоня -- сумму; один член направления вместо одного на каждый нерв. Знак и сила -- подгонкой, F -- против
// подгонки без члена u (D - mu_D).
// Поправка ПЛАН.md §6 (до основного счёта): команда сама зависит от D (в ней предложение «от»), и член u (D - mu_D) ловит
// совпадения. Знак и сила -- по члену проба · (D - mu_D), проба круга -- команда минус команда до шума MVSIG; член
// u (D - mu_D) остаётся поправкой на совпадения. F -- против подгонки без члена пробы.
function awayFit(B, m, v, T, ord, Q, S, zx, FZ, mu) {
  const cfg = B.cfg, [ia, ib] = S, sig = (r) => zx(r, ia) + zx(r, ib), Dm = mu[ia] - mu[ib];
  if (!v.e) return;
  const d = FZ + 4, A = new Float64Array(d * d), cv = new Float64Array(d), f = new Float64Array(d); let yy = 0, prev = sig(ord[0]);
  for (let i = 0; i < T - 1; i++) { const r = ord[i], nx = sig(ord[i + 1]), y = nx - prev, u = v.u[r], Dr = zx(r, ia) - zx(r, ib) - Dm; prev = nx; yy += y * y;
    f[0] = 1; for (let k = 0; k < FZ; k++) f[1 + k] = zx(r, k) - mu[k]; f[FZ + 1] = u; f[FZ + 2] = u * Dr; f[FZ + 3] = v.e[r] * Dr;   // поправка ПЛАН.md §6: знак -- по пробе
    for (let a = 0; a < d; a++) { cv[a] += f[a] * y; for (let b = 0; b <= a; b++) A[a * d + b] += f[a] * f[b]; } }
  for (let a = 0; a < d; a++) for (let b = 0; b < a; b++) A[b * d + a] = A[a * d + b];
  const mask = new Float64Array(d).fill(1e-3); mask[0] = 0;
  const r = solve(A, cv, d, yy, mask); B.led.work(m, T * (d * d + 2 * FZ) + (r ? r.ops : 0)); if (!r) return;
  const d0 = d - 1, A0 = new Float64Array(d0 * d0); for (let a = 0; a < d0; a++) for (let b = 0; b < d0; b++) A0[a * d0 + b] = A[a * d + b];
  const r0 = solve(A0, cv.subarray(0, d0), d0, yy, mask.subarray(0, d0)); if (!r0) return;
  const sse = (w, k) => { let s = yy; for (let a = 0; a < k; a++) { s -= 2 * w[a] * cv[a]; for (let b = 0; b < k; b++) s += w[a] * w[b] * A[a * d + b]; } return Math.max(1e-12, s); };
  const s1 = sse(r.w, d), s0 = sse(r0.w, d0), Fr = (s0 - s1) / (s1 / Math.max(1, T - 1 - d)), aD = r.w[FZ + 3];
  let s2 = 0; for (let i = 0; i < T; i++) { const z = aD * (zx(ord[i], ia) - zx(ord[i], ib) - Dm); s2 += z * z; }
  const g = cfg.MVGAIN / Math.sqrt(Math.max(1e-12, s2 / T)), a = new Array(FZ).fill(0), w = Math.max(-8, Math.min(8, g * aD)); a[ia] = w; a[ib] = -w;
  Q.goal = { a, g, mu, F: Fr, fits: (Q.goal ? Q.goal.fits : 0) + 1, rounds: Q.goal ? Q.goal.rounds : 0, away: true };
}
// Э7: мера руля «от» (правда мира мозгу не видна) -- поворачивает ли предложение прочь от хищника; отдельно ближе 8
function awayDir(B, props) {
  const W = B.world, X = B.exp; if (!W.pred || B.t <= B.cfg.ROUNDS / 2) return;
  const d = Math.hypot(W.x - W.pred.x, W.y - W.pred.y), side = Math.sign(Math.sin(Math.atan2(W.pred.y - W.y, W.pred.x - W.x) - W.th));
  const st = X.awayDir || (X.awayDir = { all: [0, 0], near: [0, 0] });
  for (const p of props) { if (p.key[0] !== '-' || !p.u) continue; const ok = Math.sign(p.u) === -side ? 1 : 0; st.all[0] += ok; st.all[1]++; if (d < 8) { st.near[0] += ok; st.near[1]++; } }
}
// М3д: нерв нужды и цена по нему
function needFit(X, Q, use) {
  let best = -1, bf = 0; X.ks.forEach((k, i) => { const fr = (Q.proto.get(`${k}+`) || 0) / Q.pn; if (use[i] && fr >= NEEDF && fr > bf) { bf = fr; best = i; } });
  if (best < 0 || !Q.evs || Q.evs.length < 5) { Q.need = null; return; }
  const A = new Float64Array(9), cv = new Float64Array(3); let yy = 0;
  for (const [xs, dC] of Q.evs) { const n = xs[best], f = [1, n, n * n]; yy += dC * dC; for (let a = 0; a < 3; a++) { cv[a] += f[a] * dC; for (let b = 0; b < 3; b++) A[a * 3 + b] += f[a] * f[b]; } }
  const r = solve(A, cv, 3, yy, Float64Array.from([0, 1e-3, 1e-3])); Q.need = r ? { i: best, k: X.ks[best], c: Array.from(r.w) } : null;
}
// Э5: предложения этого круга -- в запись (строка записи мотора), для подгонки весов смеси
function recProps(B, row) { const X = B.exp; if (!X) return; (X.prec || (X.prec = new Array(B.cfg.MVH))); X.prec[row] = X.curProps || null; X.curProps = null;
  if (B.cfg.MBLEND === 2) (X.pbt || (X.pbt = new Int32Array(B.cfg.MVH).fill(-1)))[row] = Math.floor(B.t / B.cfg.MBOUT); }
// Э5б: веса цели и её проба в этой пробе (новая проба -- новый жребий)
function probeW(B, key, b) {
  const X = B.exp, cfg = B.cfg, P = X.pw || (X.pw = new Map()); let w = P.get(key); if (!w) P.set(key, w = { al: 0.5, ga: 0, xi: 0, ze: 0, bout: -1, steps: 0, t: [0, 0] });
  if (w.bout !== b) { const R = X.prng || (X.prng = stream(B.seed, 'проба')); w.xi = cfg.MBSIG * R.gauss(); w.ze = cfg.MBSIG * R.gauss(); w.bout = b; }
  return w;
}
// Э5б: учёба по пробам записи
function probeFit(B, m, v, T, ord) {
  const cfg = B.cfg, X = B.exp; if (!X || !X.prec || !X.pbt || !X.pw || !v.ok || !v.b) return; const F = v.F;
  const V = (row) => v.Vrow(v, row);
  const bouts = new Map();
  for (let i = 0; i < T - 1; i++) { const r = ord[i], r1 = ord[i + 1], b = X.pbt[r]; if (b < 0) continue; let o = bouts.get(b); if (!o) bouts.set(b, o = { R: 0, r0: r, n: 0, k: new Map() });
    o.R += v.c[r1] + cfg.MGAMV * V(r1) - V(r); o.n++;
    for (const p of X.prec[r] || []) { const q = o.k.get(p.key); if (q) q.c++; else o.k.set(p.key, { c: 1, xi: p.xi, ze: p.ze }); } }
  const L = [...bouts.values()].filter((o) => o.n >= cfg.MBOUT / 2); if (L.length < 50) return;
  // ожидаемое по нервам в начале пробы -- линейная подгонка, остаток R̃
  const pu = v.pu || [], PS = 8, d = F + 1 + pu.length, A = new Float64Array(d * d), cv = new Float64Array(d), f = new Float64Array(d); let yy = 0;   // Э6: база -- нервы и ожидания
  const feat0 = (r0) => { f[0] = 1; for (let k = 0; k < F; k++) f[1 + k] = v.x[r0 * F + k]; for (let j = 0; j < pu.length; j++) f[1 + F + j] = v.p[r0 * PS + pu[j]]; };
  for (const o of L) { feat0(o.r0); yy += o.R * o.R; for (let a = 0; a < d; a++) { cv[a] += f[a] * o.R; for (let c = 0; c <= a; c++) A[a * d + c] += f[a] * f[c]; } }
  for (let a = 0; a < d; a++) for (let c = 0; c < a; c++) A[c * d + a] = A[a * d + c];
  const mask = new Float64Array(d).fill(1e-3); mask[0] = 0; const r = solve(A, cv, d, yy, mask); if (!r) return;
  for (const o of L) { feat0(o.r0); let e = 0; for (let a = 0; a < d; a++) e += r.w[a] * f[a]; o.Rt = o.R - e; }
  const tOf = (xs, ys) => { let sxx = 0, sxy = 0; for (let i = 0; i < xs.length; i++) { sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; } if (!(sxx > 0)) return 0;
    const g = sxy / sxx; let rr = 0; for (let i = 0; i < xs.length; i++) rr += (ys[i] - g * xs[i]) ** 2; const se = Math.sqrt(rr / Math.max(1, xs.length - 1) / sxx); return se > 0 ? g / se : 0; };
  const clip = (t) => Math.max(-3, Math.min(3, t)), lim = (w) => Math.max(-4, Math.min(4, w));
  for (const [key, w] of X.pw) { const S = L.filter((o) => o.k.has(key) && o.k.get(key).c >= o.n / 2); if (S.length < 30) continue;
    const ys = S.map((o) => o.Rt), ta = tOf(S.map((o) => o.k.get(key).xi), ys), tg = tOf(S.map((o) => o.k.get(key).ze), ys);
    w.al = lim(w.al + cfg.MBLR * clip(ta)); w.ga = lim(w.ga + cfg.MBLR * clip(tg)); w.t = [ta, tg]; w.steps++; w.nb = S.length; }
  B.led.work(m, T * (F + 4) + L.length * (d * d + 4 * X.pw.size) + (r.ops || 0));
  // мера: вес в обстановке -- у «от» при страхе 3, у «к» при средней цене по записи
  const ords = Array.from(ord.subarray(0, T));
  X.blendInfo = [...X.pw].map(([key, w]) => { const cs = ords.flatMap((rw) => (X.prec[rw] || []).filter((p) => p.key === key).map((p) => p.ctx)); const mc = cs.length ? cs.reduce((a, c) => a + c, 0) / cs.length : 0;
    const away = key[0] === '-'; return { key, kind: away ? 'от' : 'к', w: w.al + w.ga * (away ? 3 : mc), al: w.al, ga: w.ga, ctx: away ? 3 : mc, steps: w.steps, nb: w.nb || 0, tAl: w.t[0], tGa: w.t[1] }; });
}
function blendFit(B, m, v, T, ord) {
  if (B.cfg.MBLEND === 2) return probeFit(B, m, v, T, ord);
  const cfg = B.cfg, X = B.exp; if (!X || !X.prec || !v.ok || !v.b) return; const F = v.F;
  const rows = Array.from(ord.subarray(0, T)), keys = [...new Set(rows.flatMap((r) => (X.prec[r] || []).map((p) => p.key)))], n = rows.filter((r) => X.prec[r] && X.prec[r].length).length;
  if (!keys.length || n < 1000) return;
  const V = (row) => v.Vrow(v, row);
  const mu = new Float64Array(F); for (let i = 0; i < T; i++) for (let k = 0; k < F; k++) mu[k] += v.x[ord[i] * F + k] / T;
  const K = keys.length, d = F + 2 + 2 * K, A = new Float64Array(d * d), cv = new Float64Array(d), f = new Float64Array(d); let yy = 0;
  const pv = (r, j) => { const p = (X.prec[r] || []).find((q) => q.key === keys[j]); return p ? [p.u, p.u * p.ctx] : [0, 0]; };
  for (let i = 0; i < T - 1; i++) { const r = ord[i], r1 = ord[i + 1], y = v.c[r1] + cfg.MGAMV * V(r1) - V(r), u = v.u[r]; yy += y * y;
    f[0] = 1; for (let k = 0; k < F; k++) f[1 + k] = v.x[r * F + k] - mu[k]; f[F + 1] = u; for (let j = 0; j < K; j++) { const [a, b] = pv(r, j); f[F + 2 + 2 * j] = u * a; f[F + 3 + 2 * j] = u * b; }
    for (let a = 0; a < d; a++) { cv[a] += f[a] * y; for (let b = 0; b <= a; b++) A[a * d + b] += f[a] * f[b]; } }
  for (let a = 0; a < d; a++) for (let b = 0; b < a; b++) A[b * d + a] = A[a * d + b];
  const mask = new Float64Array(d).fill(1e-3); mask[0] = 0; const r = solve(A, cv, d, yy, mask); B.led.work(m, T * d * d + (r ? r.ops : 0)); if (!r) return;
  const al = keys.map((_, j) => r.w[F + 2 + 2 * j]), ga = keys.map((_, j) => r.w[F + 3 + 2 * j]);
  let s2 = 0, ns = 0; for (let i = 0; i < T; i++) { const ps = X.prec[ord[i]]; if (!ps) continue; let s = 0; for (const p of ps) { const j = keys.indexOf(p.key); if (j >= 0) s += (al[j] + ga[j] * p.ctx) * p.u; } s2 += s * s; ns++; }
  if (!(s2 > 0) || !al.concat(ga).every(Number.isFinite)) return;
  X.blend = { keys, al, ga, G: cfg.MVGAIN / Math.sqrt(s2 / ns), fits: (X.blend ? X.blend.fits : 0) + 1 };
  // мера: вес предложения в обстановке -- у «от» при страхе 3, у «к» при средней цене
  X.blendInfo = keys.map((key, j) => { const cs = rows.flatMap((r) => (X.prec[r] || []).filter((p) => p.key === key).map((p) => p.ctx)); const mc = cs.length ? cs.reduce((a, b) => a + b, 0) / cs.length : 0;
    const away = key[0] === '-'; return { key, kind: away ? 'от' : 'к', w: al[j] + ga[j] * (away ? 3 : mc), al: al[j], ga: ga[j], ctx: away ? 3 : mc }; });
}
function command(B, m, v) {
  const X = B.exp, G = B.goods, cfg = B.cfg; if (!X || m.port.k !== B.world.motorNerve) return null;
  let best = null, bs = -1, cur = null, cs = -1; const props = [];
  for (const Q of X.types.values()) { if (!ready(Q, cfg) || !Q.goal || !(Q.goal.F >= FMIN)) continue;
    X.hadGoal = true; let p;
    if (cfg.MEXP === 4) { if (!Q.need) continue; const n = G.val[B.ch[Q.need.k].good]; p = Q.need.c[0] + Q.need.c[1] * n + Q.need.c[2] * n * n; }
    else p = priceAt(cfg, Q, X.ks.map((k) => G.val[B.ch[k].good]));
    const toward = p > 0 && T0(Q) === '+';   // М3: цели «к» -- виды со скачком пользы вверх и ценой больше 0
    // Э4 (MAVOID): цели «от» -- вид со скачком вниз и ценой меньше 0; 1 -- только когда страх (ожидание события вида) выше двух средних
    // Э4б: 3 -- порог «страх выше одного среднего», 4 -- без порога, заметность умножена на страх / средний страх
    const fear = Q.org && Q.org.w && Q.org.fm > 0 ? G.val[Q.good] / Q.org.fm : null;
    const away = cfg.MAVOID && p < 0 && T0(Q) === '-' && (cfg.MAVOID === 2 || (fear !== null && (cfg.MAVOID === 4 ? fear > 0 : fear > (cfg.MAVOID === 3 ? 1 : 2))));
    if (!toward && !away) continue;
    let ue = 0; for (let k = 0; k < Q.goal.a.length; k++) ue += Q.goal.a[k] * ((cfg.CER >= 3 ? CER.estNow(v, k, ECON.xhat(B, v.ids[k])) : k < v.F ? ECON.xhat(B, v.ids[k]) : v.ce && v.ce.pred ? v.ce.pred[k - v.F] : ECON.xhat(B, v.ids[k - v.F])) - Q.goal.mu[k]); Q.ue = ue;   // Э1: MANT -- прогноз канала; Э2: и прогноз мозжечка
    const s = (cfg.MEXP === 4 ? p : Math.abs(p) * ue * ue / Q.goal.g) * (away && cfg.MAVOID === 4 ? fear : 1); Q.sal = s; Q.sign = p >= 0 ? 1 : -1;
    if (cfg.MBLEND) props.push({ key: Q.key, u: Q.sign * ue, ctx: away ? fear : p });   // Э5: предложение цели и её обстановка
    if (s > bs) { bs = s; best = Q; } if (X.cur === Q.key) { cur = Q; cs = s; } }
  if (cfg.MBLEND) awayDir(B, props);   // Э7: мера
  if (cfg.MBLEND === 2) { props.b = Math.floor(B.t / cfg.MBOUT); X.curProps = props; if (props.length) { let s = 0;   // Э5б: смесь с пробами
      for (const p of props) { const w = probeW(B, p.key, props.b); p.xi = w.xi; p.ze = w.ze; s += (w.al + w.xi + (w.ga + w.ze) * p.ctx) * p.u; }
      if (B.t > cfg.ROUNDS / 2) (X.goalRounds || (X.goalRounds = {}))['смесь'] = ((X.goalRounds || {})['смесь'] || 0) + 1; B.led.work(m, (2 * v.F + 6) * X.types.size); if (Number.isFinite(s)) return s; } }
  else if (cfg.MBLEND) { X.curProps = props; if (X.blend && props.length) { let s = 0; for (const p of props) { const j = X.blend.keys.indexOf(p.key); if (j >= 0) s += (X.blend.al[j] + X.blend.ga[j] * p.ctx) * p.u; }   // Э5: смесь
      if (B.t > cfg.ROUNDS / 2) (X.goalRounds || (X.goalRounds = {}))['смесь'] = ((X.goalRounds || {})['смесь'] || 0) + 1; B.led.work(m, (2 * v.F + 4) * X.types.size); if (Number.isFinite(s)) return X.blend.G * s; } }
  if (!best) { const none = cfg.MEXP === 3 && X.hadGoal ? 'нет цели' : 'прежний'; if (B.t > cfg.ROUNDS / 2) X.goalRounds = Object.assign(X.goalRounds || {}, { [none]: ((X.goalRounds || {})[none] || 0) + 1 }); return none === 'нет цели' ? 0 : null; }
  const Q = cur && !(bs > HOLD * cs) ? cur : best; X.cur = Q.key;
  if (B.t > cfg.ROUNDS / 2) { Q.goal.rounds++; (X.goalRounds || (X.goalRounds = {}))[Q.key] = (X.goalRounds[Q.key] || 0) + 1; }
  B.led.work(m, (2 * v.F + 4) * X.types.size);
  if (cfg.MANT) ECON.credit(B, v.ids, Q.goal.a, Q.sign * Q.ue);   // Э1: вклад частей в команду
  return Q.sign * Q.ue;
}
module.exports = { fit, command, recProps, blendFit };

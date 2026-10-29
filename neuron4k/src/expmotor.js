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
const HOLD = 1.2, FMIN = 3, NEEDF = 0.3;
const T0 = (Q) => Q.key[0];

// подогнанные цели: вид с живым органом (веса), ценой и (для команды) рулём
const ready = (T, cfg) => (cfg.MEXP >= 2 ? (T.pr.w || cfg.MEXP === 4) && T.pn : T.org && T.org.w && T.pr.w);
// сигнатура вида -- номера столбцов записи (порядок X.ks) нервов, которые в его событиях падают не реже чем в половине
const sigOf = (X, Q, use) => X.ks.map((k, i) => ((Q.proto.get(`${k}-`) || 0) / Q.pn >= 0.5 && use[i] ? i : -1)).filter((i) => i >= 0);

function fit(B, m, v, T, ord) {
  const cfg = B.cfg, X = B.exp, W = B.world; if (!X || m.port.k !== W.motorNerve) return;
  const F = v.F, n = X.ks.length; if (F !== n) return;   // запись мотора -- те же нервы, что у органов
  const own = new Set(cfg.MNOPE ? (m.port.eff || []).map((e) => B.ch[e.j] && B.ch[e.j].good) : []), use = v.ids.map((id) => !own.has(id));
  const mu = new Float64Array(F); for (let i = 0; i < T; i++) for (let k = 0; k < F; k++) mu[k] += v.x[ord[i] * F + k] / T;
  for (const Q of X.types.values()) { if (!ready(Q, cfg)) continue; let psi;
    if (cfg.MEXP === 4) needFit(X, Q, use);
    if (cfg.MEXP >= 2) { const S = sigOf(X, Q, use); Q.sig = S.map((i) => X.ks[i]); if (!S.length) { Q.goal = null; continue; } psi = (r) => { let s = 0; for (const i of S) s += v.x[r * F + i]; return s; }; }
    else { const w = Q.org.w; psi = (r) => { let s = w[0]; for (let k = 0; k < F; k++) { const x = use[k] ? v.x[r * F + k] : mu[k]; s += w[1 + 2 * k] * x + w[2 + 2 * k] * x * x; } return s; }; }
    const d = 2 * F + 2, A = new Float64Array(d * d), cv = new Float64Array(d), f = new Float64Array(d); let yy = 0, prev = psi(ord[0]);
    for (let i = 0; i < T - 1; i++) { const r = ord[i], nx = psi(ord[i + 1]), y = nx - prev, u = v.u[r]; prev = nx; yy += y * y;
      f[0] = 1; for (let k = 0; k < F; k++) f[1 + k] = v.x[r * F + k] - mu[k]; f[F + 1] = u; for (let k = 0; k < F; k++) f[F + 2 + k] = use[k] ? u * f[1 + k] : 0;
      for (let a = 0; a < d; a++) { cv[a] += f[a] * y; for (let b = 0; b <= a; b++) A[a * d + b] += f[a] * f[b]; } }
    for (let a = 0; a < d; a++) for (let b = 0; b < a; b++) A[b * d + a] = A[a * d + b];
    const mask = new Float64Array(d).fill(1e-3); mask[0] = 0;
    const r = solve(A, cv, d, yy, mask); B.led.work(m, T * (d * d + 2 * F) + (r ? r.ops : 0)); if (!r) continue;
    // F-отношение: подгонка без членов направления (первые F + 2 признаков: 1, x - mu, u) против полной
    const d0 = F + 2, A0 = new Float64Array(d0 * d0); for (let a = 0; a < d0; a++) for (let b = 0; b < d0; b++) A0[a * d0 + b] = A[a * d + b];
    const r0 = solve(A0, cv.subarray(0, d0), d0, yy, mask.subarray(0, d0)); if (!r0) continue;
    const sse = (w, k) => { let s = yy; for (let a = 0; a < k; a++) { s -= 2 * w[a] * cv[a]; for (let b = 0; b < k; b++) s += w[a] * w[b] * A[a * d + b]; } return Math.max(1e-12, s); };
    const s1 = sse(r.w, d), s0 = sse(r0.w, d0), nu = Math.max(1, use.filter(Boolean).length), Fr = ((s0 - s1) / nu) / (s1 / Math.max(1, T - 1 - d));
    const a = Array.from({ length: F }, (_, k) => (use[k] ? r.w[F + 2 + k] : 0));
    let s2 = 0; for (let i = 0; i < T; i++) { let s = 0; for (let k = 0; k < F; k++) s += a[k] * (v.x[ord[i] * F + k] - mu[k]); s2 += s * s; }
    const g = cfg.MVGAIN / Math.sqrt(Math.max(1e-12, s2 / T));
    Q.goal = { a: a.map((x) => Math.max(-8, Math.min(8, g * x))), g, mu, F: Fr, fits: (Q.goal ? Q.goal.fits : 0) + 1, rounds: Q.goal ? Q.goal.rounds : 0 }; }
}

// М3д: нерв нужды и цена по нему
function needFit(X, Q, use) {
  let best = -1, bf = 0; X.ks.forEach((k, i) => { const fr = (Q.proto.get(`${k}+`) || 0) / Q.pn; if (use[i] && fr >= NEEDF && fr > bf) { bf = fr; best = i; } });
  if (best < 0 || !Q.evs || Q.evs.length < 5) { Q.need = null; return; }
  const A = new Float64Array(9), cv = new Float64Array(3); let yy = 0;
  for (const [xs, dC] of Q.evs) { const n = xs[best], f = [1, n, n * n]; yy += dC * dC; for (let a = 0; a < 3; a++) { cv[a] += f[a] * dC; for (let b = 0; b < 3; b++) A[a * 3 + b] += f[a] * f[b]; } }
  const r = solve(A, cv, 3, yy, Float64Array.from([0, 1e-3, 1e-3])); Q.need = r ? { i: best, k: X.ks[best], c: Array.from(r.w) } : null;
}
function command(B, m, v) {
  const X = B.exp, G = B.goods, cfg = B.cfg; if (!X || m.port.k !== B.world.motorNerve) return null;
  let best = null, bs = -1, cur = null, cs = -1;
  for (const Q of X.types.values()) { if (!ready(Q, cfg) || !Q.goal || !(Q.goal.F >= FMIN)) continue;
    X.hadGoal = true; let p;
    if (cfg.MEXP === 4) { if (!Q.need) continue; const n = G.val[B.ch[Q.need.k].good]; p = Q.need.c[0] + Q.need.c[1] * n + Q.need.c[2] * n * n; }
    else p = priceAt(cfg, Q, X.ks.map((k) => G.val[B.ch[k].good]));
    if (!(p > 0) || T0(Q) !== '+') continue;   // М3: только цели «к» -- виды со скачком пользы вверх и ценой больше 0
    let ue = 0; for (let k = 0; k < v.F; k++) ue += Q.goal.a[k] * (ECON.xhat(B, v.ids[k]) - Q.goal.mu[k]); Q.ue = ue;   // Э1: MANT -- прогноз канала
    const s = cfg.MEXP === 4 ? p : Math.abs(p) * ue * ue / Q.goal.g; Q.sal = s; Q.sign = p >= 0 ? 1 : -1;
    if (s > bs) { bs = s; best = Q; } if (X.cur === Q.key) { cur = Q; cs = s; } }
  if (!best) { const none = cfg.MEXP === 3 && X.hadGoal ? 'нет цели' : 'прежний'; if (B.t > cfg.ROUNDS / 2) X.goalRounds = Object.assign(X.goalRounds || {}, { [none]: ((X.goalRounds || {})[none] || 0) + 1 }); return none === 'нет цели' ? 0 : null; }
  const Q = cur && !(bs > HOLD * cs) ? cur : best; X.cur = Q.key;
  if (B.t > cfg.ROUNDS / 2) { Q.goal.rounds++; (X.goalRounds || (X.goalRounds = {}))[Q.key] = (X.goalRounds[Q.key] || 0) + 1; }
  B.led.work(m, (2 * v.F + 4) * X.types.size);
  if (cfg.MANT) ECON.credit(B, v.ids, Q.goal.a, Q.sign * Q.ue);   // Э1: вклад частей в команду
  return Q.sign * Q.ue;
}
module.exports = { fit, command };

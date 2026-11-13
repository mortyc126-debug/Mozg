'use strict';
// Отдел речи (ступень 4, results/s4/ПЛАН.md §2; «зона Брока»). Вне рынка, как ценность и ганглии. Рот и улыбка -- по
// врождённой карте (до ступени 3). Довод за слово i -- прогноз коры для нерва-слова i, купленный на шине (товары «прогноз»
// этого нерва, среднее живых), делённый на свой бегущий средний: «жду, что родитель скажет i». Цена слова
// r_i = a_i + b_i · довод_i -- ожидаемая улыбка, если сказать i сейчас; учится наименьшими квадратами (гребень 1) по своим
// высказываниям слова i и улыбке на них, с забыванием 0.999 на высказывание. У каждого слова своя цена. Сказать слово с
// наибольшей ценой, если она больше 0; лепет -- пробы (принцип 3): с вероятностью 0.05 за круг случайное слово.
// SPEV = 0 -- контроль: довод постоянен (речь без понимания).
// Ступень 5 (SPB): у слова вторая цена -- по телу. Итог круга -- сумма ошибок ожидания ценности (organs/critic.js) за 20
// кругов после него. База слова -- итог по всем кругам при таком же доводе (что бывает при обычной речи); урок -- только
// лепет (принцип 3: лепет случаен, обстановка с ним не связана): итог после лепета этим словом минус база -- причинный
// вклад слова. Цена по телу идёт в счёт, только когда доказана (как у ганглиев): прогноз больше трёх своих ошибок (ошибка --
// по среднему квадрату урока и числу уроков при таком доводе); иначе 0. Решает сумма двух цен.
// Ступень 5б (SPX): цена по улыбке -- r_i = w_i · [1, довод_i, нервы]: нервы с шины, каждый в своих единицах (минус бегущее
// среднее, делить на бегущий разброс); наименьшие квадраты по своим высказываниям слова (забывание 0.999, гребень 1 у
// каждого веса, кроме свободного; подгонка раз в 20 уроков). Довод цены по телу -- цена по улыбке этого слова
// («насколько я уверен, что слово правда»), а не прогноз коры.
// Ступень 3 (MAP = 0): какой нерв рта какое слово говорит, не сказано. Нервы рта -- из карты тела (их находит
// исследователь); пока он не кончил, речь молчит (сначала тело, потом слова: ухо исследователя слышит и речь). Цена нерва рта --
// w · [1, доводы всех семи слов, нервы] по улыбке (как SPX); лепет -- по найденным нервам рта.
const { stream } = require('../rng');
const { solve } = require('../linalg');
const BABBLE = 0.05, FORGET = 0.999, RIDGE = 1, BODY = 20;
class Speech {
  constructor(B) {
    const W = B.world, bus = B.bus; this.mouth = W.innate.mouth; this.smile = W.innate.smile; this.words = W.innate.voice; this.rng = stream(B.seed, 'речь');
    const n = this.words.length; this.goods = this.words.map((k) => { const g = []; for (let id = 0; id < bus.n; id++) if (bus.kind[id] === 'прогноз' && bus.name[id] === k) g.push(id); return g; });
    this.m = new Float64Array(n).fill(0.05); this.z = new Float64Array(n);
    this.S = Array.from({ length: n }, () => ({ s11: RIDGE, s1z: 0, szz: RIDGE, c1: 0, cz: 0, a: 0, b: 0, n: 0 }));
    this.said = -1; this.sz = 0; this.babbles = 0; this.chosen = 0;
    this.line = !B.cfg.MAP; if (this.line) { const N = B.n, d = N + 1 + n + (B.cfg.SPT ? n : 0); this.nt0 = 1 + n + (B.cfg.SPT ? n : 0); this.d = d; this.f = new Float64Array(d); this.sf = new Float64Array(d);
      this.mu = new Float64Array(N); this.va = new Float64Array(N).fill(1); this.nv = 0; this.L = []; this.sl = -1; }
    else if (B.cfg.SPX) { const N = B.n, d = N + 2; this.d = d; this.f = new Float64Array(d); this.sf = new Float64Array(d); this.pr = new Float64Array(n);
      this.mu = new Float64Array(N); this.va = new Float64Array(N).fill(1); this.nv = 0;
      this.X = Array.from({ length: n }, () => ({ A: new Float64Array(d * d), c: new Float64Array(d), yy: 0, w: new Float64Array(d), n: 0 })); }
    if (B.cfg.SPB) { const st = () => ({ s11: 0, s1z: 0, szz: 0, c1: 0, cz: 0, a: 0, b: 0, n: 0 }); this.base = Array.from({ length: n }, st); this.bp = Array.from({ length: n }, st); this.ring = []; this.vb = 1; }
  }
  // наименьшие квадраты r ~ a + b z по накопленным суммам с забыванием f и гребнем lam
  static acc(s, z, r, f) { s.s11 = f * s.s11 + 1; s.s1z = f * s.s1z + z; s.szz = f * s.szz + z * z; s.c1 = f * s.c1 + r; s.cz = f * s.cz + z * r; s.n++; }
  static solve(s, lam) { const A = s.s11 + lam, D = s.szz + lam, det = A * D - s.s1z * s.s1z; if (det > 0) { s.a = (D * s.c1 - s.s1z * s.cz) / det; s.b = (A * s.cz - s.s1z * s.c1) / det; } }
  // цена по телу при доводе z, если доказана: |a + b z| > 3 ошибки, ошибка^2 = vb · [1 z] (X'X + гребень)^-1 [1 z]
  proven(s, z) { const A = s.s11 + RIDGE, D = s.szz + RIDGE, det = A * D - s.s1z * s.s1z; if (!(det > 0)) return 0;
    const p = s.a + s.b * z, v = this.vb * (D - 2 * z * s.s1z + z * z * A) / det; return p * p > 9 * v ? p : 0; }
  bodyStep(B, w, bab, ev) {
    const d = B.critic.delta, n = this.words.length; for (const q of this.ring) q.R += d;
    this.ring.push({ z: Float64Array.from(ev), w: bab ? w : -1, R: 0, t: B.t });
    while (this.ring.length && B.t - this.ring[0].t >= BODY) { const q = this.ring.shift();
      for (let i = 0; i < n; i++) { const b = this.base[i]; Speech.acc(b, q.z[i], q.R, 0.9999); Speech.solve(b, 1); }
      if (q.w >= 0) { const b = this.base[q.w], adv = q.R - (b.a + b.b * q.z[q.w]); this.vb += 0.001 * (adv * adv - this.vb);
        const s = this.bp[q.w]; Speech.acc(s, q.z[q.w], adv, FORGET); Speech.solve(s, RIDGE); } }
    B.led.work(null, 12 * n);
  }
  lessonX(B, i, r) { this.fitX(B, this.X[i], r); }
  fitX(B, X, r) {
    const d = this.d, f = this.sf, F = FORGET;
    for (let a = 0; a < d; a++) { X.c[a] = F * X.c[a] + f[a] * r; for (let b = 0; b <= a; b++) X.A[a * d + b] = F * X.A[a * d + b] + f[a] * f[b]; }
    X.yy = F * X.yy + r * r; X.n++;
    if (X.n % 20 === 0) { const A = new Float64Array(d * d); let tr = 0; for (let a = 0; a < d; a++) for (let b = 0; b <= a; b++) { A[a * d + b] = A[b * d + a] = X.A[a * d + b]; } for (let a = 0; a < d; a++) tr += A[a * d + a];
      const m = new Float64Array(d).fill(RIDGE * d / Math.max(tr, 1e-9)); m[0] = 0; const q = solve(A, X.c, d, X.yy, m); if (q) X.w = Float64Array.from(q.w); B.led.work(null, d * d * d); }
    B.led.work(null, d * d);
  }
  lesson(i, z, r) {
    const s = this.S[i]; s.s11 = FORGET * s.s11 + 1; s.s1z = FORGET * s.s1z + z; s.szz = FORGET * s.szz + z * z; s.c1 = FORGET * s.c1 + r; s.cz = FORGET * s.cz + z * r; s.n++;
    const A = s.s11 + RIDGE * (1 - FORGET), D = s.szz + RIDGE * (1 - FORGET), det = A * D - s.s1z * s.s1z;   // гребень держится и при забывании
    if (det > 0) { s.a = (D * s.c1 - s.s1z * s.cz) / det; s.b = (A * s.cz - s.s1z * s.c1) / det; }
  }
  // улыбка на сказанное в прошлом круге -- урок цене этого слова
  sense(B) {
    if (this.line) { if (this.sl >= 0) { this.fitX(B, this.L[this.sl], B.obs[this.smile]); this.sl = -1; B.led.work(null, 12); } return; }
    if (this.said < 0) return; if (this.X) this.lessonX(B, this.said, B.obs[this.smile]); else this.lesson(this.said, this.sz, B.obs[this.smile]); this.said = -1; B.led.work(null, 12);
  }
  act(B) {
    const v = B.bus.val, bus = B.bus, n = this.words.length;
    for (let i = 0; i < n; i++) { let s = 0, c = 0; for (const g of this.goods[i]) if (bus.owner[g] && bus.owner[g].alive) { s += v[g]; c++; }
      const x = c ? s / c : 0; this.m[i] += 0.001 * (x - this.m[i]); this.z[i] = B.cfg.SPEV ? x / Math.max(this.m[i], 1e-3) : 1; }
    if (this.line) return this.actLine(B);
    if (this.X) { const N = B.n, f = this.f, o = B.obs; this.nv++; const k = Math.max(0.001, 1 / this.nv);   // свои нервы в своих единицах
      for (let j = 0; j < N; j++) { const dv = o[j] - this.mu[j]; this.mu[j] += k * dv; this.va[j] += k * (dv * dv - this.va[j]); f[2 + j] = dv / Math.sqrt(Math.max(this.va[j], 1e-6)); }
      f[0] = 1; for (let i = 0; i < n; i++) { f[1] = this.z[i]; const w = this.X[i].w; let r = 0; for (let a = 0; a < this.d; a++) r += w[a] * f[a]; this.pr[i] = r; }
      B.led.work(null, n * this.d); }
    const ev = this.X ? this.pr : this.z;   // довод цены по телу
    let w = -1, bab = false;
    if (this.rng() < BABBLE) { bab = true; w = Math.floor(n * this.rng()); this.babbles++; }
    else { let best = 0; for (let i = 0; i < n; i++) { let r; if (this.X) r = this.pr[i]; else { const s = this.S[i]; r = s.a + s.b * this.z[i]; } if (this.bp) r += this.proven(this.bp[i], ev[i]); if (r > best) { best = r; w = i; } } if (w >= 0) this.chosen++; }
    if (w >= 0) { B.drive(this.mouth[w], 1); this.said = w; this.sz = this.z[w]; if (this.X) { this.sf.set(this.f); this.sf[1] = this.z[w]; } }
    if (this.bp) this.bodyStep(B, w, bab, ev);
    B.led.work(null, 4 * n);
  }
}
// речь без карты рта (MAP = 0): цена каждого найденного нерва рта по всем доводам и своим нервам
Speech.prototype.actLine = function (B) {
  const N = B.n, f = this.f, o = B.obs, n = this.words.length; this.nv++; const k = Math.max(0.001, 1 / this.nv);
  f[0] = 1; for (let i = 0; i < n; i++) f[1 + i] = this.z[i];
  if (B.cfg.SPT) { const v = B.bus.val, T = B.hippo.traces; for (let i = 0; i < n; i++) { let e = 0; for (const tr of T) if (tr.targets.has(this.words[i])) e = Math.max(e, v[tr.good]); f[1 + n + i] = e; } }   // ступень 6+: «событие было недавно» -- след, выданный слову
  for (let j = 0; j < N; j++) { const dv = o[j] - this.mu[j]; this.mu[j] += k * dv; this.va[j] += k * (dv * dv - this.va[j]); f[this.nt0 + j] = dv / Math.sqrt(Math.max(this.va[j], 1e-6)); }
  if (!B.map.done) return;
  const d = this.d; while (this.L.length < B.map.mouth.length) this.L.push({ k: B.map.mouth[this.L.length], A: new Float64Array(d * d), c: new Float64Array(d), yy: 0, w: new Float64Array(d), n: 0 });
  if (!this.L.length) return; let w = -1;
  if (this.rng() < BABBLE) { w = Math.floor(this.L.length * this.rng()); this.babbles++; }
  else { let best = 0; for (let l = 0; l < this.L.length; l++) { const W = this.L[l].w; let r = 0; for (let a = 0; a < d; a++) r += W[a] * f[a]; if (r > best) { best = r; w = l; } } if (w >= 0) this.chosen++; }
  if (w >= 0) { B.drive(this.L[w].k, 1); this.sl = w; this.sf.set(f); }
  B.led.work(null, this.L.length * d);
};
module.exports = { Speech };

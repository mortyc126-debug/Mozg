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
const { stream } = require('../rng');
const BABBLE = 0.05, FORGET = 0.999, RIDGE = 1, BODY = 20;
class Speech {
  constructor(B) {
    const W = B.world, bus = B.bus; this.mouth = W.innate.mouth; this.smile = W.innate.smile; this.words = W.innate.voice; this.rng = stream(B.seed, 'речь');
    const n = this.words.length; this.goods = this.words.map((k) => { const g = []; for (let id = 0; id < bus.n; id++) if (bus.kind[id] === 'прогноз' && bus.name[id] === k) g.push(id); return g; });
    this.m = new Float64Array(n).fill(0.05); this.z = new Float64Array(n);
    this.S = Array.from({ length: n }, () => ({ s11: RIDGE, s1z: 0, szz: RIDGE, c1: 0, cz: 0, a: 0, b: 0, n: 0 }));
    this.said = -1; this.sz = 0; this.babbles = 0; this.chosen = 0;
    if (B.cfg.SPB) { const st = () => ({ s11: 0, s1z: 0, szz: 0, c1: 0, cz: 0, a: 0, b: 0, n: 0 }); this.base = Array.from({ length: n }, st); this.bp = Array.from({ length: n }, st); this.ring = []; this.vb = 1; }
  }
  // наименьшие квадраты r ~ a + b z по накопленным суммам с забыванием f и гребнем lam
  static acc(s, z, r, f) { s.s11 = f * s.s11 + 1; s.s1z = f * s.s1z + z; s.szz = f * s.szz + z * z; s.c1 = f * s.c1 + r; s.cz = f * s.cz + z * r; s.n++; }
  static solve(s, lam) { const A = s.s11 + lam, D = s.szz + lam, det = A * D - s.s1z * s.s1z; if (det > 0) { s.a = (D * s.c1 - s.s1z * s.cz) / det; s.b = (A * s.cz - s.s1z * s.c1) / det; } }
  // цена по телу при доводе z, если доказана: |a + b z| > 3 ошибки, ошибка^2 = vb · [1 z] (X'X + гребень)^-1 [1 z]
  proven(s, z) { const A = s.s11 + RIDGE, D = s.szz + RIDGE, det = A * D - s.s1z * s.s1z; if (!(det > 0)) return 0;
    const p = s.a + s.b * z, v = this.vb * (D - 2 * z * s.s1z + z * z * A) / det; return p * p > 9 * v ? p : 0; }
  bodyStep(B, w, bab) {
    const d = B.critic.delta, n = this.words.length; for (const q of this.ring) q.R += d;
    this.ring.push({ z: Float64Array.from(this.z), w: bab ? w : -1, R: 0, t: B.t });
    while (this.ring.length && B.t - this.ring[0].t >= BODY) { const q = this.ring.shift();
      for (let i = 0; i < n; i++) { const b = this.base[i]; Speech.acc(b, q.z[i], q.R, 0.9999); Speech.solve(b, 1); }
      if (q.w >= 0) { const b = this.base[q.w], adv = q.R - (b.a + b.b * q.z[q.w]); this.vb += 0.001 * (adv * adv - this.vb);
        const s = this.bp[q.w]; Speech.acc(s, q.z[q.w], adv, FORGET); Speech.solve(s, RIDGE); } }
    B.led.work(null, 12 * n);
  }
  lesson(i, z, r) {
    const s = this.S[i]; s.s11 = FORGET * s.s11 + 1; s.s1z = FORGET * s.s1z + z; s.szz = FORGET * s.szz + z * z; s.c1 = FORGET * s.c1 + r; s.cz = FORGET * s.cz + z * r; s.n++;
    const A = s.s11 + RIDGE * (1 - FORGET), D = s.szz + RIDGE * (1 - FORGET), det = A * D - s.s1z * s.s1z;   // гребень держится и при забывании
    if (det > 0) { s.a = (D * s.c1 - s.s1z * s.cz) / det; s.b = (A * s.cz - s.s1z * s.c1) / det; }
  }
  // улыбка на сказанное в прошлом круге -- урок цене этого слова
  sense(B) {
    if (this.said < 0) return; this.lesson(this.said, this.sz, B.obs[this.smile]); this.said = -1; B.led.work(null, 12);
  }
  act(B) {
    const v = B.bus.val, bus = B.bus, n = this.words.length;
    for (let i = 0; i < n; i++) { let s = 0, c = 0; for (const g of this.goods[i]) if (bus.owner[g] && bus.owner[g].alive) { s += v[g]; c++; }
      const x = c ? s / c : 0; this.m[i] += 0.001 * (x - this.m[i]); this.z[i] = B.cfg.SPEV ? x / Math.max(this.m[i], 1e-3) : 1; }
    let w = -1, bab = false;
    if (this.rng() < BABBLE) { bab = true; w = Math.floor(n * this.rng()); this.babbles++; }
    else { let best = 0; for (let i = 0; i < n; i++) { const s = this.S[i]; let r = s.a + s.b * this.z[i]; if (this.bp) r += this.proven(this.bp[i], this.z[i]); if (r > best) { best = r; w = i; } } if (w >= 0) this.chosen++; }
    if (w >= 0) { B.drive(this.mouth[w], 1); this.said = w; this.sz = this.z[w]; }
    if (this.bp) this.bodyStep(B, w, bab);
    B.led.work(null, 4 * n);
  }
}
module.exports = { Speech };

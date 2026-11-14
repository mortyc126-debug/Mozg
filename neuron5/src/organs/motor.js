'use strict';
// Моторная кора (ступень 8, results/s8/ПЛАН.md §2; MOT). Вне рынка. Своё движение -- поправка к команде двигателя
// u = sum_j (w_j + zeta_j) · x_j по ощущениям: x_j -- нерв в единицах своего бегущего разброса (без вычитания среднего: нерв,
// который молчит, ничего не добавляет). w начинает с 0. Учёба -- как у базальных ганглиев (принцип 3): проба zeta ~ N(0, MSIG/√N)
// (вся проба по N входам -- около MSIG, как у ганглиев)
// держится BOUT кругов, итог пробы -- сумма ошибок ожидания ценности (organs/critic.js); раз в BFIT кругов
// w_j += MLR · clip(t, ±3), t -- убедительность наклона итога по пробе (проба взвешена тем, как вход звучал).
// MOT = 2 -- контроль: пробы без учёбы.
const { stream } = require('../rng');
class Motor {
  constructor(B) { const N = B.n; this.N = N; this.w = new Float64Array(N); this.rms = new Float64Array(N).fill(1); this.nv = 0; this.rng = stream(B.seed, 'моторные пробы');
    this.cur = null; this.bouts = []; this.mabs = new Float64Array(N); this.u = 0; this.steps = 0; this.x = new Float64Array(N); }
  sense(B) { if (this.cur) this.cur.R += B.critic.delta; }
  act(B) {
    const c = B.cfg, t = B.t, N = this.N, o = B.obs; this.nv++; const k = Math.max(0.001, 1 / this.nv);
    if (!this.cur || t % c.BOUT === 0) { if (this.cur && this.cur.n) this.bouts.push(this.cur);
      this.cur = { R: 0, n: 0, ze: Float64Array.from({ length: N }, () => c.MSIG / Math.sqrt(N) * this.rng.gauss()), ex: new Float64Array(N) }; }
    let u = 0; for (let j = 0; j < N; j++) { this.rms[j] += k * (o[j] * o[j] - this.rms[j]); const x = o[j] / Math.sqrt(Math.max(this.rms[j], 1e-6)); this.x[j] = x;
      const a = Math.abs(x); this.cur.ex[j] += a; this.mabs[j] += 0.001 * (a - this.mabs[j]); u += (this.w[j] + this.cur.ze[j]) * x; }
    this.cur.n++; this.u = Math.max(-4, Math.min(4, u)); B.led.work(null, 4 * N);
  }
  learn(B) {
    const c = B.cfg; if (B.t % c.BFIT !== 0) return; const L = this.bouts; this.bouts = []; if (c.MOT !== 1 || L.length < 30 || !B.critic.w) return;
    let m = 0; for (const b of L) m += b.R; m /= L.length;
    const tOf = (xs) => { let sxx = 0, sxy = 0; for (let i = 0; i < L.length; i++) { sxx += xs[i] * xs[i]; sxy += xs[i] * (L[i].R - m); } if (!(sxx > 0)) return 0;
      const g = sxy / sxx; let rr = 0; for (let i = 0; i < L.length; i++) rr += (L[i].R - m - g * xs[i]) ** 2; const se = Math.sqrt(rr / (L.length - 1) / sxx); return se > 0 ? g / se : 0; };
    for (let j = 0; j < this.N; j++) { if (!(this.mabs[j] > 0)) continue; const tt = tOf(L.map((b) => b.ze[j] * (b.ex[j] / b.n) / this.mabs[j]));
      if (Math.abs(tt) < c.MTMIN) continue;   // шаг -- только при убедительной пробе (иначе 30 весов блуждают по шуму)
      this.w[j] = Math.max(-4, Math.min(4, this.w[j] + c.MLR * Math.max(-3, Math.min(3, tt)))); }
    this.steps++; B.led.work(null, L.length * this.N * 4);
  }
}
module.exports = { Motor };

'use strict';
// Ценность (вентральный стриатум; ступень 2а). V(x) = b0 + b · нервы -- ожидаемая будущая польза с затуханием VGAM:
// подгонка наименьшими квадратами по своей записи нервов и пользы (VH кругов) раз в VFIT кругов. Каждый круг выдаёт
// ошибку ожидания delta = C + VGAM · V(сейчас) - V(кругом раньше): «стало лучше или хуже, чем ждал». Это один учитель
// для всего, что учится действовать (PLAN.md, принцип 3).
const { solve } = require('../linalg');
class Critic {
  constructor(B) { const c = B.cfg; this.n = B.n; this.x = new Float32Array(c.VH * B.n); this.c = new Float32Array(c.VH); this.cnt = 0; this.w = null; this.pv = NaN; this.delta = 0; this.fits = 0; }
  V(x) { const w = this.w; let s = w[0]; for (let k = 0; k < this.n; k++) s += w[1 + k] * x[k]; return s; }
  sense(B) {
    const c = B.cfg, row = this.cnt % c.VH, C = B.bus.val[B.comfort]; this.x.set(B.obs, row * this.n); this.c[row] = C; this.cnt++;
    if (!this.w) { this.delta = 0; return; }
    const v = this.V(B.obs); this.delta = this.pv === this.pv ? C + c.VGAM * v - this.pv : 0; this.pv = v; B.led.work(null, this.n + 2);
  }
  learn(B) {
    const c = B.cfg; if (B.t % c.VFIT !== 0) return; const T = Math.min(this.cnt, c.VH), cut = Math.ceil(3 / (1 - c.VGAM)), n = this.n, d = n + 1; if (T - cut < 500) return;
    const at = (i) => (this.cnt - T + i) % c.VH, G = new Float64Array(T); let acc = 0; for (let i = T - 1; i >= 1; i--) { acc = this.c[at(i)] + c.VGAM * acc; G[i - 1] = acc; }   // будущая польза после круга
    const A = new Float64Array(d * d), cv = new Float64Array(d), f = new Float64Array(d); let yy = 0; f[0] = 1;
    for (let i = 0; i < T - cut; i++) { const r = at(i) * n; for (let k = 0; k < n; k++) f[1 + k] = this.x[r + k]; const y = G[i]; yy += y * y;
      for (let a = 0; a < d; a++) { cv[a] += f[a] * y; for (let b = 0; b <= a; b++) A[a * d + b] += f[a] * f[b]; } }
    for (let a = 0; a < d; a++) for (let b = 0; b < a; b++) A[b * d + a] = A[a * d + b];
    const mask = new Float64Array(d).fill(1e-3); mask[0] = 0; const s = solve(A, cv, d, yy, mask); B.led.work(null, T * d * d); if (!s) return;
    this.w = Float64Array.from(s.w); this.pv = this.V(B.obs); this.fits++;
  }
}
module.exports = { Critic };

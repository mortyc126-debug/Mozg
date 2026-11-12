'use strict';
// Миндалина (ступень 2б; Э4 нейрона-4): ожидание боли. Боль -- необычно резкое падение пользы за круг: сильнее HZ средних
// |изменений| пользы (порог мозг находит сам: укус и смерть проходят, удар о стену -- нет). По своей записи нервов и боли
// (VH кругов) миндалина учит ожидаемую боль ближайших кругов (затухание AGAM) линейно по нервам и выставляет на шину
// товар «страх» -- обстановку для выбора (organs/bg.js) и товар для коры. Вне рынка, как ценность.
const { solve } = require('../linalg');
class Amygdala {
  constructor(B) { const c = B.cfg; this.n = B.n; this.x = new Float32Array(c.VH * B.n); this.p = new Float32Array(c.VH); this.cnt = 0; this.w = null; this.pc = NaN; this.dabs = 0;
    this.good = B.bus.add('страх', null, 'страх', 0); this.fear = 0; this.mean = 0; this.pains = 0; this.fits = 0; }
  sense(B) {
    const c = B.cfg, t = B.t, C = B.bus.val[B.comfort], row = this.cnt % c.VH; let pain = 0;
    if (this.pc === this.pc) { const d = C - this.pc, a = Math.abs(d); if (t > 1000 && -d > c.HZ * this.dabs) { pain = -d; this.pains++; } this.dabs += (a - this.dabs) / Math.min(t, 1000); }
    this.pc = C; this.x.set(B.obs, row * this.n); this.p[row] = pain; this.cnt++;
    if (this.w) { let s = this.w[0]; for (let k = 0; k < this.n; k++) s += this.w[1 + k] * B.obs[k]; this.fear = Math.max(0, s); this.mean += 0.001 * (this.fear - this.mean); B.led.work(null, this.n + 2); }
    B.bus.val[this.good] = this.fear;
  }
  learn(B) {
    const c = B.cfg; if (B.t % c.VFIT !== 0) return; const T = Math.min(this.cnt, c.VH), cut = Math.ceil(3 / (1 - c.AGAM)), n = this.n, d = n + 1; if (T - cut < 500) return;
    const at = (i) => (this.cnt - T + i) % c.VH, G = new Float64Array(T); let acc = 0; for (let i = T - 1; i >= 1; i--) { acc = this.p[at(i)] + c.AGAM * acc; G[i - 1] = acc; }   // боль после круга
    const A = new Float64Array(d * d), cv = new Float64Array(d), f = new Float64Array(d); let yy = 0; f[0] = 1;
    for (let i = 0; i < T - cut; i++) { const r = at(i) * n; for (let k = 0; k < n; k++) f[1 + k] = this.x[r + k]; const y = G[i]; yy += y * y;
      for (let a = 0; a < d; a++) { cv[a] += f[a] * y; for (let b = 0; b <= a; b++) A[a * d + b] += f[a] * f[b]; } }
    for (let a = 0; a < d; a++) for (let b = 0; b < a; b++) A[b * d + a] = A[a * d + b];
    const mask = new Float64Array(d).fill(1e-3); mask[0] = 0; const s = solve(A, cv, d, yy, mask); B.led.work(null, T * d * d); if (!s || !(yy > 0)) return;
    if (!this.w) this.mean = 0; this.w = Float64Array.from(s.w); this.fits++;
  }
}
module.exports = { Amygdala };

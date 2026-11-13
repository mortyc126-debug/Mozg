'use strict';
// Таламус (THAL = 1; исследование после ступени 6б): очистка ощущений до коры. Для каждого нерва -- бегущие два сгустка
// значений (2-средних: нижний и верхний центр, общий разброс внутри сгустков). Если сгустки далеко (разрыв больше 6
// разбросов) и в каждом не меньше 1% кругов, нерв двоичный: товар «чисто» -- 0 или 1 по середине между центрами. Иначе
// товар повторяет нерв. Кора покупает или не покупает его на рынке, как любой товар (принцип 1). THAL = 2: когда нерв
// впервые признан двоичным, чистый товар дарится каналу этого нерва в коре (как след гиппокампа); оставит ли его кора --
// решает её рынок.
const GAP = 6, MIN = 0.01, RATE = 0.002;
class Thalamus {
  constructor(B) { const n = B.n; this.g = []; for (let k = 0; k < n; k++) this.g.push(B.bus.add('чисто', null, k, 0));
    this.c0 = new Float64Array(n).fill(NaN); this.c1 = new Float64Array(n).fill(NaN); this.v = new Float64Array(n).fill(1e-2); this.p1 = new Float64Array(n).fill(0.5); this.bin = new Uint8Array(n); this.gave = new Uint8Array(n); }
  sense(B) {
    const o = B.obs, v = B.bus.val, n = B.n;
    for (let k = 0; k < n; k++) { const x = o[k];
      if (this.c0[k] !== this.c0[k]) { this.c0[k] = x - 0.1; this.c1[k] = x + 0.1; }
      const mid = (this.c0[k] + this.c1[k]) / 2, up = x > mid ? 1 : 0, r = Math.max(RATE, 1 / (B.t + 10));
      if (up) { const d = x - this.c1[k]; this.c1[k] += 4 * r * d; this.v[k] += r * (d * d - this.v[k]); } else { const d = x - this.c0[k]; this.c0[k] += r * d; this.v[k] += r * (d * d - this.v[k]); }
      this.p1[k] += r * (up - this.p1[k]);
      this.bin[k] = B.t > 1000 && this.c1[k] - this.c0[k] > GAP * Math.sqrt(this.v[k]) && this.p1[k] > MIN && this.p1[k] < 1 - MIN ? 1 : 0;
      v[this.g[k]] = this.bin[k] ? up : x;
      if (B.cfg.THAL === 2 && this.bin[k] && !this.gave[k]) { this.gave[k] = 1; this.give = (this.give || []).concat(k); } }
    B.led.work(null, 8 * n);
  }
  learn(B) { if (!this.give) return; for (const k of this.give) B.cortex.deliver(B, k, this.g[k], 1, 0); this.give = null; }
}
module.exports = { Thalamus };

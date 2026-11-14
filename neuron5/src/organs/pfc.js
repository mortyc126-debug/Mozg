'use strict';
// Лобная кора (ступень 10, results/s10/ПЛАН.md §1; PFC). Вне рынка. Цель -- еда или вода; тяга -- нужда (по врождённой карте
// ощущений, как у ствола). Цель держится: другая берётся, только когда её тяга больше тяги нынешней на порог m. Цель
// ведёт: предложения о другом ресурсе (рефлекс ствола и предложение навигатора) ганглии глушат. Порог учится по пробам,
// как веса ганглиев (принцип 3): проба m + zeta держится BOUT кругов, итог -- сумма ошибок ожидания ценности; раз в BFIT
// кругов m += 0.03 · clip(t, ±3); m в [0, 0.6], начинает с 0. PFC = 2 -- порог PFCM задан рукой, без учёбы.
const { stream } = require('../rng');
class PFC {
  constructor(B) { this.I = B.world.innate; this.goal = -1; this.m = B.cfg.PFC === 2 ? B.cfg.PFCM : 0; this.rng = stream(B.seed, 'пробы цели'); this.cur = null; this.bouts = []; this.switches = 0; this.steps = 0; this.mm = this.m; }
  // ресурс предложения ганглиев: 0 -- еда, 1 -- вода, -1 -- прочее
  static res(name) { return name.startsWith('к еде') ? 0 : name.startsWith('к воде') ? 1 : -1; }
  gain(r) { return r < 0 || this.goal < 0 || r === this.goal ? 1 : 0; }
  sense(B) { if (this.cur) this.cur.R += B.critic.delta; }
  act(B) {
    const c = B.cfg, o = B.obs, I = this.I;
    if (c.PFC === 1 && (!this.cur || B.t % c.BOUT === 0)) { if (this.cur) this.bouts.push(this.cur); const ze = 0.1 * this.rng.gauss(); this.cur = { R: 0, ze }; this.mm = Math.max(0, Math.min(0.6, this.m + ze)); }
    const d = [1 - o[I.e], 1 - o[I.h]];
    if (this.goal < 0) this.goal = d[0] >= d[1] ? 0 : 1;
    else if (d[1 - this.goal] > d[this.goal] + this.mm) { this.goal = 1 - this.goal; if (B.t > c.ROUNDS / 2) this.switches++; }
    B.led.work(null, 6);
  }
  learn(B) {
    const c = B.cfg; if (c.PFC !== 1 || B.t % c.BFIT !== 0) return; const L = this.bouts; this.bouts = []; if (L.length < 30 || !B.critic.w) return;
    let m = 0; for (const b of L) m += b.R; m /= L.length; let sxx = 0, sxy = 0; for (const b of L) { sxx += b.ze * b.ze; sxy += b.ze * (b.R - m); } if (!(sxx > 0)) return;
    const g = sxy / sxx; let rr = 0; for (const b of L) rr += (b.R - m - g * b.ze) ** 2; const se = Math.sqrt(rr / (L.length - 1) / sxx), t = se > 0 ? g / se : 0;
    this.m = Math.max(0, Math.min(0.6, this.m + 0.03 * Math.max(-3, Math.min(3, t)))); this.steps++;
  }
}
module.exports = { PFC };

'use strict';
// Базальные ганглии (ступень 2а; Э5б нейрона-4): выбор учится по своим пробам, а не по совпадениям (PLAN.md, принцип 3).
// Команда -- сумма (alpha_j + xi_j) · рефлекс_j по рефлексам ствола с шины. Веса alpha начинают с 1 (слушаться ствол как
// есть). Пробы xi ~ N(0, BSIG) меняются каждые BOUT кругов. Итог пробы -- сумма ошибок ожидания ценности за её круги
// (organs/critic.js). Раз в BFIT кругов, по пробам этого отрезка (каждая считается один раз): наклон итога по пробе
// рефлекса -- проба взвешена тем, насколько рефлекс в ней звучал, -- и его ошибка; шаг alpha_j += BLR · clip(t, ±3).
// Проба случайна, обстановка с ней не связана -- связь причинная.
// Ступень 7 (BSOC): вес рефлекса «к другому» -- alpha + сумма gamma_i · c_i, c_i -- голос другого (слово i в прошлом круге).
// Пробы и учёба gamma -- как у alpha (проба взвешена тем, как рефлекс звучал, пока слово i было слышно); gamma начинает с 0;
// вес не ниже 0. BSOCG >= 0 -- диагностика: gamma слов «еда» и «вода» задана рукой, gamma не учатся. BMEM > 0: обстановка --
// не само слово, а его угасающая память (рабочая память: c_i = max(слово сейчас, BMEM · c_i прошлого круга)).
const { stream } = require('../rng');
class BasalGanglia {
  constructor(B) { const J = B.stem.props.length; this.J = J; this.al = new Float64Array(J).fill(1); this.rng = stream(B.seed, 'пробы'); this.cur = null; this.bouts = [];
    this.mabs = new Float64Array(J); this.tst = new Float64Array(J); this.steps = 0;
    this.soc = B.cfg.BSOC && J === 5 ? B.world.innate.pvoice : null; if (this.soc) { const K = this.soc.length; this.ga = new Float64Array(K); if (B.cfg.BSOCG >= 0) { this.ga[0] = this.ga[1] = B.cfg.BSOCG; } this.mz = new Float64Array(K); this.tsg = new Float64Array(K); this.zr = stream(B.seed, 'пробы слов'); this.mem = new Float64Array(K); } }
  sense(B) { if (this.cur) this.cur.R += B.critic.delta; }   // ошибка ожидания этого круга -- следствие команды прошлого
  act(B) {
    const c = B.cfg, t = B.t, v = B.bus.val, P = B.stem.props, J = this.J;
    if (!this.cur || t % c.BOUT === 0) { if (this.cur && this.cur.n) this.bouts.push(this.cur);
      this.cur = { R: 0, n: 0, xi: Float64Array.from({ length: J }, () => c.BSIG * this.rng.gauss()), ex: new Float64Array(J) };
      if (this.soc) { this.cur.ze = Float64Array.from(this.ga, () => (c.BSOCG >= 0 ? 0 : c.BSIG * this.zr.gauss())); this.cur.ez = new Float64Array(this.ga.length); } }
    let u = 0; for (let j = 0; j < J; j++) { const p = v[P[j]], a = Math.abs(p); this.cur.ex[j] += a; this.mabs[j] += 0.001 * (a - this.mabs[j]);
      if (this.soc && j === 4) { let w = this.al[j] + this.cur.xi[j]; for (let k = 0; k < this.ga.length; k++) { const now = B.obs[this.soc[k]] > 0.5 ? 1 : 0, ck = c.BMEM > 0 ? (this.mem[k] = Math.max(now, c.BMEM * this.mem[k])) : now; if (ck > 0.01) { w += (this.ga[k] + this.cur.ze[k]) * ck; this.cur.ez[k] += ck * a; } this.mz[k] += 0.001 * (ck * a - this.mz[k]); }
        u += Math.max(0, w) * p; continue; }
      u += (this.al[j] + this.cur.xi[j]) * p; }
    this.cur.n++; const cmd = Math.max(-4, Math.min(4, u + c.USIG * this.rng.gauss())); if (B.map.m !== null) B.drive(B.map.m, B.map.sign * cmd); B.led.work(null, 3 * J);
  }
  learn(B) {
    const c = B.cfg; if (B.t % c.BFIT !== 0) return; const L = this.bouts; this.bouts = []; if (!(c.BLR > 0) || L.length < 30 || !B.critic.w) return;
    let m = 0; for (const b of L) m += b.R; m /= L.length;
    // убедительность пробы: наклон итога по пробе над его ошибкой
    const tOf = (xs) => { let sxx = 0, sxy = 0; for (let i = 0; i < L.length; i++) { sxx += xs[i] * xs[i]; sxy += xs[i] * (L[i].R - m); } if (!(sxx > 0)) return 0;
      const g = sxy / sxx; let rr = 0; for (let i = 0; i < L.length; i++) rr += (L[i].R - m - g * xs[i]) ** 2; const se = Math.sqrt(rr / (L.length - 1) / sxx); return se > 0 ? g / se : 0; };
    const clip = (x) => Math.max(-3, Math.min(3, x));
    for (let j = 0; j < this.J; j++) { if (!(this.mabs[j] > 0)) continue;
      const tt = tOf(L.map((b) => b.xi[j] * (b.ex[j] / b.n) / this.mabs[j])); this.tst[j] = tt; this.al[j] = Math.max(0, Math.min(6, this.al[j] + c.BLR * clip(tt))); }
    if (this.soc && !(c.BSOCG >= 0)) for (let k = 0; k < this.ga.length; k++) { if (!(this.mz[k] > 0)) continue;
      const tg = tOf(L.map((b) => (b.ze ? b.ze[k] * (b.ez[k] / b.n) / this.mz[k] : 0))); this.tsg[k] = tg; this.ga[k] = Math.max(-3, Math.min(3, this.ga[k] + c.BLR * clip(tg))); }
    this.steps++; B.led.work(null, L.length * this.J * 4);
  }
}
module.exports = { BasalGanglia };

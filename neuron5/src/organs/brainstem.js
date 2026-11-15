'use strict';
// Ствол мозга: врождённые рефлексы по врождённой карте тела (PLAN.md §4, принцип 5). Четыре предложения поворота: к стороне,
// где сильнее запах еды (по голоду) и воды (по жажде), прочь от стороны, где сильнее запах хищника, и прочь от стены,
// которой коснулось. Каждое -- товар «рефлекс» на шине (принцип 1). Ничему не учится и счёта не имеет: это тело. Без
// базальных ганглиев (BG = 0) ствол сам подаёт сумму рефлексов и шум; с ними -- решают ганглии (organs/bg.js).
// Ступень 7 (два тела): рефлекс «к другому» -- к стороне, где сильнее запах другого (врождённое стремление к своим).
// Ступень 11 (BCAR): рефлекс «к норе» -- к стороне, где сильнее запах норы.
const { stream } = require('../rng');
const NAMES = ['к еде', 'к воде', 'от хищника', 'от стены'];
class Brainstem {
  constructor(B) { this.i = B.world.innate; this.rng = stream(B.seed, 'ствол'); this.names = NAMES.slice();
    if (this.i.ol !== undefined) { this.jOther = this.names.length; this.names.push('к другому'); }   // ступень 7
    if (this.i.dl !== undefined && B.cfg.BCAR) { this.jDen = this.names.length; this.names.push('к норе'); }   // ступень 11
    this.props = this.names.map((nm) => B.bus.add('рефлекс', null, nm, 0)); }
  act(B) {
    const c = B.cfg, o = B.obs, i = this.i, v = B.bus.val, P = this.props;
    v[P[0]] = c.GF * (1 - o[i.e]) * (o[i.fl] - o[i.fr]); v[P[1]] = c.GF * (1 - o[i.h]) * (o[i.wl] - o[i.wr]);
    v[P[2]] = -c.GP * (o[i.pl] - o[i.pr]); v[P[3]] = -c.GW * (o[i.tl] - o[i.tr]); if (this.jOther !== undefined) v[P[this.jOther]] = c.GS * (o[i.ol] - o[i.or]); if (this.jDen !== undefined) v[P[this.jDen]] = c.GF * (o[i.dl] - o[i.dr]);
    if (!c.BG) { const cmd = Math.max(-4, Math.min(4, v[P[0]] + v[P[1]] + v[P[2]] + v[P[3]] + (this.jOther !== undefined ? v[P[this.jOther]] : 0) + c.USIG * this.rng.gauss())); if (B.map.m !== null) B.drive(B.map.m, B.map.sign * cmd); }
  }
}
module.exports = { Brainstem };

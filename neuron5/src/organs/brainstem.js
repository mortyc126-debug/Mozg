'use strict';
// Ствол мозга: врождённые рефлексы по врождённой карте тела (PLAN.md §4, принцип 5). Четыре предложения поворота: к стороне,
// где сильнее запах еды (по голоду) и воды (по жажде), прочь от стороны, где сильнее запах хищника, и прочь от стены,
// которой коснулось. Каждое -- товар «рефлекс» на шине (принцип 1). Ничему не учится и счёта не имеет: это тело. Без
// базальных ганглиев (BG = 0) ствол сам подаёт сумму рефлексов и шум; с ними -- решают ганглии (organs/bg.js).
// Ступень 7 (два тела): пятый рефлекс «к другому» -- к стороне, где сильнее запах другого (врождённое стремление к своим).
const { stream } = require('../rng');
const NAMES = ['к еде', 'к воде', 'от хищника', 'от стены', 'к другому'];
class Brainstem {
  constructor(B) { this.i = B.world.innate; this.rng = stream(B.seed, 'ствол'); this.names = NAMES.slice(0, this.i.ol !== undefined ? 5 : 4); this.props = this.names.map((nm) => B.bus.add('рефлекс', null, nm, 0)); }
  act(B) {
    const c = B.cfg, o = B.obs, i = this.i, v = B.bus.val, P = this.props;
    v[P[0]] = c.GF * (1 - o[i.e]) * (o[i.fl] - o[i.fr]); v[P[1]] = c.GF * (1 - o[i.h]) * (o[i.wl] - o[i.wr]);
    v[P[2]] = -c.GP * (o[i.pl] - o[i.pr]); v[P[3]] = -c.GW * (o[i.tl] - o[i.tr]); if (P[4] !== undefined) v[P[4]] = c.GS * (o[i.ol] - o[i.or]);
    if (!c.BG) { const cmd = Math.max(-4, Math.min(4, v[P[0]] + v[P[1]] + v[P[2]] + v[P[3]] + (P[4] !== undefined ? v[P[4]] : 0) + c.USIG * this.rng.gauss())); if (B.map.m !== null) B.drive(B.map.m, B.map.sign * cmd); }
  }
}
module.exports = { Brainstem };

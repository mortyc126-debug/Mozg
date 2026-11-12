'use strict';
// Ствол мозга: врождённые рефлексы по врождённой карте тела (PLAN.md §4, принцип 5). Четыре предложения поворота: к стороне,
// где сильнее запах еды (по голоду) и воды (по жажде), прочь от стороны, где сильнее запах хищника, и прочь от стены,
// которой коснулось. Каждое -- товар «рефлекс» на шине (принцип 1). Ничему не учится и счёта не имеет: это тело. Без
// базальных ганглиев (BG = 0) ствол сам подаёт сумму рефлексов и шум; с ними -- решают ганглии (organs/bg.js).
const { stream } = require('../rng');
const NAMES = ['к еде', 'к воде', 'от хищника', 'от стены'];
class Brainstem {
  constructor(B) { this.i = B.world.innate; this.rng = stream(B.seed, 'ствол'); this.props = NAMES.map((nm) => B.bus.add('рефлекс', null, nm, 0)); this.names = NAMES; }
  act(B) {
    const c = B.cfg, o = B.obs, i = this.i, v = B.bus.val, P = this.props;
    v[P[0]] = c.GF * (1 - o[i.e]) * (o[i.fl] - o[i.fr]); v[P[1]] = c.GF * (1 - o[i.h]) * (o[i.wl] - o[i.wr]);
    v[P[2]] = -c.GP * (o[i.pl] - o[i.pr]); v[P[3]] = -c.GW * (o[i.tl] - o[i.tr]);
    if (!c.BG) B.drive(i.m, Math.max(-4, Math.min(4, v[P[0]] + v[P[1]] + v[P[2]] + v[P[3]] + c.USIG * this.rng.gauss())));
  }
}
module.exports = { Brainstem };

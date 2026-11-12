'use strict';
// Ствол мозга: врождённые рефлексы по врождённой карте тела (PLAN.md §4, принцип 5). Поворот -- к стороне, где запах еды
// и воды сильнее (по нужде: голодному -- еда, жаждущему -- вода), прочь от стороны, где сильнее запах хищника, и прочь от стены, которой коснулось (отдёргивание); плюс шум.
// Ничему не учится и счёта не имеет: это тело. На ступени 2 выученный выбор решает, когда рефлексу подчиняться.
const { stream } = require('../rng');
class Brainstem {
  constructor(B) { this.i = B.world.innate; this.rng = stream(B.seed, 'ствол'); }
  act(B) {
    const c = B.cfg, o = B.obs, i = this.i;
    const u = c.GF * ((1 - o[i.e]) * (o[i.fl] - o[i.fr]) + (1 - o[i.h]) * (o[i.wl] - o[i.wr])) - c.GP * (o[i.pl] - o[i.pr]) - c.GW * (o[i.tl] - o[i.tr]) + c.USIG * this.rng.gauss();
    B.drive(i.m, Math.max(-4, Math.min(4, u)));
  }
}
module.exports = { Brainstem };

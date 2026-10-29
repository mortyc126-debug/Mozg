'use strict';
// Орган страха (Колония К1к, results/kolonia/ПЛАН_К1к.md; KFEAR). Страх -- прогноз смерти заранее: ожидаемая смерть с
// затуханием y(t) = сумма KFGAM^(k-1) смерть(t+k), k >= 1. Связь с нервом «смерть» врождённая (её задаёт мир, как пользу),
// какие нервы о смерти говорят -- орган учит сам: модель линейна по нервам и их квадратам (все нервы, кроме двигателя).
// Суммы копятся каждый круг с забыванием (~5000 кругов); цель строки известна через LAG кругов -- строка входит с задержкой.
// Выход -- товар «страх» (один на всю жизнь мозга; органа нет -- 0). Доход за страх: в круг смерти тела мир платит органу
// KFPAY (средний страх за BEFORE кругов до смерти - средний страх органа вообще); не ждал -- платит сам. Хозяйство -- как у
// всех: кредит от банка, аренда, в долгу дольше DIE -- банкротство, новый орган -- через REBORN кругов, с нуля.
// KFEAR=2 -- товар «страх» входит в ценность и команду мотора (src/explorer.js, valRecord) как ещё один нерв.
const { solve } = require('./linalg');
const LAG = 150, FIT = 200, BEFORE = 50, REBORN = 500, FCRED = 1500, FIRST = 1000, FORGET = 1 - 1 / 5000;

function step(B) {
  const cfg = B.cfg, W = B.world, G = B.goods, led = B.led;
  if (!B.fear) { if (!(W.deathNerve >= 0) || B.ch.length < W.n) return;
    B.fear = { good: G.add('страх', 'world', -1, B.t), org: null, next: FIRST, deaths: 0, built: 0, paid: 0, ks: B.ch.filter((c) => c.k !== W.motorNerve).map((c) => c.k) }; }
  const F = B.fear, t = B.t, d = 2 * F.ks.length + 1;
  if (!F.org && t >= F.next) { F.built++;
    F.org = led.open('страх', 'bank', FCRED, { d, A: new Float64Array(d * d), cv: new Float64Array(d), yy: 0, n: 0, w: null, ring: new Float64Array(LAG * d), dr: new Float64Array(LAG),
      fr: new Float64Array(BEFORE), fm: 0, fn: 0, born: t, mem: d * d + LAG * (d + 1) + BEFORE }); }
  const o = F.org; if (!o) { G.val[F.good] = 0; return; }
  // признаки этого круга и страх
  const f = new Float64Array(d); f[0] = 1; for (let i = 0; i < F.ks.length; i++) { const x = G.val[B.ch[F.ks[i]].good]; f[1 + 2 * i] = x; f[2 + 2 * i] = x * x; }
  let fear = 0; if (o.w) for (let i = 0; i < d; i++) fear += o.w[i] * f[i];
  // доход за страх: смерть в прошлом круге -- нерв «смерть» сейчас 1 (мир знает точно)
  if (W.died && o.w && o.fn >= BEFORE) { let s = 0; for (let i = 0; i < BEFORE; i++) s += o.fr[i]; const pay = cfg.KFPAY * (s / BEFORE - o.fm);
    if (pay > 0) led.earn('world', o, pay, 'мир->страх: доход за страх'); else if (pay < 0) led.move(o, 'world', -pay, 'страх->мир: не ждал смерти');
    F.paid += pay; }
  if (o.w) { o.fr[o.fn % BEFORE] = fear; o.fn++; o.fm += (fear - o.fm) / Math.min(o.fn, 5000); }
  G.val[F.good] = fear;
  // учёба: строка круга t - LAG получает цель -- смерти в кругах после неё
  const dv = G.val[B.ch[W.deathNerve].good], slot = t % LAG;
  o.dr[slot] = dv; o.n++;
  if (o.n > LAG) { const r = o.ring.subarray(slot * d, slot * d + d); let y = 0, g = 1;   // в ячейке slot -- строка t - LAG
    for (let k = 1; k < LAG; k++) { y += g * o.dr[(slot + k) % LAG]; g *= cfg.KFGAM; } y += g * dv;
    for (let i = 0; i < d * d; i++) o.A[i] *= FORGET; for (let i = 0; i < d; i++) o.cv[i] *= FORGET; o.yy = o.yy * FORGET + y * y;
    for (let i = 0; i < d; i++) { o.cv[i] += r[i] * y; for (let j = 0; j <= i; j++) o.A[i * d + j] += r[i] * r[j]; } }
  o.ring.set(f, slot * d);
  led.work(o, 2 * d * d + 2 * LAG + 2 * d);
  if (o.n > LAG + 1000 && (t - o.born) % FIT === 0) { const A = Float64Array.from(o.A); for (let i = 0; i < d; i++) for (let j = 0; j < i; j++) A[j * d + i] = A[i * d + j];
    const mask = new Float64Array(d).fill(1e-3); mask[0] = 0; const r = solve(A, o.cv, d, o.yy, mask); led.work(o, d * d * d); if (r) o.w = Float64Array.from(r.w); }
  // хозяйство
  o.age++; led.rent(o, cfg.RENT); o.inc = 0;
  if (o.w && o.credit > cfg.CAP) led.move(o, 'bank', o.credit - cfg.CAP, 'страх->банк: налог сверх потолка');   // до первой подгонки кредит -- запас на учёбу, без налога
  o.hungry = o.credit < 0 ? o.hungry + 1 : 0;
  // доход кусками (в круги смерти) -- живёт в долг, как мотор с MLOAN
  if (o.hungry > cfg.DIE && !(cfg.MLOAN && o.credit > -cfg.MLOAN)) { led.close(o); F.org = null; F.next = t + REBORN; F.deaths++; G.val[F.good] = 0; }
}
module.exports = { step };

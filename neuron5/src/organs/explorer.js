'use strict';
// Исследователь тела (ступень 3, results/s3/ПЛАН.md §1; MAP = 0). Вне рынка. Каждый круг -- проба ±1 (знак -- жребий) на
// один ещё не понятый нерв; в следующем круге -- что почувствовано: чувство поворота и ухо (врождённые ощущения).
// Принцип 3: учёба по своим пробам. По каждому ощущению -- разница средних после +1 и после -1 и её ошибка (t):
// |t| > 8 по чувству поворота -- двигатель (знак -- знак разницы); t > 8 по уху -- рот; не меньше 12 проб (и по 4 каждого
// знака) до решения; после 40 проб без того и другого -- пустой нерв. Понятый нерв больше не пробуется и отдаётся в карту
// тела (B.map): двигатель -- базальным ганглиям, рот -- речи.
const { stream } = require('../rng');
const NMIN = 12, NMAX = 40, TMIN = 8;
class Explorer {
  constructor(B) {
    const I = B.world.innate; this.feel = [I.p, I.ear]; this.rng = stream(B.seed, 'исследователь'); this.n = B.n;
    const z = () => ({ n: 0, s: 0, ss: 0 }); this.st = Array.from({ length: B.n }, () => ({ done: false, g: [[z(), z()], [z(), z()]], n: 0 }));
    this.open = Array.from({ length: B.n }, (_, k) => k); this.pk = -1; this.pv = 0; this.doneAt = null; this.verdict = new Array(B.n).fill('?');
  }
  static t(a, b) { if (a.n < 4 || b.n < 4) return 0; const ma = a.s / a.n, mb = b.s / b.n, va = Math.max(0, a.ss / a.n - ma * ma), vb = Math.max(0, b.ss / b.n - mb * mb);
    const v = (va * a.n + vb * b.n) / (a.n + b.n - 2) * (1 / a.n + 1 / b.n); return (ma - mb) / Math.sqrt(Math.max(v, 1e-12)); }
  sense(B) {
    if (this.pk < 0) return; const k = this.pk, S = this.st[k], side = this.pv > 0 ? 0 : 1; this.pk = -1; S.n++;
    for (let j = 0; j < 2; j++) { const y = B.obs[this.feel[j]], g = S.g[j][side]; g.n++; g.s += y; g.ss += y * y; }
    if (S.n < NMIN) return;
    const tp = Explorer.t(S.g[0][0], S.g[0][1]), te = Explorer.t(S.g[1][0], S.g[1][1]); let what = null;
    if (Math.abs(tp) > TMIN) { what = 'двигатель'; if (B.map.m === null) { B.map.m = k; B.map.sign = Math.sign(tp); } }
    else if (te > TMIN) { what = 'рот'; B.map.mouth.push(k); }
    else if (S.n >= NMAX) what = 'пусто';
    if (what) { S.done = true; this.verdict[k] = what; this.open.splice(this.open.indexOf(k), 1); if (!this.open.length) { this.doneAt = B.t; B.map.done = true; } }
    B.led.work(null, 20);
  }
  act(B) {
    if (!this.open.length) return; const k = this.open[Math.floor(this.open.length * this.rng())], v = this.rng() < 0.5 ? 1 : -1;
    B.drive(k, v); this.pk = k; this.pv = v; B.led.work(null, 4);
  }
}
module.exports = { Explorer };

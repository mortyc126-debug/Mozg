'use strict';
/* ============================================================
   ПРОБА
   Внешнее воздействие подаётся в точку пространства. Движок не знает,
   есть ли там кто-то чувствительный. Измеряется только то, сколько
   агентов после этого пришло в возбуждение и как далеко оно ушло.
   ============================================================ */
const { step, stimulate, components } = require('./world');

/* точки воздействия выбираются геометрически: концы главной оси
   самой крупной связной группы, а если её нет — самой популяции */
function sites(w) {
  const comps = components(w);
  const set = (comps[0] && comps[0].length >= 8) ? comps[0] : w.cells;
  if (!set.length) return [];
  const n = set.length;
  let mx = 0, my = 0;
  for (const c of set) { mx += c.x / n; my += c.y / n; }
  let sxx = 0, syy = 0, sxy = 0;
  for (const c of set) { const dx = c.x - mx, dy = c.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const tr = (sxx + syy) / n, det = (sxx * syy - sxy * sxy) / (n * n);
  const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
  let ax = sxy / n, ay = l1 - sxx / n;
  const len = Math.hypot(ax, ay) || 1; ax /= len; ay /= len;
  let lo = set[0], hi = set[0], plo = 1e9, phi = -1e9;
  for (const c of set) {
    const p = (c.x - mx) * ax + (c.y - my) * ay;
    if (p < plo) { plo = p; lo = c; }
    if (p > phi) { phi = p; hi = c; }
  }
  return [{ x: lo.x, y: lo.y }, { x: hi.x, y: hi.y }];
}

function respond(w, p, amp = 1.0, steps = 110) {
  const t0 = w.t;
  stimulate(w, p.x, p.y, amp);
  for (let i = 0; i < steps; i++) step(w);
  let n = 0, far = 0;
  for (const c of w.cells) if (c.fired >= t0) {
    n++;
    far = Math.max(far, Math.hypot(c.x - p.x, c.y - p.y));
  }
  return { n, far };
}

/* слабая проба → повторное сильное воздействие → та же слабая проба */
function plasticity(w, p, trials = 8, gap = 130) {
  const before = respond(w, p, 1.0);
  for (let k = 0; k < trials; k++) {
    stimulate(w, p.x, p.y, 2.2);
    for (let i = 0; i < gap; i++) step(w);
  }
  const after = respond(w, p, 1.0);
  return {
    before: before.n, after: after.n,
    farBefore: before.far, farAfter: after.far,
    gain: before.n > 0 ? after.n / before.n : (after.n > 0 ? Infinity : 1),
  };
}

module.exports = { sites, respond, plasticity };

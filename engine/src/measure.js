'use strict';
/* ============================================================
   ИЗМЕРЕНИЯ
   Ни одно измерение не знает, что такое "ось", "рецептор" или
   "нервная система". Считаются только наблюдаемые величины:
   сколько агентов, какие устойчивые состояния экспрессии есть,
   как они расположены в пространстве, как устроена сеть связей.
   ============================================================ */
const { components, buildHash, forNeighbors, D0 } = require('./world');

/* форма произвольной группы агентов */
function shape(group, w) {
  const n = group.length;
  if (n < 5) return { n, elong: 0, inner: 0, hollow: 1, spread: 0 };
  let mx = 0, my = 0;
  for (const c of group) { mx += c.x / n; my += c.y / n; }
  let sxx = 0, syy = 0, sxy = 0;
  for (const c of group) { const dx = c.x - mx, dy = c.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  sxx /= n; syy /= n; sxy /= n;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l2 = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const len = 2 * Math.sqrt(Math.max(l1, 0)), wid = 2 * Math.sqrt(Math.max(l2, 0));

  // доля агентов группы, окружённых со всех сторон (насколько группа лежит внутри ткани)
  const H = buildHash(w);
  let ins = 0;
  for (const c of group) {
    let cnt = 0, sx = 0, sy = 0;
    forNeighbors(H, c, D0 * 2.2, (o) => {
      const dx = o.x - c.x, dy = o.y - c.y;
      if (dx * dx + dy * dy < (D0 * 2.2) * (D0 * 2.2)) { cnt++; sx += dx; sy += dy; }
    });
    if (cnt > 6 && Math.hypot(sx, sy) / cnt < D0 * 0.35) ins++;
  }

  // заполненность центра: если центр пуст, группа кольцевая или дуговая
  let rmax = 0;
  for (const c of group) rmax = Math.max(rmax, Math.hypot(c.x - mx, c.y - my));
  let near = 0;
  for (const c of group) if (Math.hypot(c.x - mx, c.y - my) < 0.45 * rmax) near++;

  return {
    n, cx: mx, cy: my, len, wid,
    elong: wid > 0.01 ? len / wid : 0,
    inner: ins / n,
    hollow: 1 - near / n,
    spread: rmax,
  };
}

/* устойчивые состояния экспрессии: агенты группируются по своему
   двоичному профилю; роль профиля не приписывается */
function expressionTypes(w, minShare = 0.05) {
  const map = new Map();
  for (const c of w.cells) {
    let key = 0;
    for (let g = 0; g < w.nGenes; g++) if (c.e[g] > 0.5) key |= (1 << g);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  }
  const out = [];
  for (const [key, group] of map) {
    const share = group.length / w.cells.length;
    if (share < minShare) continue;
    const s = shape(group, w);
    out.push({ key, bits: key.toString(2).padStart(w.nGenes, '0').split('').reverse().join(''), share, ...s });
  }
  out.sort((a, b) => b.n - a.n);
  return out;
}

/* пространственная анизотропия экспрессии: насколько экспрессия
   вообще связана с положением в пространстве */
function anisotropy(w) {
  const n = w.cells.length;
  if (!n) return 0;
  let mxp = 0, myp = 0;
  for (const c of w.cells) { mxp += c.x / n; myp += c.y / n; }
  let best = 0;
  for (let g = 0; g < w.nGenes; g++) {
    let me = 0;
    for (const c of w.cells) me += c.e[g] / n;
    let cx = 0, cy = 0, se = 0, sx = 0, sy = 0;
    for (const c of w.cells) {
      const de = c.e[g] - me, dx = c.x - mxp, dy = c.y - myp;
      cx += dx * de; cy += dy * de; se += de * de; sx += dx * dx; sy += dy * dy;
    }
    if (se < 1e-9) continue;
    const r = Math.hypot(cx / Math.sqrt(sx * se || 1), cy / Math.sqrt(sy * se || 1));
    best = Math.max(best, Math.min(1, r));
  }
  return best;
}

function network(w) {
  const comps = components(w);
  const big = comps[0] || [];
  const seen = new Set();
  let wSum = 0, wCnt = 0, deg = 0;
  for (const c of w.cells) {
    deg += c.links.length;
    for (const l of c.links) { if (seen.has(l)) continue; seen.add(l); wSum += l.w; wCnt++; }
  }
  return {
    comps: comps.length,
    compMax: big.length,
    links: wCnt,
    degree: w.cells.length ? deg / w.cells.length : 0,
    wMean: wCnt ? wSum / wCnt : 0,
    bigShape: big.length >= 5 ? shape(big, w) : null,
  };
}

function measure(w) {
  const n = w.cells.length;
  let energy = 0;
  const mean = new Float64Array(w.nGenes);
  for (const c of w.cells) {
    energy += c.energy / (n || 1);
    for (let g = 0; g < w.nGenes; g++) mean[g] += c.e[g] / (n || 1);
  }
  return {
    t: w.t, n, energy, mean: Array.from(mean),
    types: expressionTypes(w),
    anis: anisotropy(w),
    net: network(w),
  };
}

/* кривизна группы агентов: в собственных осях группы подгоняется парабола,
   возвращается прогиб относительно длины. Прямая полоса даёт 0, дуга — больше 0.
   Наблюдатель: на симуляцию не влияет. */
function curvature(group) {
  const n = group.length;
  if (n < 12) return { len: 0, sagitta: 0, bend: 0 };
  let mx = 0, my = 0;
  for (const c of group) { mx += c.x / n; my += c.y / n; }
  let sxx = 0, syy = 0, sxy = 0;
  for (const c of group) { const dx = c.x - mx, dy = c.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  sxx /= n; syy /= n; sxy /= n;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
  let ux = sxy, uy = l1 - sxx;
  const nl = Math.hypot(ux, uy) || 1; ux /= nl; uy /= nl;
  const vx = -uy, vy = ux;

  // координаты в осях группы
  const P = group.map((c) => {
    const dx = c.x - mx, dy = c.y - my;
    return [dx * ux + dy * uy, dx * vx + dy * vy];
  });
  // подгонка v = a*u^2 + b*u + c методом наименьших квадратов
  let S0 = n, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0;
  for (const [u, v] of P) {
    const u2 = u * u;
    S1 += u; S2 += u2; S3 += u2 * u; S4 += u2 * u2;
    T0 += v; T1 += u * v; T2 += u2 * v;
  }
  const M = [[S4, S3, S2], [S3, S2, S1], [S2, S1, S0]], Y = [T2, T1, T0];
  for (let i = 0; i < 3; i++) {                      // метод Гаусса
    let p = i;
    for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (Math.abs(M[p][i]) < 1e-12) return { len: 0, sagitta: 0, bend: 0 };
    [M[i], M[p]] = [M[p], M[i]]; [Y[i], Y[p]] = [Y[p], Y[i]];
    for (let r = 0; r < 3; r++) {
      if (r === i) continue;
      const f = M[r][i] / M[i][i];
      for (let k = i; k < 3; k++) M[r][k] -= f * M[i][k];
      Y[r] -= f * Y[i];
    }
  }
  const a = Y[0] / M[0][0];
  let lo = 1e9, hi = -1e9;
  for (const [u] of P) { if (u < lo) lo = u; if (u > hi) hi = u; }
  const len = hi - lo;
  const sagitta = Math.abs(a) * (len / 2) * (len / 2);
  return { len, sagitta, bend: len > 1 ? sagitta / len : 0 };
}

module.exports = { measure, shape, expressionTypes, anisotropy, network, curvature };

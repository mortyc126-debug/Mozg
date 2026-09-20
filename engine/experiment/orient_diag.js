#!/usr/bin/env node
'use strict';
/* ПОЧЕМУ НА ДВУСЛОЙНОМ |q| БЛИЗОК К НУЛЮ.

   Гипотеза: это НЕ беспорядок, а правильная структура. Ориентация
   тянется к локальной асимметрии ("куда соседей меньше"), поэтому у
   двурядного пласта верхний ряд смотрит наружу вверх, нижний -- наружу
   вниз. Среднее по всем агентам сокращается.

   Это ровно та ловушка, которую движок описал на этапе 8: «если все
   агенты смотрят наружу, модуль среднего направления близок к нулю,
   хотя ткань согласована идеально». Мера |q| для пласта с двумя
   сторонами неверна по построению.

   Измеряется, как и предписано этапом 8:
   - согласие соседей (скалярное произведение у соприкасающихся),
     отдельно ВНУТРИ ряда и МЕЖДУ рядами;
   - согласие со стороной: проекция q на внешнюю нормаль к средней
     линии пласта. Внешняя нормаль считается наблюдателем, агенту она
     недоступна.

   Запуск: node experiment/orient_diag.js [сиды] [толщины] [jadh] [jst]
*/
const { createWorld, step, D0 } = require('../src/world');
const { ancestral } = require('../src/genome');

const STEPS = 1400, STRENGTH = 0.35, GENES = [0, 1];
const ALL = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808];
const SEEDS = (process.argv[2] || ALL.join(',')).split(',').map(Number);
const ROWS = (process.argv[3] || '1,2').split(',').map(Number);
const JADH = +(process.argv[4] || 1), JST = +(process.argv[5] || 0.1);
const RN = D0 * 1.35;

function analyse(w) {
  const cs = w.cells, n = cs.length;
  // главная ось пласта и средняя линия
  let mx = 0, my = 0;
  for (const c of cs) { mx += c.x / n; my += c.y / n; }
  let sxx = 0, syy = 0, sxy = 0;
  for (const c of cs) { const dx = c.x - mx, dy = c.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  sxx /= n; syy /= n; sxy /= n;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
  let ux = sxy, uy = l1 - sxx;
  const nl = Math.hypot(ux, uy) || 1; ux /= nl; uy /= nl;
  const vx = -uy, vy = ux;                    // нормаль к пласту

  // глобальный модуль среднего q -- заведомо неверная для пласта мера
  let gx = 0, gy = 0;
  for (const c of cs) { gx += c.qx; gy += c.qy; }
  const qGlobal = Math.hypot(gx, gy) / n;

  // сторона агента относительно средней линии и согласие со стороной
  let sideAgree = 0, cnt = 0;
  for (const c of cs) {
    const dv = (c.x - mx) * vx + (c.y - my) * vy;
    if (Math.abs(dv) < 1e-9) continue;
    const s = dv > 0 ? 1 : -1;               // внешняя нормаль для этого агента
    sideAgree += s * (c.qx * vx + c.qy * vy);
    cnt++;
  }
  sideAgree = cnt ? sideAgree / cnt : NaN;

  // согласие соседей: внутри одной стороны и между сторонами
  let sameSum = 0, sameN = 0, crossSum = 0, crossN = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = cs[i], b = cs[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy >= RN * RN) continue;
      const dot = a.qx * b.qx + a.qy * b.qy;
      const sa = ((a.x - mx) * vx + (a.y - my) * vy) > 0;
      const sb = ((b.x - mx) * vx + (b.y - my) * vy) > 0;
      if (sa === sb) { sameSum += dot; sameN++; } else { crossSum += dot; crossN++; }
    }
  }
  return {
    qGlobal, sideAgree,
    same: sameN ? sameSum / sameN : NaN, sameN,
    cross: crossN ? crossSum / crossN : NaN, crossN,
  };
}

const f = (x, k = 3) => (Number.isFinite(x) ? x.toFixed(k) : '—');
for (const rows of ROWS) {
  const per = 60, n0 = per * rows;
  const acc = [];
  for (const seed of SEEDS) {
    const g = ancestral();
    for (const gi of GENES) g.eff[gi].pol = 1;
    const w = createWorld({
      seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
      params: { polarity: STRENGTH, maxCells: n0, junctionAdhesion: JADH, junction: JST },
    });
    for (let i = 0; i < STEPS; i++) step(w);
    acc.push(analyse(w));
  }
  const m = (k) => acc.reduce((s, r) => s + r[k], 0) / acc.length;
  console.log(`\n=== слой толщиной ${rows}, ${SEEDS.length} сидов ===`);
  console.log(`  |q| среднее по всем (МЕРА НЕВЕРНА для пласта): ${f(m('qGlobal'))}`);
  console.log(`  согласие СО СТОРОНОЙ (проекция на внешнюю нормаль): ${f(m('sideAgree'))}`);
  console.log(`  согласие соседей ВНУТРИ стороны: ${f(m('same'))}  (пар ${Math.round(m('sameN'))})`);
  console.log(`  согласие соседей МЕЖДУ сторонами: ${f(m('cross'))}  (пар ${Math.round(m('crossN'))})`);
}

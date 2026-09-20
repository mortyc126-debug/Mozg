#!/usr/bin/env node
'use strict';
/* КУДА УХОДИТ ПОЛЕВОЕ ДЕЙСТВИЕ У ДВУРЯДНОГО ПЛАСТА

   Установлено: на однорядном слое чтение поля управляет стороной прогиба
   (88 из 90, парный разворот 88 из 90, дуга при этом чище: 4.40 против
   2.23). На двурядном при том же отборе и той же силе -- 48 из 90,
   парный разворот 44 из 90, дуга разваливается в облако (0.91).

   Догадка о взаимном гашении опровергнута: в рамке поля чистый поперечный
   момент у двурядного БОЛЬШЕ (1.091 против 0.877), и поле доходит до
   ориентации лучше (cos 0.80 против 0.63). Знак поляризации на шаге 25
   предсказывает конечную сторону на однорядном (86 из 90) и не
   предсказывает на двурядном (44 из 90). Значит отказ лежит МЕЖДУ
   ориентацией и формой.

   Проверяемое объяснение. Ориентация действует через равновесное
   расстояние: сосед со стороны +q получает уменьшенное, со стороны -q --
   увеличенное. У двурядного пласта есть пары МЕЖДУ рядами, и для такой
   пары это требование противоречиво: верхний видит нижнего со стороны -q
   и отталкивается сильнее, нижний видит верхнего со стороны +q и
   отталкивается слабее. Момента изгиба из этого не выходит, а вот
   расстояние между рядами измениться обязано. У однорядного таких пар
   нет вовсе.

   Второй сток момента -- перенос: одинаковая у всех ориентация может
   просто сдвигать пласт поперёк себя, ничего не изгибая.

   ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
     * если у двурядного расстояние в парах МЕЖДУ рядами меняется при
       включении чтения согласованно (в одну сторону не менее чем на 5/6
       сидов), а знак прогиба остаётся случайным, -- полевое действие
       уходит в толщину, и отказ объяснён;
     * если меняется и поперечный СДВИГ пласта -- часть уходит в перенос,
       сообщается отдельно;
     * если ни расстояние между рядами, ни сдвиг не меняются
       согласованно, объяснение неверно и разрыв надо искать в другом;
     * однорядный слой служит сравнением: у него межрядных пар нет, и
       если объяснение верно, у него согласованно меняться должно
       ВНУТРИрядное расстояние либо ничего.

   Запуск: node experiment/sheet_thick.js [сиды] [толщины]
*/
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const GHALF = +(process.env.GHALF || 95);
const STEPS = 1400, STRENGTH = 0.35, GENES = [0, 1], KG = 0.5;
const SEEDS = (process.argv[2] || '').split(',').filter(Boolean).map(Number);
const ROWS = (process.argv[3] || '2,1').split(',').map(Number);
const D0 = 7.2, RN = D0 * 1.35;
const CROSS = 0.7, INROW = 0.3;

function axes(cells) {
  const n = cells.length; let mx = 0, my = 0;
  for (const c of cells) { mx += c.x / n; my += c.y / n; }
  let sxx = 0, syy = 0, sxy = 0;
  for (const c of cells) { const dx = c.x - mx, dy = c.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  sxx /= n; syy /= n; sxy /= n;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
  let ux = sxy, uy = l1 - sxx; const nl = Math.hypot(ux, uy) || 1; ux /= nl; uy /= nl;
  return { mx, my, ux, uy, vx: -uy, vy: ux };
}

function run(seed, rows, kg) {
  const per = 60, n0 = per * rows;
  const g = ancestral();
  for (const gi of GENES) g.eff[gi].pol = 1;
  const w = createWorld({
    seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
    params: { polarity: STRENGTH, maxCells: n0, gradient: 1.0,
              junctionAdhesion: 1, junction: 0.1, gradAlign: kg, gradHalf: GHALF },
  });
  const cy0 = w.cells.reduce((s, c) => s + c.y, 0) / w.cells.length;
  const cx0 = w.cells.reduce((s, c) => s + c.x, 0) / w.cells.length;
  for (let i = 0; i < STEPS; i++) step(w);
  const gx = Math.cos(w.theta), gy = Math.sin(w.theta);
  const A = axes(w.cells);
  if (A.vx * gx + A.vy * gy < 0) { A.vx = -A.vx; A.vy = -A.vy; }   // поперечная ось -- по полю
  let cross = 0, nc = 0, inrow = 0, ni = 0;
  for (const c of w.cells) {
    for (const o of w.cells) {
      if (o === c) continue;
      const dx = o.x - c.x, dy = o.y - c.y, d2 = dx * dx + dy * dy;
      if (d2 > RN * RN || d2 < 1e-9) continue;
      const d = Math.sqrt(d2), t = Math.abs((dx * A.vx + dy * A.vy) / d);
      if (t > CROSS) { cross += d; nc++; } else if (t < INROW) { inrow += d; ni++; }
    }
  }
  // поперечный сдвиг пласта относительно старта
  const shift = (A.mx - cx0) * A.vx + (A.my - cy0) * A.vy;
  // толщина: разброс поперечной координаты
  let s2 = 0;
  for (const c of w.cells) { const t = (c.x - A.mx) * A.vx + (c.y - A.my) * A.vy; s2 += t * t; }
  return {
    cross: nc ? cross / nc : NaN, nc: nc / w.cells.length,
    inrow: ni ? inrow / ni : NaN, ni: ni / w.cells.length,
    shift, thick: Math.sqrt(s2 / w.cells.length),
  };
}

function med(a) { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; }

for (const rows of ROWS) {
  let upCross = 0, nCross = 0, upIn = 0, nIn = 0, upShift = 0, upThick = 0, n = 0;
  const dc = [], di = [], ds = [], dt = [];
  let c0 = 0, c1 = 0, i0 = 0, i1 = 0, t0 = 0, t1 = 0, kc = 0, ki = 0;
  for (const seed of SEEDS) {
    const A = run(seed, rows, 0), B = run(seed, rows, KG);
    n++;
    if (!Number.isNaN(A.cross) && !Number.isNaN(B.cross)) {
      nCross++; if (B.cross > A.cross) upCross++;
      dc.push(B.cross - A.cross); c0 += A.cross; c1 += B.cross; kc++;
    }
    if (!Number.isNaN(A.inrow) && !Number.isNaN(B.inrow)) {
      nIn++; if (B.inrow > A.inrow) upIn++;
      di.push(B.inrow - A.inrow); i0 += A.inrow; i1 += B.inrow; ki++;
    }
    if (Math.abs(B.shift) > Math.abs(A.shift)) upShift++;
    ds.push(Math.abs(B.shift) - Math.abs(A.shift));
    if (B.thick > A.thick) upThick++;
    dt.push(B.thick - A.thick); t0 += A.thick; t1 += B.thick;
  }
  const thr = (k) => Math.ceil(k * 5 / 6);
  console.log(`\n=== слой ${rows}, ${n} сидов, чтение 0 против ${KG} ===`);
  console.log(`  пар МЕЖДУ рядами на агента: ${(run(SEEDS[0], rows, 0).nc).toFixed(2)}`);
  console.log(`  расстояние МЕЖДУ рядами: ${(c0 / kc).toFixed(3)} -> ${(c1 / kc).toFixed(3)};  выросло на ${upCross} из ${nCross} (порог ${thr(nCross)}), медиана сдвига ${med(dc).toFixed(4)}`);
  console.log(`  расстояние ВНУТРИ ряда : ${(i0 / ki).toFixed(3)} -> ${(i1 / ki).toFixed(3)};  выросло на ${upIn} из ${nIn} (порог ${thr(nIn)}), медиана сдвига ${med(di).toFixed(4)}`);
  console.log(`  толщина пласта         : ${(t0 / n).toFixed(3)} -> ${(t1 / n).toFixed(3)};  выросла на ${upThick} из ${n} (порог ${thr(n)}), медиана ${med(dt).toFixed(4)}`);
  console.log(`  поперечный сдвиг пласта: вырос по модулю на ${upShift} из ${n} (порог ${thr(n)}), медиана ${med(ds).toFixed(4)}`);
}

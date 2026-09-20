#!/usr/bin/env node
'use strict';
/* ПРЕДШЕСТВУЕТ ЛИ ОРИЕНТАЦИЯ ИЗГИБУ, ИЛИ СЛЕДУЕТ ЗА НИМ?

   Этап 13 читает результат так: средняя ориентация q задаёт опору, по
   которой пласт решает, в какую сторону изгибаться. Альтернатива
   ровно обратная: изогнутый пласт сам создаёт асимметрию плотности,
   q тянется к ней, и согласованность знака получается тривиально --
   мы предсказываем изгиб величиной, которую сам изгиб и породил.

   Первая проверка (grad_ref.js, EARLY=100) дала 11 из 12: ранний q
   предсказывает поздний изгиб. Но там же видно, что на шаге 100 изгиб
   УЖЕ согласован с q на 9 сидах из 12. Значит шаг 100 -- не "до
   изгиба", и различения не получилось.

   Здесь измеряется ВЕЛИЧИНА прогиба, а не только знак, на серии
   контрольных точек. Опора считается предшествующей, только если
   найдётся точка, где выполнено ОБА условия сразу:

     (1) прогиб ещё пренебрежимо мал -- |a| не больше 10% от конечного;
     (2) снятый в этой точке q предсказывает знак КОНЕЧНОГО прогиба
         заметно чаще случайного.

   Если такой точки нет -- то есть q начинает предсказывать только
   после того, как прогиб набрал величину, -- результат этапа 13
   циркулярен и подлежит отзыву, а не оговорке.

   Правило чтения объявлено до запуска.

   Запуск: node experiment/bend_precede.js [сиды] [толщины]
*/
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const STEPS = 1400, STRENGTH = 0.35, GENES = [0, 1];
const ALL = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808];
const SEEDS = (process.argv[2] || ALL.join(',')).split(',').map(Number);
const ROWS = (process.argv[3] || '1,2').split(',').map(Number);
const CHECK = [10, 25, 50, 100, 200, 400, 700, 1400];

/* коэффициент параболы относительно опоры refx,refy: знак -- сторона
   прогиба, модуль -- его величина. Модуль от выбора опоры не зависит. */
function bendCoef(cells, refx, refy) {
  const n = cells.length;
  let mx = 0, my = 0;
  for (const c of cells) { mx += c.x / n; my += c.y / n; }
  let sxx = 0, syy = 0, sxy = 0;
  for (const c of cells) { const dx = c.x - mx, dy = c.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  sxx /= n; syy /= n; sxy /= n;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
  let ux = sxy, uy = l1 - sxx;
  const nl = Math.hypot(ux, uy) || 1; ux /= nl; uy /= nl;
  let vx = -uy, vy = ux;
  if (refx * vx + refy * vy < 0) { vx = -vx; vy = -vy; }
  const P = cells.map((c) => {
    const dx = c.x - mx, dy = c.y - my;
    return [dx * ux + dy * uy, dx * vx + dy * vy];
  });
  let S0 = n, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0;
  for (const [u, v] of P) {
    const u2 = u * u;
    S1 += u; S2 += u2; S3 += u2 * u; S4 += u2 * u2;
    T0 += v; T1 += u * v; T2 += u2 * v;
  }
  const M = [[S4, S3, S2], [S3, S2, S1], [S2, S1, S0]], Y = [T2, T1, T0];
  for (let i = 0; i < 3; i++) {
    let pi = i;
    for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[pi][i])) pi = r;
    if (Math.abs(M[pi][i]) < 1e-12) return 0;
    [M[i], M[pi]] = [M[pi], M[i]]; [Y[i], Y[pi]] = [Y[pi], Y[i]];
    for (let r = 0; r < 3; r++) {
      if (r === i) continue;
      const f2 = M[r][i] / M[i][i];
      for (let k = i; k < 3; k++) M[r][k] -= f2 * M[i][k];
      Y[r] -= f2 * Y[i];
    }
  }
  return Y[0] / M[0][0] || 0;
}

function meanQ(cells) {
  let ax = 0, ay = 0;
  for (const c of cells) { ax += c.qx; ay += c.qy; }
  const al = Math.hypot(ax, ay) || 1;
  return [ax / al, ay / al];
}

for (const rows of ROWS) {
  const per = 60, n0 = per * rows;
  const snap = SEEDS.map(() => ({}));          // на сид: чекпойнт -> {q, |a|}
  const finalSign = [], finalAbs = [];
  SEEDS.forEach((seed, si) => {
    const g = ancestral();
    for (const gi of GENES) g.eff[gi].pol = 1;
    const w = createWorld({
      seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
      params: { polarity: STRENGTH, maxCells: n0, gradient: 1.0,
                junctionAdhesion: 1, junction: 0.1 },
    });
    for (let i = 0; i < STEPS; i++) {
      step(w);
      const t = i + 1;
      if (CHECK.includes(t)) {
        const [qx, qy] = meanQ(w.cells);
        snap[si][t] = { qx, qy, abs: Math.abs(bendCoef(w.cells, qx, qy)) };
      }
    }
    const [fqx, fqy] = meanQ(w.cells);
    finalAbs.push(Math.abs(bendCoef(w.cells, fqx, fqy)));
    // знак конечного прогиба, снятый по q КАЖДОЙ контрольной точки
    for (const t of CHECK) {
      const s = snap[si][t];
      s.predict = bendCoef(w.cells, s.qx, s.qy) > 0 ? 1 : 0;
      s.qdrift = s.qx * fqx + s.qy * fqy;
    }
    finalSign.push(1);
  });
  const mFinal = finalAbs.reduce((a, b) => a + b, 0) / SEEDS.length;
  console.log(`\n=== слой ${rows}, ${SEEDS.length} сидов, конечный |a| = ${mFinal.toExponential(3)} ===`);
  console.log('  шаг    |a| в точке   доля от конечного   предсказан конечный знак   cos(q, конечный q)');
  for (const t of CHECK) {
    const abs = SEEDS.map((_, si) => snap[si][t].abs);
    const m = abs.reduce((a, b) => a + b, 0) / abs.length;
    const hit = SEEDS.reduce((a, _, si) => a + snap[si][t].predict, 0);
    const drift = SEEDS.reduce((a, _, si) => a + snap[si][t].qdrift, 0) / SEEDS.length;
    console.log(`  ${String(t).padStart(4)}   ${m.toExponential(3)}      ${(m / mFinal * 100).toFixed(1).padStart(6)}%             ${String(hit).padStart(2)} из ${SEEDS.length}                 ${drift.toFixed(3).padStart(6)}`);
  }
}

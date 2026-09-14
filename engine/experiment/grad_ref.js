#!/usr/bin/env node
'use strict';
/* НЕ ЦИРКУЛЯРЕН ЛИ РЕЗУЛЬТАТ ЭТАПА 13?

   Ориентация q тянется к локальной асимметрии ПЛОТНОСТИ. Но изогнутый
   пласт сам создаёт асимметрию плотности. Значит q может быть
   СЛЕДСТВИЕМ изгиба, а не опорой для него, и согласованность знака
   получалась бы тривиально: мы предсказываем изгиб величиной, которую
   сам изгиб и породил.

   Различение прямое: взять q РАНО, до развития изгиба, и предсказать им
   изгиб в конце. Если ранний q предсказывает -- опора настоящая и
   предшествует следствию. Если предсказывает только поздний q --
   результат этапа 13 циркулярен и подлежит отзыву.

   Дополнительно проверяется прежний кандидат -- градиент среды.

   ЧТО ЗАДАЁТ ОПОРУ НА ОДНОСЛОЙНОМ ПЛАСТЕ?

   Изгиб согласован на 10 сидах из 12 относительно средней ориентации q,
   но у однослойного пласта соседи анти-согласованы (-0.150) и деления
   на стороны нет. Источник опоры неизвестен.

   Кандидат: неподвижный градиент среды, направление (cos w.theta,
   sin w.theta), случайное на сид.

   Проверяется НЕ корреляция, а ПРИЧИННОСТЬ: градиент выключается
   (gradient = 0, среда однородна). Если согласованность направления
   исчезает -- опору задавал он. Если сохраняется -- источник другой.

   Дополнительно измеряется угол между средним q и градиентом и
   согласованность знака изгиба ОТНОСИТЕЛЬНО ГРАДИЕНТА: если градиент
   есть настоящая опора, относительно него знак должен быть согласован
   не хуже, чем относительно q.

   Запуск: node experiment/grad_ref.js [сиды] [толщины] [амплитуда градиента]
*/
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const STEPS = 1400, STRENGTH = 0.35, GENES = [0, 1];
const ALL = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808];
const SEEDS = (process.argv[2] || ALL.join(',')).split(',').map(Number);
const ROWS = (process.argv[3] || '1,2').split(',').map(Number);
const GRAD = process.argv[4] === undefined ? 1.0 : +process.argv[4];
const EARLY = +(process.argv[5] || 100);   // шаг, на котором снимается ранний q

/* знак прогиба относительно ЗАДАННОЙ опоры refx,refy */
function bendSign(cells, refx, refy) {
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
  return Math.sign(Y[0] / M[0][0] || 0);
}

for (const rows of ROWS) {
  const per = 60, n0 = per * rows;
  let qDotG = 0, byQ = 0, byG = 0, byEarly = 0, bendEarly = 0, nOk = 0;
  for (const seed of SEEDS) {
    const g = ancestral();
    for (const gi of GENES) g.eff[gi].pol = 1;
    const w = createWorld({
      seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
      params: { polarity: STRENGTH, maxCells: n0, gradient: GRAD,
                junctionAdhesion: 1, junction: 0.1 },
    });
    let eqx = 0, eqy = 0, eSign = 0;
    for (let i = 0; i < STEPS; i++) {
      step(w);
      if (i === EARLY - 1) {                    // снимок РАННЕГО q и раннего изгиба
        let ax = 0, ay = 0;
        for (const c of w.cells) { ax += c.qx; ay += c.qy; }
        const al = Math.hypot(ax, ay) || 1;
        eqx = ax / al; eqy = ay / al;
        eSign = bendSign(w.cells, eqx, eqy);
      }
    }
    const gx = Math.cos(w.theta), gy = Math.sin(w.theta);
    let qx = 0, qy = 0;
    for (const c of w.cells) { qx += c.qx; qy += c.qy; }
    const ql = Math.hypot(qx, qy) || 1;
    qDotG += (qx / ql) * gx + (qy / ql) * gy;
    if (bendSign(w.cells, qx / ql, qy / ql) > 0) byQ++;
    if (bendSign(w.cells, gx, gy) > 0) byG++;
    if (bendSign(w.cells, eqx, eqy) > 0) byEarly++;   // поздний изгиб по РАННЕМУ q
    if (eSign > 0) bendEarly++;                        // изгиб уже на раннем шаге
    nOk++;
  }
  console.log(`\n=== слой ${rows}, амплитуда градиента ${GRAD}, ${nOk} сидов ===`);
  console.log(`  среднее q ПО градиенту (косинус угла): ${(qDotG / nOk).toFixed(3)}`);
  console.log(`  знак изгиба согласован относительно q       : ${byQ} из ${nOk}`);
  console.log(`  знак изгиба согласован относительно ГРАДИЕНТА: ${byG} из ${nOk}`);
  console.log(`  ПО РАННЕМУ q (шаг ${EARLY}) предсказан поздний изгиб: ${byEarly} из ${nOk}`);
  console.log(`    (для сравнения: изгиб на самом раннем шаге ${bendEarly} из ${nOk})`);
}

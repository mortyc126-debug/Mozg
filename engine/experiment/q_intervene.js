#!/usr/bin/env node
'use strict';
/* ОПОРА ИЛИ СОПУТСТВУЮЩЕЕ СЛЕДСТВИЕ: УДЕРЖИВАЕМОЕ ВМЕШАТЕЛЬСТВО В q

   Установлено (bend_precede.js): на шаге 50 прогиб составляет 4.2% от
   конечного, а снятый в этой точке q предсказывает знак конечного
   прогиба на 12 сидах из 12. Ориентация не следствие изгиба: она ему
   предшествует. Но предшествование -- ещё не причинность: ранняя
   асимметрия могла задать И ориентацию, И сторону прогиба порознь.

   ПЕРВАЯ ПОПЫТКА ЭТОГО ТЕСТА БЫЛА ПУСТОЙ, и это следует прочесть
   прежде результата. Разворот q делался ПОСЛЕ возврата из step(),
   а внутри шага порядок такой: updateOrientation -> физика. При
   align = 0 (значение по умолчанию, и именно оно стояло во всех
   прогонах этой линии) updateOrientation не обновляет ориентацию,
   а ПЕРЕЗАПИСЫВАЕТ её локальной асимметрией: c.qx = c.ax. Проверено
   прямо: max |q - a| = 0. Поэтому подменённое значение стиралось до
   того, как его кто-либо прочитает, и все три ветки выходили побитово
   одинаковыми. Нулевой результат означал неработающий инструмент, а
   не отсутствие эффекта; распознан он по тому, что совпадение было
   ТОЧНЫМ, а не примерным.

   Отсюда же следует поправка к словарю: при align = 0 никакой
   "собственной ориентации" у агента нет. q -- это мгновенная функция
   расположения соседей, пересчитываемая с нуля каждый шаг, без
   памяти. Разделить "ориентацию" и "локальную асимметрию" в этой
   конфигурации невозможно: это один и тот же объект.

   Здесь вмешательство УДЕРЖИВАЕМОЕ: в движок добавлена точка w.onOrient,
   вызываемая после обновления ориентации и до физики (при незаданном
   значении не делает ничего; побитовое тождество с нетронутым движком
   подтверждено на 6 сверках). Подмена применяется КАЖДЫЙ шаг начиная
   с заданного.

   Ветки, развитие до вмешательства побитово одно:
     A -- без вмешательства;
     B -- разворот q на 180 градусов с шага 50 и до конца;
     C -- то же с шага 1350 (контроль специфичности: подействовать
          уже не успевает);
     D -- поворот q на 90 градусов с шага 50 (отличает "q задаёт
          сторону" от "q задаёт только ось").

   Знак прогиба читается в НЕПОДВИЖНОЙ рамке -- по направлению
   градиента среды (cos theta, sin theta). Оно одно во всех ветках и
   от q не зависит, поэтому мера не может подхватить вмешательство
   напрямую.

   ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
     * если B снова совпадает с A побитово -- инструмент опять не
       работает, результат не читается вовсе;
     * если знак прогиба переворачивается в B не менее чем на 10 сидах
       из 12 (не менее 5/6 доли при другом числе сидов), ПРИ ТОМ ЧТО в
       C он переворачивается не более чем на 1/6, -- сторона прогиба
       задаётся знаком локальной асимметрии;
     * иначе сторона им НЕ задаётся.

   ВТОРАЯ РЕДАКЦИЯ ПРАВИЛА; первая была неверна, и это записано отдельно.
   Отрицательная ветка была сформулирована как "знак не перевернётся,
   не более 2 из 12". Так выглядит вмешательство, которое ни на что не
   влияет. Верное предсказание для "сторона не управляется q, а
   возмущение сильное" -- знак СЛУЧАЕН, около половины. Полученные в
   первой редакции 5 из 12 -- ровно этот случай -- попали в тогдашнюю
   "неопределённую" полосу и формально не читались.

   Мерилом случайности служит не биномиальная монета, а ветка D:
   возмущение сопоставимой силы, которое знак q НЕ переворачивает. Если
   бы знак q управлял стороной, B переворачивал бы её почти всегда, а D
   -- нет. Объявлено: превышение доли переворотов B над D менее чем на
   0.4 читается как отсутствие управления знаком.

   Отдельно сообщается |a| в каждой ветке: если вмешательство просто
   разрушило ткань, сравнивать знаки не на чем.

   Запуск: node experiment/q_intervene.js [сиды] [толщины]
*/
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const STEPS = 1400, STRENGTH = 0.35, GENES = [0, 1];
const EARLY = 50, LATE = 1350;
const ALL = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808];
const SEEDS = (process.argv[2] || ALL.join(',')).split(',').map(Number);
const ROWS = (process.argv[3] || '1').split(',').map(Number);

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

/* один прогон. mode: null -- без вмешательства; 'flip' -- разворот на 180;
   'rot' -- поворот на 90. Подмена ставится через w.onOrient, то есть внутри
   шага, после обновления ориентации и до физики, и УДЕРЖИВАЕТСЯ до конца.
   Случайных чисел она не тратит, поэтому до шага from ветки побитово равны. */
function run(seed, rows, mode, from) {
  const per = 60, n0 = per * rows;
  const g = ancestral();
  for (const gi of GENES) g.eff[gi].pol = 1;
  const w = createWorld({
    seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
    params: { polarity: STRENGTH, maxCells: n0, gradient: 1.0,
              junctionAdhesion: 1, junction: 0.1 },
  });
  if (mode) w.onOrient = (ww) => {
    if (ww.t < from) return;
    if (mode === 'flip') for (const c of ww.cells) { c.qx = -c.qx; c.qy = -c.qy; }
    else for (const c of ww.cells) { const t = c.qx; c.qx = -c.qy; c.qy = t; }
  };
  for (let i = 0; i < STEPS; i++) step(w);
  const [qx, qy] = meanQ(w.cells);
  const gx = Math.cos(w.theta), gy = Math.sin(w.theta);
  return { qx, qy, bend: bendCoef(w.cells, gx, gy) };   // знак -- в неподвижной рамке
}

for (const rows of ROWS) {
  let flipB = 0, flipC = 0, flipD = 0, sameB = 0, nOk = 0;
  let mA = 0, mB = 0, mD = 0;
  const lines = [];
  for (const seed of SEEDS) {
    const A = run(seed, rows, null, 0);
    const B = run(seed, rows, 'flip', EARLY);
    const C = run(seed, rows, 'flip', LATE);
    const D = run(seed, rows, 'rot', EARLY);
    if (B.bend === A.bend) sameB++;                       // точное совпадение = инструмент не работает
    const fB = Math.sign(B.bend) !== Math.sign(A.bend);
    const fC = Math.sign(C.bend) !== Math.sign(A.bend);
    const fD = Math.sign(D.bend) !== Math.sign(A.bend);
    if (fB) flipB++;
    if (fC) flipC++;
    if (fD) flipD++;
    mA += Math.abs(A.bend); mB += Math.abs(B.bend); mD += Math.abs(D.bend);
    nOk++;
    lines.push(`  сид ${String(seed).padStart(4)}   A ${A.bend.toExponential(2).padStart(9)}   B ${B.bend.toExponential(2).padStart(9)} ${fB ? 'перевернулся' : '   тот же   '}   C ${C.bend.toExponential(2).padStart(9)} ${fC ? 'перевернулся' : '   тот же   '}   D ${D.bend.toExponential(2).padStart(9)} ${fD ? 'перевернулся' : '   тот же   '}`);
  }
  console.log(`\n=== слой ${rows}, ${nOk} сидов; разворот с шага ${EARLY} (B), с шага ${LATE} (C), поворот на 90 с шага ${EARLY} (D) ===`);
  for (const l of lines) console.log(l);
  console.log(`  сидов, где B совпал с A ТОЧНО (признак неработающего вмешательства): ${sameB} из ${nOk}`);
  console.log(`  средний |прогиб|: A ${(mA / nOk).toExponential(3)}   B ${(mB / nOk).toExponential(3)}   D ${(mD / nOk).toExponential(3)}`);
  console.log(`  знак прогиба перевернулся: B (рано) ${flipB} из ${nOk};  C (поздно, контроль) ${flipC} из ${nOk};  D (на 90) ${flipD} из ${nOk}`);
}

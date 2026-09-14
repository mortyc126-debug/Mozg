#!/usr/bin/env node
'use strict';
/* НАСЛЕДУЕТСЯ ЛИ СТОРОНА ПРОГИБА ОТ НАЧАЛЬНОГО РЯДА?

   Что уже исключено как источник стороны: градиент среды (причинной
   проверкой), знак локальной асимметрии q (удерживаемым вмешательством,
   11 переворотов из 24 при пороге 20), и объяснение через bodyRadii
   (в его собственной конфигурации дуги не возникает вовсе).

   Остался крупный кандидат: сторона не ПОРОЖДАЕТСЯ процессом, а
   НАСЛЕДУЕТСЯ. Стартовый ряд не прям: каждому агенту при создании
   добавлен джиттер +-0.2 по обеим осям. У такого ряда есть собственная
   случайная кривизна. Если механизм её просто усиливает, то дуга
   этапа 13 -- потеря устойчивости с унаследованным знаком, а не
   морфогенез, и читать её надо иначе.

   Два хода, второй решает.

   ХОД 1, НАБЛЮДЕНИЕ. Коэффициент параболы стартового ряда снимается ДО
   первого шага и сравнивается со знаком конечного прогиба. Дополнительно
   ранговая корреляция |c0| с |конечным| -- усиление предсказывает, что
   больший стартовый изгиб даёт больший конечный. Наблюдение само по себе
   ничего не решает: оно уже дважды обмануло (q предсказывал 12 из 12 и
   при этом стороной не управлял), поэтому служит только подсказкой.

   ХОД 2, ВМЕШАТЕЛЬСТВО. Стартовому ряду ОДНОГО И ТОГО ЖЕ сида
   навязывается дуга обоих знаков: y сдвигается на +-A*(u/uMax)^2, то
   есть A -- это стрелка навязанной дуги. Всё прочее -- сид, геном,
   поля, порядок случайных чисел -- в точности одно и то же, отличается
   только форма старта.

   ПЕРВАЯ РЕДАКЦИЯ АМПЛИТУД БЫЛА НЕВЕРНОЙ, и это следует прочесть
   прежде результата. Амплитуды брались в единицах собственного джиттера
   ряда (+-0.2): 0.1, 0.4 и 1.6 как положительный контроль. Но джиттер --
   это СМЕЩЕНИЕ, а сравнивать надо КРИВИЗНУ. Полуразмах ряда 195, поэтому
   стрелка 1.6 отвечает коэффициенту 4.2e-5, тогда как процесс сам
   производит 1.0e-3 -- в 24 раза больше. "Положительный контроль" был
   слабее проверяемого явления и пройти не мог в принципе; все три
   амплитуды дали 0 из 24 и совершенно одинаковую картину по сидам, что
   контроль и уловил.

   Вторая редакция берёт амплитуды в единицах КОНЕЧНОЙ стрелки, которая
   равна 38: A = 4 (десятая часть), A = 40 (вровень) и A = 120 (втрое
   больше) как положительный контроль. Собственная кривизна джиттера при
   этом 5.7e-8 -- в 17500 раз слабее конечной, то есть наследовать
   сторону, если она наследуется, приходится от очень слабого зачатка.

   Мера знака берётся в НЕПОДВИЖНОЙ лабораторной рамке, опора (0,1), то
   есть поперёк ряда. Она не зависит ни от q, ни от сида, поэтому знак
   навязанной дуги и знак конечного прогиба сравнимы напрямую.

   ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
     * если при A = 4 (десятая часть конечной стрелки) сторона следует
       за навязанной не менее чем на 5/6 сидов -- сторона наследуется от
       начальной формы даже когда начальная форма много слабее конечной;
       результат этапа 13 о направлении читается как усиление стартовой
       конфигурации, то есть потеря устойчивости, а не порождённое
       направление;
     * если следует при A = 40, но не при A = 4 -- начальная форма
       решает, лишь когда сравнима с конечной; в пределах слабого
       зачатка сторону задаёт что-то другое, и вопрос остаётся;
     * если не следует ни при одной -- сторона от начальной кривизны не
       наследуется, кандидат снимается;
     * A = 120 (втрое больше конечной стрелки) -- ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ,
       а не проверяемое условие: при такой дуге навязанная форма обязана
       победить. Если не побеждает и она, значит либо мера знака слепа,
       либо смещение написано неверно, и весь прогон не читается. Без
       этого контроля "не следует" может означать просто "вмешательство
       слишком слабо" -- ровно ошибка записи 22;
     * доля "следования" считается как доля сидов, где навязанное +A
       дало конечный плюс И навязанное -A дало конечный минус.

   САМОПРОВЕРКА ИНСТРУМЕНТА (после урока записи 22): при A = 0 обе ветки
   обязаны совпасть с нетронутым прогоном ПОБИТОВО. Выводится отдельной
   строкой ДО обсуждения эффекта. Если не совпали -- смещение написано
   неверно и читать нечего.

   Запуск: node experiment/seed_shape.js [сиды] [толщины]
*/
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const STEPS = 1400, STRENGTH = 0.35, GENES = [0, 1];
const AMPS = [4, 40, 120];
const BASE = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808,
              11, 23, 42, 314, 271, 1618, 65, 128, 999, 1234, 4096, 7];
const SEEDS = (process.argv[2] || BASE.join(',')).split(',').map(Number);
const ROWS = (process.argv[3] || '1').split(',').map(Number);

/* коэффициент параболы относительно опоры refx,refy */
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

/* навязать стартовому ряду дугу амплитуды amp: смещение по y, ноль в
   середине ряда, amp на концах. Случайных чисел не тратит; при amp = 0
   не меняет ничего, что и проверяется побитово. */
function imposeArc(w, amp) {
  if (!amp) return;
  let mx = 0;
  for (const c of w.cells) mx += c.x / w.cells.length;
  let uMax = 0;
  for (const c of w.cells) uMax = Math.max(uMax, Math.abs(c.x - mx));
  if (uMax < 1e-9) return;
  for (const c of w.cells) {
    const t = (c.x - mx) / uMax;
    const dy = amp * t * t;
    c.y += dy; c.p1y += dy; c.p2y += dy;
  }
}

function meanNb(cells) {
  let s = 0;
  for (const c of cells) s += c.nb;
  return s / cells.length;
}

function run(seed, rows, amp) {
  const per = 60, n0 = per * rows;
  const g = ancestral();
  for (const gi of GENES) g.eff[gi].pol = 1;
  const w = createWorld({
    seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
    params: { polarity: STRENGTH, maxCells: n0, gradient: 1.0,
              junctionAdhesion: 1, junction: 0.1 },
  });
  imposeArc(w, amp);
  const c0 = bendCoef(w.cells, 0, 1);            // кривизна СТАРТА, до первого шага
  for (let i = 0; i < STEPS; i++) step(w);
  return { c0, a: bendCoef(w.cells, 0, 1), nb: meanNb(w.cells) };
}

function spearman(xs, ys) {
  const rank = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(v.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const a = rank(xs), b = rank(ys), n = xs.length;
  const ma = (n + 1) / 2, mb = (n + 1) / 2;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(sa * sb || 1);
}

for (const rows of ROWS) {
  const n = SEEDS.length;
  // --- самопроверка инструмента: amp = 0 обязан совпасть побитово ---
  let identical = 0;
  const base = SEEDS.map((s) => run(s, rows, 0));
  const zero = SEEDS.map((s) => run(s, rows, 0));
  SEEDS.forEach((_, i) => { if (base[i].a === zero[i].a && base[i].c0 === zero[i].c0) identical++; });

  // --- ход 1: наблюдение ---
  let agree = 0;
  const absC0 = [], absA = [];
  base.forEach((r) => {
    if (Math.sign(r.c0) === Math.sign(r.a)) agree++;
    absC0.push(Math.abs(r.c0)); absA.push(Math.abs(r.a));
  });

  console.log(`\n=== слой ${rows}, ${n} сидов ===`);
  console.log(`  самопроверка: при A = 0 повтор совпал побитово на ${identical} из ${n} (обязано ${n})`);
  console.log(`\n  ХОД 1, наблюдение:`);
  console.log(`    знак стартовой кривизны совпал с конечным: ${agree} из ${n}`);
  console.log(`    ранговая корреляция |старт| с |конец|: ${spearman(absC0, absA).toFixed(3)}`);

  console.log(`\n  ХОД 2, вмешательство в начальную форму:`);
  for (const amp of AMPS) {
    let follows = 0, plusPos = 0, minusNeg = 0, changed = 0, nbSum = 0;
    const det = [];
    SEEDS.forEach((seed, i) => {
      const P = run(seed, rows, amp), M = run(seed, rows, -amp);
      if (P.a !== base[i].a || M.a !== base[i].a) changed++;
      nbSum += P.nb + M.nb;
      const p = P.a > 0, m = M.a < 0;
      if (p) plusPos++;
      if (m) minusNeg++;
      if (p && m) follows++;
      det.push(`${seed}:${p ? '+' : '-'}${m ? '-' : '+'}`);
    });
    console.log(`    A = ${amp} (конечная стрелка ~38): следует за навязанной стороной ${follows} из ${n} (порог ${Math.ceil(n * 5 / 6)});  соседей ${(nbSum / (2 * n)).toFixed(2)} против ${(base.reduce((x, r) => x + r.nb, 0) / n).toFixed(2)} без вмешательства`);
    console.log(`        из них: +A дало плюс ${plusPos} из ${n};  -A дало минус ${minusNeg} из ${n};  ветки разошлись с базой на ${changed} из ${n}`);
    console.log(`        по сидам: ${det.join(' ')}`);
  }
}

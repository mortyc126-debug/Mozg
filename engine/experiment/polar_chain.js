#!/usr/bin/env node
'use strict';
/* ГДЕ РВЁТСЯ ЦЕПЬ У ДВУРЯДНОГО ПЛАСТА

   Чтение поля даёт частичное смещение стороны на ОДНОРЯДНОМ слое
   (42 из 65 при развороте поля 51 из 66, контроли на случайном уровне)
   и не даёт ничего на ДВУРЯДНОМ (13 из 21, парный разворот 11 из 21).

   Первая догадка -- взаимное гашение: у двурядного верхний и нижний ряды
   смотрят наружу в разные стороны, и полевая добавка складывается в ноль.
   ДОГАДКА НЕВЕРНА, измерено. В рамке, привязанной к полю (а не к оси
   пласта -- первая редакция пробы усредняла знакопеременную величину и
   гасила как раз полевую часть), чистая поперечная поляризация на шаге 25
   такова:

     рядов 1, чтение выключено:  верх +0.547  низ -0.608  сумма -0.061
     рядов 1, чтение включено:   верх +0.599  низ +0.279  сумма +0.877
     рядов 2, чтение выключено:  верх +0.966  низ -0.965  сумма +0.001
     рядов 2, чтение включено:   верх +0.820  низ +0.271  сумма +1.091

   То есть у двурядного чистый поперечный момент даже БОЛЬШЕ. Чтение
   доходит до ориентации (cos(q, поле) 0.80 против 0.63 у однорядного),
   поляризация возникает -- а прогиб за ней не идёт. Значит цепь рвётся
   НИЖЕ ориентации.

   Здесь звено проверяется напрямую: предсказывает ли ЗНАК чистой
   поперечной поляризации на шаге 25 знак конечного прогиба. Шаг 25 взят
   не произвольно -- это измеренное время фиксации стороны.

   ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
     * если знак поляризации предсказывает прогиб на ОБОИХ пластах, звено
       цело, и отказ двурядного надо искать ещё ниже либо в самой мере;
     * если предсказывает на однорядном и НЕ предсказывает на двурядном,
       разрыв локализован: поляризация у двурядного есть, но в изгиб не
       переходит;
     * если не предсказывает нигде, то и на однорядном смещение стороны
       идёт не через поперечную поляризацию, и объяснение эффекта надо
       строить заново;
     * порог согласия -- 5/6 читаемых сидов; величина поляризации
       сообщается рядом, потому что предсказание слабой величиной
       бессмысленно.

   Запуск: node experiment/polar_chain.js [сиды] [толщины]
*/
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const STEPS = 1400, DECIDE = 25, STRENGTH = 0.35, GENES = [0, 1];
const BASE = Array.from({ length: 72 }, (_, i) => i + 1);
const SEEDS = (process.argv[2] || BASE.join(',')).split(',').map(Number);
const ROWS = (process.argv[3] || '1,2').split(',').map(Number);

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

/* коэффициент параболы в рамке, поперечная ось которой задана снаружи */
function coefIn(cells, A) {
  const n = cells.length;
  let S0 = n, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0;
  for (const c of cells) {
    const dx = c.x - A.mx, dy = c.y - A.my;
    const u = dx * A.ux + dy * A.uy, v = dx * A.vx + dy * A.vy, u2 = u * u;
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

function run(seed, rows, kg) {
  const per = 60, n0 = per * rows;
  const g = ancestral();
  for (const gi of GENES) g.eff[gi].pol = 1;
  const w = createWorld({
    seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
    params: { polarity: STRENGTH, maxCells: n0, gradient: 1.0,
              junctionAdhesion: 1, junction: 0.1, gradAlign: kg },
  });
  let pol = 0, Afix = null;
  for (let i = 0; i < STEPS; i++) {
    step(w);
    if (i + 1 === DECIDE) {
      Afix = axes(w.cells);                       // рамка фиксируется в момент решения
      let s = 0;
      for (const c of w.cells) s += c.qx * Afix.vx + c.qy * Afix.vy;
      pol = s / w.cells.length;                   // чистая поперечная поляризация
    }
  }
  // конечный прогиб мерится в ТОЙ ЖЕ рамке, что и поляризация: знаки сравнимы
  const A2 = axes(w.cells);
  if (A2.ux * Afix.ux + A2.uy * Afix.uy < 0) { A2.ux = -A2.ux; A2.uy = -A2.uy; }
  if (A2.vx * Afix.vx + A2.vy * Afix.vy < 0) { A2.vx = -A2.vx; A2.vy = -A2.vy; }
  return { pol, a: coefIn(w.cells, A2) };
}

for (const rows of ROWS) {
  console.log(`\n=== слой ${rows}, ${SEEDS.length} сидов ===`);
  console.log('  чтение   знак поляризации предсказал прогиб   доля   средняя |поляризация|');
  for (const kg of [0, 1]) {
    let ok = 0, n = 0, mag = 0;
    for (const seed of SEEDS) {
      const r = run(seed, rows, kg);
      if (r.pol === 0 || r.a === 0) continue;
      n++; mag += Math.abs(r.pol);
      if (Math.sign(r.pol) === Math.sign(r.a)) ok++;
    }
    const maj = Math.max(ok, n - ok);
    console.log(`  ${String(kg).padStart(6)}   ${String(ok).padStart(2)} из ${String(n).padStart(2)} (большинство ${maj}, порог ${Math.ceil(n * 5 / 6)})      ${(ok / n).toFixed(2)}   ${(mag / n).toFixed(3)}`);
  }
}

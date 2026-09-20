#!/usr/bin/env node
'use strict';
/* КОГДА СТОРОНА ПРОГИБА СТАНОВИТСЯ НЕОБРАТИМОЙ?

   Четыре кандидата на источник стороны уже исключены: градиент среды
   (причинной проверкой), знак локальной асимметрии q (удерживаемым
   вмешательством, 11 переворотов из 24 при пороге 20), объяснение через
   bodyRadii (в его собственной конфигурации дуги не возникает) и
   кривизна стартового ряда (вмешательством с пройденным положительным
   контролем: при зачатке в 0.1 конечной стрелки -- 0 из 24).

   Сторона при этом ВОСПРОИЗВОДИМА: один и тот же сид даёт один и тот же
   знак при всех перечисленных вмешательствах. Остаётся возможность, что
   её выбирает не структура, а шум самого прогона: подвижность агентов
   берёт случайное число каждый шаг, и при фиксированном сиде этот шум
   детерминирован. Тогда воспроизводимость стороны есть воспроизводимость
   генератора, и никакой информации о форме знак не несёт.

   Проба: на шаге T из потока изымается ОДНО лишнее случайное число.
   Состояние мира при этом не меняется ни на йоту -- меняется лишь то,
   какие числа достанутся агентам дальше. История до T побитово та же,
   после T -- другая реализация того же шума. Это и есть вопрос "решено
   ли уже к шагу T".

   ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
     * временем фиксации T* считается самый ранний шаг, начиная с
       которого доля перевёрнутых знаков падает ниже 1/6;
     * если доля держится около половины даже при T = 700, то есть к
       середине прогона сторона ещё не решена, -- её выбирает поздний
       шум, и результат этапа 13 о направлении не несёт сведений о
       форме: знак воспроизводим лишь потому, что воспроизводим
       генератор. Согласованность "10 из 12 относительно q" тогда
       означает, что q к концу подстраивается под уже случившийся изгиб,
       и читать её как морфогенез нельзя;
     * если T* ранний (не позже 100), сторона решается рано, и тогда
       осмысленно искать, ЧЕМ она решается, в первых десятках шагов;
     * промежуточное T* сообщается как есть.

   САМОПРОВЕРКА ИНСТРУМЕНТА (уроки записей 22 и 25), обязательна к
   выводу ДО обсуждения:
     * ветка с T больше числа шагов не срабатывает ни разу и обязана
       совпасть с базой ПОБИТОВО -- иначе проба меняет что-то помимо
       потока;
     * ветка с очень поздним T (1390) обязана давать долю переворотов
       около нуля -- за десять шагов знак измениться не может. Это
       верхний конец шкалы: если и он переворачивает, мера знака шумит.

   Запуск: node experiment/commit_time.js [сиды] [толщины]
*/
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const STEPS = 1400, STRENGTH = 0.35, GENES = [0, 1];
const CHECK = [5, 10, 25, 50, 100, 200, 400, 700, 1390];
const NEVER = 2000;                       // не срабатывает: самопроверка
const BASE = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808,
              11, 23, 42, 314, 271, 1618, 65, 128, 999, 1234, 4096, 7];
const SEEDS = (process.argv[2] || BASE.join(',')).split(',').map(Number);
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

/* at = 0: без пробы. Иначе на шаге at изымается одно случайное число. */
function run(seed, rows, at) {
  const per = 60, n0 = per * rows;
  const g = ancestral();
  for (const gi of GENES) g.eff[gi].pol = 1;
  const w = createWorld({
    seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
    params: { polarity: STRENGTH, maxCells: n0, gradient: 1.0,
              junctionAdhesion: 1, junction: 0.1 },
  });
  if (at) w.onOrient = (ww) => { if (ww.t === at) ww.rnd(); };
  for (let i = 0; i < STEPS; i++) step(w);
  return bendCoef(w.cells, 0, 1);
}

for (const rows of ROWS) {
  const n = SEEDS.length;
  const base = SEEDS.map((s) => run(s, rows, 0));
  const never = SEEDS.map((s) => run(s, rows, NEVER));
  let ident = 0;
  base.forEach((b, i) => { if (b === never[i]) ident++; });

  console.log(`\n=== слой ${rows}, ${n} сидов ===`);
  console.log(`  самопроверка: несрабатывающая проба (T = ${NEVER}) совпала с базой побитово на ${ident} из ${n} (обязано ${n})`);
  console.log(`\n  шаг пробы   знак перевернулся   доля`);
  const rows2 = [];
  for (const at of CHECK) {
    let flip = 0, same = 0;
    SEEDS.forEach((s, i) => {
      const a = run(s, rows, at);
      if (a === base[i]) same++;
      if (Math.sign(a) !== Math.sign(base[i])) flip++;
    });
    rows2.push([at, flip, same]);
    console.log(`  ${String(at).padStart(9)}   ${String(flip).padStart(6)} из ${n}      ${(flip / n).toFixed(2)}${same ? `   (совпало побитово: ${same})` : ''}`);
  }
  const star = rows2.find(([, f]) => f / n < 1 / 6);
  console.log(`\n  время фиксации T* (первый шаг с долей ниже 1/6): ${star ? star[0] : 'не достигнуто до ' + CHECK[CHECK.length - 1]}`);
}

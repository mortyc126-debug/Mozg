#!/usr/bin/env node
'use strict';
/* ПОДТВЕРЖДЕНИЕ НА СВЕЖИХ СИДАХ: РАБОТАЕТ ЛИ ЧТЕНИЕ ПОЛЯ, КОГДА ПОЛЕ
   НАПРАВЛЕНО ПОПЕРЁК ПЛАСТА

   Развёртка по силе чтения (grad_strength.js, сиды 1..72) показала, что
   доля следования полю на плато и не превышает 0.75 ни при какой силе.
   Но разбиение по доле градиента ПОПЕРЁК пласта -- которое объявлялось
   заранее как диагностика -- обнаружило, что эффект сосредоточен в
   узкой полосе:

     вес 0.25, |perp| 0.7-1.0:  11 из 13 согласованно
     вес 0.5,  |perp| 0.7-1.0:  10 из 10
     вес 1,    |perp| 0.7-1.0:   9 из 10
     тогда как при |perp| 0.1-0.4 -- около половины на всех весах,
     и при выключенном чтении -- около половины во всех полосах.

   ЭТО ГИПОТЕЗА, ПОРОЖДЁННАЯ ДАННЫМИ, А НЕ РЕЗУЛЬТАТ. Полосы узкие
   (по 10-13 сидов), объединение полос и выбор веса сделаны ПОСЛЕ того,
   как числа увидены. Проверять такую гипотезу на тех же сидах нельзя.
   Здесь она проверяется на СВЕЖЕМ наборе, не пересекающемся с прежним.

   ОТБОР СДЕЛАН ДО ПРОГОНА и по величине, от исхода не зависящей. На
   шаге 0 ряд лежит вдоль x, поэтому поперечная доля градиента равна
   |sin theta|, где theta -- первое случайное число мира. Она читается
   из созданного мира без единого шага. Отбирать по КОНЕЧНОЙ форме было
   бы отбором по величине, связанной с исходом, -- так делать нельзя.

   Ветки: чтение выключено (контроль), чтение 0.5 (лучшая сила по
   развёртке), и она же при развёрнутом поле (причинная проверка,
   сравнение парное).

   ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
     * чтение 0.5 даёт согласие не ниже 5/6 И парный разворот не ниже
       5/6 И дуга цела (прогиб/остаток выше единицы), контроль при этом
       около половины -- гипотеза подтверждена, и источник направления
       получен для пластов, лежащих поперёк поля;
     * любое из трёх не выполнено -- не подтверждена, и записывается
       именно это, а совпадение на прежних сидах объясняется отбором.

   Запуск: node experiment/grad_perp.js [сколько сидов] [толщины]
*/
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const GHALF = +(process.env.GHALF || 95);
const KG = +(process.env.KG || 0.5);
const STEPS = 1400, STRENGTH = 0.35, GENES = [0, 1];
const WANT = +(process.argv[2] || 90);
const ROWS = (process.argv[3] || '1').split(',').map(Number);
const PERP_MIN_SELECT = 0.7;
const FROM = 1000, TO = 3000;             // свежий диапазон, с прежними 1..72 не пересекается

function theta(seed) {                    // без единого шага: только начальное состояние
  const w = createWorld({ seed, init: 'layer', layerLength: 4, layerRows: 1,
                          params: { maxCells: 4 } });
  return w.theta;
}

function fit(cells, refx, refy) {
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
  const perp = refx * vx + refy * vy;
  if (perp < 0) { vx = -vx; vy = -vy; }
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
    if (Math.abs(M[pi][i]) < 1e-12) return { a: 0, sag: 0, rms: 0, perp: Math.abs(perp) };
    [M[i], M[pi]] = [M[pi], M[i]]; [Y[i], Y[pi]] = [Y[pi], Y[i]];
    for (let r = 0; r < 3; r++) {
      if (r === i) continue;
      const f2 = M[r][i] / M[i][i];
      for (let k = i; k < 3; k++) M[r][k] -= f2 * M[i][k];
      Y[r] -= f2 * Y[i];
    }
  }
  const a = Y[0] / M[0][0], b = Y[1] / M[1][1], c0 = Y[2] / M[2][2];
  let umin = Infinity, umax = -Infinity, ss = 0;
  for (const [u, v] of P) {
    if (u < umin) umin = u;
    if (u > umax) umax = u;
    const d = v - (a * u * u + b * u + c0); ss += d * d;
  }
  const L = umax - umin;
  return { a, sag: Math.abs(a) * L * L / 4, rms: Math.sqrt(ss / n), perp: Math.abs(perp) };
}

function run(seed, rows, kg, amp) {
  const per = 60, n0 = per * rows;
  const g = ancestral();
  for (const gi of GENES) g.eff[gi].pol = 1;
  const w = createWorld({
    seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
    params: { polarity: STRENGTH, maxCells: n0, gradient: amp,
              junctionAdhesion: 1, junction: 0.1, gradAlign: kg, gradHalf: GHALF },
  });
  for (let i = 0; i < STEPS; i++) step(w);
  const gx = Math.cos(w.theta), gy = Math.sin(w.theta);
  return fit(w.cells, gx, gy);
}

// отбор ДО прогона: |sin theta| -- поперечная доля градиента на шаге 0
const picked = [];
for (let s = FROM; s < TO && picked.length < WANT; s++) {
  if (Math.abs(Math.sin(theta(s))) >= PERP_MIN_SELECT) picked.push(s);
}
console.log(`отобрано ${picked.length} сидов из диапазона ${FROM}..${TO} по условию |sin theta| >= ${PERP_MIN_SELECT}`);
console.log(`(отбор по НАЧАЛЬНОМУ состоянию, до единого шага; от исхода не зависит)`);

for (const rows of ROWS) {
  console.log(`\n=== слой ${rows}, ${picked.length} свежих сидов ===`);
  console.log('  ветка                  большинство   доля    прогиб/остаток');
  const sign = {};
  for (const [name, kg, amp] of [['чтение выключено', 0, 1.0], ['чтение включено ', KG, 1.0], ['поле развёрнуто ', KG, -1.0]]) {
    let plus = 0, n = 0, ratio = 0;
    sign[name] = {};
    for (const seed of picked) {
      const r = run(seed, rows, kg, amp);
      n++; ratio += r.rms > 0 ? r.sag / r.rms : 0;
      sign[name][seed] = Math.sign(r.a);
      if (r.a > 0) plus++;
    }
    const maj = Math.max(plus, n - plus);
    const rr = ratio / n;
    console.log(`  ${name}   ${String(maj).padStart(2)} из ${String(n).padStart(2)}   ${(maj / n).toFixed(2)}   ${rr.toFixed(2)} ${rr > 1 ? '(дуга)' : '(облако)'}   ${plus >= n - plus ? 'ПО опоре' : 'ПРОТИВ опоры'}`);
  }
  const a = sign['чтение включено '], b = sign['поле развёрнуто '];
  let flip = 0, pair = 0;
  for (const seed of picked) { pair++; if (a[seed] !== b[seed]) flip++; }
  console.log(`  ПРИЧИННАЯ ПРОВЕРКА: при развороте поля знак перевернулся на ${flip} из ${pair} (${(flip / pair).toFixed(2)}, порог ${Math.ceil(pair * 5 / 6)})`);
}

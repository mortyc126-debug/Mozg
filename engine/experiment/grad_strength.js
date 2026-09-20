#!/usr/bin/env node
'use strict';
/* РАЗВЁРТКА ПО СИЛЕ ЧТЕНИЯ ПОЛЯ

   При весе чтения 1.0 (взятом наугад) сторона прогиба следует за полем
   у 42 сидов из 65 -- эффект причинный (контроли на случайном уровне,
   разворот поля переворачивает большинство), но объявленного порога 5/6
   не берёт. Вопрос: это потолок механизма или недобор силы.

   Здесь вес меняется от 0 до 8 при прочем неизменном. На каждой силе две
   ветки: поле прямое и поле развёрнутое (амплитуда -1). Разворот -- та же
   причинная проверка, что и прежде, и сравнение ПАРНОЕ, сид к сиду.

   ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
     * если доля растёт с силой и достигает 5/6 ПРИ СОХРАНЁННОЙ ДУГЕ
       (прогиб/остаток выше единицы), источник направления получен, и
       прежний недобор был недобором силы;
     * если доля выходит на плато ниже 5/6 -- это потолок механизма, и
       чтения поля для управления стороной НЕДОСТАТОЧНО;
     * если доля растёт, но дуга при этом разваливается (отношение падает
       ниже единицы), выигрыш куплен формой и НЕ ЗАСЧИТЫВАЕТСЯ: мерить
       сторону у облака нечем;
     * парный разворот обязан идти следом за долей; если доля растёт, а
       парный разворот нет, растёт не управление, а что-то другое.

   ЗАОДНО: разбиение по |perp| -- доле градиента ПОПЕРЁК пласта. Если
   смещение создаётся поперечной составляющей поля, согласие должно быть
   сильнее там, где она велика. Если наоборот, сильнее при малой |perp|,
   значит работает продольная составляющая -- градиент РАССТОЯНИЙ вдоль
   ряда, а не поперечная полярность. Это разные механизмы, и различает
   их именно разбиение.

   Запуск: node experiment/grad_strength.js [сиды] [толщины]
*/
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const GHALF = +(process.env.GHALF || 95);
const STEPS = 1400, STRENGTH = 0.35, GENES = [0, 1];
const KG = (process.argv[4] || '0,0.25,0.5,1,2,4,8').split(',').map(Number);
const BASE = Array.from({ length: 72 }, (_, i) => i + 1);
const SEEDS = (process.argv[2] || BASE.join(',')).split(',').map(Number);
const ROWS = (process.argv[3] || '1').split(',').map(Number);
const PERP_MIN = 0.1;

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

function run(seed, rows, gradAlign, amp) {
  const per = 60, n0 = per * rows;
  const g = ancestral();
  for (const gi of GENES) g.eff[gi].pol = 1;
  const w = createWorld({
    seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
    params: { polarity: STRENGTH, maxCells: n0, gradient: amp,
              junctionAdhesion: 1, junction: 0.1, gradAlign, gradHalf: GHALF },
  });
  for (let i = 0; i < STEPS; i++) step(w);
  const gx = Math.cos(w.theta), gy = Math.sin(w.theta);
  let nb = 0;
  for (const c of w.cells) nb += c.nb;
  return Object.assign(fit(w.cells, gx, gy), { nb: nb / w.cells.length });
}

const BINS = [[0.1, 0.4], [0.4, 0.7], [0.7, 1.01]];

for (const rows of ROWS) {
  console.log(`\n=== слой ${rows}, ${SEEDS.length} сидов ===`);
  console.log('  вес чтения   большинство   доля    парный разворот   прогиб/остаток   соседей');
  const perBin = [];
  for (const kg of KG) {
    let plus = 0, read = 0, ratio = 0, nb = 0, flip = 0, pair = 0;
    const bins = BINS.map(() => [0, 0]);
    for (const seed of SEEDS) {
      const A = run(seed, rows, kg, 1.0);
      const B = run(seed, rows, kg, -1.0);
      nb += A.nb;
      if (A.perp < PERP_MIN) continue;
      read++;
      ratio += A.rms > 0 ? A.sag / A.rms : 0;
      if (A.a > 0) plus++;
      for (let b = 0; b < BINS.length; b++) {
        if (A.perp >= BINS[b][0] && A.perp < BINS[b][1]) { bins[b][1]++; if (A.a > 0) bins[b][0]++; }
      }
      if (B.perp >= PERP_MIN) { pair++; if (Math.sign(A.a) !== Math.sign(B.a)) flip++; }
    }
    const maj = Math.max(plus, read - plus);
    const rr = read ? ratio / read : 0;
    console.log(`  ${String(kg).padStart(9)}   ${String(maj).padStart(2)} из ${String(read).padStart(2)}   ${(maj / read).toFixed(2)}   ${String(flip).padStart(2)} из ${String(pair).padStart(2)} (${(flip / pair).toFixed(2)})      ${rr.toFixed(2)} ${rr > 1 ? '(дуга)  ' : '(облако)'}     ${(nb / SEEDS.length).toFixed(2)}`);
    perBin.push([kg, bins]);
  }
  console.log('\n  разбиение по доле градиента ПОПЕРЁК пласта (согласие "в сторону +perp"):');
  console.log('  вес чтения   |perp| 0.1-0.4   0.4-0.7   0.7-1.0');
  for (const [kg, bins] of perBin) {
    console.log(`  ${String(kg).padStart(9)}   ${bins.map(([a, b]) => `${String(a).padStart(2)} из ${String(b).padStart(2)}`).join('   ')}`);
  }
}

#!/usr/bin/env node
'use strict';
/* ============================================================
   ЭКСПЕРИМЕНТ (версия с упругой тканью).

   Проверяется ПОСЛЕДНЯЯ непроверенная часть объяснения этапа 9:
   «у плотного тела различима ровно одна сторона; равномерное сжатие по
   замкнутой выпуклой границе гасится, изгибать нечего». Две другие
   гипотезы опровергнуты: различие участков (этап 10) и текучесть
   ткани (этап 12) изгиба не дали.

   Слой имеет свободный край и две стороны -- то есть ту степень
   свободы, которой нет у плотного шара. Новых механизмов не вводится:
   берутся уже готовые упругость (этап 11) и ограничение деформации
   носителями гена.

   Контроль встроен в постановку: каждый сид прогоняется дважды --
   полярность выключена и включена, сравнение парное.

   Запуск: node experiment/layer_elastic.js [сиды] [толщины] [гены] [jadh] [jst]

   ЭКСПЕРИМЕНТ: тот же механизм, другая начальная геометрия
   Меняется ровно одно: стартовая конфигурация. Геном, сила полярности,
   сиды, физика, поля, регуляция, пластичность и критерии измерения —
   те же, что в эксперименте с диском.

   Ёмкость мира приравнена к числу стартовых агентов: иначе деление
   мгновенно превратит слой обратно в комок. Это ограничение начального
   условия, а не новое правило.
   ============================================================ */
const { createWorld, step } = require('../src/world');
const { measure, curvature, shape } = require('../src/measure');

/* РАЗЛИЧЕНИЕ ДУГИ И ОБЛАКА.
   Толщина (wid) -- габаритная ширина, она смешивает изгиб и разброс:
   у дуги она велика просто потому, что дуга изогнута. Поэтому большой
   прогиб при большой толщине неинтерпретируем -- этап 5 на этом и
   забраковал свой результат.
   Здесь считается ОСТАТОК подгонки параболы: среднеквадратичное
   отклонение агентов от подогнанной кривой. У настоящей дуги остаток
   мал (агенты лежат НА кривой), у облака остаток сопоставим с его
   шириной. Отношение прогиб/остаток и есть различитель:
   заметно больше 1 -- дуга, около 1 и меньше -- облако. */
/* НАПРАВЛЕНИЕ ИЗГИБА.
   Знак коэффициента параболы сам по себе бессмыслен: перпендикуляр в
   собственных осях облака определён с точностью до знака, и от сида к
   сиду он произволен. Нужна ВНЕШНЯЯ опора.
   Опора -- собственная ориентация агента q. Деформация делает точку по
   направлению q больше, противоположную меньше (bodyRadii), поэтому
   пласт должен гнуться в сторону УЗКОЙ стороны, как биметалл. Ось v
   ориентируется так, чтобы v.q_среднее > 0; тогда знак a сравним
   между сидами.
   Если среднее q близко к нулю (ориентации не согласованы), опоры нет
   и направление не определено -- это сообщается отдельно. */
function fitResidual(group) {
  const n = group.length;
  if (n < 12) return { rms: 0, len: 0 };
  let mx = 0, my = 0;
  for (const c of group) { mx += c.x / n; my += c.y / n; }
  let sxx = 0, syy = 0, sxy = 0;
  for (const c of group) { const dx = c.x - mx, dy = c.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  sxx /= n; syy /= n; sxy /= n;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
  let ux = sxy, uy = l1 - sxx;
  const nl = Math.hypot(ux, uy) || 1; ux /= nl; uy /= nl;
  let vx = -uy, vy = ux;
  // опора: среднее направление ориентации агентов
  let qx = 0, qy = 0;
  for (const c of group) { qx += c.qx; qy += c.qy; }
  const qm = Math.hypot(qx, qy) / n;          // модуль среднего q: согласованность
  if (qx * vx + qy * vy < 0) { vx = -vx; vy = -vy; }   // v сонаправлена с q
  const P = group.map((c) => {
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
    if (Math.abs(M[pi][i]) < 1e-12) return { rms: 0, len: 0 };
    [M[i], M[pi]] = [M[pi], M[i]]; [Y[i], Y[pi]] = [Y[pi], Y[i]];
    for (let r = 0; r < 3; r++) {
      if (r === i) continue;
      const f2 = M[r][i] / M[i][i];
      for (let k = i; k < 3; k++) M[r][k] -= f2 * M[i][k];
      Y[r] -= f2 * Y[i];
    }
  }
  const a = Y[0] / M[0][0], b = Y[1] / M[1][1], c0 = Y[2] / M[2][2];
  let ss = 0, lo = 1e9, hi = -1e9;
  for (const [u, v] of P) {
    const pred = a * u * u + b * u + c0;
    ss += (v - pred) * (v - pred);
    if (u < lo) lo = u; if (u > hi) hi = u;
  }
  return { rms: Math.sqrt(ss / n), len: hi - lo, a, qm };
}
const { ancestral } = require('../src/genome');

const STEPS = 1400;
const STRENGTH = 0.35;       // та же сила, что и в эксперименте с диском
const GENES = (process.argv[4] || '3').split(',').map(Number); // по умолчанию тот же ген, что в основном сравнении
const ALL = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808];
const SEEDS = (process.argv[2] || ALL.join(',')).split(',').map(Number);
const ROWS = (process.argv[3] || '1,2').split(',').map(Number);
const JADH = +(process.argv[5] || 0);
const JST = +(process.argv[6] || 0);

function run(seed, rows, strength, genes) {
  const g = ancestral();
  for (const gi of genes) g.eff[gi].pol = 1;
  const per = 60, n0 = per * rows;
  const w = createWorld({
    seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
    params: { polarity: strength, maxCells: n0,
              junctionAdhesion: JADH, junction: JST },
  });
  for (let i = 0; i < STEPS; i++) step(w);
  const m = measure(w);
  const sh = shape(w.cells, w);
  const cu = curvature(w.cells);
  const fr = fitResidual(w.cells);
  // угол между градиентом среды и слоем: слой горизонтален, поэтому это |cos theta|
  const along = Math.abs(Math.cos(w.theta));
  return {
    pop: m.n, states: m.types.length, anis: m.anis,
    elong: sh.elong, wid: sh.wid, len: cu.len,
    sagitta: cu.sagitta, bend: cu.bend, along,
    rms: fr.rms, arc: fr.rms > 1e-9 ? cu.sagitta / fr.rms : 0,
    aSign: Math.sign(fr.a || 0), qm: fr.qm,
    nb: w.cells.reduce((s2, c) => s2 + c.nb, 0) / w.cells.length,
    profiles: m.types.map((t) => `${t.bits}:${t.n}`).join(' '),
  };
}

const f = (x, k = 3) => x.toFixed(k);
for (const rows of ROWS) {
  console.log(`\n=== слой толщиной ${rows} агент${rows > 1 ? 'а' : ''}, длина 60, ${SEEDS.length} сидов` +
    ` | упругость: ${JADH ? `ДА (жёсткость ${JST})` : 'нет'} ===`);
  console.log('сид  | вдоль град. | прогиб/длина off → on | толщина off → on | состояний off → on');
  const recs = [];
  for (const seed of SEEDS) {
    const a = run(seed, rows, 0, []);
    const b = run(seed, rows, STRENGTH, GENES);
    recs.push({ seed, a, b });
    console.log(`${String(seed).padStart(4)} | ${f(a.along, 2).padStart(11)} | ` +
      `${f(a.bend).padStart(9)} → ${f(b.bend).padEnd(9)} | ${f(a.wid, 1).padStart(6)} → ${f(b.wid, 1).padEnd(6)} | ` +
      `${a.states} → ${b.states}`);
  }
  const mn = (sel, fn) => recs.reduce((s, r) => s + fn(r[sel]), 0) / recs.length;
  const up = recs.filter((r) => r.b.bend > r.a.bend).length;
  console.log(`  прогиб/длина: ${f(mn('a', (r) => r.bend))} → ${f(mn('b', (r) => r.bend))}, вырос у ${up} из ${recs.length}`);
  console.log(`  прогиб, ед.:  ${f(mn('a', (r) => r.sagitta), 1)} → ${f(mn('b', (r) => r.sagitta), 1)}`);
  console.log(`  толщина:      ${f(mn('a', (r) => r.wid), 1)} → ${f(mn('b', (r) => r.wid), 1)}`);
  console.log(`  ОСТАТОК подгонки: ${f(mn('a', (r) => r.rms), 1)} → ${f(mn('b', (r) => r.rms), 1)}`);
  console.log(`  ПРОГИБ/ОСТАТОК:   ${f(mn('a', (r) => r.arc), 2)} → ${f(mn('b', (r) => r.arc), 2)}   (>>1 дуга, ~1 облако)`);
  console.log(`  соседей:      ${f(mn('a', (r) => r.nb), 2)} → ${f(mn('b', (r) => r.nb), 2)}`);
  const pos = recs.filter((r) => r.b.aSign > 0).length;
  const neg = recs.filter((r) => r.b.aSign < 0).length;
  const posOff = recs.filter((r) => r.a.aSign > 0).length;
  console.log(`  НАПРАВЛЕНИЕ изгиба (знак относительно ориентации q):`);
  console.log(`    с деформацией : в сторону q ${pos}, против ${neg} из ${recs.length}`);
  console.log(`    без деформации: в сторону q ${posOff}, против ${recs.length - posOff} (контроль)`);
  console.log(`    согласованность ориентаций |q| среднее: ${f(mn('b', (r) => r.qm), 3)}`);
  console.log(`  длина:        ${f(mn('a', (r) => r.len), 1)} → ${f(mn('b', (r) => r.len), 1)}`);
  console.log(`  агентов:      ${f(mn('a', (r) => r.pop), 0)} → ${f(mn('b', (r) => r.pop), 0)}`);
  console.log(`  состояний:    ${f(mn('a', (r) => r.states), 1)} → ${f(mn('b', (r) => r.states), 1)}`);
  // разделение по тому, насколько градиент направлен вдоль слоя
  const strong = recs.filter((r) => r.a.along > 0.6), weak = recs.filter((r) => r.a.along <= 0.6);
  const sub = (arr, sel) => arr.length ? f(arr.reduce((s, r) => s + r[sel].bend, 0) / arr.length) : '—';
  console.log(`  градиент вдоль слоя (>0.6, ${strong.length} сидов): ${sub(strong, 'a')} → ${sub(strong, 'b')}`);
  console.log(`  градиент поперёк   (≤0.6, ${weak.length} сидов): ${sub(weak, 'a')} → ${sub(weak, 'b')}`);
}

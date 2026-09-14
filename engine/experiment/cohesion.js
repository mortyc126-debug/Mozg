#!/usr/bin/env node
'use strict';
/* ============================================================
   ЭКСПЕРИМЕНТ: сопротивляется ли ткань перестройке?

   Этап 10 упёрся в текучесть: локальное сокращение рассасывается
   перестановкой соседей, напряжение не накапливается и до формы не
   доходит. Проверяется САМО СВОЙСТВО МАТЕРИАЛА, до всякой морфологии --
   как и записано в выводах этапа 10.

   Величина: доля соседей, сохранившихся спустя N шагов. Соседство --
   то же, что в ядре: расстояние между центрами меньше D0 * 1.35.

   Порядок: развитие 1400 шагов (та же постановка, что в patch.js),
   затем снимок соседей и продолжение с замерами на 50, 100, 400 шагах.

   Запуск: node experiment/cohesion.js [ген|-] [сиды]
   ============================================================ */
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const R = 3.6, D0 = 2 * R, RN = D0 * 1.35;
const DEV = 1400;
const CHECKS = [50, 100, 400];
const GENE = process.argv[2] === '-' ? null : +(process.argv[2] || 0);
const SEEDS = (process.argv[3] || '5,77').split(',').map(Number);
/* сетка жёсткости закреплённого контакта объявлена заранее, кривая
   сообщается целиком -- отбор "удачного" значения запрещён. */
const JN = (process.argv[4] || '0,0.05,0.1,0.2,0.4').split(',').map(Number);
/* КОГДА включать механизм:
     'dev'   -- с самого начала (тогда он влияет и на РАЗВИТИЕ ткани);
     'probe' -- только на время замера, после одинакового развития.
   Режим 'dev' даёт РАЗНЫЕ ткани у разных жёсткостей и потому мерит
   вместе и различие ткани, и различие сопротивления -- это спутывание
   (та же ошибка, что ловушка №13 в Mozg). Режим 'probe' изолирует
   механизм: развитие идентично, различие ровно одно. */
const MODE = process.argv[5] || 'probe';

/* КОНТРОЛЬ ПРОТИВ СЖАТИЯ. Соседство по радиусу чувствительно к
   уплотнению: если агенты просто сблизились, они чаще остаются внутри
   радиуса, и сохранность растёт БЕЗ всякого сопротивления перестройке.
   Соседство по k ближайшим от плотности не зависит: сколько бы ни
   сжалась ткань, ближайших всегда ровно k. Если прирост сохранности
   держится и здесь -- он не объясняется сжатием. */
const KNN = 6;
function knnSets(w) {
  const m = new Map();
  const cs = w.cells;
  for (const c of cs) {
    const ds = [];
    for (const o of cs) {
      if (o === c) continue;
      const dx = o.x - c.x, dy = o.y - c.y;
      ds.push([dx * dx + dy * dy, o]);
    }
    ds.sort((a, b) => a[0] - b[0]);
    m.set(c, new Set(ds.slice(0, KNN).map((x) => x[1])));
  }
  return m;
}

function neighbourSets(w) {
  const m = new Map();
  for (const c of w.cells) m.set(c, new Set());
  for (let i = 0; i < w.cells.length; i++) {
    for (let j = i + 1; j < w.cells.length; j++) {
      const a = w.cells[i], b = w.cells[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy < RN * RN) { m.get(a).add(b); m.get(b).add(a); }
    }
  }
  return m;
}

/* доля соседей из снимка, оставшихся соседями. Считается только по
   агентам, дожившим до замера и имевшим хотя бы одного соседа. */
function retention(before, now) {
  let sum = 0, n = 0;
  for (const [c, set] of before) {
    if (!now.has(c) || set.size === 0) continue;
    let kept = 0;
    for (const o of set) if (now.get(c).has(o)) kept++;
    sum += kept / set.size; n++;
  }
  return { frac: n ? sum / n : NaN, n };
}

function meanNb(w) {
  return w.cells.reduce((s2, c) => s2 + c.nb, 0) / w.cells.length;
}
function biggestNet(w) {
  const { components } = require('../src/world');
  const comp = components(w);
  return comp.length ? Math.max(...comp.map((x) => (x.length !== undefined ? x.length : x))) : 0;
}

const out = [];
for (const jn of JN) {
for (const seed of SEEDS) {
  const g = ancestral();
  if (GENE !== null) g.eff[GENE].pol = 1;
  const w = createWorld({
    seed, genome: g,
    params: { twoPoint: true, align: 1, alignSelf: 1, alignRate: 0.10,
              polarity: GENE === null ? 0 : 0.35,
              junction: MODE === 'dev' ? jn : 0 },
  });
  for (let i = 0; i < DEV; i++) step(w);
  // в режиме probe механизм включается ПОСЛЕ одинакового развития
  if (MODE !== 'dev') w.p.junction = jn;

  const before = neighbourSets(w);
  const beforeK = knnSets(w);
  const nCells0 = w.cells.length;
  const row = { seed, gene: GENE, jn, cells: nCells0, nb0: meanNb(w) };
  let done = 0;
  for (const chk of CHECKS) {
    while (done < chk) { step(w); done++; }
    const r = retention(before, neighbourSets(w));
    row['k' + chk] = r.frac;
    row['n' + chk] = retention(beforeK, knnSets(w)).frac;
  }
  row.cellsEnd = w.cells.length;
  row.nbEnd = meanNb(w);
  row.jnMean = w.cells.reduce((s2, c) => s2 + c.jn.size, 0) / w.cells.length;
  out.push(row);
  console.log(`жёсткость ${String(jn).padStart(5)} | сид ${String(seed).padStart(4)} | ` +
    `агентов ${nCells0}->${row.cellsEnd} | соседей ${row.nbEnd.toFixed(1)} | ` +
    `закреплённых ${row.jnMean.toFixed(1)} | ` +
    CHECKS.map((c) => `${c}ш ${(100 * row['k' + c]).toFixed(0)}%/${(100 * row['n' + c]).toFixed(0)}%`).join(' '));
}
}
console.log(`\n=== СВОДКА (режим ${MODE}${MODE === 'probe' ? ': развитие ОДИНАКОВОЕ, механизм включён только на замер' : ': механизм влиял и на развитие'}) ===`);
console.log('сохранность: по РАДИУСУ / по k БЛИЖАЙШИМ (контроль против сжатия)');
console.log('жёсткость | соседей |     50ш     |    100ш     |    400ш');
for (const jn of JN) {
  const rs = out.filter((r) => r.jn === jn);
  const m = (k) => rs.reduce((s2, r) => s2 + r[k], 0) / rs.length;
  console.log(`${String(jn).padStart(9)} | ${m('nbEnd').toFixed(2).padStart(7)} | ` +
    CHECKS.map((c) => `${(100 * m('k' + c)).toFixed(1)}% / ${(100 * m('n' + c)).toFixed(1)}%`.padStart(11)).join(' | '));
}

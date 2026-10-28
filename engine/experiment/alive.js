#!/usr/bin/env node
'use strict';
/* ============================================================
   ЖИВЁТ ЛИ ТКАНЬ МЕЖДУ КАСАНИЯМИ

   Строка 0 критерия зачатка цифрового мозга (docs/RUDIMENT_SPEC.md).
   В Python-линии этот вопрос закрылся отрицательно и обрушил v0.59:
   при drive 0.8 и выключенном гомеостазе ткань без входа даёт 2 импульса
   на шесть тканей за 120 секунд, то есть след опыта там нечему
   подвергать. Здесь тот же вопрос задаётся движку.

   МЕХАНИЗМОВ НЕ ДОБАВЛЯЕТСЯ. Правило проекта: сперва измерить то, что
   модель уже умеет (v0.12). Движок берётся как есть, с наследным геномом.

   УСТРОЙСТВО. Мир растёт обычные 1600 шагов. Затем два отрезка равной
   длины по 2000 шагов:
     ТИШИНА   -- воздействия нет вовсе;
     КАСАНИЯ  -- то же воздействие, что в пробе, каждые 130 шагов.
   Считаются импульсы (w.firedNow) и доля агентов, выстреливших хотя бы
   раз. Оба отрезка идут на РАЗНЫХ копиях одного мира: тишина не должна
   утомлять ткань перед касаниями и наоборот.

   ПРАВИЛО ЧТЕНИЯ, ОБЪЯВЛЕНО ДО ЗАПУСКА:
     * СТРОКА 0 ЗАКРЫТА ПОЛОЖИТЕЛЬНО, если спонтанная активность
       составляет не менее 10% от вызванной у большинства сидов;
     * ЗАКРЫТА ОТРИЦАТЕЛЬНО, если ниже 1% -- тогда движок в этом смысле
       не лучше Python-линии, и условия, которые у него есть (экономика,
       гибель, отмирание связей), сами по себе жизни не дают;
     * между 1% и 10% -- НЕ РАЗРЕШЕНО, записывается как есть.
     * Отдельно сообщается доля агентов, выстреливших в тишине хотя бы
       раз: ткань, где стреляет один и тот же угол, -- не то же, что
       ткань, живущая целиком.
   ============================================================ */
const { createWorld, step, stimulate } = require('../src/world');
const { ancestral } = require('../src/genome');
const { measure } = require('../src/measure');
const { sites } = require('../src/probe');

const GROW = 1600;
const WATCH = 2000;
const GAP = 130;
const SEEDS = [5, 77, 2024, 11, 22, 33, 101, 202, 303, 404, 505, 606];

function grow(seed) {
  const w = createWorld({ seed, genome: ancestral() });
  for (let i = 0; i < GROW; i++) step(w);
  return w;
}

/* прогон длиной WATCH с воздействием или без; возвращает импульсы и
   долю агентов, выстреливших хотя бы раз */
function watch(seed, touching) {
  const w = grow(seed);              // своя копия мира для каждого условия
  const p = sites(w)[0];
  const t0 = w.t;
  let spikes = 0;
  for (let i = 0; i < WATCH; i++) {
    if (touching && p && i % GAP === 0) stimulate(w, p.x, p.y, 2.2);
    step(w);
    spikes += w.firedNow;
  }
  let lit = 0;
  for (const c of w.cells) if (c.fired >= t0) lit++;
  return { spikes, lit, n: w.cells.length, share: w.cells.length ? lit / w.cells.length : 0 };
}

const rows = [];
console.log('ЖИВЁТ ЛИ ТКАНЬ МЕЖДУ КАСАНИЯМИ');
console.log(`рост ${GROW} шагов, затем ${WATCH} шагов наблюдения; касания каждые ${GAP} шагов\n`);
console.log('  сид | агентов | тишина: импульсов | стреляло | касания: импульсов | стреляло |  доля');
for (const seed of SEEDS) {
  const q = watch(seed, false);
  const t = watch(seed, true);
  const ratio = t.spikes > 0 ? q.spikes / t.spikes : (q.spikes > 0 ? Infinity : 0);
  rows.push({ seed, q, t, ratio });
  console.log(
    `${String(seed).padStart(5)} | ${String(q.n).padStart(7)} | ` +
    `${String(q.spikes).padStart(17)} | ${(q.share * 100).toFixed(0).padStart(7)}% | ` +
    `${String(t.spikes).padStart(18)} | ${(t.share * 100).toFixed(0).padStart(7)}% | ` +
    `${(ratio * 100).toFixed(2).padStart(5)}%`);
}

const ratios = rows.map((r) => r.ratio).filter((x) => Number.isFinite(x));
const mid = ratios.slice().sort((a, b) => a - b)[Math.floor(ratios.length / 2)];
const hi10 = ratios.filter((x) => x >= 0.10).length;
const lo01 = ratios.filter((x) => x < 0.01).length;
const half = Math.floor(SEEDS.length / 2) + 1;

console.log(`\nспонтанная активность как доля от вызванной: медиана ${(mid * 100).toFixed(2)}%`);
console.log(`сидов с долей >= 10%: ${hi10} из ${SEEDS.length}; с долей < 1%: ${lo01}`);
console.log(`доля агентов, выстреливших в тишине: ` +
  `${(rows.reduce((s, r) => s + r.q.share, 0) / rows.length * 100).toFixed(1)}% в среднем`);

let verdict;
if (hi10 >= half) verdict = 'СТРОКА 0 ЗАКРЫТА ПОЛОЖИТЕЛЬНО: ткань живёт между касаниями';
else if (lo01 >= half) verdict = 'СТРОКА 0 ЗАКРЫТА ОТРИЦАТЕЛЬНО: между касаниями ткань молчит';
else verdict = 'НЕ РАЗРЕШЕНО: активность есть, но ниже объявленного порога';
console.log(`\n${verdict}`);

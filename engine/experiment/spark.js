#!/usr/bin/env node
'use strict';
/* ============================================================
   ДОСТИЖИМА ЛИ ЖИЗНЬ МЕЖДУ КАСАНИЯМИ В ПРОСТРАНСТВЕ ГЕНОМА

   ОТКУДА. experiment/alive.js: наследная ткань между касаниями МОЛЧИТ --
   0 импульсов на 12 сидов из 12 за 2000 шагов, при 21-561 импульсе под
   касанием. Та же стена, что обрушила v0.59 в Python-линии, только
   причина другая и она видна прямо в геноме:

     агенты выделяют в поля 0, 1, 2  (eff[0].sec[0], eff[1].sec[1], eff[3].sec[2])
     чувствует же только ген 5, и только поле 4 -- ВНЕШНЕЕ ВОЗДЕЙСТВИЕ.

   У ткани есть голос и нет слуха к нему. Нет касания -- нет ощущения --
   нет первого импульса -- нечему распространяться.

   ЧТО ЗДЕСЬ СПРАШИВАЕТСЯ. Не "как сделать ткань живой" -- механизмов не
   добавляется ни одного. Спрашивается: ДОСТИЖИМА ЛИ такая ткань
   мутацией того же генома. Если да, жизнь между касаниями есть
   возможность этого устройства, а не наша выдумка, и дальше вопрос
   переходит к отбору. Если нет, ограничение глубже генома.

   ЧЕГО ЭТОТ ОПЫТ НЕ ДЕЛАЕТ. Он НЕ отбирает. Мутанты не соревнуются, им
   ничего не назначается, приспособленности нет (её нет и в движке, см.
   README). Меряется ДОСЯГАЕМОСТЬ, а не предпочтение.

   ПРАВИЛО ЧТЕНИЯ, ОБЪЯВЛЕНО ДО ЗАПУСКА:
     * мутант считается ЖИВЫМ МЕЖДУ КАСАНИЯМИ, если за 2000 шагов
       тишины выстрелило не менее 5% агентов (наследный даёт ровно 0%);
     * ЖИЗНЬ ДОСТИЖИМА, если таких мутантов не менее 5 из 100;
     * НЕ ДОСТИЖИМА, если ни одного;
     * между 1 и 4 -- НЕ РАЗРЕШЕНО, записывается как есть.
     * У каждого живого мутанта отдельно сообщается, ЖИВ ЛИ ОН САМ:
       сколько агентов осталось. Ткань, спалившая себя, -- не ответ.
       Это и есть условие, которое у движка уже стоит: экономика, а не
       наша оценка.
     * Наследный геном обязан дать 0% -- контроль исправности меры.
   ============================================================ */
const fs = require('fs');
const { createWorld, step } = require('../src/world');
const { ancestral, mutate } = require('../src/genome');
const { makeRNG } = require('../src/rng');

const GROW = 1600;
const WATCH = 2000;
const WSEED = 5;
const N_MUT = 100;
const TIERS = [0.03, 0.06, 0.12, 0.20];     // те же ступени, что в bin/sweep.js
const LIVE_SHARE = 0.05;                     // порог "живой", объявлен выше

function trial(genome) {
  const w = createWorld({ seed: WSEED, genome });
  for (let i = 0; i < GROW; i++) step(w);
  const grown = w.cells.length;
  const t0 = w.t;
  let spikes = 0;
  for (let i = 0; i < WATCH; i++) { step(w); spikes += w.firedNow; }
  let lit = 0;
  for (const c of w.cells) if (c.fired >= t0) lit++;
  const n = w.cells.length;
  return { grown, n, spikes, lit, share: n ? lit / n : 0 };
}

/* сколько геном вообще слышит собственные поля -- диагностика, не мера */
function ownEars(g) {
  let s = 0;
  for (const e of g.eff) for (let f = 0; f < 3; f++) s += e.sens[f];
  return s;
}

const base = ancestral();
const ctl = trial(base);
console.log('ДОСТИЖИМА ЛИ ЖИЗНЬ МЕЖДУ КАСАНИЯМИ В ПРОСТРАНСТВЕ ГЕНОМА');
console.log(`рост ${GROW} шагов, затем ${WATCH} шагов тишины; ${N_MUT} мутантов\n`);
console.log(`КОНТРОЛЬ, наследный геном: агентов ${ctl.n}, импульсов ${ctl.spikes}, ` +
  `стреляло ${(ctl.share * 100).toFixed(1)}%, слух к своим полям ${ownEars(base).toFixed(2)}`);
if (ctl.share > 0.001) console.log('  ВНИМАНИЕ: контроль обязан был дать 0% -- мера неисправна');

const rows = [];
for (let i = 0; i < N_MUT; i++) {
  const rnd = makeRNG(9000 + i);
  const tier = TIERS[i % TIERS.length];
  const g = mutate(base, rnd, { pWeight: tier, pEff: tier });
  const r = trial(g);
  rows.push({ i, tier, ears: ownEars(g), ...r });
}

const live = rows.filter((r) => r.share >= LIVE_SHARE);
console.log(`\nживых между касаниями: ${live.length} из ${N_MUT} (порог ${LIVE_SHARE * 100}% агентов)`);
if (live.length) {
  console.log('\n    № | ступень | агентов | импульсов | стреляло | слух к своим полям');
  for (const r of live.slice(0, 20)) {
    console.log(`${String(r.i).padStart(5)} | ${r.tier.toFixed(2).padStart(7)} | ` +
      `${String(r.n).padStart(7)} | ${String(r.spikes).padStart(9)} | ` +
      `${(r.share * 100).toFixed(0).padStart(7)}% | ${r.ears.toFixed(2).padStart(18)}`);
  }
  const alive = live.filter((r) => r.n >= 40);
  console.log(`\nиз них СОХРАНИВШИХ ПОПУЛЯЦИЮ (>= 40 агентов): ${alive.length} из ${live.length}`);
  const withEars = live.filter((r) => r.ears > 0).length;
  console.log(`из них со слухом к собственным полям: ${withEars} из ${live.length} ` +
    `(диагностика механизма, не часть правила)`);
}

const half = rows.filter((r) => r.share > 0 && r.share < LIVE_SHARE).length;
console.log(`мутантов с активностью ниже порога (но не нулевой): ${half}`);

let verdict;
if (live.length >= 5) verdict = 'ЖИЗНЬ МЕЖДУ КАСАНИЯМИ ДОСТИЖИМА мутацией этого же генома';
else if (live.length === 0) verdict = 'НЕ ДОСТИЖИМА: ни один мутант не ожил';
else verdict = `НЕ РАЗРЕШЕНО: живых ${live.length}, объявленный порог 5`;
console.log(`\n${verdict}`);
console.log('ЭТО НЕ ОТБОР: мутанты ни с чем не соревновались, приспособленности нет.');

fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/spark.jsonl',
  rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

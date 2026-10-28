#!/usr/bin/env node
'use strict';
/* ============================================================
   ОТКУДА У ОЖИВШИХ МУТАНТОВ БЕРЁТСЯ АКТИВНОСТЬ

   ОТКУДА ВОПРОС. experiment/spark.js нашёл 26 мутантов из 100, у которых
   в тишине возбуждаются агенты (наследный геном даёт ровно 0). По
   объявленному правилу это "жизнь между касаниями достижима". Но
   формулировка шире измеренного, и разница существенна:

     ткань может возбуждаться ОТ СВОЕГО ГОЛОСА -- агенты выделяют в поля
     0-2, кто-то их чувствует, и петля замыкается на самой ткани;
     а может -- ОТ НЕПОДВИЖНОГО ГРАДИЕНТА среды (поле 5) или ресурса
     (поле 3), которые есть всегда и к ткани отношения не имеют.

   Второе -- это не жизнь между касаниями, а "мир всегда чуть шумит", то
   есть переименование касания в фон. Такой вариант был отвергнут ещё в
   разговоре о путях, и засчитывать его теперь нельзя.

   ДВА ИЗЪЯНА spark.js, названные здесь, а не умолчанные:
   1. колонка "импульсов" считала w.firedNow, а он учитывает ТОЛЬКО
      срабатывания от связей; сенсорное возбуждение (world.js:314) ставит
      c.fired, но в счётчик не попадает. Отсюда строки с нулём импульсов
      при 45-100% выстреливших. Здесь считается правильно: агенты, у
      которых c.fired === w.t после шага, то есть оба пути разом;
   2. проверка "сохранил ли мутант популяцию" оказалась пустой: у ВСЕХ
      ровно 560 агентов, это потолок maxCells. Экономика в этой
      настройке не связывает, и говорить, что условие отсеяло
      спаливших себя, нельзя -- оно ничего не отсеивало.

   УСТРОЙСТВО. Вмешательство на ОДНОЙ выросшей ткани, а не сравнение
   разных: мутант растёт обычные 1600 шагов, затем 2000 шагов тишины в
   трёх условиях, каждое на своей копии:

     КАК ЕСТЬ       -- ничего не трогаем;
     БЕЗ СВОЕГО     -- на каждом шаге обнуляются поля 0-2, то есть ткань
                       теряет собственный голос, но не строение;
     БЕЗ ГРАДИЕНТА  -- на каждом шаге обнуляется поле 5.

   ПРАВИЛО ЧТЕНИЯ, ОБЪЯВЛЕНО ДО ЗАПУСКА. Падением считается снижение
   доли выстреливших более чем ВДВОЕ относительно "как есть".
     * ЖИВЁТ СВОИМ -- падение при обнулении своих полей И нет падения
       при обнулении градиента;
     * ЖИВЁТ ЧУЖИМ -- наоборот;
     * ЖИВЁТ ОБОИМИ -- падение в обоих условиях (петля нуждается и в
       том, и в другом);
     * НЕ ОБЪЯСНЕНО -- падения нет нигде: источник не найден ни один,
       и это записывается как есть, а не подгоняется.
   ============================================================ */
const fs = require('fs');
const { createWorld, step } = require('../src/world');
const { ancestral, mutate } = require('../src/genome');
const { makeRNG } = require('../src/rng');

const GROW = 1600;
const WATCH = 2000;
const WSEED = 5;
const TIERS = [0.03, 0.06, 0.12, 0.20];
const LIVE_SHARE = 0.05;
const DROP = 0.5;                     // "падение" -- меньше половины от "как есть"

function watch(genome, mode) {
  const w = createWorld({ seed: WSEED, genome });
  for (let i = 0; i < GROW; i++) step(w);
  const t0 = w.t;
  let spikes = 0;
  for (let i = 0; i < WATCH; i++) {
    step(w);
    if (mode === 'own') for (let f = 0; f < 3; f++) w.f[f].fill(0);
    if (mode === 'grad') w.f[5].fill(0);
    // оба пути возбуждения разом: и сенсорный, и от связей
    for (const c of w.cells) if (c.fired === w.t) spikes++;
  }
  let lit = 0;
  for (const c of w.cells) if (c.fired >= t0) lit++;
  const n = w.cells.length;
  return { spikes, lit, n, share: n ? lit / n : 0 };
}

const base = ancestral();
console.log('ОТКУДА У ОЖИВШИХ МУТАНТОВ БЕРЁТСЯ АКТИВНОСТЬ');
console.log(`вмешательство на одной выросшей ткани; ${WATCH} шагов тишины\n`);

const ctl = watch(base, null);
console.log(`КОНТРОЛЬ, наследный геном: импульсов ${ctl.spikes}, стреляло ` +
  `${(ctl.share * 100).toFixed(1)}% (правильный счёт обоих путей)\n`);

const rows = [];
for (let i = 0; i < 100; i++) {
  const g = mutate(base, makeRNG(9000 + i), { pWeight: TIERS[i % 4], pEff: TIERS[i % 4] });
  const asis = watch(g, null);
  if (asis.share < LIVE_SHARE) continue;
  const own = watch(g, 'own');
  const grad = watch(g, 'grad');
  const dOwn = asis.share > 0 ? own.share / asis.share : 1;
  const dGrad = asis.share > 0 ? grad.share / asis.share : 1;
  let verdict;
  const fellOwn = dOwn < DROP, fellGrad = dGrad < DROP;
  if (fellOwn && !fellGrad) verdict = 'живёт СВОИМ';
  else if (!fellOwn && fellGrad) verdict = 'живёт ЧУЖИМ';
  else if (fellOwn && fellGrad) verdict = 'живёт обоими';
  else verdict = 'НЕ ОБЪЯСНЕНО';
  rows.push({ i, tier: TIERS[i % 4], asis, own, grad, dOwn, dGrad, verdict });
  console.log(`${String(i).padStart(4)} | как есть ${(asis.share * 100).toFixed(0).padStart(3)}% ` +
    `(${String(asis.spikes).padStart(6)} имп.) | без своего ${(own.share * 100).toFixed(0).padStart(3)}% ` +
    `(x${dOwn.toFixed(2)}) | без градиента ${(grad.share * 100).toFixed(0).padStart(3)}% ` +
    `(x${dGrad.toFixed(2)}) | ${verdict}`);
}

const tally = {};
for (const r of rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
console.log(`\nживых мутантов разобрано: ${rows.length}`);
for (const k of Object.keys(tally)) console.log(`  ${k}: ${tally[k]}`);

const own = tally['живёт СВОИМ'] || 0;
const both = tally['живёт обоими'] || 0;
console.log(`\nАКТИВНОСТЬ, ЗАВИСЯЩАЯ ОТ СОБСТВЕННЫХ ПОЛЕЙ ТКАНИ: ${own + both} из ${rows.length}`);
console.log('Это НЕ отбор и НЕ утверждение, что такая ткань чем-то лучше.');

fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/spark_cause.jsonl',
  rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

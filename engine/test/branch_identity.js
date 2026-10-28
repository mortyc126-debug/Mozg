#!/usr/bin/env node
'use strict';
/* ============================================================
   ПРОВЕРКА ВЕТВЛЕНИЯ -- внутренняя, о самой машинерии

   Ничего о похожести на что-либо. Только о том, делает ли код ровно то,
   что про него сказано. Четыре требования:

     1. ТОЖДЕСТВО ПРИ ОДНОЙ ВЕТВИ. Ветвление с n = 1 обязано быть
        ПОБИТОВО равно обычному прогону той же длины. Иначе всё, что
        меряется поверх, будет про машинерию, а не про мир.
     2. ВЕТВИ РАСХОДЯТСЯ. При n > 1 будущие обязаны отличаться друг от
        друга. Иначе выбирать не из чего, и любое правило -- пустая
        формальность. Это пустой отсчёт для п.1.
     3. ВЫБРАНА ИМЕННО НАЗВАННАЯ. Оставшийся мир обязан совпадать с той
        ветвью, которой правило дало наибольшую оценку. Проверяется
        сверкой отпечатков, а не доверием к индексу.
     4. ВЫБРОШЕННЫЕ НЕ ВЛИЯЮТ. Прогон с n = 4 и правилом "всегда ветвь 0"
        обязан совпасть с прогоном при n = 1: лишние будущие, раз они
        отброшены, не должны оставлять следа.
   ============================================================ */
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');
const { fingerprint } = require('../src/clone');
const { episode, branchRun } = require('../src/branch');

const SEEDS = [5, 77, 2024];
const GROW = 600, H = 150, EP = 4;
let fails = 0;
const check = (name, ok, note) => {
  console.log(`${ok ? ' ok  ' : 'ПРОВАЛ'} ${name}${note ? '  ' + note : ''}`);
  if (!ok) fails++;
};

for (const seed of SEEDS) {
  const grow = () => {
    const w = createWorld({ seed, genome: ancestral() });
    for (let i = 0; i < GROW; i++) step(w);
    return w;
  };

  // 1) тождество при одной ветви
  const plain = grow();
  for (let i = 0; i < H * EP; i++) step(plain);
  const one = branchRun(grow(), { n: 1, horizon: H, episodes: EP, pick: () => 0 });
  check(`сид ${seed}: ветвление при n=1 равно обычному прогону`,
    fingerprint(one.world) === fingerprint(plain), `${H * EP} шагов`);

  // 2) ветви расходятся -- пустой отсчёт
  const r = episode(grow(), { n: 4, horizon: H, pick: () => 0 });
  const prints = r.kids.map(fingerprint);
  const uniq = new Set(prints).size;
  check(`сид ${seed}: четыре будущих различны`, uniq === 4, `различных ${uniq} из 4`);

  // 3) выбрана именно названная
  const want = 2;
  const r2 = episode(grow(), { n: 4, horizon: H, pick: (kid, base, k) => (k === want ? 10 : 0) });
  check(`сид ${seed}: оставлена ветвь, названная правилом`,
    r2.keptIndex === want && fingerprint(r2.kept) === fingerprint(r2.kids[want]));

  // 4) выброшенные не влияют
  const four0 = branchRun(grow(), { n: 4, horizon: H, episodes: EP, pick: (kid, base, k) => (k === 0 ? 1 : 0) });
  check(`сид ${seed}: лишние будущие не оставляют следа`,
    fingerprint(four0.world) === fingerprint(plain));
}

console.log(fails ? `\nпровалено проверок: ${fails}` : '\nвсе проверки пройдены');
process.exit(fails ? 1 : 0);

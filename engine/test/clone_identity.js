#!/usr/bin/env node
'use strict';
/* ============================================================
   ПРОВЕРКА РАЗДВОЕНИЯ МИРА -- внутренняя, о самой работе

   Не о похожести на что бы то ни было. Только о том, делает ли код то,
   что про него сказано. Три требования, и все обязаны выполниться точно:

     1. ТОЖДЕСТВО. Копия, прогнанная N шагов, совпадает с оригиналом,
        прогнанным те же N шагов, ПОБИТОВО по всему состоянию.
     2. НЕЗАВИСИМОСТЬ. Если копию тронуть, оригинал не меняется, и
        наоборот. Иначе это не копия, а вторая ссылка.
     3. РАСХОЖДЕНИЕ ВОЗМОЖНО. Копия, которой дали другой поток случайных
        чисел, обязана разойтись с оригиналом. Иначе тождество в п.1
        ничего не значит -- совпадать может и то, что не считает.

   Требование 3 -- это пустой отсчёт для требования 1. Без него проверка
   не способна провалиться (ошибка №49 Python-ведомости).
   ============================================================ */
const { createWorld, step, stimulate } = require('../src/world');
const { ancestral } = require('../src/genome');
const { cloneWorld, fingerprint } = require('../src/clone');

const SEEDS = [5, 77, 2024];
const GROW = 600, AFTER = 400;
let fails = 0;

function check(name, ok, note) {
  console.log(`${ok ? ' ok  ' : 'ПРОВАЛ'} ${name}${note ? '  ' + note : ''}`);
  if (!ok) fails++;
}

for (const seed of SEEDS) {
  const w = createWorld({ seed, genome: ancestral() });
  for (let i = 0; i < GROW; i++) step(w);

  // 1) тождество
  const c = cloneWorld(w);
  check(`сид ${seed}: копия снята верно`, fingerprint(c) === fingerprint(w),
    `агентов ${w.cells.length}`);
  for (let i = 0; i < AFTER; i++) { step(w); step(c); }
  const same = fingerprint(c) === fingerprint(w);
  check(`сид ${seed}: копия идёт тем же путём ${AFTER} шагов`, same);

  // 2) независимость: трогаем копию, оригинал обязан устоять
  const before = fingerprint(w);
  stimulate(c, c.cells[0].x, c.cells[0].y, 3.0);
  for (let i = 0; i < 50; i++) step(c);
  check(`сид ${seed}: оригинал не задет вмешательством в копию`,
    fingerprint(w) === before);

  // 3) расхождение возможно -- пустой отсчёт для п.1
  const d = cloneWorld(w);
  d.rnd.setState(w.rnd.getState() ^ 0x9e3779b9);
  for (let i = 0; i < AFTER; i++) { step(w); step(d); }
  check(`сид ${seed}: при другом потоке чисел копия РАСХОДИТСЯ`,
    fingerprint(d) !== fingerprint(w));
}

console.log(fails ? `\nпровалено проверок: ${fails}` : '\nвсе проверки пройдены');
process.exit(fails ? 1 : 0);

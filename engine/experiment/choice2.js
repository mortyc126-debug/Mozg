#!/usr/bin/env node
'use strict';
/* ============================================================
   ДЕЙСТВУЕТ ЛИ ВЫБОР -- ДВУСТОРОННЕЕ ПРАВИЛО, СВЕЖИЕ СИДЫ

   ПОЧЕМУ ВТОРОЙ ЗАХОД. choice.js напечатал "НЕ РАЗРЕШЕНО", и это была
   моя вина, а не данных. Правило гласило: "выбор действует, если
   расстояние ПРЕВЫШАЕТ пол". А вышло так:

     дальше      выше пола  6 из 12, p = 0.61
     деятельнее  выше пола  5 из 12, p = 0.39
     ближе       выше пола  2 из 12, p = 0.0193   <- значимо, но ВНИЗ

   Правило "ближе" (оставлять ветвь, ушедшую от прежнего себя меньше
   всех) уводит мир МЕНЬШЕ, чем жребий. Выбор оставляет след -- в сторону
   меньшего расхождения, -- а односторонний порог такой исход засчитать
   не мог.

   ЭТО ПЯТЫЙ РАЗ ЗА СЕССИЮ, когда я ставлю границу с одной стороны
   (припадок, местная судорога, деление на шум, контроль, который сам не
   держится, теперь -- знак). Отсюда правило для самих правил, и оно
   действует начиная с этого опыта:

     ВСЯКОЕ ПРАВИЛО ОБЯЗАНО СКАЗАТЬ, ЧТО ОЗНАЧАЛ БЫ ПРОТИВОПОЛОЖНЫЙ ЗНАК.

   ПРАВИЛО ЧТЕНИЯ, ОБЪЯВЛЕНО ДО ЗАПУСКА, ДВУСТОРОННЕЕ:
     * ВЫБОР ДЕЙСТВУЕТ, если расстояние (правило против жребия) ОТЛИЧНО
       от пола у большинства сидов при биномиальном p < 0.05 -- в любую
       сторону. Сторона сообщается отдельно:
         ВВЕРХ -- выбор уводит мир дальше, чем случай;
         ВНИЗ  -- выбор удерживает мир ближе, чем случай.
     * ВЫБОР НЕ ДЕЙСТВУЕТ, если ни одно правило от пола не отличается;
     * НЕ РАЗРЕШЕНО, если знаковый счёт порога не проходит.

   СИДЫ СВЕЖИЕ (1501-1516), прежние двенадцать мера уже видела.
   Наблюдение с виденных сидов подтверждением не считается.

   ДОБАВЛЕНО ИЗМЕРЕНИЕ МЕХАНИЗМА. Печатается расстояние каждого мира от
   ИСХОДНОГО, до ветвления. Если "ближе" держит мир у основания -- это
   видно прямо, и тогда эффект отчасти ТАВТОЛОГИЧЕН: правило отбирает
   малое расхождение и получает малое расхождение. Тавтология тут не
   изъян, а то, что надо назвать: нетавтологично лишь то, что выбор
   вообще ДОХОДИТ до мира через двадцать эпизодов, а не тонет.

   И отдельный вопрос, тоже объявленный заранее: почему "дальше" НЕ
   усиливает расхождение так же, как "ближе" его подавляет. Если
   асимметрия подтвердится на свежих сидах, она означает, что уводить
   мир дороже, чем удерживать, -- и это уже не тавтология.
   ============================================================ */
const fs = require('fs');
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');
const { cloneWorld } = require('../src/clone');
const { branchRun, RULES } = require('../src/branch');
const { makeRNG } = require('../src/rng');

const GROW = 1200, N = 4, HORIZON = 200, EPISODES = 20;
const SEEDS = [1501, 1502, 1503, 1504, 1505, 1506, 1507, 1508,
  1509, 1510, 1511, 1512, 1513, 1514, 1515, 1516];
const NAMES = ['дальше', 'ближе', 'деятельнее'];

function occupancy(w) {
  const h = new Float64Array(w.GX * w.GY);
  for (const c of w.cells) {
    const x = Math.max(0, Math.min(w.GX - 1, (c.x / w.CS) | 0));
    const y = Math.max(0, Math.min(w.GY - 1, (c.y / w.CS) | 0));
    h[y * w.GX + x] += 1;
  }
  return h;
}
function dist(a, b) {
  const ha = occupancy(a), hb = occupancy(b);
  let s = 0;
  for (let i = 0; i < ha.length; i++) s += Math.abs(ha[i] - hb[i]);
  return s / (a.cells.length + b.cells.length);
}
function grown(seed) {
  const w = createWorld({ seed, genome: ancestral() });
  for (let i = 0; i < GROW; i++) step(w);
  return w;
}
const runPolicy = (base, pick) =>
  branchRun(cloneWorld(base), { n: N, horizon: HORIZON, episodes: EPISODES, pick }).world;

console.log('ДЕЙСТВУЕТ ЛИ ВЫБОР -- ДВУСТОРОННЕЕ ПРАВИЛО, СВЕЖИЕ СИДЫ');
console.log(`${N} будущих по ${HORIZON} шагов, ${EPISODES} эпизодов, ${SEEDS.length} свежих сидов\n`);
console.log('  сид |    пол | дальше | ближе  | деятел | от основания: жребий/дальше/ближе/деят');

const rows = [];
for (const seed of SEEDS) {
  const base = grown(seed);
  const r1 = makeRNG(1000 + seed), r2 = makeRNG(7000 + seed);
  const lot1 = runPolicy(base, () => r1());
  const lot2 = runPolicy(base, () => r2());
  const floor = dist(lot1, lot2);
  const w = {}, fromBase = { жребий: dist(lot1, base) };
  for (const nm of NAMES) {
    const world = runPolicy(base, RULES[nm]());
    w[nm] = dist(world, lot1);
    fromBase[nm] = dist(world, base);
  }
  rows.push({ seed, floor, ...w, fromBase });
  console.log(`${String(seed).padStart(5)} | ${floor.toFixed(4)} | ${w['дальше'].toFixed(4)} | ` +
    `${w['ближе'].toFixed(4)} | ${w['деятельнее'].toFixed(4)} | ` +
    `${fromBase['жребий'].toFixed(3)}/${fromBase['дальше'].toFixed(3)}/` +
    `${fromBase['ближе'].toFixed(3)}/${fromBase['деятельнее'].toFixed(3)}`);
}

function pge(k, n) {
  const c = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  let s = 0; for (let i = k; i <= n; i++) s += c(n, i); return s / 2 ** n;
}
const n = rows.length;
const mean = (f) => (rows.reduce((s, r) => s + f(r), 0) / n).toFixed(4);

console.log(`\nсредние: пол ${mean((r) => r.floor)}, ` +
  NAMES.map((k) => `${k} ${mean((r) => r[k])}`).join(', '));
console.log(`от основания: жребий ${mean((r) => r.fromBase['жребий'])}, ` +
  NAMES.map((k) => `${k} ${mean((r) => r.fromBase[k])}`).join(', '));

console.log('\nдвусторонний знаковый счёт против пола:');
let any = false, none = true;
for (const nm of NAMES) {
  const up = rows.filter((r) => r[nm] > r.floor).length;
  const dn = n - up;
  const p = pge(Math.max(up, dn), n);
  const sig = p < 0.05;
  if (sig) { any = true; }
  if (sig) none = false;
  console.log(`  ${nm}: выше ${up}, ниже ${dn} из ${n}, p = ${p.toFixed(4)}` +
    (sig ? `  <- ДЕЙСТВУЕТ, ${up > dn ? 'ВВЕРХ (уводит дальше)' : 'ВНИЗ (удерживает ближе)'}` : ''));
}

console.log('\nасимметрия (объявленный заранее отдельный вопрос):');
const upFar = rows.filter((r) => r.fromBase['дальше'] > r.fromBase['жребий']).length;
const dnNear = rows.filter((r) => r.fromBase['ближе'] < r.fromBase['жребий']).length;
console.log(`  "дальше" уводит от основания сильнее жребия: ${upFar} из ${n}, p = ${pge(Math.max(upFar, n - upFar), n).toFixed(4)}`);
console.log(`  "ближе" держит у основания крепче жребия:    ${dnNear} из ${n}, p = ${pge(Math.max(dnNear, n - dnNear), n).toFixed(4)}`);

console.log(`\n${any ? 'ВЫБОР ДЕЙСТВУЕТ: правило доходит до мира через двадцать эпизодов'
  : (none ? 'ВЫБОР НЕ ДЕЙСТВУЕТ: ни одно правило от пола не отличается'
    : 'НЕ РАЗРЕШЕНО')}`);
console.log('Какое правило ЛУЧШЕ -- опыт не говорит: "лучше" требует цели, а цели нет.');

fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/choice2.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

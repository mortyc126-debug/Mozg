#!/usr/bin/env node
'use strict';
/* ============================================================
   СЛЕД ОПЫТА ПРОТИВ СВОБОДНОЙ АКТИВНОСТИ -- ВТОРАЯ РЕДАКЦИЯ ПРОБЫ

   ПЕРВАЯ РЕДАКЦИЯ (hold.js) НЕ СМОГЛА ЗАДАТЬ ВОПРОС, и причина названа
   числами, а не догадкой:

     спонтанная активность в окне пробы у живой ткани   244 агента из 560
     пол измерения (две одинаковые пробы подряд)        10-16 агентов
     вызванный отклик                                   единицы агентов

   Парный вычет убирает СРЕДНЕЕ спонтанной активности, но не её РАЗБРОС:
   при 244 агентах он порядка 16, и это ровно то, что наблюдалось. Сигнал
   на два порядка меньше шума, в котором его искали.

   Второй изъян: базовая проба снималась сразу после роста, пока ткань
   ещё не успокоилась. Оттого "до" в тихой ветви выходило -105, -99, -97
   -- это затухание остаточной активности, а не отклик. Удержание у тихой
   ветви (0.89 в среднем) было артефактом этого затухания.

   Ирония ровно обратная v0.59: там ткань была СЛИШКОМ ТИХА, чтобы задать
   вопрос; здесь -- СЛИШКОМ ШУМНА для такой пробы.

   ЧТО ИСПРАВЛЕНО, и оба исправления объявлены до запуска:

   1. ПРОБА УСРЕДНЯЕТСЯ. Парная проба повторяется K = 20 раз, отклик есть
      среднее по ним. Разброс среднего падает как корень: при поле 16 у
      одиночной пробы у среднего из двадцати он около 3.6. Рядом печатается
      ИЗМЕРЕННЫЙ пол -- разброс среднего по двадцати холостым пробам, --
      а не предполагаемый (урок №42).
   2. ТКАНЬ УСПОКАИВАЕТСЯ. После роста и оглушения идут SETTLE = 800
      шагов до первой пробы, чтобы остаточная активность роста угасла.

   ДОБАВЛЕНА ПРОВЕРКА, КОТОРОЙ ПРАВИЛУ НЕДОСТАВАЛО. Прежде ткань шла в
   счёт при gain > 0 -- любой малости. Теперь требуется, чтобы прирост от
   обучения ПРЕВЫШАЛ ИЗМЕРЕННЫЙ ПОЛ: gain > 2 * floor. Иначе делить на
   шум, и keep ничего не значит. Это та самая проверка, отсутствие
   которой уже дважды печатало вердикт в этой линии (ошибка №49).

   ПРАВИЛО ЧТЕНИЯ, В ОСТАЛЬНОМ ПРЕЖНЕЕ И ОБЪЯВЛЕННОЕ ДО ЗАПУСКА:
     keep = (later - before) / (after - before)
     * ткань в счёт, если gain > 2 * floor В ОБЕИХ ветвях;
     * СЛЕД ДЕРЖИТСЯ в ветви, если keep >= 0.5 у большинства при
       биномиальном p < 0.05;
     * ЖИЗНЬ СТИРАЕТ СЛЕД, если keep(живая) < keep(тихая) у такого же
       большинства;
     * иначе НЕ РАЗРЕШЕНО.
     * если в счёт попадает меньше 5 тканей -- вердикт не выносится, и
       это ответ о ПРОБЕ, а не о ткани.
   ОБА ИСХОДА СОДЕРЖАТЕЛЬНЫ.
   ============================================================ */
const fs = require('fs');
const { createWorld, step, stimulate } = require('../src/world');
const { ancestral, mutate } = require('../src/genome');
const { makeRNG } = require('../src/rng');
const { sites } = require('../src/probe');

const GROW = 1600, SETTLE = 800, FREE = 2000, WIN = 110, K = 20;
const TRIALS = 8, GAP = 130, WSEED = 5;
const TIERS = [0.03, 0.06, 0.12, 0.20];

function run(w, n) { for (let i = 0; i < n; i++) step(w); }

function countFired(w, t0) { let n = 0; for (const c of w.cells) if (c.fired >= t0) n++; return n; }

/* одна парная проба: окно без воздействия, затем окно с ним */
function once(w, p, amp) {
  let t0 = w.t; run(w, WIN); const n0 = countFired(w, t0);
  t0 = w.t; if (amp > 0) stimulate(w, p.x, p.y, amp); run(w, WIN);
  return { n0, ev: countFired(w, t0) - n0 };
}

/* усреднённая проба: K повторов; заодно возвращает пол -- разброс
   среднего по K ХОЛОСТЫМ парам (воздействия нет вовсе) */
function probe(w, p) {
  const ev = [], blank = [], sp = [];
  for (let k = 0; k < K; k++) { const r = once(w, p, 1.0); ev.push(r.ev); sp.push(r.n0); }
  for (let k = 0; k < K; k++) { const r = once(w, p, 0); blank.push(r.ev); }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
  return {
    evoked: mean(ev), floor: sd(blank) / Math.sqrt(K), spont: mean(sp),
    blankMean: mean(blank),
  };
}

function branch(genome, deaf) {
  const w = createWorld({ seed: WSEED, genome });
  run(w, GROW);
  if (deaf) for (const e of w.genome.eff) for (const f of [0, 1, 2]) e.sens[f] = 0;
  run(w, SETTLE);
  const p = sites(w)[0];
  if (!p) return null;
  const before = probe(w, p);
  for (let k = 0; k < TRIALS; k++) { stimulate(w, p.x, p.y, 2.2); run(w, GAP); }
  const after = probe(w, p);
  run(w, FREE);
  const later = probe(w, p);
  const gain = after.evoked - before.evoked;
  const floor = Math.max(before.floor, after.floor, later.floor);
  return {
    before: before.evoked, after: after.evoked, later: later.evoked,
    gain, floor, spont: later.spont, blank: later.blankMean,
    keep: gain !== 0 ? (later.evoked - before.evoked) / gain : NaN,
    counted: gain > 2 * floor,
  };
}

const rows = [];
for (const f of fs.readdirSync('results').filter((x) => /^own_\d+\.jsonl$/.test(x)))
  for (const l of fs.readFileSync(`results/${f}`, 'utf8').trim().split('\n')) rows.push(JSON.parse(l));
const ownLive = rows.filter((r) => r.alive && r.cls === 'ЖИВЁТ СВОИМ').sort((a, b) => a.i - b.i);

const base = ancestral();
const mk = (i) => mutate(base, makeRNG(9000 + i), { pWeight: TIERS[i % 4], pEff: TIERS[i % 4] });

console.log('СЛЕД ОПЫТА ПРОТИВ СВОБОДНОЙ АКТИВНОСТИ -- ВТОРАЯ РЕДАКЦИЯ ПРОБЫ');
console.log(`проба усредняется по ${K} повторам, успокоение ${SETTLE} шагов, ` +
  `свободный бег ${FREE}\n`);
console.log('    № |              ЖИВАЯ               |              ТИХАЯ               |');
console.log('      |   до   после  потом  пол   keep  |   до   после  потом  пол   keep  | счёт');

const pairs = [];
for (const r of ownLive) {
  const a = branch(mk(r.i), false), b = branch(mk(r.i), true);
  if (!a || !b) continue;
  const ok = a.counted && b.counted;
  if (ok) pairs.push({ i: r.i, live: a, quiet: b });
  const f = (x) => `${x.before.toFixed(1).padStart(6)} ${x.after.toFixed(1).padStart(7)} ` +
    `${x.later.toFixed(1).padStart(6)} ${x.floor.toFixed(1).padStart(4)} ` +
    `${(Number.isFinite(x.keep) ? x.keep.toFixed(2) : '--').padStart(6)}`;
  console.log(`${String(r.i).padStart(5)} | ${f(a)} | ${f(b)} | ${ok ? 'да' : 'нет'}`);
}

function pge(k, n) {
  const c = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  let s = 0; for (let i = k; i <= n; i++) s += c(n, i); return s / 2 ** n;
}

console.log(`\nв счёт (прирост выше удвоенного пола в обеих ветвях): ${pairs.length} из ${ownLive.length}`);
console.log(`спонтанная активность в окне пробы: живая ` +
  `${(ownLive.length ? 0 : 0) || pairs.length ? (pairs.reduce((s, p) => s + p.live.spont, 0) / Math.max(1, pairs.length)).toFixed(0) : '--'} ` +
  `агентов, тихая ${pairs.length ? (pairs.reduce((s, p) => s + p.quiet.spont, 0) / pairs.length).toFixed(0) : '--'}`);

if (pairs.length >= 5) {
  const n = pairs.length;
  const hL = pairs.filter((p) => p.live.keep >= 0.5).length;
  const hQ = pairs.filter((p) => p.quiet.keep >= 0.5).length;
  const worse = pairs.filter((p) => p.live.keep < p.quiet.keep).length;
  const mean = (f) => pairs.reduce((s, p) => s + f(p), 0) / n;
  console.log(`\nсреднее keep: живая ${mean((p) => p.live.keep).toFixed(3)}, ` +
    `тихая ${mean((p) => p.quiet.keep).toFixed(3)}`);
  console.log(`держится: живая ${hL}/${n} (p = ${pge(Math.max(hL, n - hL), n).toFixed(4)}), ` +
    `тихая ${hQ}/${n} (p = ${pge(Math.max(hQ, n - hQ), n).toFixed(4)})`);
  console.log(`keep(живая) < keep(тихая): ${worse}/${n}, p = ${pge(Math.max(worse, n - worse), n).toFixed(4)}`);
  const sig = (k) => pge(Math.max(k, n - k), n) < 0.05;
  let v;
  if (sig(worse) && worse > n / 2) v = 'ЖИЗНЬ СТИРАЕТ СЛЕД';
  else if (sig(hL) && hL > n / 2) v = 'СЛЕД ДЕРЖИТСЯ И У ЖИВОЙ ТКАНИ';
  else if (sig(hL) && hL < n / 2) v = 'СЛЕД СЛАБЕЕТ у живой ткани';
  else v = 'НЕ РАЗРЕШЕНО';
  console.log(`\n${v}`);
} else {
  console.log('\nВЕРДИКТ НЕ ВЫНОСИТСЯ: тканей в счёт меньше пяти.');
  console.log('Это ответ О ПРОБЕ, а не о ткани: прирост от обучения не превышает');
  console.log('собственного шума измерения даже после усреднения по 20 повторам.');
}

fs.writeFileSync('results/hold2.jsonl', pairs.map((p) => JSON.stringify(p)).join('\n') + '\n');

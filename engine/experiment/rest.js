#!/usr/bin/env node
'use strict';
/* ============================================================
   ОБРАЗУЕТСЯ ЛИ СЛЕД В ЖИВОЙ ТКАНИ -- ИЛИ ЭТО УТОМЛЕНИЕ

   ОТКУДА. hold2.js вердикта не вынес (проба тонула в шуме), но в его
   таблице обнаружилось систематическое, о чём правило не спрашивало:

     ТИХАЯ ветвь: отклик после обучения ВЫРОС у 9 из 11, p = 0.033
     ЖИВАЯ ветвь: отклик после обучения УПАЛ  у 10 из 13, p = 0.046

   Одни ткани, один протокол; различие ровно одно -- живёт ли ткань между
   касаниями. Это было НАБЛЮДЕНИЕ, и засчитывать его было нельзя. Здесь
   оно проверяется правилом, объявленным заранее.

   ДВА ОБЪЯСНЕНИЯ, КОТОРЫЕ НАДО РАЗВЕСТИ ИЗМЕРЕНИЕМ:
     * СЛЕД НЕ ОБРАЗУЕТСЯ -- пластичности не за что зацепиться;
     * СЛЕД ЕСТЬ, НО ЕГО НЕ ВИДНО -- восемь сильных воздействий оставляют
       УТОМЛЕНИЕ (c.ad), и слабая проба сразу после обучения ловит его.
   Разводится ОТДЫХОМ: проба снимается сразу, через 500 и через 2000
   шагов. Утомление за это время спадает (ADEC = 0.94 за шаг), след --
   нет.

   ПОЧЕМУ ПОНАДОБИЛАСЬ НОВАЯ ПРОБА, и это не "мерить, пока не выйдет".
   Прежняя считала выстреливших ПО ВСЕЙ ткани: 244 агента спонтанно при
   отклике в единицы, разброс 16. Но воздействие накрывает около 27
   единиц, а ткань раскинута на 180x180; в радиусе 30 от точки всего 29
   агентов из 560. Значит вызванный отклик весь там, а спонтанный шум
   там впятеро меньше. Радиус взят чуть больше следа воздействия (27), а
   не подобран по данным.

   ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ ИНСТРУМЕНТА, ОБЪЯВЛЕН ДО ЗАПУСКА. В ТИХОЙ
   ветви уже известно, что обучение работает. Новая проба ОБЯЗАНА это
   воспроизвести: отклик после обучения выше базового у большинства при
   p < 0.05. Если не воспроизведёт -- инструмент негоден, и о живой
   ткани по нему НИЧЕГО не говорится. Так мера проверяется на случае с
   известным ответом, прежде чем применяться к неизвестному.

   ПРАВИЛО ЧТЕНИЯ ДЛЯ ЖИВОЙ ВЕТВИ (объявлено до запуска):
     * УТОМЛЕНИЕ, если сразу после обучения отклик НИЖЕ базового у
       большинства (p < 0.05) И после отдыха 2000 -- ВЫШЕ базового у
       большинства (p < 0.05);
     * СЛЕД НЕ ОБРАЗУЕТСЯ, если после отдыха 2000 отклик НЕ выше
       базового (знаковый счёт не проходит), притом что в тихой ветви он
       выше;
     * СЛЕД ЕСТЬ И БЕЗ ОТДЫХА, если отклик выше базового уже сразу;
     * иначе НЕ РАЗРЕШЕНО.
   ОБА ИСХОДА СОДЕРЖАТЕЛЬНЫ. "След не образуется" означало бы, что
   собственная активность и обучение в этой модели соперничают, и это
   надо знать, а не обходить.

   ОТБРАКОВКИ ТКАНЕЙ ЗДЕСЬ НЕТ НАРОЧНО. В hold2 порог "прирост выше
   удвоенного пола" отсеял 12 из 13, и вердикт стал невозможен. Знаковый
   счёт по тканям к поштучному шуму устойчив: если действие
   систематическое, знаки сойдутся. Пол печатается рядом, чтобы
   величины было с чем соотнести.
   ============================================================ */
const fs = require('fs');
const { createWorld, step, stimulate } = require('../src/world');
const { ancestral, mutate } = require('../src/genome');
const { makeRNG } = require('../src/rng');
const { sites } = require('../src/probe');

const GROW = 1600, SETTLE = 800, WIN = 110, K = 20;
const TRIALS = 8, GAP = 130, WSEED = 5;
const REST1 = 500, REST2 = 2000;
const NEAR = 30;                       // чуть больше следа воздействия (27)
const TIERS = [0.03, 0.06, 0.12, 0.20];

function run(w, n) { for (let i = 0; i < n; i++) step(w); }

function nearFired(w, p, t0) {
  let n = 0;
  for (const c of w.cells)
    if (c.fired >= t0 && Math.hypot(c.x - p.x, c.y - p.y) <= NEAR) n++;
  return n;
}

function once(w, p, amp) {
  let t0 = w.t; run(w, WIN); const a = nearFired(w, p, t0);
  t0 = w.t; if (amp > 0) stimulate(w, p.x, p.y, amp); run(w, WIN);
  return nearFired(w, p, t0) - a;
}

function probe(w, p) {
  const ev = [], blank = [];
  for (let k = 0; k < K; k++) ev.push(once(w, p, 1.0));
  for (let k = 0; k < K; k++) blank.push(once(w, p, 0));
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
  return { v: mean(ev), floor: sd(blank) / Math.sqrt(K) };
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
  const t0 = probe(w, p);
  run(w, REST1);
  const t1 = probe(w, p);
  run(w, REST2 - REST1);
  const t2 = probe(w, p);
  return { before: before.v, t0: t0.v, t1: t1.v, t2: t2.v, floor: before.floor };
}

const rows = [];
for (const f of fs.readdirSync('results').filter((x) => /^own_\d+\.jsonl$/.test(x)))
  for (const l of fs.readFileSync(`results/${f}`, 'utf8').trim().split('\n')) rows.push(JSON.parse(l));
const ownLive = rows.filter((r) => r.alive && r.cls === 'ЖИВЁТ СВОИМ').sort((a, b) => a.i - b.i);

const base = ancestral();
const mk = (i) => mutate(base, makeRNG(9000 + i), { pWeight: TIERS[i % 4], pEff: TIERS[i % 4] });

console.log('ОБРАЗУЕТСЯ ЛИ СЛЕД В ЖИВОЙ ТКАНИ -- ИЛИ ЭТО УТОМЛЕНИЕ');
console.log(`проба местная: агенты в радиусе ${NEAR} от точки, ${K} повторов`);
console.log(`отдых ${REST1} и ${REST2} шагов после обучения\n`);
console.log('    № |            ЖИВАЯ                 |            ТИХАЯ                 |');
console.log('      |  база  сразу  отдых1 отдых2  пол |  база  сразу  отдых1 отдых2  пол |');

const data = [];
for (const r of ownLive) {
  const a = branch(mk(r.i), false), b = branch(mk(r.i), true);
  if (!a || !b) continue;
  data.push({ i: r.i, live: a, quiet: b });
  const f = (x) => `${x.before.toFixed(1).padStart(5)} ${x.t0.toFixed(1).padStart(6)} ` +
    `${x.t1.toFixed(1).padStart(7)} ${x.t2.toFixed(1).padStart(6)} ${x.floor.toFixed(2).padStart(5)}`;
  console.log(`${String(r.i).padStart(5)} | ${f(a)} | ${f(b)} |`);
}

function pge(k, n) {
  const c = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  let s = 0; for (let i = k; i <= n; i++) s += c(n, i); return s / 2 ** n;
}
function signTest(name, pick) {
  const up = data.filter((d) => pick(d) > 0).length;
  const dn = data.filter((d) => pick(d) < 0).length;
  const n = up + dn;
  const p = n ? pge(Math.max(up, dn), n) : 1;
  console.log(`  ${name}: выше ${up}, ниже ${dn} из ${n}, p = ${p.toFixed(4)}`);
  return { up, dn, n, p, sig: p < 0.05 };
}

const n = data.length;
console.log(`\nтканей: ${n}\n`);
console.log('ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ ИНСТРУМЕНТА (тихая ветвь, ответ известен):');
const ctlNow = signTest('тихая, сразу после обучения против базы', (d) => d.quiet.t0 - d.quiet.before);
const ctlRest = signTest('тихая, после отдыха 2000 против базы', (d) => d.quiet.t2 - d.quiet.before);

if (!ctlNow.sig && !ctlRest.sig) {
  console.log('\nИНСТРУМЕНТ НЕГОДЕН: новая проба не воспроизвела обучение даже там,');
  console.log('где оно заведомо есть. О живой ткани по нему ничего не говорится.');
} else {
  console.log('\nЖИВАЯ ВЕТВЬ:');
  const now = signTest('сразу после обучения против базы', (d) => d.live.t0 - d.live.before);
  const r1 = signTest('после отдыха 500 против базы', (d) => d.live.t1 - d.live.before);
  const r2 = signTest('после отдыха 2000 против базы', (d) => d.live.t2 - d.live.before);
  const mean = (f) => (data.reduce((s, d) => s + f(d), 0) / n).toFixed(2);
  console.log(`\nсредние: живая база ${mean((d) => d.live.before)}, сразу ${mean((d) => d.live.t0)}, ` +
    `отдых1 ${mean((d) => d.live.t1)}, отдых2 ${mean((d) => d.live.t2)}`);
  console.log(`         тихая база ${mean((d) => d.quiet.before)}, сразу ${mean((d) => d.quiet.t0)}, ` +
    `отдых1 ${mean((d) => d.quiet.t1)}, отдых2 ${mean((d) => d.quiet.t2)}`);

  let v;
  if (now.sig && now.dn > now.up && r2.sig && r2.up > r2.dn) v = 'УТОМЛЕНИЕ: след есть, его закрывала усталость';
  else if (now.sig && now.up > now.dn) v = 'СЛЕД ЕСТЬ И БЕЗ ОТДЫХА';
  else if (!r2.sig && (ctlRest.sig || ctlNow.sig)) v = 'СЛЕД В ЖИВОЙ ТКАНИ НЕ ОБРАЗУЕТСЯ (в тихой -- образуется)';
  else v = 'НЕ РАЗРЕШЕНО';
  console.log(`\n${v}`);
}

fs.writeFileSync('results/rest.jsonl', data.map((d) => JSON.stringify(d)).join('\n') + '\n');

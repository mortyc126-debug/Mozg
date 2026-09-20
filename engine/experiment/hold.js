#!/usr/bin/env node
'use strict';
/* ============================================================
   ПЕРЕЖИВАЕТ ЛИ СЛЕД ОПЫТА СВОБОДНУЮ АКТИВНОСТЬ

   Строка 3 критерия зачатка цифрового мозга. В Python-линии она обрушила
   v0.59: вопрос НЕ БЫЛ ЗАДАН, потому что ткань между касаниями ничего не
   делала -- след ничему не подвергался, и "держится" означало лишь "с ним
   ничего не происходило". Этап 14 нашёл в движке ткани, которые живут
   между касаниями собственным голосом. На них вопрос впервые задаваем.

   СЛЕД БЕРЁТСЯ НЕ МОЙ, А ДВИЖКОВЫЙ. test/parity.js принимает ядро по
   критерию "отклик растёт от повторов" (src/probe.js::plasticity): слабая
   проба -> восемь сильных воздействий -> та же слабая проба. Это
   собственное приёмное испытание движка, и оно не подгонялось под этот
   опыт.

   ПОПРАВКА, БЕЗ КОТОРОЙ МЕРА НЕГОДНА. probe.js::respond считает ВСЕХ
   агентов, выстреливших за окно, -- в том числе от спонтанной активности.
   У живой ткани это большая доля, и прирост отклика утонул бы в ней.
   Поэтому проба здесь ПАРНАЯ: сперва 110 шагов БЕЗ воздействия (n0),
   затем воздействие и 110 шагов (n1), отклик = n1 - n0. Окна равной
   длины и соседние во времени; это не идеальный, но честный вычет, и он
   назван, а не умолчан.

   УСТРОЙСТВО. Для каждой ткани ДВЕ ветви, отличающиеся ровно одним:

     ЖИВАЯ -- как есть, между касаниями ткань живёт;
     ТИХАЯ -- та же ткань, оглушённая к своим полям (sens[0..2] = 0)
              сразу после роста. Слух к воздействию (поле 4) цел, поэтому
              обучение идёт так же, а вот собственная жизнь гаснет.

   Это ПАРНЫЙ контроль на одном геноме и одном росте: единственное
   различие -- происходит ли что-нибудь между касаниями. Ровно то, чего
   не было в v0.59, где сравнивать было не с чем.

   Ход каждой ветви:
     рост 1600 -> проба (before) -> обучение 8 повторов -> проба (after)
     -> СВОБОДНЫЕ 2000 шагов -> проба (later)

   Удержание: keep = (later - before) / (after - before).
     keep = 1 -- след цел; keep = 0 -- от него ничего не осталось.

   ПРАВИЛО ЧТЕНИЯ, ОБЪЯВЛЕНО ДО ЗАПУСКА:
     * ткань в счёт, только если обучение произошло В ОБЕИХ ветвях
       (after > before), иначе меряется шум;
     * СЛЕД ДЕРЖИТСЯ в ветви, если keep >= 0.5 у большинства тканей при
       биномиальном p < 0.05 (при 13 тканях это 10 из 13);
     * СЛЕД СЛАБЕЕТ -- если keep < 0.5 у такого же большинства;
     * ЖИЗНЬ СТИРАЕТ СЛЕД, если keep(живая) < keep(тихая) у 10 из 13;
     * иначе НЕ РАЗРЕШЕНО, и это честный исход.
   ОБА ИСХОДА СОДЕРЖАТЕЛЬНЫ. "Жизнь стирает след" -- такой же ответ, как
   и обратный: он означал бы, что память и собственная активность в этой
   модели соперничают, и это надо знать.

   ПОЛ ИЗМЕРЕНИЯ меряется, а не предполагается: две пробы подряд без
   всякого вмешательства между ними дают разброс самой пробы.

   ГРУППА БЕЗ КОНТРОЛЯ. Ткани "эхо по связям" тоже живут между касаниями,
   но оглушить их нельзя -- их активность держится на сети, а не на
   ощущении. Для них парного контроля не существует, поэтому их числа
   печатаются ОТДЕЛЬНО и в вердикт не входят.
   ============================================================ */
const fs = require('fs');
const { createWorld, step, stimulate } = require('../src/world');
const { ancestral, mutate } = require('../src/genome');
const { makeRNG } = require('../src/rng');
const { sites } = require('../src/probe');

const GROW = 1600, FREE = 2000, WIN = 110, TRIALS = 8, GAP = 130;
const TIERS = [0.03, 0.06, 0.12, 0.20];
const WSEED = 5;

function run(w, n) { for (let i = 0; i < n; i++) step(w); }

/* парная проба: окно без воздействия, затем окно с ним */
function probe(w, p) {
  let t0 = w.t;
  run(w, WIN);
  let n0 = 0;
  for (const c of w.cells) if (c.fired >= t0) n0++;
  t0 = w.t;
  stimulate(w, p.x, p.y, 1.0);
  run(w, WIN);
  let n1 = 0;
  for (const c of w.cells) if (c.fired >= t0) n1++;
  return { n0, n1, evoked: n1 - n0 };
}

function branch(genome, deaf) {
  const w = createWorld({ seed: WSEED, genome });
  run(w, GROW);
  if (deaf) for (const e of w.genome.eff) for (const f of [0, 1, 2]) e.sens[f] = 0;
  const p = sites(w)[0];
  if (!p) return null;
  const before = probe(w, p);
  const floor = probe(w, p);                    // пол: та же проба сразу следом
  for (let k = 0; k < TRIALS; k++) { stimulate(w, p.x, p.y, 2.2); run(w, GAP); }
  const after = probe(w, p);
  run(w, FREE);                                 // ткань живёт сама
  const later = probe(w, p);
  const gain = after.evoked - before.evoked;
  return {
    before: before.evoked, floor: floor.evoked, after: after.evoked,
    later: later.evoked, gain,
    keep: gain !== 0 ? (later.evoked - before.evoked) / gain : NaN,
    spontBefore: before.n0, spontLater: later.n0,
  };
}

/* кого берём: классы из опыта own.js */
const rows = [];
for (const f of fs.readdirSync('results').filter((x) => /^own_\d+\.jsonl$/.test(x)))
  for (const l of fs.readFileSync(`results/${f}`, 'utf8').trim().split('\n'))
    rows.push(JSON.parse(l));
const ownLive = rows.filter((r) => r.alive && r.cls === 'ЖИВЁТ СВОИМ').sort((a, b) => a.i - b.i);
const echo = rows.filter((r) => r.alive && r.cls === 'ЭХО ПО СВЯЗЯМ').sort((a, b) => a.i - b.i);

const base = ancestral();
const mk = (i) => mutate(base, makeRNG(9000 + i), { pWeight: TIERS[i % 4], pEff: TIERS[i % 4] });

console.log('ПЕРЕЖИВАЕТ ЛИ СЛЕД ОПЫТА СВОБОДНУЮ АКТИВНОСТЬ');
console.log(`живущих своим ${ownLive.length}, эхо ${echo.length}; свободный бег ${FREE} шагов\n`);
console.log('    № |          ЖИВАЯ ветвь           |          ТИХАЯ ветвь           |');
console.log('      | до  пол  после  потом   keep   | до  пол  после  потом   keep   | в счёт');

const pairs = [];
for (const r of ownLive) {
  const a = branch(mk(r.i), false);
  const b = branch(mk(r.i), true);
  if (!a || !b) continue;
  const ok = a.gain > 0 && b.gain > 0;
  if (ok) pairs.push({ i: r.i, live: a, quiet: b });
  const fmt = (x) => `${String(x.before).padStart(3)} ${String(x.floor).padStart(4)} ` +
    `${String(x.after).padStart(6)} ${String(x.later).padStart(6)} ` +
    `${(Number.isFinite(x.keep) ? x.keep.toFixed(2) : '  --').padStart(7)}`;
  console.log(`${String(r.i).padStart(5)} | ${fmt(a)} | ${fmt(b)} | ${ok ? 'да' : 'НЕТ (обучения нет)'}`);
}

function pge(k, n) {
  const c = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  let s = 0; for (let i = k; i <= n; i++) s += c(n, i);
  return s / 2 ** n;
}

console.log(`\nв счёт тканей: ${pairs.length} из ${ownLive.length}`);
if (pairs.length >= 5) {
  const n = pairs.length;
  const holdLive = pairs.filter((p) => p.live.keep >= 0.5).length;
  const holdQuiet = pairs.filter((p) => p.quiet.keep >= 0.5).length;
  const worse = pairs.filter((p) => p.live.keep < p.quiet.keep).length;
  const mean = (f) => (pairs.reduce((s, p) => s + f(p), 0) / n);
  console.log(`\nсреднее keep: живая ${mean((p) => p.live.keep).toFixed(3)}, ` +
    `тихая ${mean((p) => p.quiet.keep).toFixed(3)}`);
  console.log(`след держится (keep >= 0.5): живая ${holdLive}/${n} (p = ${pge(Math.max(holdLive, n - holdLive), n).toFixed(4)}), ` +
    `тихая ${holdQuiet}/${n} (p = ${pge(Math.max(holdQuiet, n - holdQuiet), n).toFixed(4)})`);
  console.log(`keep(живая) < keep(тихая): ${worse}/${n}, p = ${pge(Math.max(worse, n - worse), n).toFixed(4)}`);
  console.log(`спонтанная активность в окне пробы: живая ${mean((p) => p.live.spontLater).toFixed(1)} ` +
    `агентов, тихая ${mean((p) => p.quiet.spontLater).toFixed(1)}`);

  const sig = (k) => pge(Math.max(k, n - k), n) < 0.05;
  let v;
  if (sig(worse) && worse > n / 2) v = 'ЖИЗНЬ СТИРАЕТ СЛЕД: у живой ветви удержание ниже';
  else if (sig(holdLive) && holdLive > n / 2) v = 'СЛЕД ДЕРЖИТСЯ И У ЖИВОЙ ТКАНИ';
  else if (sig(holdLive) && holdLive < n / 2) v = 'СЛЕД СЛАБЕЕТ у живой ткани';
  else v = 'НЕ РАЗРЕШЕНО';
  console.log(`\n${v}`);
} else {
  console.log('\nтканей в счёт меньше пяти -- вердикт не выносится');
}

console.log('\nЭХО ПО СВЯЗЯМ -- без парного контроля, в вердикт не входят:');
const echoRows = [];
for (const r of echo) {
  const a = branch(mk(r.i), false);
  if (!a) continue;
  echoRows.push({ i: r.i, ...a });
  console.log(`${String(r.i).padStart(5)} | до ${String(a.before).padStart(3)} после ` +
    `${String(a.after).padStart(4)} потом ${String(a.later).padStart(4)} | keep ` +
    `${Number.isFinite(a.keep) ? a.keep.toFixed(2) : '--'}${a.gain > 0 ? '' : '  (обучения нет)'}`);
}

fs.writeFileSync('results/hold.jsonl',
  pairs.map((p) => JSON.stringify(p)).concat(echoRows.map((r) => JSON.stringify({ echo: true, ...r }))).join('\n') + '\n');

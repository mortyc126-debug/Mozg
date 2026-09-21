#!/usr/bin/env node
'use strict';
/* ============================================================
   ДЕРЖИТ ЛИ СЕТЬ РАЗЛИЧИЕ ИЛИ ОНО ПРОСТО ЛЕЖИТ

   Правила чтения -- HOLD_SPEC.md, объявлены до этого файла.

   Впрыск различия (порча записи) идёт до круга 10000, потом
   выключается. В этот миг мир раздваивается: СВОЙ -- как есть;
   ПЕРЕМЕШАННЫЙ -- состояния переставлены между узлами ТОГО ЖЕ графа.

   Мера: приведённое время удержания -- площадь под кривой избытка
   различия за 100 кругов, делённая на избыток в миг выключения.
   ============================================================ */
const fs = require('fs');
const { execFileSync } = require('child_process');

const BUILD = 10000, WINDOW = 100;
const SEEDS = Array.from({ length: 48 }, (_, i) => 601 + i);
const LIVE_READS = 20, LIVE_DEG = 0.5, DRAWS = 10000;

if (process.env.CHILD) {
  const base = { CAP: '64', BASE: '0.05', HOLD: '0.1', TAX: '40', LEARN: '0.1',
    W: '20', HEAD: '20', GRACE: '30' };
  Object.assign(process.env, base);
  const sterile = process.env.STERILE === '1';
  process.env.ROT = sterile ? '0' : '0.05';
  process.env.ROT_UNTIL = String(BUILD);
  const G = require('../grow.js');
  const { makeRNG } = require('../../src/rng');
  const seed = +process.env.SEED, perm = process.env.PERM === '1';

  const spread = (w) => {
    const P = w.parts; let s = 0, n = 0;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { s += G.dist(P[i].x, P[j].x); n++; }
    return s / n;
  };

  const w = G.createSeed(seed, false);
  G.watch(w);
  for (let r = 0; r < BUILD; r++) G.round(w);

  if (sterile) {
    // пол: тот же сид, та же длина, впрыска не было вовсе
    let s = 0;
    for (let r = 0; r < WINDOW; r++) { G.round(w); s += spread(w); }
    process.stdout.write(JSON.stringify({ floor: s / WINDOW }));
    return;
  }

  // ПЕРЕСТАНОВКА СОСТОЯНИЙ между узлами того же графа. Свой рукав --
  // тождественная перестановка. Числа для неё из отдельного потока,
  // чтобы собственный поток мира не сдвинулся.
  const aux = makeRNG((seed * 104729 + 7) >>> 0);
  const P = w.parts;
  const order = P.map((_, i) => i);
  if (perm) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(aux() * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }
  }
  const xs = P.map((p) => Float64Array.from(p.x));
  for (let i = 0; i < P.length; i++) { P[i].x.set(xs[order[i]]); P[i].prev.set(xs[order[i]]); }
  // ожидания сбрасываются к состоянию держателя В ОБОИХ рукавах
  for (const p of P) for (const l of p.links) if (l.e) l.e.set(p.x);

  const at0 = spread(w);
  const curve = [];
  G.watch(w);
  for (let r = 0; r < WINDOW; r++) { G.round(w); curve.push(spread(w)); }
  const st = w.stat;
  process.stdout.write(JSON.stringify({
    at0, curve, deg: P.reduce((a, p) => a + p.links.length, 0) / P.length,
    reads: st.readN / WINDOW,
  }));
  return;
}

function run(seed, env) {
  return JSON.parse(execFileSync(process.execPath, [__filename],
    { env: Object.assign({}, process.env, env, { CHILD: '1', SEED: String(seed) }),
      maxBuffer: 1 << 22 }).toString());
}
function signFlip(d) {
  const obs = Math.abs(d.reduce((a, b) => a + b, 0) / d.length);
  let ge = 0;
  for (let t = 0; t < DRAWS; t++) {
    let s = 0;
    for (const v of d) s += Math.random() < 0.5 ? v : -v;
    if (Math.abs(s / d.length) >= obs - 1e-15) ge++;
  }
  return (ge + 1) / (DRAWS + 1);
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

console.log('ДЕРЖИТ ЛИ СЕТЬ РАЗЛИЧИЕ ИЛИ ОНО ПРОСТО ЛЕЖИТ');
console.log(`впрыск до круга ${BUILD}, окно ${WINDOW} кругов, ${SEEDS.length} свежих сидов`);
console.log('правила чтения -- HOLD_SPEC.md, объявлены до прогона\n');

const rows = [];
for (const seed of SEEDS) {
  const fl = run(seed, { STERILE: '1', PERM: '0' }).floor;
  const own = run(seed, { STERILE: '0', PERM: '0' });
  const shf = run(seed, { STERILE: '0', PERM: '1' });
  const T = (r) => {
    const e0 = r.at0 - fl;
    if (!(e0 > 0)) return NaN;
    return r.curve.reduce((a, v) => a + Math.max(0, v - fl), 0) / e0;
  };
  const enough = own.at0 >= 1.5 * fl && shf.at0 >= 1.5 * fl;
  const decayed = (own.curve[WINDOW - 1] - fl) <= 0.5 * (own.at0 - fl)
    && (shf.curve[WINDOW - 1] - fl) <= 0.5 * (shf.at0 - fl);
  const livePass = own.reads >= LIVE_READS && own.deg >= LIVE_DEG
    && shf.reads >= LIVE_READS && shf.deg >= LIVE_DEG;
  rows.push({ seed, floor: fl, at0own: own.at0, at0shf: shf.at0,
    Town: T(own), Tshf: T(shf), alive: enough && decayed && livePass,
    enough, decayed, livePass, curveOwn: own.curve.slice(0, 20), curveShf: shf.curve.slice(0, 20) });
}

const live = rows.filter((r) => r.alive);
console.log(`ПРОВЕРКИ ПРИБОРА: годных сидов ${live.length} из ${rows.length}`);
console.log(`  различие было (>= 1.5 пола): ${rows.filter((r) => r.enough).length}`);
console.log(`  распад уложился в окно:      ${rows.filter((r) => r.decayed).length}`);
console.log(`  мир жив:                     ${rows.filter((r) => r.livePass).length}`);

if (!live.length) {
  console.log('\nВЕРДИКТА НЕТ: годных сидов нет. Это названный заранее исход.');
} else {
  console.log(`\nсредние по годным сидам:`);
  console.log(`  пол (стерильный прогон):        ${mean(live.map((r) => r.floor)).toFixed(5)}`);
  console.log(`  разброс в миг выключения:       своё ${mean(live.map((r) => r.at0own)).toFixed(5)}, ` +
    `перемешанное ${mean(live.map((r) => r.at0shf)).toFixed(5)}`);
  console.log(`  ОСНОВНАЯ, время удержания:      своё ${mean(live.map((r) => r.Town)).toFixed(2)} кругов, ` +
    `перемешанное ${mean(live.map((r) => r.Tshf)).toFixed(2)} кругов`);
  const c = (k) => mean(live.map((r) => r[k][0])).toFixed(4) + ' ' +
    mean(live.map((r) => r[k][4])).toFixed(4) + ' ' + mean(live.map((r) => r[k][9])).toFixed(4) +
    ' ' + mean(live.map((r) => r[k][19])).toFixed(4);
  console.log(`  кривая на кругах 1,5,10,20:     своё ${c('curveOwn')}`);
  console.log(`                                  перемеш. ${c('curveShf')}`);

  const d = live.map((r) => r.Town - r.Tshf);
  const p = signFlip(d);
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean(d)) ** 2, 0) / (d.length - 1));
  console.log(`\nОСНОВНАЯ МЕРА, знакопеременная перестановка:`);
  console.log(`  разность ${mean(d).toFixed(3)} круга, разброс ${sd.toFixed(3)}, ` +
    `дольше у своего на ${d.filter((v) => v > 0).length} из ${live.length}, p = ${p.toFixed(5)}`);
  if (p < 0.05 && mean(d) > 0) {
    console.log('\nСЕТЬ ДЕРЖИТ: размещение частей в сети продлевает жизнь различия.');
    console.log('ПРЕДСКАЗАНИЕ (HOLD_SPEC §6) НЕ СБЫЛОСЬ.');
  } else if (p < 0.05) {
    console.log('\nСЕТЬ СТИРАЕТ: собственное размещение ускоряет выравнивание, а случайное мешает.');
    console.log('ПРЕДСКАЗАНИЕ (HOLD_SPEC §6) НЕ СБЫЛОСЬ.');
  } else {
    console.log('\nСЕТЬ НЕ ДЕРЖИТ НИЧЕГО: различие распадается одинаково, как его ни разложи.');
    console.log('Оно лежало, а не хранилось. ПРЕДСКАЗАНИЕ (HOLD_SPEC §6) СБЫЛОСЬ.');
  }
  console.log('\nСтрока 3 RUDIMENT_SPEC этим не закрывается: десятки кругов -- эхо, не след.');
}
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/hold_diff.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

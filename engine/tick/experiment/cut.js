#!/usr/bin/env node
'use strict';
/* ============================================================
   ЗАМКНУТА ЛИ ПЕТЛЯ -- ВМЕШАТЕЛЬСТВОМ, А НЕ НАБЛЮДЕНИЕМ

   Черновик. Мера шага 18 снята как негодная (стенд: 0.43 на пустых
   числах). Здесь наблюдение заменено вмешательством -- приёмом,
   который в шаге 13 один и развёл два объяснения.

   ЗАМЫСЕЛ. На круге BUILD мир раздваивается. В одном рукаве части
   ПОДМЕНЯЮТ КРУГ: их связи переписываются на случайных других, число
   связей то же. В другом -- всё идёт как шло. Дальше оба рукава живут
   GAP кругов, и смотрится, НАСКОЛЬКО РАЗОШЛИСЬ АДРЕСА тех частей,
   кому круг подменили.

   Если петля замкнута, подмена круга меняет то, чем часть станет.
   Если нет -- адрес пойдёт своим путём, будто ничего не случилось.

   ПУСТЫШКА, ДАЮЩАЯ НОЛЬ ПО ПОСТРОЕНИЮ: та же подмена, но связи
   переписываются на ТЕ ЖЕ САМЫЕ. Рукава обязаны совпасть ПОБИТОВО, и
   расхождение обязано быть ровно 0. Это и есть испытание меры на
   пустых числах, встроенное в опыт.

   ОТСЧЁТ ВНУТРИ ОПЫТА: LOOP = 0. Там подпись набирается не встречами,
   а своими событиями, значит круг на неё влиять почти не может.
   ============================================================ */
const fs = require('fs');
const { execFileSync } = require('child_process');
const BUILD = 6000, GAP = 2000, SHARE = 0.5;
const SEEDS = [1201, 1202, 1203, 1204, 1205, 1206];

if (process.env.CHILD) {
  Object.assign(process.env, { CAP: '64', BASE: '0.05', HOLD: '0.1', TAX: '40',
    LEARN: '0.1', W: '20', HEAD: '20', GRACE: '30', ROT: '0.01',
    ROT_UNTIL: '999999', PUSH: '1', MIX0: '-0.3', MARKS: '1', HOPS: '1',
    ANCHOR: '0.5', ANCHOR_OWN: '1', KIN: '1' });
  process.env.LOOP = process.env.LL;
  const G = require('../grow.js');
  const { makeRNG } = require('../../src/rng');
  const K = G.K;
  const seed = +process.env.SEED, mode = process.env.MODE;  // 'none' | 'sham' | 'cut'
  const w = G.createSeed(seed, false);
  for (let r = 0; r < BUILD; r++) G.round(w);

  const P = w.parts, N = P.length;
  // кому подменяем круг -- решается ОТДЕЛЬНЫМ потоком, одинаково во всех рукавах
  const aux = makeRNG((seed * 2654435761 + 3) >>> 0);
  const touched = [];
  for (let i = 0; i < N; i++) if (aux() < SHARE) touched.push(i);
  if (mode !== 'none') {
    for (const i of touched) {
      const p = P[i];
      const n = p.links.length;
      const fresh = [];
      for (let t = 0; t < n; t++) fresh.push(Math.floor(aux() * N));   // числа тратятся всегда
      if (mode === 'cut') {
        for (let t = 0; t < n; t++) if (fresh[t] !== i) p.links[t].j = fresh[t];
      }
      // при 'sham' связи остаются прежними, но случайные числа истрачены те же
    }
  }
  for (let r = 0; r < GAP; r++) G.round(w);
  const ad = P.map((p) => G.addrOf(w, p));
  const st = P.map((p) => Array.from(p.x));
  process.stdout.write(JSON.stringify({ ad, st, touched,
    deg: P.reduce((a, p) => a + p.links.length, 0) / N }));
  return;
}

const run = (seed, ll, mode) => JSON.parse(execFileSync(process.execPath, [__filename],
  { env: Object.assign({}, process.env, { CHILD: '1', SEED: String(seed), LL: String(ll), MODE: mode }),
    maxBuffer: 1 << 24 }).toString());
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

function diverge(a, b, idx) {
  let s = 0;
  for (const i of idx) s += Math.abs(a.ad[i] - b.ad[i]);
  return s / idx.length;
}
function divState(a, b, idx) {
  let s = 0;
  for (const i of idx) {
    let d = 0;
    for (let k = 0; k < a.st[i].length; k++) d += Math.abs(a.st[i][k] - b.st[i][k]);
    s += d / a.st[i].length;
  }
  return s / idx.length;
}

console.log('ЗАМКНУТА ЛИ ПЕТЛЯ -- ВМЕШАТЕЛЬСТВОМ');
console.log(`${BUILD} кругов, затем подмена круга у половины частей, затем ${GAP} кругов`);
console.log(`${SEEDS.length} сидов\n`);

const rows = [];
for (const ll of [0, 1]) {
  const shamA = [], cutA = [], cutOther = [], cutSt = [], shamSt = [];
  for (const seed of SEEDS) {
    const base = run(seed, ll, 'none');
    const sham = run(seed, ll, 'sham');
    const cut = run(seed, ll, 'cut');
    const t = base.touched, o = base.ad.map((_, i) => i).filter((i) => !t.includes(i));
    shamA.push(diverge(base, sham, t));
    cutA.push(diverge(base, cut, t));
    cutOther.push(diverge(base, cut, o));
    shamSt.push(divState(base, sham, t));
    cutSt.push(divState(base, cut, t));
  }
  rows.push({ loop: ll, shamA, cutA, cutOther, cutSt, shamSt });
  console.log(`петля ${ll ? 'есть' : 'нет '}:`);
  console.log(`  ПУСТЫШКА (подмена на те же связи): адрес разошёлся на ${mean(shamA).toExponential(2)}, ` +
    `состояние на ${mean(shamSt).toExponential(2)}` +
    (mean(shamA) === 0 && mean(shamSt) === 0 ? '   <- ровно ноль, как и обязано' : '   <- НЕ НОЛЬ, мера негодна'));
  console.log(`  ПОДМЕНА КРУГА: адрес разошёлся на ${mean(cutA).toFixed(4)}, ` +
    `состояние на ${mean(cutSt).toFixed(4)}`);
  console.log(`  у нетронутых частей адрес разошёлся на ${mean(cutOther).toFixed(4)}`);
}

const a = rows[0], b = rows[1];
console.log(`\nадрес после подмены круга: без петли ${mean(a.cutA).toFixed(4)}, с петлёй ${mean(b.cutA).toFixed(4)}` +
  `  -- в ${(mean(b.cutA) / mean(a.cutA)).toFixed(1)} раза`);
console.log(`состояние после подмены:   без петли ${mean(a.cutSt).toFixed(4)}, с петлёй ${mean(b.cutSt).toFixed(4)}` +
  `  -- в ${(mean(b.cutSt) / mean(a.cutSt)).toFixed(1)} раза`);
console.log('\nсостояние обязано разойтись в обоих случаях: круг решает, кого часть читает.');
console.log('Адрес -- только если петля замкнута: иначе подпись набирается не встречами.');
console.log('\nПравил чтения не объявлено, вердиктов нет. Это описание прогона.');
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/cut.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

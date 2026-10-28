#!/usr/bin/env node
'use strict';
/* ============================================================
   ШАГ 1 ПЛАНА, ПЕРЕИГРАННЫЙ НА ПОДЛОЖКЕ, КОТОРАЯ ДЕРЖИТ

   Правила чтения -- TAX_SPEC3.md, объявлены до этого файла.
   Вердикт шага 7 («не доходит») остаётся в силе для подложки без
   отсрочки и здесь не пересматривается.

   ОСНОВНАЯ МЕРА: избыток взаимности над случайным графом той же
   степени -- доля взаимных связей минус deg/(N-1). Плотность вычтена,
   иначе при степени 18 она подделалась бы под взаимность.

   Проверка по величине: знакопеременная перестановка разностей по
   сидам. Три проверки прибора до вердикта, включая новую -- медианная
   жизнь связи не ниже 400 кругов.
   ============================================================ */
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROUNDS = 20000;
const SEEDS = Array.from({ length: 48 }, (_, i) => 301 + i);
const LIVE_READS = 20, LIVE_DEG = 0.5, SPREAD_MIN = 0.20, LIFE_MIN = 400;
const DRAWS = 10000;
const WORLDS = [['свой', { SHUF: '0' }], ['перемешанный', { SHUF: '1' }]];

if (process.env.CHILD) {
  process.env.CAP = '64'; process.env.BASE = '0.05'; process.env.HOLD = '0.1';
  process.env.TAX = '40'; process.env.LEARN = '0.1';
  process.env.W = '20'; process.env.HEAD = '20'; process.env.GRACE = '30';
  const G = require('../grow.js');
  const seed = +process.env.SEED, shuffle = process.env.SHUF === '1';
  const w = G.createSeed(seed, shuffle);
  const from = Math.floor(ROUNDS * 0.75);

  // жизнь связей меряется поштучно на последней четверти: средняя по
  // сброшенным лжёт, если сброс редок (шаг 9 считал именно её)
  const lives = [];
  for (let r = 0; r < ROUNDS; r++) {
    if (r === from) G.watch(w);
    let before = null;
    if (r >= from) { before = new Set(); for (const p of w.parts) for (const l of p.links) before.add(l); }
    G.round(w);
    if (before) {
      const now = new Set();
      for (const p of w.parts) for (const l of p.links) now.add(l);
      for (const l of before) if (!now.has(l)) lives.push(w.round - l.born);
    }
  }
  lives.sort((a, b) => a - b);
  const P = w.parts, N = P.length, st = w.stat;

  const out = new Map(P.map((p) => [p.id, new Set(p.links.map((l) => l.j))]));
  let links = 0, mutual = 0;
  const inDeg = new Map(P.map((p) => [p.id, 0]));
  for (const p of P) for (const l of p.links) {
    links++; inDeg.set(l.j, (inDeg.get(l.j) || 0) + 1);
    const back = out.get(l.j);
    if (back && back.has(p.id)) mutual++;
  }
  const deg = links / N;
  const chance = deg / (N - 1);
  const ins = [...inDeg.values()].sort((a, b) => b - a);
  const topIn = links ? ins.slice(0, Math.max(1, Math.round(N * 0.1))).reduce((a, b) => a + b, 0) / links : NaN;

  const errs = [];
  for (const p of P) for (const l of p.links) if (l.err !== undefined) errs.push(l.err);
  errs.sort((a, b) => a - b);
  const qq = (f) => errs[Math.floor(f * (errs.length - 1))];
  const H = 0.1, T = 40;
  const spread = errs.length ? (H * T * (qq(0.9) - qq(0.1))) / (H * (1 + T * qq(0.5))) : 0;

  const lvl = [], fall = [];
  let inMeasure = 0;
  for (const p of P) for (const l of p.links) {
    if (!l || l.nr < 40) continue;
    inMeasure++;
    let last = 0; for (let i = 0; i < 20; i++) last += l.lBuf[i];
    lvl.push(last / 20);
    const early = (l.head[0] + l.head[1] + l.head[2]) / 3;
    let late = 0; for (let i = 10; i < 20; i++) late += l.head[i];
    fall.push(early - late / 10);
  }
  let dsum = 0, dn = 0;
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { dsum += G.dist(P[i].x, P[j].x); dn++; }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

  process.stdout.write(JSON.stringify({
    mutual: links ? mutual / links : NaN, chance,
    excess: links ? mutual / links - chance : NaN,
    deg, topIn, spread, n: inMeasure, links,
    lifeMedian: lives.length ? lives[Math.floor(lives.length / 2)] : Infinity,
    dropped: lives.length,
    readsPerRound: st.readN / (ROUNDS - from),
    readDist: st.readN ? st.readDist / st.readN : NaN,
    level: mean(lvl), fall: mean(fall), spreadState: dsum / dn,
  }));
  return;
}

function runWorld(seed, env) {
  const out = execFileSync(process.execPath, [__filename],
    { env: Object.assign({}, process.env, env, { CHILD: '1', SEED: String(seed) }), maxBuffer: 1 << 20 });
  return JSON.parse(out.toString());
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

console.log('ШАГ 1 ПЛАНА, ПЕРЕИГРАННЫЙ НА ПОДЛОЖКЕ, КОТОРАЯ ДЕРЖИТ');
console.log(`${ROUNDS} кругов, ${SEEDS.length} свежих сидов (301-348), отсрочка GRACE=30`);
console.log('правила чтения -- TAX_SPEC3.md, объявлены до прогона\n');

const rows = [];
console.log('  сид | избыток своё | избыток перемеш. | жизнь связи | связей/часть');
for (const seed of SEEDS) {
  const r = { seed };
  for (const [name, env] of WORLDS) r[name] = runWorld(seed, env);
  r.alive = WORLDS.every(([n]) => r[n].spread >= SPREAD_MIN && r[n].lifeMedian >= LIFE_MIN
    && r[n].readsPerRound >= LIVE_READS && r[n].deg >= LIVE_DEG);
  rows.push(r);
  console.log(`${String(seed).padStart(5)} | ${(r['свой'].excess * 100).toFixed(2).padStart(11)}% | ` +
    `${(r['перемешанный'].excess * 100).toFixed(2).padStart(15)}% | ` +
    `${String(r['свой'].lifeMedian).padStart(11)} | ${r['свой'].deg.toFixed(2).padStart(12)}` +
    (r.alive ? '' : '   <- не годен'));
}

const live = rows.filter((r) => r.alive);
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const m = (w, f) => mean(live.map((r) => f(r[w])));
console.log(`\nПРОВЕРКИ ПРИБОРА И ЖИВОСТИ: годных сидов ${live.length} из ${rows.length}`);
console.log(`  размах цены: своё ${(m('свой', (x) => x.spread) * 100).toFixed(1)}%, ` +
  `перемешанное ${(m('перемешанный', (x) => x.spread) * 100).toFixed(1)}% (нужно >= ${SPREAD_MIN * 100}%)`);
console.log(`  жизнь связи: своё ${m('свой', (x) => x.lifeMedian).toFixed(0)}, ` +
  `перемешанное ${m('перемешанный', (x) => x.lifeMedian).toFixed(0)} кругов (нужно >= ${LIFE_MIN})`);

if (!live.length) {
  console.log('\nВЕРДИКТА НЕТ: годных сидов нет. Это названный заранее исход.');
} else {
  console.log('\nсредние по годным сидам (описательное вердиктов не несёт):');
  const line = (lbl, f, d) => console.log(`  ${lbl.padEnd(32)} своё ${f(m('свой', d))}, перемешанное ${f(m('перемешанный', d))}`);
  line('ОСНОВНАЯ, избыток взаимности', (v) => (v * 100).toFixed(2) + '%', (x) => x.excess);
  line('  взаимность сырая', (v) => (v * 100).toFixed(2) + '%', (x) => x.mutual);
  line('  уровень случайного графа', (v) => (v * 100).toFixed(2) + '%', (x) => x.chance);
  line('связей на часть', (v) => v.toFixed(2), (x) => x.deg);
  line('прочтений за круг', (v) => v.toFixed(1), (x) => x.readsPerRound);
  line('связей в мере (40+ прочтений)', (v) => v.toFixed(0), (x) => x.n);
  line('уровень расхождения', (v) => v.toFixed(5), (x) => x.level);
  line('падение, окна 1-3 против 11-20', (v) => v.toFixed(5), (x) => x.fall);
  line('входящих у верхних 10%', (v) => (v * 100).toFixed(1) + '%', (x) => x.topIn);
  line('попарное расстояние состояний', (v) => v.toFixed(5), (x) => x.spreadState);

  const d = live.map((r) => r['свой'].excess - r['перемешанный'].excess);
  const p = signFlip(d);
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean(d)) ** 2, 0) / (d.length - 1));
  console.log(`\nОСНОВНАЯ МЕРА, знакопеременная перестановка:`);
  console.log(`  разность ${(mean(d) * 100).toFixed(3)} п.п., разброс ${(sd * 100).toFixed(3)}, ` +
    `выше у своего на ${d.filter((v) => v > 0).length} из ${live.length}, p = ${p.toFixed(5)}`);
  if (p < 0.05 && mean(d) > 0) {
    console.log('\nНАЛОГ ДОХОДИТ ДО УСТРОЙСТВА МИРА: пар, читающих друг друга, больше,');
    console.log('чем при слепом сбросе с тем же распределением издержек и той же плотностью.');
    console.log('ПРЕДСКАЗАНИЕ (TAX_SPEC3 §7) СБЫЛОСЬ.');
  } else if (p < 0.05) {
    console.log('\nНАЛОГ УВОДИТ МИР ОТ ПАР: осведомлённый сброс даёт взаимности МЕНЬШЕ слепого.');
    console.log('ПРЕДСКАЗАНИЕ (TAX_SPEC3 §7) НЕ СБЫЛОСЬ.');
  } else {
    console.log('\nНАЛОГ НЕ ДОХОДИТ И НА ПОДЛОЖКЕ, КОТОРАЯ ДЕРЖИТ.');
    console.log('Причина из шага 8 была не той либо не единственной. Переспрашивать нечем:');
    console.log('валюта выбрана неверно. ПРЕДСКАЗАНИЕ (TAX_SPEC3 §7) НЕ СБЫЛОСЬ.');
  }
  console.log('\nВердикт шага 7 этим не отменяется: он верен для подложки без отсрочки.');
  console.log('Ни одной строки RUDIMENT_SPEC не закрывается (TAX_SPEC3 §8).');
}

fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/tax3.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

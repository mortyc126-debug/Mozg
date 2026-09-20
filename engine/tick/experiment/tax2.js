#!/usr/bin/env node
'use strict';
/* ============================================================
   НАЛОГ НА РАСХОЖДЕНИЕ, ВТОРАЯ ПОСТАНОВКА

   Правила чтения -- TAX_SPEC2.md, объявлены до этого файла (cc7616a).
   Первая постановка признана ПУСТОЙ: вмешательство было неразличимо,
   окно меры не охватывало научения, а основная мера была круговой.

   ОСНОВНАЯ МЕРА: доля ВЗАИМНЫХ связей (i->j при существующем j->i).
   Правило налога взаимности не требует и не вознаграждает, поэтому
   разницу здесь нельзя получить определением меры.

   ПРОВЕРКА ПРИБОРА до вердикта: размах цены держания между 10% и 90%
   связей. Ниже 20% -- вердикта нет ни при каком знаке.

   TAX = 40 закреплён в спецификации по объявленному правилу калибровки.
   ============================================================ */
const fs = require('fs');

process.env.CAP = '64';
process.env.BASE = '0.05';
process.env.HOLD = '0.1';
process.env.TAX = '40';
process.env.LEARN = '0.1';
process.env.W = '20';
process.env.HEAD = '20';
const G = require('../grow.js');

const ROUNDS = 20000;
const SEEDS = (process.env.FRESH ? Array.from({ length: 32 }, (_, i) => 101 + i)
  : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
const W = G.W, TAX = G.TAX, HOLD = G.C_HOLD;
const LIVE_READS = 20, LIVE_DEG = 0.5, LIVE_LINKS = 30;
const SPREAD_MIN = 0.20;

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

function measure(seed, shuffle) {
  const w = G.createSeed(seed, shuffle);
  let reads = 0, roundsCounted = 0;
  const from = Math.floor(ROUNDS * 0.75);
  for (let r = 0; r < ROUNDS; r++) {
    G.round(w);
    if (r >= from) { roundsCounted++; for (const p of w.parts) reads += p.read; }
  }
  const P = w.parts;

  // ОСНОВНАЯ: взаимность. Плюс сосредоточенность входящих -- ступицы.
  const out = new Map(P.map((p) => [p.id, new Set(p.links.map((l) => l.j))]));
  const inDeg = new Map(P.map((p) => [p.id, 0]));
  let links = 0, mutual = 0;
  for (const p of P) for (const l of p.links) {
    links++;
    inDeg.set(l.j, (inDeg.get(l.j) || 0) + 1);
    const back = out.get(l.j);
    if (back && back.has(p.id)) mutual++;
  }
  const ins = [...inDeg.values()].sort((a, b) => b - a);
  const topIn = links ? ins.slice(0, Math.max(1, Math.round(P.length * 0.1)))
    .reduce((a, b) => a + b, 0) / links : NaN;

  // проверка прибора: размах цены между 10% и 90% связей
  const errs = [];
  for (const p of P) for (const l of p.links) if (l.err !== undefined) errs.push(l.err);
  errs.sort((a, b) => a - b);
  const qq = (f) => errs[Math.floor(f * (errs.length - 1))];
  const spread = errs.length
    ? (HOLD * (1 + TAX * qq(0.9)) - HOLD * (1 + TAX * qq(0.1))) / (HOLD * (1 + TAX * qq(0.5))) : 0;

  // описательные
  const lvl = [], fall = [], movLast = [], movFall = [];
  for (const p of P) for (const l of p.links) {
    if (!l || l.nr < 2 * W) continue;
    let last = 0, lm = 0;
    for (let i = 0; i < W; i++) { last += l.lBuf[i]; lm += l.lMov[i]; }
    lvl.push(last / W); movLast.push(lm / W);
    // исправленные окна: прочтения 1-3 против 11-20, по обе стороны схода
    const early = (l.head[0] + l.head[1] + l.head[2]) / 3;
    let late = 0; for (let i = 10; i < 20; i++) late += l.head[i];
    fall.push(early - late / 10);
    const eM = (l.headMov[0] + l.headMov[1] + l.headMov[2]) / 3;
    let lM = 0; for (let i = 10; i < 20; i++) lM += l.headMov[i];
    movFall.push(eM - lM / 10);
  }
  // среднее попарное расстояние состояний -- не сошёлся ли мир в точку
  let dsum = 0, dn = 0;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { dsum += G.dist(P[i].x, P[j].x); dn++; }

  return {
    parts: P.length, links, deg: links / P.length, readsPerRound: reads / roundsCounted,
    mutual: links ? mutual / links : NaN, topIn, spread, n: lvl.length,
    level: mean(lvl), fall: mean(fall), movLast: mean(movLast), movFall: mean(movFall),
    spreadState: dsum / dn,
  };
}

function pge(k, n) {
  const c = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  let s = 0; for (let i = k; i <= n; i++) s += c(n, i); return s / 2 ** n;
}

console.log('НАЛОГ НА РАСХОЖДЕНИЕ, ВТОРАЯ ПОСТАНОВКА');
console.log(`${ROUNDS} кругов, ${SEEDS.length} сидов, потолок ${process.env.CAP} частей, налог ${TAX}`);
console.log('правила чтения -- TAX_SPEC2.md, объявлены до прогона\n');

const rows = [];
console.log('  сид | связ/часть | чтений/круг | размах цены | взаимных своё | взаимных перемеш.');
for (const seed of SEEDS) {
  const own = measure(seed, false), shf = measure(seed, true);
  const alive = [own, shf].every((m) => m.readsPerRound >= LIVE_READS && m.deg >= LIVE_DEG && m.n >= LIVE_LINKS);
  rows.push({ seed, own, shf, alive });
  console.log(`${String(seed).padStart(5)} | ${own.deg.toFixed(2).padStart(10)} | ` +
    `${own.readsPerRound.toFixed(1).padStart(11)} | ${(own.spread * 100).toFixed(1).padStart(10)}% | ` +
    `${(own.mutual * 100).toFixed(2).padStart(12)}% | ${(shf.mutual * 100).toFixed(2).padStart(16)}%` +
    (alive ? '' : '   <- НЕ ЖИВ'));
}

const live = rows.filter((r) => r.alive);
const avgSpread = mean(live.map((r) => r.own.spread));
console.log(`\nПРЕДУСЛОВИЕ ЖИВОСТИ: прошли ${live.length} из ${rows.length}`);
console.log(`ПРОВЕРКА ПРИБОРА: средний размах цены ${(avgSpread * 100).toFixed(1)}% ` +
  `(нужно >= ${SPREAD_MIN * 100}%) -- ${avgSpread >= SPREAD_MIN ? 'вмешательство различимо' : 'ВМЕШАТЕЛЬСТВО НЕРАЗЛИЧИМО'}`);

if (!live.length || avgSpread < SPREAD_MIN) {
  console.log('\nВЕРДИКТА НЕТ: прибор или мир не годятся. Это названный заранее исход.');
} else {
  const m = (f) => mean(live.map(f));
  console.log('\nсредние по живым сидам (описательные меры вердиктов не несут):');
  console.log(`  ОСНОВНАЯ, доля взаимных связей: своё ${(m((r) => r.own.mutual) * 100).toFixed(2)}%, ` +
    `перемешанное ${(m((r) => r.shf.mutual) * 100).toFixed(2)}%`);
  console.log(`  входящих у верхних 10% частей:  своё ${(m((r) => r.own.topIn) * 100).toFixed(1)}%, ` +
    `перемешанное ${(m((r) => r.shf.topIn) * 100).toFixed(1)}%`);
  console.log(`  связей на часть:                своё ${m((r) => r.own.deg).toFixed(2)}, ` +
    `перемешанное ${m((r) => r.shf.deg).toFixed(2)}`);
  console.log(`  уровень расхождения (круговая): своё ${m((r) => r.own.level).toFixed(5)}, ` +
    `перемешанное ${m((r) => r.shf.level).toFixed(5)}`);
  console.log(`  падение, окна 1-3 против 11-20: своё ${m((r) => r.own.fall).toFixed(5)}, ` +
    `перемешанное ${m((r) => r.shf.fall).toFixed(5)}`);
  console.log(`  движение соседа к концу:        своё ${m((r) => r.own.movLast).toFixed(5)}, ` +
    `перемешанное ${m((r) => r.shf.movLast).toFixed(5)}`);
  console.log(`  попарное расстояние состояний:  своё ${m((r) => r.own.spreadState).toFixed(5)}, ` +
    `перемешанное ${m((r) => r.shf.spreadState).toFixed(5)}`);

  const up = live.filter((r) => r.own.mutual > r.shf.mutual).length;
  const dn = live.length - up;
  const p = pge(Math.max(up, dn), live.length);
  console.log(`\nОСНОВНАЯ МЕРА, знаковый счёт: взаимности больше своё ${up}, перемешанное ${dn} ` +
    `из ${live.length}, p = ${p.toFixed(5)}`);
  if (p < 0.05 && up > dn) {
    console.log('\nНАЛОГ СТРОИТ ТО, ЧЕГО В НЁМ НЕ ЗАПИСАНО: пар, читающих друг друга, больше,');
    console.log('чем при слепом сбросе с тем же распределением издержек.');
    console.log('ПРЕДСКАЗАНИЕ (TAX_SPEC2 §6) СБЫЛОСЬ.');
  } else if (p < 0.05 && dn > up) {
    console.log('\nНАЛОГ УВОДИТ МИР ОТ ПАР: осведомлённый сброс даёт одностороннее смотрение');
    console.log('на устойчивых, то есть ступицы, а не взаимность.');
    console.log('ПРЕДСКАЗАНИЕ (TAX_SPEC2 §6) НЕ СБЫЛОСЬ, и намёк из пустого прогона подтвердился.');
  } else {
    console.log('\nНАЛОГ МЕНЯЕТ БУХГАЛТЕРИЮ, НО НЕ УСТРОЙСТВО МИРА: взаимность не отличается');
    console.log('от слепого сброса. Содержательно: строить шаг 2 на этом не на чем.');
  }
  console.log('\nНи одной строки RUDIMENT_SPEC это не закрывает (TAX_SPEC2 §7).');
}

fs.mkdirSync('results', { recursive: true });
fs.writeFileSync(`results/tax2${process.env.FRESH ? '_fresh' : ''}.jsonl`, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

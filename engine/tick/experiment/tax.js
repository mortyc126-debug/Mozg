#!/usr/bin/env node
'use strict';
/* ============================================================
   НАЛОГ НА РАСХОЖДЕНИЕ: ДОХОДИТ ЛИ ОН ДО МИРА

   Правила чтения объявлены в TAX_SPEC.md ДО этого файла и до единого
   числа, отдельным коммитом (a169baa). Здесь они только исполняются.
   Ничего, что там не записано, здесь не решается.

   ЧИСЛА ПРОГОНА, доставленные в спецификацию недосказанными и
   закреплённые ЗДЕСЬ, до запуска: TAX = 1, LEARN = 0.1, W = 20,
   20000 кругов, 16 сидов, CAP = 64, BUDGET = 200, BASE = 0.05,
   HOLD = 0.1. Подбирать их по виду результата запрещено теми же
   правилами, которыми в этом проекте забракованы v0.20, v0.37, v0.40.

   ОСНОВНАЯ МЕРА (одна, чтобы не поправлять на множественность):
     падение расхождения ВНУТРИ ЖИЗНИ ОДНОЙ СВЯЗИ -- среднее на первых
     W прочтениях минус среднее на последних W, по связям, дожившим до
     конца и прочтённым не менее 2W раз. Связь против самой себя:
     отбор лёгких связей сам по себе этого не даёт.

   ПУСТОЙ ОТСЧЁТ: тот же мир, но значения ошибки при уплате налога
     перемешаны между всеми связями. Издержки те же, связь с тем, что
     действительно плохо предсказано, разорвана.

   ПРЕДУСЛОВИЕ ЖИВОСТИ -- проверяется ДО вердикта, и при нарушении для
     сида не печатается ничего: прочтений за круг >= 20, связей на
     часть >= 0.5, связей с 2W прочтениями >= 30.

   ПРЕДСКАЗАНИЕ, записанное до прогона (TAX_SPEC §8): жду, что падение
     окажется МЕНЬШЕ либо равно в своём мире, чем в перемешанном.
   ============================================================ */
const fs = require('fs');

process.env.CAP = '64';
process.env.BASE = '0.05';
process.env.HOLD = '0.1';
process.env.TAX = '1';
process.env.LEARN = '0.1';
process.env.W = '20';
const G = require('../grow.js');

const ROUNDS = 20000;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const W = G.W;
const LIVE_READS = 20, LIVE_DEG = 0.5, LIVE_LINKS = 30;

function measure(seed, shuffle) {
  const w = G.createSeed(seed, shuffle);
  let reads = 0, roundsCounted = 0;
  const from = Math.floor(ROUNDS * 0.75);
  for (let r = 0; r < ROUNDS; r++) {
    G.round(w);
    if (r >= from) { roundsCounted++; for (const p of w.parts) reads += p.read; }
  }
  const P = w.parts;
  const deg = P.reduce((a, p) => a + p.links.length, 0) / P.length;

  let n = 0, sumDiff = 0, sumLast = 0, sumMovDiff = 0, sumMovLast = 0, sumFirst = 0;
  for (const p of P) for (const l of p.links) {
    if (!l || l.nr < 2 * W) continue;
    const first = l.fSum / W;
    let last = 0, lastMov = 0;
    for (let i = 0; i < W; i++) { last += l.lBuf[i]; lastMov += l.lMov[i]; }
    last /= W; lastMov /= W;
    const firstMov = l.fMov / W;
    n++; sumFirst += first; sumDiff += first - last; sumLast += last;
    sumMovDiff += firstMov - lastMov; sumMovLast += lastMov;
  }
  return {
    n, deg, readsPerRound: reads / roundsCounted, parts: P.length,
    first: n ? sumFirst / n : NaN,
    diff: n ? sumDiff / n : NaN,       // основная мера
    level: n ? sumLast / n : NaN,      // вторая: уровень расхождения
    movDiff: n ? sumMovDiff / n : NaN, // третья: не замер ли мир
    movLast: n ? sumMovLast / n : NaN,
  };
}

function pge(k, n) {
  const c = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  let s = 0; for (let i = k; i <= n; i++) s += c(n, i); return s / 2 ** n;
}

console.log('НАЛОГ НА РАСХОЖДЕНИЕ: ДОХОДИТ ЛИ ОН ДО МИРА');
console.log(`${ROUNDS} кругов, ${SEEDS.length} сидов, потолок ${process.env.CAP} частей, ` +
  `бюджет ${G.BUDGET}, налог ${G.TAX}, W = ${W}`);
console.log('правила чтения -- TAX_SPEC.md, объявлены до прогона\n');

const rows = [];
console.log('  сид | частей | связ/часть | чтений/круг | связей в мере | падение своё | падение перемеш.');
for (const seed of SEEDS) {
  const own = measure(seed, false);
  const shf = measure(seed, true);
  const alive = own.readsPerRound >= LIVE_READS && own.deg >= LIVE_DEG && own.n >= LIVE_LINKS
    && shf.readsPerRound >= LIVE_READS && shf.deg >= LIVE_DEG && shf.n >= LIVE_LINKS;
  rows.push({ seed, own, shf, alive });
  console.log(`${String(seed).padStart(5)} | ${String(own.parts).padStart(6)} | ` +
    `${own.deg.toFixed(2).padStart(10)} | ${own.readsPerRound.toFixed(1).padStart(11)} | ` +
    `${String(own.n).padStart(13)} | ${fmt(own.diff).padStart(12)} | ${fmt(shf.diff).padStart(16)}` +
    (alive ? '' : '   <- НЕ ЖИВ, вердикт не печатается'));
}
function fmt(v) { return Number.isFinite(v) ? v.toFixed(5) : '--'; }

const live = rows.filter((r) => r.alive);
console.log(`\nПРЕДУСЛОВИЕ ЖИВОСТИ: прошли ${live.length} сидов из ${rows.length}` +
  ` (нужно: чтений/круг >= ${LIVE_READS}, связей на часть >= ${LIVE_DEG}, связей в мере >= ${LIVE_LINKS})`);

if (live.length === 0) {
  console.log('\nМИР НЕ ЖИВ НИ НА ОДНОМ СИДЕ. Вердикта нет: мерить нечего.');
  console.log('Это названный заранее исход (TAX_SPEC §6): налог мог просто выжечь граф.');
} else {
  const mean = (f) => (live.reduce((s, r) => s + f(r), 0) / live.length);
  console.log(`\nсредние по живым сидам:`);
  console.log(`  расхождение на первых ${W} прочтениях: своё ${mean((r) => r.own.first).toFixed(5)}, ` +
    `перемешанное ${mean((r) => r.shf.first).toFixed(5)}`);
  console.log(`  ОСНОВНАЯ, падение внутри жизни связи: своё ${mean((r) => r.own.diff).toFixed(5)}, ` +
    `перемешанное ${mean((r) => r.shf.diff).toFixed(5)}`);
  console.log(`  вторая, уровень расхождения к концу: своё ${mean((r) => r.own.level).toFixed(5)}, ` +
    `перемешанное ${mean((r) => r.shf.level).toFixed(5)}`);
  console.log(`  третья, падение движения соседа: своё ${mean((r) => r.own.movDiff).toFixed(5)}, ` +
    `перемешанное ${mean((r) => r.shf.movDiff).toFixed(5)}`);
  console.log(`         движение соседа к концу:   своё ${mean((r) => r.own.movLast).toFixed(5)}, ` +
    `перемешанное ${mean((r) => r.shf.movLast).toFixed(5)}`);

  const up = live.filter((r) => r.own.diff > r.shf.diff).length;
  const dn = live.length - up;
  const p = pge(Math.max(up, dn), live.length);
  console.log(`\nОСНОВНАЯ МЕРА, знаковый счёт против перемешанного мира:`);
  console.log(`  падение больше своё: ${up}, больше перемешанное: ${dn} из ${live.length}, p = ${p.toFixed(5)}`);

  if (p < 0.05 && up > dn) {
    console.log('\nНАЛОГ ДОХОДИТ ДО МИРА: то, какие связи сброшены, сказывается на том,');
    console.log('насколько части научаются предсказывать оставшихся.');
    console.log('ПРЕДСКАЗАНИЕ (§8) НЕ СБЫЛОСЬ: я ждал обратного знака.');
  } else if (p < 0.05 && dn > up) {
    console.log('\nНАЛОГ ДОХОДИТ ДО МИРА, НО ОБРАТНЫМ ЗНАКОМ: осведомлённый сброс оставляет');
    console.log('связи, которым уже некуда улучшаться, и мир учится ХУЖЕ, чем при слепом.');
    console.log('ПРЕДСКАЗАНИЕ (§8) СБЫЛОСЬ.');
  } else {
    console.log('\nНАЛОГ ДО МИРА НЕ ДОХОДИТ: своё падение не отличается от перемешанного.');
    console.log('Содержательно: валюта выбрана неверно либо её действие тонет в шуме,');
    console.log('и шаг 2 (программа-как-данные) делать не на чем.');
  }
  console.log('\nЧто бы ни вышло, это не закрывает ни одной строки RUDIMENT_SPEC (§9).');
}

fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/tax.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

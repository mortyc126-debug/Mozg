#!/usr/bin/env node
'use strict';
/* ============================================================
   ПОЧЕМУ НАЛОГ СВОДИТ ЧАСТИ БЛИЖЕ ДРУГ К ДРУГУ

   Правила чтения -- HOMOGEN_SPEC.md, объявлены до этого файла.
   Здесь они только исполняются.

   ВОПРОС ПЕРВЫЙ: есть ли эффект. Среднее попарное расстояние состояний,
     свой мир против перемешанного. Проверка ПО ВЕЛИЧИНЕ:
     знакопеременная перестановка разностей по сидам.
   ВОПРОС ВТОРОЙ: зависит ли он от направления правила. Свой мир против
     ПЕРЕВЁРНУТОГО (держать дорого хорошо предсказанную связь).

   Описательно, вердиктов не несёт: сколько читают, кого читают, как
   долго живут связи -- три предположения о причине, все корреляционные.
   ============================================================ */
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROUNDS = 20000;
const SEEDS = Array.from({ length: 48 }, (_, i) => 201 + i);
const LIVE_READS = 20, LIVE_DEG = 0.5, LIVE_LINKS = 30;
const SPREAD_MIN = 0.20, DRAWS = 10000;

/* каждый мир считается в отдельном процессе: INVERT и прочее читается
   из окружения при загрузке модуля, и три мира в одном процессе
   мешались бы друг с другом через кэш require. */
const WORLDS = [
  ['свой', { INVERT: '0', SHUF: '0' }],
  ['перемешанный', { INVERT: '0', SHUF: '1' }],
  ['перевёрнутый', { INVERT: '1', SHUF: '0' }],
];

if (process.env.CHILD) {
  process.env.CAP = '64'; process.env.BASE = '0.05'; process.env.HOLD = '0.1';
  process.env.TAX = '40'; process.env.LEARN = '0.1';
  process.env.W = '20'; process.env.HEAD = '20';
  const G = require('../grow.js');
  const seed = +process.env.SEED, shuffle = process.env.SHUF === '1';
  const w = G.createSeed(seed, shuffle);
  const from = Math.floor(ROUNDS * 0.75);
  for (let r = 0; r < ROUNDS; r++) { if (r === from) G.watch(w); G.round(w); }
  const P = w.parts, st = w.stat;

  let dsum = 0, dn = 0;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { dsum += G.dist(P[i].x, P[j].x); dn++; }
  const links = P.reduce((a, p) => a + p.links.length, 0);
  const errs = [];
  for (const p of P) for (const l of p.links) if (l.err !== undefined) errs.push(l.err);
  errs.sort((a, b) => a - b);
  const qq = (f) => errs[Math.floor(f * (errs.length - 1))];
  const H = 0.1, T = 40;
  let inMeasure = 0;
  for (const p of P) for (const l of p.links) if (l.nr >= 40) inMeasure++;
  process.stdout.write(JSON.stringify({
    dist: dsum / dn, deg: links / P.length, parts: P.length, n: inMeasure,
    readsPerRound: st.readN / (ROUNDS - from),
    readDist: st.readN ? st.readDist / st.readN : NaN,
    life: st.lifeN ? st.lifeSum / st.lifeN : NaN,
    made: st.madeN / (ROUNDS - from),
    spread: errs.length ? (H * T * (qq(0.9) - qq(0.1))) / (H * (1 + T * qq(0.5))) : 0,
  }));
  return;
}

function runWorld(seed, env) {
  const out = execFileSync(process.execPath, [__filename],
    { env: Object.assign({}, process.env, env, { CHILD: '1', SEED: String(seed) }), maxBuffer: 1 << 20 });
  return JSON.parse(out.toString());
}

/* знакопеременная перестановка: величина, без предположений о виде */
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

console.log('ПОЧЕМУ НАЛОГ СВОДИТ ЧАСТИ БЛИЖЕ ДРУГ К ДРУГУ');
console.log(`${ROUNDS} кругов, ${SEEDS.length} свежих сидов (201-248), три мира`);
console.log('правила чтения -- HOMOGEN_SPEC.md, объявлены до прогона\n');

const rows = [];
process.stdout.write('  сид |   свой   | перемеш. | перевёрн.\n');
for (const seed of SEEDS) {
  const r = { seed };
  for (const [name, env] of WORLDS) r[name] = runWorld(seed, env);
  r.alive = WORLDS.every(([n]) => r[n].readsPerRound >= LIVE_READS && r[n].deg >= LIVE_DEG
    && r[n].n >= LIVE_LINKS && r[n].spread >= SPREAD_MIN);
  rows.push(r);
  console.log(`${String(seed).padStart(5)} | ${r['свой'].dist.toFixed(5)} | ` +
    `${r['перемешанный'].dist.toFixed(5)} | ${r['перевёрнутый'].dist.toFixed(5)}` +
    (r.alive ? '' : '   <- не годен'));
}

const live = rows.filter((r) => r.alive);
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const m = (w, f) => mean(live.map((r) => f(r[w])));
console.log(`\nПРЕДУСЛОВИЕ ЖИВОСТИ И ПРОВЕРКА ПРИБОРА: годных сидов ${live.length} из ${rows.length}`);
console.log(`  размах цены: свой ${(m('свой', (x) => x.spread) * 100).toFixed(1)}%, ` +
  `перемешанный ${(m('перемешанный', (x) => x.spread) * 100).toFixed(1)}%, ` +
  `перевёрнутый ${(m('перевёрнутый', (x) => x.spread) * 100).toFixed(1)}%`);

if (!live.length) { console.log('\nВЕРДИКТА НЕТ: годных сидов нет.'); process.exit(0); }

console.log('\nсредние по годным сидам:');
const line = (label, f, d) => console.log(`  ${label.padEnd(30)} свой ${f(m('свой', d))}, ` +
  `перемешанный ${f(m('перемешанный', d))}, перевёрнутый ${f(m('перевёрнутый', d))}`);
line('ОСНОВНАЯ, расстояние состояний', (v) => v.toFixed(5), (x) => x.dist);
line('(А) прочтений за круг', (v) => v.toFixed(1), (x) => x.readsPerRound);
line('(А) связей на часть', (v) => v.toFixed(2), (x) => x.deg);
line('(Б) расстояние до прочитанного', (v) => v.toFixed(5), (x) => x.readDist);
line('(В) прожитая длина связи, кругов', (v) => v.toFixed(1), (x) => x.life);
line('    заведено связей за круг', (v) => v.toFixed(2), (x) => x.made);

const d1 = live.map((r) => r['свой'].dist - r['перемешанный'].dist);
const p1 = signFlip(d1);
console.log(`\nВОПРОС ПЕРВЫЙ, свой против перемешанного:`);
console.log(`  разность ${(mean(d1) * 1000).toFixed(3)} x10^-3, ниже у своего на ` +
  `${d1.filter((v) => v < 0).length} сидах из ${live.length}, p = ${p1.toFixed(5)}`);
console.log(p1 < 0.05
  ? `  ЭФФЕКТ ЕСТЬ, ${mean(d1) < 0 ? 'свой мир ОДНОРОДНЕЕ' : 'свой мир РАЗНООБРАЗНЕЕ'} перемешанного`
  : '  ЭФФЕКТА НЕТ: от перемешанного не отличается. Находка шага 7 была шумом.');

const d2 = live.map((r) => r['свой'].dist - r['перевёрнутый'].dist);
const p2 = signFlip(d2);
console.log(`\nВОПРОС ВТОРОЙ, свой против перевёрнутого (вмешательство):`);
console.log(`  разность ${(mean(d2) * 1000).toFixed(3)} x10^-3, ниже у своего на ` +
  `${d2.filter((v) => v < 0).length} сидах из ${live.length}, p = ${p2.toFixed(5)}`);
console.log(p2 < 0.05
  ? '  НАПРАВЛЕНИЕ ПРАВИЛА РЕШАЕТ: переворот меняет однородность мира'
  : '  НАПРАВЛЕНИЕ ПРАВИЛА НЕ РЕШАЕТ: перевёрнутое правило даёт то же самое');

const a = m('свой', (x) => x.dist), b = m('перемешанный', (x) => x.dist), c = m('перевёрнутый', (x) => x.dist);
const between = (b - a) * (c - b) > 0;
console.log(`\nописательно: перемешанный мир ${between ? 'ЛЕЖИТ МЕЖДУ' : 'НЕ лежит между'} ` +
  `своим и перевёрнутым (${a.toFixed(5)} / ${b.toFixed(5)} / ${c.toFixed(5)})`);
console.log('  упорядоченность отклика по направлению правила объявлена описанием, не критерием');
console.log('\nНи одной строки RUDIMENT_SPEC это не закрывает (HOMOGEN_SPEC §8).');

fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/homogen.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

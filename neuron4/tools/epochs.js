#!/usr/bin/env node
'use strict';
// Раунд 9, этап 4: знание, которое сейчас не нужно. Мир эпох (src/worldep.js): миры экзамена рядом, живёт по одному в эпоху.
// По каждой эпохе: какой мир, точность в начале эпохи (первые EARLY кругов) и в конце (вторая половина), операции и время на
// круг, части и органы. EPONLY=i -- мозг, у которого всегда живёт один мир i (остальные нервы молчат с рождения): с ним
// сравнивается цена эпохи того же мира у мозга, который накопил знание о других мирах.
//   node tools/epochs.js [EPW=факт,память,счёт,до метки] [EPL=5000] [ROUNDS=40000] [SEED=1] [EARLY=1000] [EPONLY=-1] [ручки]
const K = require('../src/knobs');
const { WorldEp } = require('../src/worldep');
const { Brain } = require('../src/market');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; }).map(([k, v]) => [k, isNaN(+v) || v === '' ? v : +v]));
const seed = args.SEED || 1, EARLY = args.EARLY || 1000, OUT = args.OUT; delete args.SEED; delete args.EARLY; delete args.OUT;
const BRAIN = { SQ: 1, RENT: 0.05, MFEAT: 6, CHOOSE: 1, CIMIT: 1, CWATCH: 80, CPROD: 4, CFEAT: 8 };
const cfg = K.makeConfig({ ...BRAIN, ROUNDS: 40000, ...args, WORLD: 'exam' });
const W = new WorldEp(cfg, seed), B = new Brain(cfg, W, seed);
// верно ли в записи ответа: факт-подобные -- [t, ответ, ожидание], память -- [t, ответ, ожидания по предметам]
const right = (r) => (Array.isArray(r[2]) ? r[2].indexOf(Math.max(...r[2])) === r[1] : Math.sign(r[2]) === r[1]);
const rows = []; let ep = null;
const close = () => { if (!ep) return; const w = W.xs[ep.a], st = w.st.slice(ep.st0), early = st.filter((r) => r[0] - ep.t0w <= EARLY), late = st.filter((r) => r[0] - ep.t0w > (ep.len / 2));
  const acc = (a) => (a.length ? a.filter(right).length / a.length : NaN); let parts = 0; for (const c of B.ch) parts += c.parts.length;
  rows.push({ ep: rows.length, world: W.names[ep.a], early: acc(early), late: acc(late), nE: early.length, nL: late.length, opsRound: (B.led.opsTotal - ep.ops0) / ep.len, ms: Number(process.hrtime.bigint() - ep.time0) / 1e6 / ep.len, parts, organs: B.mem ? B.mem.organs.length : 0 }); };
for (let r = 1; r <= cfg.ROUNDS; r++) {
  const a = W.active;
  if (!ep || a !== ep.a || (r - 1) % cfg.EPL === 0) { close(); const w = W.xs[a]; ep = { a, st0: w.st.length, t0w: w.t, len: 0, ops0: B.led.opsTotal, time0: process.hrtime.bigint() }; }
  B.step(); W.score(B); ep.len++;
}
close();
for (const r of rows) console.log(`эпоха ${r.ep} ${r.world.padEnd(10)} начало ${(100 * r.early).toFixed(0).padStart(3)}% (${r.nE})  конец ${(100 * r.late).toFixed(0).padStart(3)}% (${r.nL})  ${(r.opsRound / 1000).toFixed(1)}к оп / ${r.ms.toFixed(2)} мс  части ${r.parts} органы ${r.organs}`);
if (OUT) require('fs').writeFileSync(String(OUT), JSON.stringify(rows, null, 1));

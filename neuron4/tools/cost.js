#!/usr/bin/env node
'use strict';
// Раунд 9, этап 1: цена мозга. Один мир экзамена (EXAM, по умолчанию «память»), тела xS (SIZES), одна жизнь на тело.
// Меряется: операции за круг по видам (книга работы, src/ledger.js), время на круг, память процесса, число частей и
// органов -- по четвертям жизни (растёт ли цена с накопленным знанием) и всего. Степень роста по телу -- наклон
// log(операции) по log(нервы).
//   node tools/cost.js [EXAM=память] [SIZES=1,2,4,8] [SEED=1] [ROUNDS=20000] [ручки мозга]
// Время -- только на свободной машине (остальные прогоны мешают); операции от загрузки машины не зависят.
const K = require('../src/knobs');
const { WorldX } = require('../src/worldx');
const { Brain } = require('../src/market');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; }).map(([k, v]) => [k, isNaN(+v) ? v : +v]));
const sizes = String(args.SIZES || '1,2,4,8').split(',').map(Number), seed = args.SEED || 1, OUT = args.OUT; delete args.SIZES; delete args.SEED; delete args.OUT;
const BRAIN = { SQ: 1, RENT: 0.05, MFEAT: 6, CHOOSE: 1, CIMIT: 1, CWATCH: 80, CPROD: 4, CFEAT: 8 };
const XNDOF = (S) => Math.round(12 * S + 6 * (S - 1));
const rows = [];
for (const S of sizes) {
  const cfg = K.makeConfig({ ...BRAIN, EXAM: 'память', ...args, WORLD: 'exam', XND: XNDOF(S) });
  const W = new WorldX(cfg, seed), B = new Brain(cfg, W, seed), Q = Math.floor(cfg.ROUNDS / 4), quarters = [];
  let ops0 = { ...B.led.ops }, t0 = process.hrtime.bigint(), tot0 = B.led.opsTotal;
  for (let r = 1; r <= cfg.ROUNDS; r++) { B.step(); W.score(B);
    if (r % Q === 0) { const dt = Number(process.hrtime.bigint() - t0) / 1e6 / Q, ops = {}; for (const [k, v] of Object.entries(B.led.ops)) ops[k] = (v - (ops0[k] || 0)) / Q;
      let parts = 0; for (const c of B.ch) parts += c.parts.length;
      quarters.push({ r, opsRound: (B.led.opsTotal - tot0) / Q, ops, ms: dt, heapMB: process.memoryUsage().heapUsed / 2 ** 20, parts, organs: B.mem ? B.mem.organs.length : 0 });
      ops0 = { ...B.led.ops }; t0 = process.hrtime.bigint(); tot0 = B.led.opsTotal; } }
  const res = W.result(), last = quarters[quarters.length - 1];
  rows.push({ S, nerves: W.n, quarters, res });
  console.log(`тело x${S} (${W.n} нервов): ${quarters.map((q) => `${(q.opsRound / 1000).toFixed(1)}к оп / ${q.ms.toFixed(2)} мс`).join(' | ')} | части ${last.parts}, органы ${last.organs}, память ${last.heapMB.toFixed(0)} МБ | итог ${JSON.stringify(res).slice(0, 80)}`);
  console.log(`   по видам (последняя четверть, тыс. оп. за круг): ${Object.entries(last.ops).filter(([, v]) => v > 50).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}`).join(', ')}`);
}
if (rows.length > 1) { const xs = rows.map((r) => Math.log(r.nerves)), ys = rows.map((r) => Math.log(r.quarters[r.quarters.length - 1].opsRound)), n = xs.length;
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  console.log(`степень роста работы по числу нервов (последняя четверть): ${(sxy / sxx).toFixed(2)}`); }
if (OUT) require('fs').writeFileSync(String(OUT), JSON.stringify(rows, null, 1));

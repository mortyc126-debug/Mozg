#!/usr/bin/env node
'use strict';
// Общий мир: все способности экзамена в одной жизни одного мозга (src/worldone.js). Меры и пороги -- как в tools/exam.js;
// рядом -- те же способности в отдельных мирах (если передан файл экзамена EXAM_FILE, числа берутся из него).
//   node tools/one.js [SEEDS=1-8] [ROUNDS=20000] [ручки мозга]
const { isMainThread, Worker, parentPort, workerData } = require('worker_threads');
const os = require('os');
const K = require('../src/knobs');
const { WorldOne } = require('../src/worldone');
const { Brain } = require('../src/market');
const BRAIN = { SQ: 1, RENT: 0.05, MFEAT: 6, CHOOSE: 1, CIMIT: 1, CWATCH: 80, CPROD: 4, CFEAT: 8 };
const WORLD = { WORLD: 'one', SPEAK: 1, ASK: 1, OWNV: 1, WSAL: 5, RQPAY: 3, RQSAY: 0 };
const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '-'), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const mean = (a) => { const b = a.filter(Number.isFinite); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };

function run(job) {
  const cfg = K.makeConfig({ ...BRAIN, ...WORLD, ...job.over }), W = new WorldOne(cfg, job.seed), B = new Brain(cfg, W, job.seed), t0 = Date.now();
  for (let r = 1; r <= cfg.ROUNDS; r++) { B.step(); W.score(B); }
  const wr = W.wordReport(), M = wr.groups[0].conf, row = (i) => M[i].reduce((a, b) => a + b, 0);
  // диалог -- как на экзамене: вопросы о движении, глазе и пользе; вопрос «о чём просили?» (есть только в общем мире) -- отдельно
  const by = wr.ask.by; let a = 0, n = 0; for (const x of by.slice(0, 3)) { a += x[0]; n += x[3]; }
  const S = W.dev.req.st;
  return { seed: job.seed, min: (Date.now() - t0) / 60000, nerves: B.ch.length, ops: B.led.opsTotal / cfg.ROUNDS,
    self: (M[1][1] + M[1][2] + M[2][1] + M[2][2]) / (row(1) + row(2)), oth: (M[3][3] + M[3][4] + M[4][3] + M[4][4]) / (row(3) + row(4)),
    dlgAll: a / n, dlgMove: by[0][0] / by[0][3], dlgReq: by[3] ? by[3][0] / Math.max(1, by[3][3]) : NaN, reqAgree: S.agree / Math.max(1, S.moved), reqShift: S.dot / S.n, x: W.result(), conc: B.cc.list.length, ...(cfg.ONEVOC ? { drop: wr.groups[0].drop } : {}), mem: B.mem.organs.map((o) => o.type) };
}
if (!isMainThread) { parentPort.postMessage(run(workerData)); return; }
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')).map(([k, v]) => [k, isNaN(+v) ? v : +v]));
const seeds = K.parseSeeds(String(args.SEEDS || '1-8')); delete args.SEEDS;
const jobs = seeds.map((seed) => ({ seed, over: args })), out = []; let next = 0; const t0 = Date.now();
const start = () => { if (next >= jobs.length) return null; const job = jobs[next++]; return new Promise((ok, bad) => { const w = new Worker(__filename, { workerData: job }); w.on('message', (m) => { out.push(m); ok(); }); w.on('error', bad); }).then(start); };
Promise.all(Array.from({ length: Math.min(os.cpus().length, jobs.length) }, start)).then(() => {
  const R = out.sort((p, q) => p.seed - q.seed), m = (f) => mean(R.map(f)), X = (k, f) => m((r) => (r.x[k] ? f(r.x[k]) : NaN));
  const T = [
    ['я и мир', m((r) => r.self) >= 0.7 && m((r) => r.oth) >= 0.6, `«я» ${pc(m((r) => r.self))}, «оно» ${pc(m((r) => r.oth))} (пороги 70% / 60%)`],
    ['просьба', m((r) => r.reqAgree) >= 0.75 && m((r) => r.reqShift) >= 0.33, `в сторону просьбы ${pc(m((r) => r.reqAgree))}, сдвиг ${f2(m((r) => r.reqShift))} (пороги 75%, 0.33)`],
    ['диалог', m((r) => r.dlgAll) >= 0.6 && m((r) => r.dlgMove) >= 0.5, `верных ответов ${pc(m((r) => r.dlgAll))}, о движении ${pc(m((r) => r.dlgMove))} (пороги 60%, 50%); на «о чём просили?» -- ${pc(m((r) => r.dlgReq))}`],
    ['перенос', X('перенос', (x) => x.transfer) >= 0.5, `перенос ${pc(X('перенос', (x) => x.transfer))} (порог 50%)`],
    ['антоним', X('антоним', (x) => x.transfer) >= 0.5, `перенос со знаком ${pc(X('антоним', (x) => x.transfer))} (порог 50%)`],
    ['сложение', X('сложение', (x) => -x.held) >= 0.5, `ждёт «вниз» на ${f2(X('сложение', (x) => -x.held))} (порог 0.5)`],
    ['память разговора', X('память', (x) => x.acc) >= 0.6, `верный ответ ${pc(X('память', (x) => x.acc))} (порог 60%, наугад 33%)`],
    ['собеседник', Math.min(X('собеседник', (x) => x.falseOld), X('собеседник', (x) => x.seenNew), X('собеседник', (x) => x.falseNew)) >= 0.7,
      `мнение ложно и прежнее ${pc(X('собеседник', (x) => x.falseOld))}, верно и новое ${pc(X('собеседник', (x) => x.seenNew))}, ложно и новое ${pc(X('собеседник', (x) => x.falseNew))} (порог 70%)`],
  ];
  const L = [`ОБЩИЙ МИР | мозг: ${Object.entries({ ...BRAIN, ...args }).map(([k, v]) => `${k}=${v}`).join(' ')} | миры ${seeds.join(',')} | ${((Date.now() - t0) / 60000).toFixed(1)} мин`,
    `  нервов у мозга ${Math.round(m((r) => r.nerves))}, работа ${(m((r) => r.ops) / 1000).toFixed(0)} тыс. операций за круг, понятий в конце жизни ${R.map((r) => r.conc).join(' ')}`, ''];
  for (const [nm, ok, line] of T) L.push(`  ${ok ? '✓' : '✗'}  ${nm.padEnd(17)} ${line}`);
  L.push('', `СДАНО: ${T.filter((x) => x[1]).length} из ${T.length}`, '', 'по мирам:');
  for (const r of R) L.push('  ' + JSON.stringify({ ...r, mem: undefined }, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v)));
  console.log(L.join('\n'));
});

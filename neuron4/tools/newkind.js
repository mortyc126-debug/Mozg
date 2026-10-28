#!/usr/bin/env node
'use strict';
// Задачи нового рода (раунд 6, этап 4, results/round6/ПЛАН.md): придуманы после заморозки языка кирпичиков (src/compose.js,
// sha256 4197c5a586fdb9c5); пороги -- до первого прогона. Устроен как экзамен готовности (tools/ready.js).
// Экзамен готовности (основа): есть ли у мозга то, без чего нет мозга, а не сколько он знает. Пороги заданы заранее (до первого прогона);
// мозг один на все опыты (BRAIN ниже плюс ручки из командной строки). Кроме самих способностей -- рост тела: те же опыты, когда
// отвлекающих нервов больше (SIZES: тело x1, x2, x4). Мозг, который держится только на маленьком теле, -- настройка под размер.
//   node tools/newkind.js [SEEDS=9-16] [SIZES=1] [ONLY=счёт,до метки] [JOBFILE=файл.jsonl] [JOBS=потоков] [CTRL=0 -- без контролей] [ручки мозга]
// JOBS -- готовые задания пишутся в файл по одному; при повторном запуске с тем же файлом они не считаются заново (долгий
// прогон переживает перезапуск машины)
// Чего здесь нет: слова о себе и диалог -- в tools/exam.js («я и мир», «диалог»); рассказ словами -- опыты с языковой корой.
const { isMainThread, Worker, parentPort, workerData } = require('worker_threads');
const os = require('os');
const K = require('../src/knobs');
const { bootLine } = require('../src/stats');
const { WorldX } = require('../src/worldx');
const { Brain } = require('../src/market');

const BRAIN = { SQ: 1, RENT: 0.05, MFEAT: 6, CHOOSE: 1, CIMIT: 1, CWATCH: 80, CPROD: 4, CFEAT: 8 };
const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '-'), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const mean = (a) => { const b = a.filter(Number.isFinite); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };
// отвлекающих нервов при теле xS: 12 -- как на экзамене способностей; x2, x4 -- столько, чтобы нервов стало примерно в S раз больше
const XNDOF = (S) => Math.round(12 * S + 6 * (S - 1));

// пороги -- заданы до первого прогона
const TESTS = [
  ...['порядок', 'счёт', 'правило', 'больше', 'интервал', 'счёт до метки', 'до метки', 'из трёх до метки', 'первое после метки'].map((name) => ({ name, what: { 'из трёх до метки': 'a / b / c до метки и после, вопрос: свойство +1, если последним до метки было a', 'первое после метки': 'a / b до метки и после, вопрос: свойство +1, если первым после метки было a', 'порядок': 'A и B в случайном порядке, потом вопрос: свойство +1, если первым было A',
      'счёт до метки': 'X 1-2 раза, метка, X ещё 0-2 раза, вопрос: свойство +1, если до метки X был дважды', 'до метки': 'a / b до метки и после, вопрос: свойство +1, если последним до метки было a',
      'больше': 'X и Y по 1-3 раза, вперемешку, потом вопрос: свойство +1, если X больше', 'интервал': 'X, через 1-2 или 5-8 кругов Y, потом вопрос: свойство +1, если промежуток короткий',
      'счёт': 'X звучит 1 или 2 раза, потом вопрос: свойство +1, если дважды', 'правило': 'подсказка C1 / C2, через 4-10 кругов стимул S+ / S-: свойство -- знак стимула при C1, обратный при C2' }[name],
    thr: 0.75, main: { EXAM: name }, ctrl: { EXAM: name, XCTRL: 1 }, ctrlWhat: 'свойство наугад', scale: false,
    val: (m) => mean(m.map((x) => x.acc)),
    sum(m, c) { const a = mean(m.map((x) => x.acc)), b = mean(c.map((x) => x.acc)); return { pass: a >= 0.75 && b <= 0.6, line: `верный знак ${pc(a)} (порог 75%, наугад 50%), контроль ${pc(b)} (порог 60%)` }; } })),
];
// рост тела держится, если на x2 и x4 мера не ниже порога и не ниже 80% от меры на x1
const SCALE_KEEP = 0.8;

function runJob(job) {
  const t = TESTS.find((x) => x.name === job.test), cfg = K.makeConfig({ ...BRAIN, ...job.brain, WORLD: 'exam', ...job.world, XND: XNDOF(job.size) });
  const W = new WorldX(cfg, job.seed), B = new Brain(cfg, W, job.seed), t0 = Date.now();
  for (let r = 1; r <= cfg.ROUNDS; r++) { B.step(); W.score(B); }
  return { test: job.test, cond: job.cond, size: job.size, seed: job.seed, nerves: W.n, ops: B.led.opsTotal / cfg.ROUNDS, min: (Date.now() - t0) / 60000, res: W.result() };
}
if (!isMainThread) { parentPort.postMessage(runJob(workerData)); return; }

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')).map(([k, v]) => [k, isNaN(+v) ? v : +v]));
const seeds = K.parseSeeds(String(args.SEEDS || '1-8')), sizes = String(args.SIZES || '1,2,4').split(',').map(Number);
const only = args.ONLY ? String(args.ONLY).split(',') : null, jfile = args.JOBFILE !== undefined ? String(args.JOBFILE) : args.JOBS !== undefined && typeof args.JOBS !== 'number' ? String(args.JOBS) : null, threads = typeof args.JOBS === 'number' && args.JOBS > 0 ? args.JOBS : os.cpus().length, noCtrl = args.CTRL === 0; delete args.SEEDS; delete args.SIZES; delete args.ONLY; delete args.JOBS; delete args.JOBFILE; delete args.CTRL;
const fs = require('fs'), jkey = (j) => `${j.test}|${j.cond}|${j.size}|${j.seed}`, done = new Map();
if (jfile && fs.existsSync(jfile)) for (const l of fs.readFileSync(jfile, 'utf8').split('\n')) if (l.trim()) { const m = JSON.parse(l); done.set(jkey(m), m); }
const brain = args, jobs = [];
for (const t of TESTS) { if (only && !only.includes(t.name)) continue;
  for (const size of sizes) { if (size !== 1 && !t.scale) continue;
    for (const seed of seeds) { jobs.push({ test: t.name, cond: 'main', world: t.main, brain, seed, size }); if (t.ctrl && size === 1 && !noCtrl) jobs.push({ test: t.name, cond: 'ctrl', world: t.ctrl, brain, seed, size }); } } }
// долгие задания -- первыми (большое тело), чтобы потоки кончили вместе
jobs.sort((a, b) => b.size - a.size);
const out = jobs.filter((j) => done.has(jkey(j))).map((j) => done.get(jkey(j))), todo = jobs.filter((j) => !done.has(jkey(j))); jobs.length = 0; jobs.push(...todo);
let next = 0; const N = Math.max(1, Math.min(threads, jobs.length)), t0 = Date.now();
function start() { if (next >= jobs.length) return null; const job = jobs[next++];
  return new Promise((ok, bad) => { const w = new Worker(__filename, { workerData: job }); w.on('message', (m) => { out.push(m); if (jfile) fs.appendFileSync(jfile, JSON.stringify(m) + '\n'); ok(); }); w.on('error', bad); }).then(start); }
Promise.all(Array.from({ length: N }, start)).then(() => {
  const L = [`ЗАДАЧИ НОВОГО РОДА | мозг: ${Object.entries({ ...BRAIN, ...brain }).map(([k, v]) => `${k}=${v}`).join(' ')} | миры ${seeds.join(',')} | тело x${sizes.join(', x')} | ${((Date.now() - t0) / 60000).toFixed(1)} мин`, ''];
  let passed = 0, total = 0; const js = (r) => JSON.stringify(r, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v));
  for (const t of TESTS) { if (only && !only.includes(t.name)) continue;
    const pick = (cond, size) => out.filter((x) => x.test === t.name && x.cond === cond && x.size === size).sort((a, b) => a.seed - b.seed);
    const m = pick('main', 1).map((x) => x.res), c = pick('ctrl', 1).map((x) => x.res), s = t.sum(m, c); total++; if (s.pass) passed++;
    L.push(`  ${s.pass ? '✓' : '✗'}  ${t.name.padEnd(12)} ${t.what}`);
    L.push(`     ${s.line}${t.ctrl ? `  [контроль: ${t.ctrlWhat}]` : ''}`);
    L.push(`     главная мера (без контроля и прочих условий сдачи): ${bootLine(m.map((x) => t.val([x])), t.thr)}`);
    L.push(`     по мирам: ${m.map(js).join(' ')}`); if (c.length) L.push(`     контроль: ${c.map(js).join(' ')}`);
    if (t.scale && sizes.length > 1) { const v1 = t.val(m);
      const row = sizes.map((S) => { const rs = pick('main', S), v = t.val(rs.map((x) => x.res)); return `x${S} (${Math.round(mean(rs.map((x) => x.nerves)))} нервов, ${(mean(rs.map((x) => x.ops)) / 1000).toFixed(0)} тыс. оп.): ${f2(v)}`; });
      const keep = sizes.filter((S) => S !== 1).every((S) => { const v = t.val(pick('main', S).map((x) => x.res)); return s.pass && t.sum(pick('main', S).map((x) => x.res), c).pass && v >= SCALE_KEEP * v1; });
      L.push(`     рост тела: ${row.join('; ')} -- ${keep ? 'держится' : 'не держится'}`); }
  }
  L.push('', `СДАНО: ${passed} из ${total}`);
  console.log(L.join('\n'));
});

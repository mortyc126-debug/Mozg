#!/usr/bin/env node
'use strict';
// Экзамен способностей: может ли мозг понимать и отвечать, а не сколько он знает. Каждый опыт -- маленький мир с одной
// способностью и контролем, где этой способности не на чем проявиться; порог «сдал / не сдал» -- заранее. Мозг на всех опытах
// один и тот же (BRAIN ниже плюс ручки из командной строки): под опыт ничего не подстраивается.
//   node tools/exam.js [SEEDS=1-8] [ONLY=перенос,сложение] [JOBFILE=файл.jsonl] [JOBS=потоков] [ИМЯ=значение ...]  -- ручки мозга для всех опытов (например CONC=1)
const { isMainThread, Worker, parentPort, workerData } = require('worker_threads');
const os = require('os'), path = require('path');
const K = require('../src/knobs');
const { bootLine } = require('../src/stats');
const { World } = require('../src/world');
const { WorldX } = require('../src/worldx');
const { Brain } = require('../src/market');

// мозг экзамена: квадрат входа, дешёвое место, мотор с 6 нервами в модели, орган выбора с подражанием (для рта)
const BRAIN = { SQ: 1, RENT: 0.05, MFEAT: 6, CHOOSE: 1, CIMIT: 1, CWATCH: 80, CPROD: 4, CFEAT: 8 };
const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '-');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const mean = (a) => { const b = a.filter(Number.isFinite); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };

// опыты: мир (главный и контроль), замер за жизнь, итог мира, сводка по мирам и порог
const TESTS = [
  { name: 'привязка', one: (x) => x.bits, thr: 0.56, what: 'слово как знание: по «светло» мозг предсказывает то, чего ещё не видел (глаза нет)',
    main: { WORDS: 2, WDLAG: 1, DEYE: 0, WSAL: 5 }, ctrl: { WORDS: 2, WDLAG: 1, DEYE: 0, WSAL: 5, WFAKE: 1 }, ctrlWhat: 'слово о другом процессе',
    init(W, B) { return { kd: W.nerves.findIndex((nv) => nv.ch === W.deep[0]), e: 0, y: 0, y2: 0, n: 0 }; },
    each(W, B, r, s) { if (r <= W.cfg.ROUNDS / 2) return; const c = B.ch[s.kd]; let bp = null; for (const p of c.parts) if (p.age >= 1 && (!bp || p.mse < bp.mse)) bp = p; s.pred = bp ? bp.pred : null; },
    after(W, B, r, s) { if (r <= W.cfg.ROUNDS / 2 || s.pred === null || s.pred === undefined) return; const y = B.goods.val[B.ch[s.kd].good]; s.e += (y - s.pred) ** 2; s.y += y; s.y2 += y * y; s.n++; },
    result(W, B, s) { const v = s.y2 / s.n - (s.y / s.n) ** 2; return { bits: 0.5 * Math.log2(v / (s.e / s.n)) }; },
    sum(m, c) { const a = mean(m.map((x) => x.bits)), b = mean(c.map((x) => x.bits)); return { pass: a >= 0.56 && b < 0.1, line: `бит о невиденном ${f2(a)} (потолок 1.12, порог 0.56), контроль ${f2(b)} (порог < 0.1)` }; } },
  { name: 'я и мир', one: (x) => x.self, thr: 0.7, what: 'слово «я» -- о своём движении, «оно» -- о толчке мира (мозг слушает родителя)',
    main: { WORDS: 1, WSAL: 5 }, ctrl: { WORDS: 1, WSAL: 5, NOCOPY: 1 }, ctrlWhat: 'без копии своей команды',
    result(W, B) { const M = W.wordReport().groups[0].conf, row = (i) => M[i].reduce((a, b) => a + b, 0);
      const self = (M[1][1] + M[1][2] + M[2][1] + M[2][2]) / (row(1) + row(2)), oth = (M[3][3] + M[3][4] + M[4][3] + M[4][4]) / (row(3) + row(4)); return { self, oth }; },
    sum(m, c) { const s = mean(m.map((x) => x.self)), o = mean(m.map((x) => x.oth)), cs = mean(c.map((x) => x.self));
      return { pass: s >= 0.7 && o >= 0.6 && cs <= s - 0.3, line: `«я» узнано ${pc(s)} (порог 70%), «оно» ${pc(o)} (порог 60%); без копии команды «я» ${pc(cs)} (порог: на 30 пунктов меньше)` }; } },
  { name: 'просьба', one: (x) => x.agree, thr: 0.75, what: 'слово как действие: родитель просит «вверх» / «вниз», мозг двигает туда',
    main: { WORDS: 8, RQPAY: 3 }, ctrl: { WORDS: 8, RQPAY: 3, RQFAKE: 1 }, ctrlWhat: 'слово о другой просьбе',
    result(W, B) { const S = W.req.st; return { agree: S.agree / Math.max(1, S.moved), shift: S.dot / S.n }; },
    sum(m, c) { const a = mean(m.map((x) => x.agree)), sh = mean(m.map((x) => x.shift)), ca = mean(c.map((x) => x.agree));
      // потолок -- лучшая близорукая политика, знающая всё (tools/request_ceil.js): сдвиг 0.41, в сторону просьбы 83%. Первый
      // порог (сдвиг 0.5 «из ~1») был посчитан неверно -- без того, что z держит прошлый сдвиг; исправлен на 80% потолка
      return { pass: a >= 0.75 && sh >= 0.33 && ca <= 0.55, line: `в сторону просьбы ${pc(a)} (порог 75%, потолок 83%), сдвиг ${f2(sh)} (порог 0.33 -- 80% потолка 0.41); контроль ${pc(ca)} (порог 55%)` }; } },
  { name: 'диалог', one: (x) => x.all, thr: 0.6, what: 'отвечает на вопросы родителя словом нужной группы (рот, слова о движении, глазе, пользе)',
    main: { WORDS: 7, SPEAK: 1, ASK: 1, OWNV: 1, WSAL: 5 }, ctrl: null,
    result(W, B) { const by = W.qst.by; let a = 0, n = 0; for (const x of by) { a += x[0]; n += x[3]; } return { all: a / n, move: by[0][0] / by[0][3] }; },
    sum(m) { const a = mean(m.map((x) => x.all)), mv = mean(m.map((x) => x.move)); return { pass: a >= 0.6 && mv >= 0.5, line: `верных ответов ${pc(a)} (порог 60%), о движении ${pc(mv)} (порог 50%)` }; } },
  { name: 'перенос', one: (x) => x.transfer, thr: 0.5, what: 'общее понятие: a и b -- имена одной вещи; свойство, выученное с a, ждёт ли мозг по b',
    main: { WORLD: 'exam', EXAM: 'перенос' }, ctrl: { WORLD: 'exam', EXAM: 'перенос', XCTRL: 1 }, ctrlWhat: 'b прежде называло другую вещь',
    result(W) { return W.result(); },
    sum(m, c) { const a = mean(m.map((x) => x.transfer)), b = mean(c.map((x) => x.transfer)), s3 = mean(m.map((x) => x.sB3)), s1 = mean(m.map((x) => x.sB1));
      return { pass: a >= 0.5 && b <= 0.2, line: `перенос ${pc(a)} (порог 50%), контроль ${pc(b)} (порог 20%); значение b после долгого молчания: ${f2(s3)} против ${f2(s1)}` }; } },
  { name: 'антоним', one: (x) => x.transfer, thr: 0.5, what: 'перенос со знаком: a -- «вверх», b -- «вниз»; свойство, выученное с a, ждёт ли мозг по b со знаком минус',
    main: { WORLD: 'exam', EXAM: 'антоним' }, ctrl: { WORLD: 'exam', EXAM: 'антоним', XCTRL: 1 }, ctrlWhat: 'b прежде называло другую вещь',
    result(W) { return W.result(); },
    sum(m, c) { const a = mean(m.map((x) => x.transfer)), b = mean(c.map((x) => x.transfer));
      return { pass: a >= 0.5 && b <= 0.2, line: `перенос со знаком ${pc(a)} (порог 50%; минус -- ждёт не туда), контроль ${pc(b)} (порог 20%)` }; } },
  { name: 'сложение', one: (x) => -x.held, thr: 0.5, what: 'сложение смысла: «второе вниз» ни разу не звучало -- ждёт ли мозг, что второй пойдёт вниз',
    main: { WORLD: 'exam', EXAM: 'сложение', XK: 10 }, ctrl: null,
    result(W) { return W.result(); },
    sum(m) { const h = mean(m.map((x) => -x.held)); return { pass: h >= 0.5, line: `ждёт «вниз» на ${f2(h)} из 1 (порог 0.5; 0 -- ничего не ждёт, -1 -- ждёт «вверх»)` }; } },
  { name: 'сложение-3', one: (x) => -x.held, thr: 0.5, what: 'то же с тремя предметами: «второе вниз» и «третье вверх» ни разу не звучали',
    main: { WORLD: 'exam', EXAM: 'сложение3', XK: 10 }, ctrl: null,
    result(W) { return W.result(); },
    sum(m) { const h = mean(m.map((x) => -x.held)); return { pass: h >= 0.5, line: `ждёт верного на ${f2(h)} из 1 (порог 0.5; 0 -- ничего не ждёт, -1 -- ждёт как раньше)` }; } },
  { name: 'память разговора', one: (x) => x.acc, thr: 0.6, what: 'назвал предмет, через 3-12 кругов спросил «что было?» -- ждёт ли мозг ответом тот предмет',
    main: { WORLD: 'exam', EXAM: 'память' }, ctrl: { WORLD: 'exam', EXAM: 'память', XCTRL: 1 }, ctrlWhat: 'ответ -- случайный предмет',
    result(W) { return W.result(); },
    sum(m, c) { const a = mean(m.map((x) => x.acc)), b = mean(c.map((x) => x.acc)); return { pass: a >= 0.6 && b <= 0.4, line: `верный ответ ${pc(a)} (порог 60%, наугад 33%), контроль ${pc(b)} (порог 40%)` }; } },
  { name: 'память долгая', one: (x) => x.acc, thr: 0.6, what: 'то же, но вопрос через 15-30 кругов (рабочая память строилась на 3-12)',
    main: { WORLD: 'exam', EXAM: 'память', XDMIN: 15, XDMAX: 30 }, ctrl: { WORLD: 'exam', EXAM: 'память', XDMIN: 15, XDMAX: 30, XCTRL: 1 }, ctrlWhat: 'ответ -- случайный предмет',
    result(W) { return W.result(); },
    sum(m, c) { const a = mean(m.map((x) => x.acc)), b = mean(c.map((x) => x.acc)); return { pass: a >= 0.6 && b <= 0.4, line: `верный ответ ${pc(a)} (порог 60%, наугад 33%), контроль ${pc(b)} (порог 40%)` }; } },
  { name: 'собеседник', one: (x) => Math.min(x.falseOld, x.seenNew, x.falseNew), thr: 0.7, what: 'ложное убеждение: родитель не видел, как предмет переложили, -- ждёт ли мозг его слова по его мнению',
    main: { WORLD: 'exam', EXAM: 'собеседник' }, ctrl: null,
    result(W) { return W.result(); },
    sum(m) { const a = mean(m.map((x) => x.falseOld)), b = mean(m.map((x) => x.seenNew)), c = mean(m.map((x) => x.falseNew));
      return { pass: Math.min(a, b, c) >= 0.7, line: `ждёт слова по мнению родителя: мнение ложно и прежнее ${pc(a)}, верно и новое (видел, как переложили) ${pc(b)}, ложно и новое ${pc(c)} (порог 70% в каждом; наугад 50%; «по правде» -- 0/100/0, «как в прошлый раз» -- 100/0/0)` }; } },
];

function runJob(job) {
  const t = TESTS.find((x) => x.name === job.test), cfg = K.makeConfig({ ...BRAIN, ...job.brain, ...job.world }), seed = job.seed;
  const W = cfg.WORLD === 'exam' ? new WorldX(cfg, seed) : new World(cfg, seed), B = new Brain(cfg, W, seed), s = t.init ? t.init(W, B) : {};
  for (let r = 1; r <= cfg.ROUNDS; r++) { if (t.each) t.each(W, B, r, s); B.step(); if (W.score) W.score(B); if (t.after) t.after(W, B, r, s); }
  return { ...job, res: t.result(W, B, s) };
}
if (!isMainThread) { parentPort.postMessage(runJob(workerData)); return; }

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')).map(([k, v]) => [k, isNaN(+v) ? v : +v]));
const seeds = K.parseSeeds ? K.parseSeeds(String(args.SEEDS || '1-8')) : [1, 2, 3, 4];
const only = args.ONLY ? String(args.ONLY).split(',') : null, jfile = args.JOBFILE !== undefined ? String(args.JOBFILE) : args.JOBS !== undefined && typeof args.JOBS !== 'number' ? String(args.JOBS) : null, threads = typeof args.JOBS === 'number' && args.JOBS > 0 ? args.JOBS : os.cpus().length; delete args.SEEDS; delete args.ONLY; delete args.JOBS; delete args.JOBFILE;
// JOBFILE=файл.jsonl (прежде JOBS=файл, так тоже можно) -- готовые задания пишутся по одному; при повторном запуске с тем же файлом не считаются заново (как tools/ready.js)
const fs = require('fs'), jkey = (j) => `${j.test}|${j.cond}|${j.seed}`, done = new Map();
if (jfile && fs.existsSync(jfile)) for (const l of fs.readFileSync(jfile, 'utf8').split('\n')) if (l.trim()) { const m = JSON.parse(l); done.set(jkey(m), m); }
const brain = args;
const jobs = [];
for (const t of TESTS) { if (t.todo || (only && !only.includes(t.name))) continue;
  for (const seed of seeds) { jobs.push({ test: t.name, cond: 'main', world: t.main, brain, seed }); if (t.ctrl) jobs.push({ test: t.name, cond: 'ctrl', world: t.ctrl, brain, seed }); } }
const out = jobs.filter((j) => done.has(jkey(j))).map((j) => done.get(jkey(j))); { const todo = jobs.filter((j) => !done.has(jkey(j))); jobs.length = 0; jobs.push(...todo); }
let next = 0; const N = Math.max(1, Math.min(threads, jobs.length)), t0 = Date.now();
function start() { if (next >= jobs.length) return null; const job = jobs[next++];
  return new Promise((ok, bad) => { const w = new Worker(__filename, { workerData: job }); w.on('message', (m) => { out.push(m); if (jfile) fs.appendFileSync(jfile, JSON.stringify(m) + '\n'); ok(); }); w.on('error', bad); }).then(start); }
Promise.all(Array.from({ length: N }, start)).then(() => {
  const L = [`ЭКЗАМЕН СПОСОБНОСТЕЙ | мозг: ${Object.entries({ ...BRAIN, ...brain }).map(([k, v]) => `${k}=${v}`).join(' ')} | миры ${seeds.join(',')} | ${((Date.now() - t0) / 60000).toFixed(1)} мин`, ''];
  let passed = 0, total = 0;
  for (const t of TESTS) {
    if (only && !only.includes(t.name)) continue;
    if (t.todo) { L.push(`  ·  ${t.name.padEnd(17)} не построен -- ${t.what}`); continue; }
    const m = out.filter((x) => x.test === t.name && x.cond === 'main').sort((a, b) => a.seed - b.seed).map((x) => x.res), c = out.filter((x) => x.test === t.name && x.cond === 'ctrl').sort((a, b) => a.seed - b.seed).map((x) => x.res);
    const s = t.sum(m, c); total++; if (s.pass) passed++;
    L.push(`  ${s.pass ? '✓' : '✗'}  ${t.name.padEnd(17)} ${t.what}`);
    L.push(`     ${s.line}${t.ctrl ? `  [контроль: ${t.ctrlWhat}]` : ''}`);
    if (t.one) L.push(`     главная мера (без контроля и прочих условий сдачи): ${bootLine(m.map(t.one), t.thr)}`);
    const js = (r) => JSON.stringify(r, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v));
    L.push(`     по мирам: ${m.map(js).join(' ')}`); if (c.length) L.push(`     контроль: ${c.map(js).join(' ')}`);
  }
  L.push('', `СДАНО: ${passed} из ${total} построенных опытов`);
  console.log(L.join('\n'));
});

#!/usr/bin/env node
'use strict';
/* ============================================================
   НЕЙРОН-4 -- новая основа (NEURON4.md). Нейрон-3 -- эталон в ref/neuron3.js, как нейрон-2 был эталоном нейрона-3.
   Что нового против нейрона-3:
   - один вид участника рынка (часть, исследователь, моторный орган) и одна книга денег и работы: сумма всех счетов --
     ноль в каждом круге (src/ledger.js), работа записана на заказчика, включая рождение и подгонки;
   - один протокол товара: нерв, прогноз, команда, польза (src/goods.js) -- вместо видов связей k = 0..9;
   - роялти по вкладу «без одного входа» -- насколько выросла бы ошибка подгонки без входа (src/market.js);
   - ручки -- объект настройки с реестром и статусами, а не глобальные постоянные (src/knobs.js);
   - мир неизвестных органов (src/world.js) и исследователь, который сам выясняет, что делают нервы, и строит для
     выходных нервов моторные органы (src/explorer.js).
   Запуск:  node neuron4.js [ИМЯ=значение ...]      node neuron4.js KNOBS=1 -- список ручек
   ============================================================ */
const { isMainThread, Worker, parentPort, workerData } = require('worker_threads');
const os = require('os');
const K = require('./src/knobs');
const { World } = require('./src/world');
const { World3 } = require('./src/world3');
const { WorldImg } = require('./src/worldimg');
const { WorldTxt } = require('./src/worldtxt');
const { WorldX } = require('./src/worldx');
const { WorldOne } = require('./src/worldone');
const { WorldEp } = require('./src/worldep');
const { WorldBody } = require('./src/worldbody');
const { Brain } = require('./src/market');
const { Meter, KINDS, med } = require('./src/stats');

function runSeed(over, seed) {
  const cfg = K.makeConfig(over), t0 = Date.now();
  const W = cfg.WORLD === 'mix' ? new World3(cfg, seed) : cfg.WORLD === 'img' ? new WorldImg(cfg, seed) : cfg.WORLD === 'txt' ? new WorldTxt(cfg, seed) : cfg.WORLD === 'exam' ? new WorldX(cfg, seed) : cfg.WORLD === 'one' ? new WorldOne(cfg, seed) : cfg.WORLD === 'ep' ? new WorldEp(cfg, seed) : cfg.WORLD === 'body' ? new WorldBody(cfg, seed) : new World(cfg, seed), B = new Brain(cfg, W, seed), M = new Meter(B);
  const snaps = [];
  for (let r = 1; r <= cfg.ROUNDS; r++) { B.step(); if (W.score) W.score(B); M.each(); if (r % cfg.EVERY === 0) snaps.push(M.snap()); }
  const ex = B.ex, ceil = M.ceiling();
  // итог жизни: вторая половина (после подключения устройств) -- среднее по окнам; верна ли карта тела
  const late = snaps.filter((s) => s.t > cfg.ROUNDS / 2), avg = (f) => late.reduce((a, s) => a + f(s), 0) / Math.max(1, late.length);
  const tr = W.truth(), outs = B.ch.filter((c) => c.port.st === 'выходной').map((c) => tr[c.k]);
  const summary = { comfort: avg((s) => s.comfort), d2: avg((s) => s.d2), bits: Object.fromEntries(KINDS.map((k) => [k, avg((s) => s.bits[k])])),
    mapOK: W.plugged ? (outs.length === 1 && outs[0] === 'двигатель' ? 1 : 0) : (outs.length === 0 ? 1 : 0), outs,
    und: late.length && late[late.length - 1].und ? late[late.length - 1].und : null, exam: W.exN ? W.exOK / W.exN : NaN, train: W.trAcc,
    ...(W.wordReport && W.wordReport() ? { words: W.wordReport() } : {}), ...(W.result ? { xres: W.result(), concepts: B.cc.log.slice(0, 12) } : {}), bpc: W.bpN ? W.bpS / W.bpN : NaN, bpc2: W.bpN2 ? W.bpS2 / W.bpN2 : NaN, bpcOrg2: W.orgN2 ? W.orgS2 / W.orgN2 : NaN, bpcCtx2: W.ctxN2 ? W.ctxS2 / W.ctxN2 : NaN, ctxShare: W.bpN2 ? (W.ctxN2 || 0) / W.bpN2 : NaN, bpcUni2: W.bpN2 ? W.uniS2 / W.bpN2 : NaN, orgShare: W.bpN2 ? W.orgN2 / W.bpN2 : NaN,
    motorDeaths: ex.log.filter((x) => x.includes('разорился')).length, parts: avg((s) => s.parts), ops: B.led.opsTotal / cfg.ROUNDS };
  const flow = B.led.flow, ext = B.led.ext;
  return { seed, sec: (Date.now() - t0) / 1000, summary, snaps, ceil, firstEff: ex.firstEff, firstMotor: ex.firstMotor, built: ex.built, log: ex.log.slice(0, 60), memLog: B.mem.log.slice(0, 40), memLogTail: B.mem.log.slice(-6), memOrgans: B.mem.organs.map((o) => o.key), memBuilt: B.mem.built, memScanned: B.mem.scanned,
    flow, ext, opsTotal: B.led.opsTotal, stat: B.stat, truthMotor: W.motorNerve, truthProp: W.propNerve, b: W.b,
    mapFinal: B.ch.map((c) => ({ k: c.k, kind: W.truth()[c.k], st: c.port.st, eff: c.port.eff.map((e) => [e.j, e.lag]), owner: !!c.port.owner })) };
}

if (!isMainThread) { parentPort.postMessage(runSeed(workerData.over, workerData.seed)); return; }

const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
function report(cfg, res) {
  const L = [];
  const R = res.sort((a, b) => a.seed - b.seed);
  // окна: медианы по мирам
  const ks = KINDS.filter((k) => R.some((r) => r.snaps.some((s) => Number.isFinite(s.bits[k]))));
  L.push('  круг   ' + ks.map((k) => k.slice(0, 9).padStart(10)).join('') + '   польза   (z-g)^2   частей  моторов  работа/круг');
  const nW = R[0].snaps.length;
  for (let i = 0; i < nW; i++) { const S = R.map((r) => r.snaps[i]);
    const ops = med(S.map((s) => Object.values(s.ops).reduce((a, b) => a + b, 0)));
    L.push(`  ${String(S[0].t).padStart(6)} ` + ks.map((k) => fmt(med(S.map((s) => s.bits[k]))).padStart(10)).join('') +
      `   ${fmt(med(S.map((s) => s.comfort))).padStart(6)}   ${fmt(med(S.map((s) => s.d2))).padStart(7)}   ${String(Math.round(med(S.map((s) => s.parts)))).padStart(6)}   ${fmt(med(S.map((s) => s.motors)), 1).padStart(6)}   ${(ops / 1000).toFixed(1).padStart(8)}k`); }
  const ceil = {}; for (const k of ks) ceil[k] = med(R.map((r) => r.ceil[k]));
  if (Number.isFinite(R[0].summary.exam)) L.push(`  цифры: экзамен (${cfg.WTEST} невиденных) ${R.map((r) => fmt(100 * r.summary.exam, 1) + '%').join(' ')} -- медиана ${fmt(100 * med(R.map((r) => r.summary.exam)), 1)}%; учёба ${fmt(100 * med(R.map((r) => r.summary.train)), 1)}%`);
  if (Number.isFinite(R[0].summary.bpc)) { const P = (f) => R.map((r) => fmt(r.summary[f])).join(' ');
    L.push(`  текст: бит на знак за поток ${P('bpc')} -- медиана ${fmt(med(R.map((r) => r.summary.bpc)))}; на последних 20% ${P('bpc2')} -- медиана ${fmt(med(R.map((r) => r.summary.bpc2)))}`);
    L.push(`        на последних 20%: орган клонов сам по себе ${P('bpcOrg2')} (жив ${R.map((r) => fmt(100 * r.summary.orgShare, 0) + '%').join(' ')}); орган контекстов ${P('bpcCtx2')} (жив ${R.map((r) => fmt(100 * r.summary.ctxShare, 0) + '%').join(' ')}); частоты знаков ${P('bpcUni2')}`); }
  if (R[0].summary.xres) {                 // мир экзамена (src/worldx.js): итог по мирам; понятия, если строились
    for (const r of R) L.push(`  экзамен «${cfg.WORLD === 'one' ? 'общий мир' : cfg.WORLD === 'ep' ? 'мир эпох' : cfg.EXAM}», мир ${r.seed}: ${JSON.stringify(r.summary.xres, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v))}`);
    for (const r of R) for (const x of r.summary.concepts) L.push(`    мир ${r.seed}: ${x}`); }
  if (R[0].summary.words) {                // мир слов: понимает ли мозг, что говорит «родитель»
    const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '-');
    if (R[0].summary.words.req) {           // опыт «просьба»: двигает ли мозг z туда, куда просят
      const S = { n: 0, dot: 0, agree: 0, moved: 0, bn: 0, bdot: 0, bagree: 0, bmoved: 0 }; for (const r of R) for (const k in S) S[k] += r.summary.words.req.st[k];
      L.push('  просьба (вторая половина жизни, все миры): сдвиг z командой мозга в сторону просьбы');
      L.push(`    когда просят: средний сдвиг ${fmt(S.dot / S.n)}, двигал (|сдвиг| > 0.3) ${pc(S.moved / S.n)} кругов, из них в сторону просьбы ${pc(S.agree / Math.max(1, S.moved))}  (${S.n} кругов)`);
      L.push(`    когда не просят (сторона наугад): средний сдвиг ${fmt(S.bdot / S.bn)}, двигал ${pc(S.bmoved / S.bn)}, из них «в сторону» ${pc(S.bagree / Math.max(1, S.bmoved))}  (${S.bn} кругов)`);
      const nw = Math.max(...R.map((r) => r.summary.words.req.win.length)), row = [];
      for (let w = 0; w < nw; w++) { let a = 0, b = 0; for (const r of R) { const x = r.summary.words.req.win[w]; if (x) { a += x[0]; b += x[1]; } } row.push(`${w + 1}: ${pc(b ? a / b : NaN)}`); }
      L.push('    круги просьбы, когда сдвиг в её сторону, по тысячам кругов: ' + row.join('  '));
    }
    if (R[0].summary.words.ask) {           // диалог: ответы на вопросы родителя
      const A0 = R[0].summary.words.ask; L.push('  диалог (вторая половина жизни, все миры): вопрос -- ответил верно / неверно / молчал');
      A0.names.forEach((nm, gi) => { let a = 0, b = 0, c2 = 0, n = 0; for (const r of R) { const x = r.summary.words.ask.by[gi]; a += x[0]; b += x[1]; c2 += x[2]; n += x[3]; }
        L.push(`    о «${nm}»: ${pc(n ? a / n : NaN)} / ${pc(n ? b / n : NaN)} / ${pc(n ? c2 / n : NaN)}  (${n} вопросов)`); });
      let ua = 0, un = 0; for (const r of R) { ua += r.summary.words.ask.unasked[0]; un += r.summary.words.ask.unasked[1]; }
      L.push(`    говорит без вопроса: ${pc(un ? ua / un : NaN)} кругов`);
      const nw = Math.max(...R.map((r) => r.summary.words.ask.win.length)), row = [];
      for (let w = 0; w < nw; w++) { let a = 0, b = 0, c2 = 0, d = 0; for (const r of R) { const x = r.summary.words.ask.win[w]; if (x) { a += x[0]; b += x[1]; c2 += x[2]; d += x[3]; } } row.push(`${w + 1}: ${pc(b ? a / b : NaN)}/${pc(d ? c2 / d : NaN)}`); }
      L.push('    ответил верно / говорит без вопроса, по тысячам кругов: ' + row.join('  '));
      A0.names.forEach((nm, gi) => {         // что отвечал: строка -- что было, столбец -- что сказал («—» -- молчал, «чужое» -- слово другой группы)
        const Wd = R[0].summary.words.groups[gi].words, n = Wd.length, sum = Array.from({ length: n }, () => new Array(n + 1).fill(0));
        for (const r of R) r.summary.words.ask.conf[gi].forEach((row, i) => row.forEach((v, j) => { sum[i][j] += v; }));
        L.push(`    ответы на вопрос о «${nm}»: строка -- что было, столбец -- что ответил`);
        L.push('    ' + ''.padEnd(12) + ['молчал', ...Wd.slice(1), 'чужое'].map((w) => w.padStart(10)).join(''));
        sum.forEach((row, i) => { const t = row.reduce((a, b) => a + b, 0); if (i && t) L.push('    ' + Wd[i].padEnd(12) + row.map((v) => pc(v / t).padStart(10)).join('') + `  (${t})`); }); });
    }
    if (R[0].summary.words.speak) R[0].summary.words.speak.forEach((g0, gi) => {   // ступень 2: что мозг сказал о прошлом событии группы
      const Wd = g0.words, n = Wd.length, sum = Array.from({ length: n }, () => new Array(n).fill(0));
      for (const r of R) r.summary.words.speak[gi].conf.forEach((row, i) => row.forEach((v, j) => { sum[i][j] += v; }));
      L.push(`  мозг говорит о «${g0.name}» (вторая половина жизни, все миры): строка -- что было на деле, столбец -- что мозг сказал из этой группы («${Wd[0]}» -- не сказал)`);
      L.push('  ' + ''.padEnd(12) + Wd.map((w) => w.padStart(11)).join('') + '   верно');
      sum.forEach((row, i) => { const m = row.reduce((a, b) => a + b, 0); L.push('  ' + Wd[i].padEnd(12) + row.map((v) => pc(m ? v / m : NaN).padStart(11)).join('') + '   ' + pc(m ? row[i] / m : NaN) + `  (${m})`); });
      const nw = Math.max(...R.map((r) => r.summary.words.speak[gi].win.length)), row = [];
      for (let w = 0; w < nw; w++) { let a = 0, b = 0, c2 = 0, d = 0; for (const r of R) { const x = r.summary.words.speak[gi].win[w]; if (x) { a += x[0]; b += x[1]; c2 += x[2]; d += x[3]; } } row.push(`${w + 1}: ${pc(b ? a / b : NaN)}/${pc(d ? c2 / d : NaN)}`); }
      L.push(`  названо верно / сказано слово этой группы, когда «${Wd[0]}», по тысячам кругов: ` + row.join('  '));
      L.push('  точность сказанного (когда мозг сказал слово, оно верно): ' + Wd.slice(1).map((w, j) => { let a = 0, b = 0; for (let i = 0; i < n; i++) { b += sum[i][j + 1]; if (i === j + 1) a += sum[i][j + 1]; } return `${w} ${pc(b ? a / b : NaN)} (${b})`; }).join(', '));
    });
    R[0].summary.words.groups.forEach((g0, gi) => {
      const Wd = g0.words, n = Wd.length, sum = Array.from({ length: n }, () => new Array(n).fill(0));
      for (const r of R) r.summary.words.groups[gi].conf.forEach((row, i) => row.forEach((v, j) => { sum[i][j] += v; }));
      L.push(`  слова «${g0.name}» (вторая половина жизни, все миры): строка -- что сказал родитель, столбец -- какое слово ждал мозг кругом раньше`);
      L.push('  ' + ''.padEnd(12) + Wd.map((w) => w.padStart(11)).join('') + '   узнано');
      sum.forEach((row, i) => { const m = row.reduce((a, b) => a + b, 0); L.push('  ' + Wd[i].padEnd(12) + row.map((v) => pc(m ? v / m : NaN).padStart(11)).join('') + '   ' + pc(m ? row[i] / m : NaN) + `  (${m})`); });
      if (g0.name === 'движение') { const selfAs = (rows, cols) => { let a = 0, m = 0; for (const i of rows) { for (let j = 0; j < 5; j++) m += sum[i][j]; for (const j of cols) a += sum[i][j]; } return m ? a / m : NaN; };
        L.push(`  «я» узнано как «я» (любое направление): ${pc(selfAs([1, 2], [1, 2]))}, как «оно»: ${pc(selfAs([1, 2], [3, 4]))}; «оно» как «оно»: ${pc(selfAs([3, 4], [3, 4]))}, как «я»: ${pc(selfAs([3, 4], [1, 2]))}`);
        const nw = Math.max(...R.map((r) => r.summary.words.selfWin.length)), row = [];
        for (let w = 0; w < nw; w++) { let a = 0, b = 0, c2 = 0, d = 0; for (const r of R) { const x = r.summary.words.selfWin[w]; if (x) { a += x[0]; b += x[1]; c2 += x[2]; d += x[3]; } } row.push(`${w + 1}: ${pc(b ? a / b : NaN)}/${pc(d ? c2 / d : NaN)}`); }
        L.push('  «я» узнано / «оно» узнано по тысячам кругов: ' + row.join('  ')); }
      L.push('  средний прогноз слова, когда оно звучит / когда нет: ' + Wd.map((w, i) => `${w} ${R.map((r) => r.summary.words.groups[gi].lift[i].map((x) => x.toFixed(2)).join('/')).join(' ')}`).join('; '));
    });
  }
  if (R[0].summary.und) { const U = (f) => fmt(med(R.map((r) => r.summary.und[f])) * 100, 0) + '%';
    L.push(`  понято (конец жизни, медиана миров, как «доля структуры мира» нейрона-3): ${U('share')} -- рёбра смесей ${U('recall')} (точность ${U('prec')}), глубокие ${U('deepOK')}, произведения ${U('prodOK')}, этажи ${U('hierOK')}, значения ${U('valOK')}`); }
  L.push('  потолок' + ks.map((k) => fmt(ceil[k]).padStart(10)).join('') + '   (линейный: нерв t+1 по всем нервам и командам круга t)');
  // карта тела
  L.push('', '  что мозг узнал о нервах (конец жизни): вид нерва -> состояние в карте мозга, по мирам');
  for (const r of R) { const by = {}; for (const m of r.mapFinal) { const s = `${m.st}${m.owner ? '+орган' : ''}`; (by[m.kind] = by[m.kind] || {})[s] = (by[m.kind][s] || 0) + 1; }
    L.push(`  мир ${r.seed}: ` + Object.entries(by).map(([k, v]) => `${k}: ` + Object.entries(v).map(([s, n]) => `${s}${n > 1 ? ' x' + n : ''}`).join(', ')).join(' | ')); }
  const after = (x) => (x >= 0 ? x - cfg.TPLUG : NaN);
  L.push(`  найден двигатель через (кругов после подключения): ${R.map((r) => fmt(after(r.firstEff), 0)).join(', ')}; моторный орган построен: ${R.map((r) => fmt(after(r.firstMotor), 0)).join(', ')}`);
  // деньги и работа
  const fl = (name) => med(R.map((r) => r.flow[name] || 0) ) / cfg.ROUNDS;
  L.push('', `  деньги за круг (медиана): мир платит ${fmt(-med(R.map((r) => r.ext.world)) / cfg.ROUNDS)}, железо берёт ${fmt(med(R.map((r) => r.ext.hardware)) / cfg.ROUNDS)}, банк ${fmt(med(R.map((r) => r.ext.bank)) / cfg.ROUNDS)}; ` +
    `плата за пользу движений -- мотору ${fmt(fl('мир->мотор: польза движений'))}, исследователю ${fmt(fl('мир->исследователь: польза движений'))}`);
  L.push(`  сумма всех счетов -- ноль в каждом круге (CHECKM=${cfg.CHECKM}); работа: ${fmt(med(R.map((r) => r.opsTotal / cfg.ROUNDS)) / 1000, 1)}k операций за круг; время мира ${fmt(med(R.map((r) => r.sec)), 1)} с`);
  return L.join('\n');
}

process.on('uncaughtException', (e) => { console.error('ОШИБКА: ' + e.message); process.exit(1); });   // ошибка в ручках -- одна понятная строка
const over = K.parseArgs(process.argv.slice(2));
if (over.KNOBS) { console.log(K.table()); return; }
const cfg = K.makeConfig(over), seeds = K.parseSeeds(cfg.SEEDS);
const jobs = cfg.JOBS || os.cpus().length;
console.log(`НЕЙРОН-4: ${cfg.WORLD === 'mix' ? `мир-смесь нейрона-3, ${cfg.WK} каналов` : cfg.WORLD === 'img' ? 'мир цифр нейрона-3' : cfg.WORLD === 'txt' ? `мир текста нейрона-3 (${cfg.WTXT === 1 ? 'Шекспир' : 'Толстой'})` : cfg.WORLD === 'exam' ? `мир экзамена «${cfg.EXAM}»` : cfg.WORLD === 'one' ? 'общий мир' : cfg.WORLD === 'ep' ? `мир эпох (${cfg.EPW}, по ${cfg.EPL} кругов)` : 'мир неизвестных органов'} | ${K.diff(cfg) || 'всё по умолчанию'} | миры ${seeds.join(',')}`);
(async () => {
  const res = []; let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, seeds.length) }, async () => {
    while (next < seeds.length) { const seed = seeds[next++];
      res.push(await new Promise((ok, bad) => { const w = new Worker(__filename, { workerData: { over, seed } }); w.on('message', ok); w.on('error', bad); })); } }));
  if (cfg.OUT === 'json') { console.log(JSON.stringify({ cfg, res })); return; }
  console.log(report(cfg, res));
  for (const r of res.sort((a, b) => a.seed - b.seed)) if (r.log.length) console.log(`\n  мир ${r.seed}, журнал исследователя:\n    ` + r.log.slice(0, 12).join('\n    '));
  for (const r of res) if (r.memLog.length) console.log(`\n  мир ${r.seed}, органы памяти (построено ${r.memBuilt} за ${r.memScanned} примерок, живы: ${r.memOrgans.join('; ') || 'нет'}):\n    ` + r.memLog.slice(0, 10).join('\n    '));
})().catch((e) => { console.error('ОШИБКА: ' + e.message + '\n' + e.stack); process.exit(1); });

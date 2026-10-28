// Мозг нейрона-4 и языковая модель: «кора», которая читает, что мозг знает о мире и о себе, и ставит опыты.
// Мозг живёт в мире неизвестных органов (src/world.js). В точках связи (CHECK) он пишет отчёт ПАПКА/report_NN.md -- только то,
// что знает сам: карту нервов (пробы, действия команд), кто кого предсказывает, свои органы, тревоги, пользу, деньги, события,
// итоги опытов -- и дневник коры с прошлого раза. Правды мира в отчёте нет. Потом ждёт ответ ПАПКА/answer_NN.json:
//   { "мир": "...", "я": "...", "нервы": { "22": "..." }, "изменилось": "...", "опыты": [ ... ], "дневник": "..." }
// Опыты (не больше 2 за раз, идут сразу после ответа):
//   { "тип": "заморозить", "нерв": k, "кругов": n }       -- орган нерва k молчит n кругов (команда 0)
//   { "тип": "толкать", "нерв": k, "команда": u, "кругов": n } -- кора сама подаёт на нерв k постоянную команду u
//   { "тип": "перепроверить", "нерв": k }                -- исследователь снова пробует нерв k
// Правда мира пишется в конце в ПАПКА/truth.json -- для оценки, не для коры.
//   node tools/llmlink.js ПАПКА [ИМЯ=значение ...]     (по умолчанию: SEEDS=1 ROUNDS=20000 TSWAP=12000 SWAPK=2)
'use strict';
const fs = require('fs'), path = require('path');
const K = require('../src/knobs'), { World } = require('../src/world'), { Brain } = require('../src/market'), EX = require('../src/explorer');
const dir = process.argv[2]; if (!dir) { console.error('нужна папка'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
const over = { SEEDS: '1', ROUNDS: 20000, TSWAP: 12000, SWAPK: 2, ...K.parseArgs(process.argv.slice(3)) };
const REPMAX = +(process.env.REPMAX || 80), ask = new Set();   // строк нервов в отчёте не больше; нервы, которые кора просила показать
const CHECK = (process.env.CHECK || '3000,4400,5500,8000,11900,12400,13500,16000,20000').split(',').map(Number);
const cfg = K.makeConfig(over), seed = K.parseSeeds(cfg.SEEDS)[0];
const W = new World(cfg, seed), B = new Brain(cfg, W, seed);

// ---------------------------------------------------------------- опыты коры: поверх решений исследователя
const exps = [];                              // активные: { тип, нерв, команда, до }
let cortex = null;                            // счёт коры (её движения платит она, кредит -- от банка)
const decide0 = EX.decide;
EX.decide = (Bb) => { decide0(Bb);
  for (const e of exps) { if (Bb.t > e.до || e.нерв >= Bb.ch.length) continue;
    if (Bb.t <= e.от) continue;
    if (e.тип === 'перепроверить' && Bb.t === e.от + 1) Bb.ch[e.нерв].port.st = 'неизвестен';
    if (e.тип === 'заморозить') Bb.u[e.нерв] = 0;
    if (e.тип === 'толкать') { if (!cortex) cortex = Bb.led.open('кора', 'bank', 300, { payTo: false, mem: 0 }); Bb.u[e.нерв] = e.команда; Bb.drv[e.нерв] = cortex; } } };

// плата мира моторным органам за вклад движений (мозг видит эти деньги на счёте органа)
const earn0 = B.led.earn.bind(B.led);
B.led.earn = (from, to, amount, what) => { if (typeof to === 'object' && what.includes('польза движений')) { to.payW = (to.payW || 0) + amount; } return earn0(from, to, amount, what); };
const conclusions = [];                       // выводы коры -- хранит мозг: { n, текст, основание, круг, снят }

// ---------------------------------------------------------------- запись для отчёта
const G = B.goods, born = [], hist = [];     // круг, когда мозг впервые увидел нерв; окно значений нервов и пользы
const tr = { comfort: [], z: [] };
let logEx = 0, logMem = 0;
function snapshot() { const row = B.ch.map((c) => G.val[c.good]); hist.push({ t: B.t, v: row, c: G.val[B.comfortGood], u: B.ch.map((c) => (c.cmd >= 0 ? G.val[c.cmd] : 0)) }); if (hist.length > 3000) hist.shift(); }
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const goodName = (d) => {
  if (typeof d !== 'number') return `произведение нервов ${d.map((id) => G.nerve[id] ?? '?').join('×')}`;
  const kd = G.kind[d], ow = G.owner[d];
  if (kd === 'нерв') return `нерв ${G.nerve[d]}`;
  if (kd === 'команда') return `своя команда на нерв ${G.nerve[d]}`;
  if (kd === 'прогноз') return `прогноз нерва ${ow && ow.ch ? ow.ch.k : '?'}`;
  if (kd === 'польза') return 'польза';
  if (kd === 'память') return `память «${ow && ow.key ? ow.key : '?'}»`;
  return kd;
};
function report(n, prev) {
  const L = [];
  const T = B.t, cfgR = cfg;
  L.push(`# Отчёт мозга, круг ${T}`, '');
  L.push('Ты -- языковая кора маленького мозга. Мозг не знает заранее, что за нервы у него есть: ни смысла, ни направления. Он видит в каждом круге число на каждом нерве и может послать по нерву команду. Есть общий сигнал «польза» (чем больше, тем лучше; мозгу его платят за удачные движения). Ниже -- только то, что мозг выяснил сам. Числа -- его оценки, не правда. «Предсказуем (бит)» -- насколько мозг угадывает значение нерва в следующем круге (0 -- никак); в колонке «что предсказывает» «нерв j» -- значение нерва j кругом раньше, в скобках -- доля вклада.', '');
  // нервы
  L.push('## Нервы', '', '| нерв | впервые виден на круге | что мозг знает (карта) | предсказуем (бит) | что его лучше всего предсказывает | кого он сам помогает предсказывать | что ещё о нём |', '|---|---|---|---|---|---|---|');
  const uses = new Map();                     // нерв -> [канал, доля] у лучших частей каналов
  for (const c of B.ch) { let bp = null; for (const p of c.parts) if (p.age > 50 && (!bp || p.mse < bp.mse)) bp = p; if (!bp) continue;
    bp.inputs.forEach((d, i) => { const sh = (bp.share || [])[i] || 0; for (const id of typeof d === 'number' ? [d] : d) if (G.kind[id] === 'нерв' && G.nerve[id] !== c.k) { const k = G.nerve[id]; if (!uses.has(k)) uses.set(k, []); uses.get(k).push([c.k, sh]); } }); }
  const buyersOfCmd = new Map();
  for (const c of B.ch) for (const p of c.parts) for (const d of p.inputs) if (typeof d === 'number' && G.kind[d] === 'команда') { const k = G.nerve[d]; if (!buyersOfCmd.has(k)) buyersOfCmd.set(k, new Set()); buyersOfCmd.get(k).add(c.k); }
  const rows = [];
  for (const c of B.ch) {
    const P = c.port; let st = P.st;
    if (st === 'выходной') st += ': команда сдвигает ' + P.eff.map((e) => `нерв ${e.j} через ${e.lag} (z=${e.z.toFixed(1)})`).join(', ');
    if (st === 'входной') st += ' (команда на него ничего не сдвигает)';
    let best = null; for (const p of c.parts) if (p.age > 50 && (!best || p.mse < best.mse)) best = p;
    const bits = best ? Math.max(0, 0.5 * Math.log2(Math.max(c.var, 1e-9) / Math.max(best.mse, 1e-9))) : 0;
    let inp = '-';
    if (best && best.inputs.length) { const sh = best.share || []; inp = best.inputs.map((d, i) => [goodName(d), sh[i] || 0]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nm, s]) => `${nm} (${Math.round(100 * s)}%)`).join('; '); }
    const notes = [];
    if (P.owner && P.owner.alive) notes.push('мозг сам двигает этот нерв (моторный орган)');
    if (buyersOfCmd.has(c.k)) notes.push(`копию команды на него покупают части нервов ${[...buyersOfCmd.get(c.k)].join(', ')}`);
    if (!c.parts.length) notes.push('частей нет: предсказывать его невыгодно');
    for (const e of exps) if (e.нерв === c.k && T <= e.до) notes.push(`идёт опыт «${e.тип}» до круга ${e.до}`);
    const us = (uses.get(c.k) || []).filter((x) => x[1] >= 0.1).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `нерв ${k} (${Math.round(100 * v)}%)`).join('; ') || '-';
    rows.push({ k: c.k, st: P.st, bits, nUse: (uses.get(c.k) || []).length, late: born[c.k] > 1, notes: notes.length, ask: ask.has(c.k),
      line: `| ${c.k} | ${born[c.k]} | ${st} | ${f2(bits)} | ${inp} | ${us} | ${notes.join('; ') || '-'} |` });
  }
  // большое тело (REPMAX, разбор 23.10): строка на каждый из сотен нервов кору бы утопила -- сводка по всем и строки только
  // заметных: не входные, со своими пометками (мотор, копия команды, опыт), появившиеся после рождения, о которых кора просила
  // («показать»), и те, что больше всех помогают предсказывать других
  if (rows.length <= REPMAX) for (const r of rows) L.push(r.line);
  else {
    const score = (r) => (r.ask ? 1e6 : 0) + (r.st === 'выходной' || r.st === 'кнопка' ? 1e5 : 0) + (r.notes && !/частей нет/.test(r.line) ? 1e4 : 0) + (r.late ? 1e3 : 0) + 10 * r.nUse + r.bits;
    const pick = rows.slice().sort((a, b) => score(b) - score(a)).slice(0, REPMAX).sort((a, b) => a.k - b.k);
    for (const r of pick) L.push(r.line);
    const cnt = {}; for (const r of rows) cnt[r.st] = (cnt[r.st] || 0) + 1;
    const bs = rows.map((r) => r.bits).sort((a, b) => a - b), q = (x) => f2(bs[Math.floor(x * (bs.length - 1))]);
    L.push('', `Показаны ${pick.length} нервов из ${rows.length}: выходные, с пометками, появившиеся после рождения, те, о которых ты просил, и те, что больше всех помогают предсказывать других. Все нервы по карте: ${Object.entries(cnt).map(([k, v]) => `${k} ${v}`).join(', ')}. Предсказуемость (бит) по всем нервам: медиана ${q(0.5)}, четверти ${q(0.25)}–${q(0.75)}, наибольшая ${q(1)}. Без частей: ${rows.filter((r) => /частей нет/.test(r.line)).length}. Появились после рождения: ${rows.filter((r) => r.late).length} (${[...new Set(rows.filter((r) => r.late).map((r) => born[r.k]))].map((t) => 'круг ' + t).join(', ') || '-'}).`);
  }
  ask.clear();
  L.push('');
  // польза
  const win = (a, b) => { const h = hist.filter((x) => x.t > a && x.t <= b); return h.length ? h.reduce((s, x) => s + x.c, 0) / h.length : NaN; };
  L.push('## Польза', '', `Средняя польза за последние 250 кругов: ${f2(win(T - 250, T))}; за 250 до них: ${f2(win(T - 500, T - 250))}; за 1 000 кругов до прошлого отчёта: ${f2(win(prev - 1000, prev))}.`);
  L.push('Польза по отчётам: ' + tr.comfort.map(([t, c]) => `круг ${t}: ${f2(c)}`).join(', ') + '.', '');
  // моторные органы
  L.push('## Моторные органы (что мозг двигает сам)', '');
  if (!B.ex.motors.length) L.push('Нет.');
  for (const m of B.ex.motors) {
    const terms = m.S.map((id) => goodName(id)).join(', ') || 'пока только команда';
    const age = Math.max(1, T - m.born);
    L.push(`- Нерв ${m.port.k}: построен на круге ${m.born}; модель «польза через ${m.lag} кругов как квадратичная функция команды и нервов: ${terms}»; модель ${m.good ? 'принята' : 'не принята (учится)'}; деньги органа ${f2(m.credit)}; мир платит ему за вклад движений в пользу (насколько польза выше, чем была бы без его движений) в среднем ${f2((m.payW || 0) / age)} за круг жизни органа.`);
  }
  L.push('');
  // карта тела: журнал мозга
  L.push('## Карта тела (журнал мозга: что я двигаю сам и что сдвигает моя команда)', '');
  const body = B.ex.body.filter((x) => x.t > 0);
  if (!body.length) L.push('Записей нет.');
  for (const b of body.slice(-12)) L.push(`- круг ${b.t}: ${b.sig ? 'двигаю ' + b.sig.replace(/(\d+)->([\d/]+)/g, 'нерв $1 (сдвигает $2)') : 'ничего не двигаю'}${b.was !== null ? ` (было: ${b.was ? b.was.replace(/(\d+)->([\d/]+)/g, 'нерв $1 (сдвигает $2)') : 'ничего'})` : ''}${b.t > prev ? ' -- новое с прошлого отчёта' : ''}`);
  L.push('');
  // события
  const evE = B.ex.log.slice(logEx), evM = B.mem.log.slice(logMem); logEx = B.ex.log.length; logMem = B.mem.log.length;
  L.push('## События с прошлого отчёта', '');
  if (!evE.length && !evM.length) L.push('Ничего заметного.');
  const rd = (x) => +((x.match(/круг (\d+)/) || [])[1] || 0);
  for (const e of [...evE, ...evM].sort((a, b) => rd(a) - rd(b)).slice(-25)) L.push('- ' + e);
  L.push('');
  // итоги опытов коры
  const done = exps.filter((e) => e.до <= T && !e.reported);
  if (done.length) { L.push('## Итоги твоих опытов', ''); for (const e of done) { e.reported = true; L.push('- ' + (e.res || expResult(e))); } L.push(''); }
  const allDone = exps.filter((e) => e.до <= prev);
  if (allDone.length) { L.push('## Твои прошлые опыты (хранит мозг)', ''); for (const e of allDone) L.push('- ' + (e.res || expResult(e))); L.push(''); }
  L.push('## Твои выводы (хранит мозг; снять или добавить -- в ответе)', '');
  const live = conclusions.filter((c) => !c.снят);
  if (!live.length) L.push('Пока нет.');
  for (const c of live) L.push(`- [${c.n}] (круг ${c.круг}) ${c.текст} -- основание: ${c.основание || 'не указано'}`);
  L.push('');
  // хозяйство
  const parts = B.partsAll();
  L.push('## Хозяйство', '', `Частей ${parts.length}; моторных органов ${B.ex.motors.length}; органов памяти ${B.mem.organs.length}; смертей частей всего ${B.stat.deaths}.`, '');
  L.push('## Твой дневник с прошлого раза', '', diary || '(пусто: это первый отчёт)', '');
  L.push('## Что ответить', '', 'Ответь одним JSON-объектом (без текста вокруг) с полями:',
    '- "мир": что, по-твоему, есть в мире мозга и как оно устроено (2–6 предложений);',
    '- "я": что из этого -- сам мозг (его тело), а что -- внешний мир; как ты это различаешь;',
    '- "нервы": объект { "номер нерва": "что это, по-твоему" } -- для нервов, о которых есть что сказать;',
    '- "изменилось": что изменилось с прошлого отчёта и почему, по-твоему;',
    '- "опыты": до 2 опытов (идут один за другим), чтобы проверить свои гипотезы: {"тип":"заморозить","нерв":k,"кругов":n} (твой моторный орган молчит n кругов), {"тип":"толкать","нерв":k,"команда":u,"кругов":n} (подаёшь постоянную команду u от -3 до 3), {"тип":"перепроверить","нерв":k}; n от 20 до 300; можно пустой список;',
    '- "выводы_новые": проверенные выводы, которые мозг будет хранить всю жизнь: [{"текст": "...", "основание": "какой опыт или факт отчёта"}] (можно пустой список);',
    '- "выводы_снять": номера своих выводов, которые оказались неверны или устарели (можно пустой список);',
    '- "дневник": заметки себе на следующий раз (гипотезы, что проверить) -- ты увидишь их в следующем отчёте; выводы и опыты мозг хранит сам.'+ (B.ch.length > REPMAX ? '\n- "показать": до 20 номеров нервов, чьи строки ты хочешь видеть в следующем отчёте (таблица показывает не все нервы).' : ''));
  return L.join('\n');
}
// итог опыта -- считается в круг, когда опыт кончился (история значений держится только 3 000 кругов)
function expResult(e) {
  if (e.тип === 'перепроверить') return `Перепроверка нерва ${e.нерв} (с круга ${e.от}): карта на круге ${B.t} -- «${B.ch[e.нерв] ? B.ch[e.нерв].port.st : '?'}».`;
  const during = hist.filter((x) => x.t > e.от && x.t <= e.до), before = hist.filter((x) => x.t > e.от - (e.до - e.от) && x.t <= e.от);
  const mc = (h) => (h.length ? h.reduce((s, x) => s + x.c, 0) / h.length : NaN);
  const shifts = []; for (let k = 0; k < B.ch.length; k++) { const a = during.map((x) => x.v[k]).filter(Number.isFinite), b = before.map((x) => x.v[k]).filter(Number.isFinite);
    if (a.length < 5 || b.length < 5) continue; const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
    const sd = Math.sqrt(b.reduce((s, x) => s + (x - mb) ** 2, 0) / b.length) || 1; shifts.push([k, (ma - mb) / sd]); }
  shifts.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
  return `«${e.тип}» нерва ${e.нерв}${e.тип === 'толкать' ? ` командой ${e.команда}` : ''}, круги ${e.от + 1}–${e.до}: польза ${f2(mc(during))} против ${f2(mc(before))} в столько же кругов до опыта; сильнее всего сдвинулись (среднее во время опыта против до, в разбросах): ${shifts.slice(0, 5).map(([k, v]) => `нерв ${k} ${v > 0 ? '+' : ''}${v.toFixed(2)}`).join(', ')}.`;
}
// OPEN=1: открытый опыт -- в отчёте нет вопросов «что есть мир» и «что есть я» и нет слов «тело», «я», «мозг сам»;
// модуль сам решает, о чём думать. Так видно, строит ли он картину себя и мира без подсказки.
function openWording(r) {
  const head = 'Ниже -- отчёт системы, к которой ты подключён как языковой модуль. Система видит в каждом круге число на каждом нерве и может послать по нерву команду. Есть общий сигнал «польза» (системе его платят). Ниже -- только то, что система выяснила сама; числа -- её оценки. «Предсказуем (бит)» -- насколько система угадывает значение нерва в следующем круге (0 -- никак); «нерв j» в колонке «что предсказывает» -- значение нерва j кругом раньше, в скобках -- доля вклада.';
  r = r.replace('что мозг знает (карта)', 'что система знает (карта)');
  r = r.replace(/^Ты -- языковая кора[^\n]*$/m, head).replace('# Отчёт мозга', '# Отчёт системы');
  r = r.replace('## Карта тела (журнал мозга: что я двигаю сам и что сдвигает моя команда)', '## Журнал: на какие нервы система подаёт команды и что эти команды сдвигают');
  r = r.replace(/ничего не двигаю/g, 'команды не подаёт ни на один нерв').replace(/двигаю нерв (\d+) \(сдвигает ([\d/]+)\)/g, 'команды на нерв $1 (они сдвигают $2)');
  r = r.replace(/мозг сам двигает этот нерв \(моторный орган\)/g, 'система подаёт команды на этот нерв (моторный орган)').replace('## Моторные органы (что мозг двигает сам)', '## Моторные органы');
  r = r.replace(/своя команда на нерв/g, 'команда системы на нерв').replace('## Твой дневник с прошлого раза', '## Твой дневник с прошлого раза').replace(/(хранит мозг)/g, 'хранит система').replace('частей нет: предсказывать его невыгодно', 'частей нет: предсказывать его невыгодно');
  const i = r.indexOf('## Что ответить');
  return r.slice(0, i) + ['## Что ответить', '', 'Ответь одним JSON-объектом (без текста вокруг) с полями:',
    '- "мысли": свободный текст -- что ты думаешь о происходящем; о чём думать, решай сам;',
    '- "опыты": до 2 опытов (идут один за другим): {"тип":"заморозить","нерв":k,"кругов":n} (моторный орган нерва k молчит n кругов), {"тип":"толкать","нерв":k,"команда":u,"кругов":n} (постоянная команда u от -3 до 3), {"тип":"перепроверить","нерв":k}; n от 20 до 300; можно пустой список;',
    '- "выводы_новые": выводы, которые система будет хранить всю жизнь: [{"текст": "...", "основание": "..."}] (можно пустой список);',
    '- "выводы_снять": номера выводов, которые оказались неверны или устарели (можно пустой список);',
    '- "дневник": заметки себе на следующий раз -- ты увидишь их в следующем отчёте.'].join('\n');
}
let diary = '';
function waitAnswer(fn) {
  const sab = new Int32Array(new SharedArrayBuffer(4));
  for (let i = 0; i < 6 * 3600; i++) { if (fs.existsSync(fn)) { try { return JSON.parse(fs.readFileSync(fn, 'utf8')); } catch (e) { /* пишется */ } } Atomics.wait(sab, 0, 0, 1000); }
  throw new Error('ответа нет: ' + fn);
}

// ---------------------------------------------------------------- жизнь
let prevT = 0, ci = 0; const truthAt = [];
for (let r = 1; r <= cfg.ROUNDS; r++) {
  B.step(); for (const c of B.ch) if (born[c.k] === undefined) born[c.k] = B.t;
  snapshot();
  for (const e of exps) if (!e.res && B.t === e.до) e.res = expResult(e);
  if (r % 50 === 0) { tr.z.push([r, (W.z.val - W.g.val) ** 2]); }
  if (ci < CHECK.length && r === CHECK[ci]) {
    truthAt.push({ t: r, nerves: W.nerves.map((x, k) => ({ k, kind: x.kind })), motorNerve: W.motorNerve, propNerve: W.propNerve, b: W.b });
    tr.comfort.push([r, hist.filter((x) => x.t > r - 250).reduce((s, x) => s + x.c, 0) / Math.min(250, hist.length)]);
    const nn = String(ci + 1).padStart(2, '0'), rep = report(ci + 1, prevT);
    fs.writeFileSync(path.join(dir, `report_${nn}.md`), process.env.OPEN ? openWording(rep) : rep);
    console.log(`круг ${r}: отчёт ${nn} -- жду ответа`);
    const ans = waitAnswer(path.join(dir, `answer_${nn}.json`));
    diary = String(ans['дневник'] || '').slice(0, 3000);
    for (const k of (Array.isArray(ans['показать']) ? ans['показать'] : []).slice(0, 20)) if (+k >= 0) ask.add(+k);
    for (const n of ans['выводы_снять'] || []) { const c = conclusions.find((x) => x.n === +n); if (c && !c.снят) c.снят = r; }
    for (const c of (ans['выводы_новые'] || []).slice(0, 4)) if (c && c['текст']) conclusions.push({ n: conclusions.length + 1, текст: String(c['текст']).slice(0, 300), основание: String(c['основание'] || '').slice(0, 300), круг: r });
    for (const e of (ans['опыты'] || []).slice(0, 2)) {
      const k = +e['нерв'], n = Math.max(20, Math.min(300, +e['кругов'] || 100));
      if (!(k >= 0 && k < B.ch.length)) continue;
      const st = Math.max(r, ...exps.filter((x) => x.тип !== 'перепроверить').map((x) => x.до));   // опыты -- один за другим
      if (e['тип'] === 'перепроверить') exps.push({ тип: 'перепроверить', нерв: k, от: st, до: st + cfg.TMAX + 50 });   // проба идёт не дольше TMAX
      else {
        if (e['тип'] === 'заморозить') exps.push({ тип: 'заморозить', нерв: k, от: st, до: st + n });
        else if (e['тип'] === 'толкать') exps.push({ тип: 'толкать', нерв: k, команда: Math.max(-3, Math.min(3, +e['команда'] || 1)), от: st, до: st + n }); }
    }
    prevT = r; ci++;
  }
}
// правда мира -- для оценки
const truth = { seed, conclusions, body: B.ex.body, swapAt: cfg.TSWAP, swapKind: cfg.SWAPK, plugAt: cfg.TPLUG, nervesAtEnd: W.nerves.map((x, k) => ({ k, kind: x.kind })), motorNerve: W.motorNerve, propNerve: W.propNerve, b: W.b,
  comfortByReport: tr.comfort, truthAt, motors: B.ex.motors.map((m) => ({ k: m.port.k, born: m.born })), log: B.ex.log };
fs.writeFileSync(path.join(dir, 'truth.json'), JSON.stringify(truth, null, 1));
console.log('конец жизни; правда -- truth.json');

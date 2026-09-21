#!/usr/bin/env node
'use strict';
/* ============================================================
   ТОЖДЕСТВО ПРИ НУЛЕ ДЛЯ ЗАЧАТКА

   Во вторую редакцию grow.js внесены две правки: снят потолок
   населения и введена плата за держание связи. Обе -- параметрами.
   Правило проекта: добавляя параметр, обязан показать, что при его
   ОТКЛЮЧЁННОМ значении мир совпадает с прежним ПОБИТОВО. Иначе
   всякое расхождение дальше можно будет списать на правку, а можно на
   что угодно ещё, и разобрать будет нельзя.

   Сверяется с первой редакцией, взятой из git (HEAD на момент правки),
   а не с пересказом её поведения.

     CAP=400 HOLD=0 -- обязано совпасть побитово с первой редакцией;
     HOLD>0         -- обязано РАЗОЙТИСЬ, иначе плата ни на что не
                       влияет и тождество выше ничего не доказывает
                       (пустой отсчёт, ошибка №49).
   ============================================================ */
const path = require('path');
const V1 = process.argv[2] || path.resolve(__dirname, 'grow_v1_ref.js');
if (!V1) { console.error('нужен путь к первой редакции grow.js'); process.exit(2); }

let fails = 0;
const check = (name, ok, note) => {
  console.log(`${ok ? ' ok  ' : 'ПРОВАЛ'} ${name}${note ? '  ' + note : ''}`);
  if (!ok) fails++;
};

/* отпечаток мира: состояния, кредиты, шаги, замирания, связи */
function fp(w) {
  const out = [`round=${w.round}`, `n=${w.parts.length}`, `nextId=${w.nextId}`];
  for (const p of w.parts) {
    const links = p.links.map((l) => (typeof l === 'number' ? l : l.j)).slice().sort((a, b) => a - b);
    out.push(`${p.id}:${Array.from(p.x).map((v) => v.toFixed(15)).join(',')}` +
      `|${p.credit.toFixed(12)}|${p.steps}|${p.frozen}|${p.kids}|${p.born}` +
      `|${p.par.mix.toFixed(15)},${p.par.greed.toFixed(15)},${p.par.urge.toFixed(15)}` +
      `|${links.join('.')}`);
  }
  return out.join('\n');
}

function load(file, env) {
  for (const k of ['BASE', 'HOLD', 'DECAY', 'CAP', 'SAFETY', 'TAX', 'LEARN', 'W', 'HEAD', 'INVERT', 'EREF', 'GRACE',
    'FAULT', 'MISS', 'ROT', 'SLIP', 'GHOST', 'ROT_UNTIL', 'ROT_ALL', 'MARKS', 'HOPS', 'PUSH', 'MIX0', 'ANCHOR', 'ANCHOR_OWN', 'KIN', 'KIN_S', 'LOOP', 'MEET', 'BUDGET', 'KIN_NEAR'])
    delete process.env[k];   // иначе значение протекает из прошлой загрузки
  Object.assign(process.env, env);
  delete require.cache[require.resolve(file)];
  return require(file);
}

const ROUNDS = 300;
for (const base of ['0.5', '0.05']) {
  for (const seed of [1, 2, 3]) {
    const old = load(path.resolve(V1), { BASE: base });
    const a = fp(old.run(seed, ROUNDS));

    const now = load(path.resolve(__dirname, '../grow.js'), { BASE: base, HOLD: '0', CAP: '400' });
    const b = fp(now.run(seed, ROUNDS));

    check(`BASE=${base} сид ${seed}: при CAP=400 HOLD=0 мир тот же, побитово`, a === b,
      a === b ? '' : 'отпечатки разошлись');

    // пустой отсчёт для тождества: плата обязана что-то менять
    const paid = load(path.resolve(__dirname, '../grow.js'), { BASE: base, HOLD: '0.1', CAP: '400' });
    const c = fp(paid.run(seed, ROUNDS));
    check(`BASE=${base} сид ${seed}: при HOLD=0.1 мир РАСХОДИТСЯ с прежним`, b !== c);
  }
}

// снятие потолка обязано быть различимо само по себе
{
  const capped = load(path.resolve(__dirname, '../grow.js'), { BASE: '0.05', HOLD: '0', CAP: '400' });
  const wc = capped.run(1, 600);
  const free = load(path.resolve(__dirname, '../grow.js'), { BASE: '0.05', HOLD: '0' });
  const wf = free.run(1, 600);
  check('снятый потолок различим: без CAP частей больше, чем с CAP=400',
    wf.parts.length > wc.parts.length,
    `с потолком ${wc.parts.length}, без потолка ${wf.parts.length}`);
}

/* --- налог на расхождение: тождество при нуле и пустые отсчёты к нему --- */
{
  const base = { BASE: '0.05', HOLD: '0.1', CAP: '64' };
  for (const seed of [1, 2, 3]) {
    const a = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({}, base)).run(seed, 400));
    const b = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ TAX: '0' }, base)).run(seed, 400));
    check(`налог: сид ${seed}, при TAX=0 мир тот же, побитово`, a === b);

    const c = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ TAX: '1' }, base)).run(seed, 400));
    check(`налог: сид ${seed}, при TAX=1 мир РАСХОДИТСЯ`, a !== c);

    // перестановка обязана что-то менять, иначе нуль пустой (ошибка №49)
    const d = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ TAX: '1' }, base)).run(seed, 400, 200, true));
    check(`налог: сид ${seed}, перемешанный мир расходится со своим`, c !== d);

    // при TAX=0 перемешивать нечего: перестановка не смеет ничего менять
    const e = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({}, base)).run(seed, 400, 200, true));
    check(`налог: сид ${seed}, при TAX=0 перестановка ни на что не влияет`, a === e);
  }
}

/* --- перевёрнутое правило: обязано быть различимо и не трогать нуля --- */
{
  const base = { BASE: '0.05', HOLD: '0.1', CAP: '64' };
  for (const seed of [1, 2]) {
    const norm = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ TAX: '40' }, base)).run(seed, 400));
    const inv = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ TAX: '40', INVERT: '1' }, base)).run(seed, 400));
    check(`переворот: сид ${seed}, перевёрнутое правило расходится с обычным`, norm !== inv);

    const zero = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({}, base)).run(seed, 400));
    const invZero = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ INVERT: '1' }, base)).run(seed, 400));
    check(`переворот: сид ${seed}, при TAX=0 переворот ни на что не влияет`, zero === invZero);
  }
}

/* --- отсрочка: тождество при нуле и различимость при ненуле --- */
{
  const base = { BASE: '0.05', HOLD: '0.1', CAP: '64', TAX: '40' };
  for (const seed of [1, 2]) {
    const a = fp(load(path.resolve(__dirname, '../grow.js'), Object.assign({}, base)).run(seed, 400));
    const b = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ GRACE: '0' }, base)).run(seed, 400));
    check(`отсрочка: сид ${seed}, при GRACE=0 мир тот же, побитово`, a === b);
    const c = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ GRACE: '5' }, base)).run(seed, 400));
    check(`отсрочка: сид ${seed}, при GRACE=5 мир РАСХОДИТСЯ`, a !== c);
  }
}

/* --- сбои: тождество при нуле и различимость каждого порознь --- */
{
  const base = { BASE: '0.05', HOLD: '0.1', CAP: '64', TAX: '40', GRACE: '30' };
  for (const seed of [1, 2]) {
    const a = fp(load(path.resolve(__dirname, '../grow.js'), Object.assign({}, base)).run(seed, 300));
    const z = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ FAULT: '0' }, base)).run(seed, 300));
    check(`сбои: сид ${seed}, при FAULT=0 мир тот же, побитово`, a === z);
    for (const f of ['MISS', 'ROT', 'SLIP', 'GHOST']) {
      const env = Object.assign({}, base); env[f] = '0.05';
      const b = fp(load(path.resolve(__dirname, '../grow.js'), env).run(seed, 300));
      check(`сбои: сид ${seed}, ${f} поодиночке уводит мир`, a !== b);
    }
  }
}

/* --- память меток: тождество при нуле и то, что она НЕ УБЫВАЕТ --- */
{
  const base = { BASE: '0.05', HOLD: '0.1', CAP: '64', TAX: '40', GRACE: '30', ROT: '0.05' };
  for (const seed of [1, 2]) {
    const a = fp(load(path.resolve(__dirname, '../grow.js'), Object.assign({}, base)).run(seed, 300));
    const b = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ MARKS: '1' }, base)).run(seed, 300));
    check(`метки: сид ${seed}, при MARKS=1 ход мира тот же, побитово`, a === b,
      'память ни на что не влияет -- она пока только записывается');

    // главное свойство: память не убывает НИ У КОГО НИ РАЗУ
    const G = load(path.resolve(__dirname, '../grow.js'), Object.assign({ MARKS: '1' }, base));
    const w = G.createSeed(seed);
    let shrank = 0, grew = 0;
    for (let r = 0; r < 600; r++) {
      const before = w.parts.map((p) => p.mem.size);
      G.round(w);
      w.parts.forEach((p, i) => {
        if (i < before.length) {
          if (p.mem.size < before[i]) shrank++;
          if (p.mem.size > before[i]) grew++;
        }
      });
    }
    check(`метки: сид ${seed}, память ни разу не убыла`, shrank === 0 && grew > 0,
      `убыло ${shrank}, приросло ${grew}`);
  }
}

/* --- отталкивание: тождество при нуле, различимость, и что знак работает --- */
{
  const base = { BASE: '0.05', HOLD: '0.1', CAP: '64', TAX: '40', GRACE: '30' };
  for (const seed of [1, 2]) {
    const a = fp(load(path.resolve(__dirname, '../grow.js'), Object.assign({}, base)).run(seed, 300));
    const b = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ PUSH: '0' }, base)).run(seed, 300));
    check(`отталкивание: сид ${seed}, при PUSH=0 мир тот же, побитово`, a === b);

    // при PUSH=1 и прежнем MIX0 мир тоже обязан совпасть: знак не тронут,
    // а (1 - |mix|) при mix > 0 равно (1 - mix). Пустой отсчёт к следующей проверке.
    const c = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ PUSH: '1', MIX0: '0.3' }, base)).run(seed, 300));
    check(`отталкивание: сид ${seed}, PUSH=1 при том же MIX0 ничего не меняет`, a === c);

    const d = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ PUSH: '1', MIX0: '-0.3' }, base)).run(seed, 300));
    check(`отталкивание: сид ${seed}, при MIX0=-0.3 мир РАСХОДИТСЯ`, a !== d);
  }
}

/* --- привязка состояния к памяти --- */
{
  const base = { BASE: '0.05', HOLD: '0.1', CAP: '64', TAX: '40', GRACE: '30',
    ROT: '0.05', PUSH: '1', MIX0: '-0.3', MARKS: '1', HOPS: '1' };
  for (const seed of [1, 2]) {
    const a = fp(load(path.resolve(__dirname, '../grow.js'), Object.assign({}, base)).run(seed, 300));
    const b = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ ANCHOR: '0' }, base)).run(seed, 300));
    check(`привязка: сид ${seed}, при ANCHOR=0 мир тот же, побитово`, a === b);
    const c = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ ANCHOR: '0.2' }, base)).run(seed, 300));
    check(`привязка: сид ${seed}, при ANCHOR=0.2 мир РАСХОДИТСЯ`, a !== c);

    // подпись обязана быть РАЗНОЙ у разных частей, иначе привязка
    // тянет всех в одну точку и это просто ещё одно усреднение
    const G = load(path.resolve(__dirname, '../grow.js'), Object.assign({ ANCHOR: '0.2' }, base));
    const w = G.createSeed(seed);
    for (let r = 0; r < 800; r++) G.round(w);
    const sig = w.parts.filter((p) => p.sigW > 0)
      .map((p) => Array.from(p.sigSum).map((v) => v / p.sigW));
    let far = 0, n = 0;
    for (let i = 0; i < sig.length; i++) for (let j = i + 1; j < sig.length; j++) {
      let d = 0;
      for (let k = 0; k < sig[i].length; k++) d += Math.abs(sig[i][k] - sig[j][k]);
      if (d / sig[i].length > 0.02) far++;
      n++;
    }
    check(`привязка: сид ${seed}, подписи у частей РАЗНЫЕ`, n > 0 && far / n > 0.5,
      `подписей ${sig.length}, различных пар ${n ? (100 * far / n).toFixed(0) : 0}%`);
  }
}

/* --- лицо как адрес --- */
{
  const base = { BASE: '0.05', HOLD: '0.1', CAP: '64', TAX: '40', GRACE: '30',
    ROT: '0.01', PUSH: '1', MIX0: '-0.3', MARKS: '1', HOPS: '1',
    ANCHOR: '0.2', ANCHOR_OWN: '1' };
  for (const seed of [1, 2]) {
    const a = fp(load(path.resolve(__dirname, '../grow.js'), Object.assign({}, base)).run(seed, 400));
    const b = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ KIN: '0' }, base)).run(seed, 400));
    check(`адрес: сид ${seed}, при KIN=0 мир тот же, побитово`, a === b);
    for (const k of ['1', '-1']) {
      const c = fp(load(path.resolve(__dirname, '../grow.js'),
        Object.assign({ KIN: k }, base)).run(seed, 400));
      check(`адрес: сид ${seed}, при KIN=${k} мир РАСХОДИТСЯ`, a !== c);
    }
    // адреса обязаны быть РАЗНЫМИ, иначе выбирать не из чего
    const G = load(path.resolve(__dirname, '../grow.js'), Object.assign({ KIN: '1' }, base));
    const w = G.createSeed(seed);
    for (let r = 0; r < 1200; r++) G.round(w);
    const ad = w.parts.map((p) => G.addrOf(w, p));
    const m = ad.reduce((x, y) => x + y, 0) / ad.length;
    const sd = Math.sqrt(ad.reduce((x, y) => x + (y - m) ** 2, 0) / ad.length);
    check(`адрес: сид ${seed}, адреса у частей РАЗНЫЕ`, sd > 0.02,
      `разброс адресов ${sd.toFixed(4)}`);
  }
}

/* --- замкнутая петля --- */
{
  const base = { BASE: '0.05', HOLD: '0.1', CAP: '64', TAX: '40', GRACE: '30',
    ROT: '0.01', PUSH: '1', MIX0: '-0.3', MARKS: '1', HOPS: '1',
    ANCHOR: '0.5', ANCHOR_OWN: '1', KIN: '1' };
  for (const seed of [1, 2]) {
    const a = fp(load(path.resolve(__dirname, '../grow.js'), Object.assign({}, base)).run(seed, 400));
    const b = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ LOOP: '0' }, base)).run(seed, 400));
    check(`петля: сид ${seed}, при LOOP=0 мир тот же, побитово`, a === b);
    const c = fp(load(path.resolve(__dirname, '../grow.js'),
      Object.assign({ LOOP: '1' }, base)).run(seed, 400));
    check(`петля: сид ${seed}, при LOOP=1 мир РАСХОДИТСЯ`, a !== c);

    // петля обязана быть ЗАМКНУТОЙ: подпись должна набираться встречами
    const G = load(path.resolve(__dirname, '../grow.js'), Object.assign({ LOOP: '1' }, base));
    const w = G.createSeed(seed);
    for (let r = 0; r < 1500; r++) G.round(w);
    const got = w.parts.filter((p) => p.sigW > 0).length;
    const ad = w.parts.map((p) => G.addrOf(w, p));
    const m = ad.reduce((x, y) => x + y, 0) / ad.length;
    const sd = Math.sqrt(ad.reduce((x, y) => x + (y - m) ** 2, 0) / ad.length);
    check(`петля: сид ${seed}, встречи набраны и адреса разные`,
      got > w.parts.length / 2 && sd > 0.02,
      `с подписью ${got} из ${w.parts.length}, встреч ${w.faults.met}, разброс адресов ${sd.toFixed(4)}`);
  }
}

console.log(fails ? `\nпровалено проверок: ${fails}` : '\nвсе проверки пройдены');
process.exit(fails ? 1 : 0);

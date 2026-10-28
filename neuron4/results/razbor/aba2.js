// Детектор «висячих» номеров товаров по всем местам, где мозг держит номера: после смерти товара номер отдаётся новому,
// а ссылка остаётся. Считает случаи по видам держателей. Запуск: node aba2.js [КОРЕНЬ_ПРОЕКТА] SEED=1 ROUNDS=6000 [ручки]
// (КОРЕНЬ -- чтобы сравнить с прежним кодом; без него -- этот проект). «Записная книжка» может дать ложную тревогу: книжку
// меняют целиком, и новый товар под тем же номером в новой книжке -- законный
const R = process.argv[2] && !process.argv[2].includes('=') ? require('path').resolve(process.argv[2]) : require('path').join(__dirname, '../..');
const K = require(R + '/src/knobs'), { Goods } = require(R + '/src/goods'), { Brain } = require(R + '/src/market');
const { WorldX } = require(R + '/src/worldx'), { World } = require(R + '/src/world'), { WorldOne } = require(R + '/src/worldone'), { World3 } = require(R + '/src/world3'), { WorldImg } = require(R + '/src/worldimg'), { WorldTxt } = require(R + '/src/worldtxt');
// поколение номера растёт, когда номер переходит к товару другого смысла; новый прогноз того же нерва -- тот же сигнал (так решено
// в src/market.js: наследник канала), это не висячая ссылка. SAMEGEN=0 -- считать и такие переходы
const gen = new Map(), was = new Map(); const add0 = Goods.prototype.add, strict = process.env.SAMEGEN === '0';
Goods.prototype.add = function (kind, owner, nerve, t) { const id = add0.call(this, kind, owner, nerve, t), w = was.get(id);
  if (!(w && !strict && w[0] === 'прогноз' && kind === 'прогноз' && w[1] === nerve)) gen.set(id, (gen.get(id) || 0) + 1); was.set(id, [kind, nerve]); return id; };
const args = Object.fromEntries(process.argv.slice(process.argv[2] && !process.argv[2].includes('=') ? 3 : 2).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; }));
const seed = +(args.SEED || 1); delete args.SEED;
const cfg = K.makeConfig(args);
const W = cfg.WORLD === 'mix' ? new World3(cfg, seed) : cfg.WORLD === 'img' ? new WorldImg(cfg, seed) : cfg.WORLD === 'txt' ? new WorldTxt(cfg, seed) : cfg.WORLD === 'exam' ? new WorldX(cfg, seed) : cfg.WORLD === 'one' ? new WorldOne(cfg, seed) : new World(cfg, seed);
const B = new Brain(cfg, W, seed);
const seen = new Map(); const stale = {};
const chk = (key, ids, kind) => { let m = seen.get(key); if (!m) { m = new Map(); seen.set(key, m); }
  const now = new Set();
  for (const id of ids) { if (typeof id !== 'number' || id < 0) continue; now.add(id); const g = gen.get(id); if (!m.has(id)) m.set(id, g); else if (m.get(id) !== g) { stale[kind] = (stale[kind] || 0) + 1; m.set(id, g); } }
  for (const id of [...m.keys()]) if (!now.has(id)) m.delete(id); };
const flat = (a) => (a || []).flatMap((d) => (Array.isArray(d) ? d.flatMap((x) => (Array.isArray(x) ? x : [x])) : [d]));
const keyIds = (k) => k.replace(/^[a-zа-я]+/i, '').split(/[,*]/).map(Number).filter(Number.isFinite);
for (let r = 1; r <= cfg.ROUNDS; r++) { B.step(); if (W.score) W.score(B);
  for (const h of B.ex.choosers) { chk('w' + h.id, h.watch || [], 'выбор: слежка'); chk('f' + h.id, [...flat(h.Fa), ...flat(h.FA), ...(h.Cx || []).filter(Boolean).flatMap((c) => flat(c.FS))], 'выбор: признаки'); }
  for (const m of B.ex.motors) { chk('m' + m.id, m.S, 'мотор: нервы модели'); if (m.good) chk('mg' + m.id, m.good.S, 'мотор: принятая модель'); if (m.pl) chk('pl' + m.id, flat(m.pl.S), 'план'); }
  for (const c of B.ch) { if (c.port && c.port.note) chk('pn' + c.k, c.port.note.S, 'записка нерва (MNOTE)');
    if (c.keep) chk('k' + c.k, [...c.keep.values()].flatMap((e) => (Array.isArray(e.d) ? e.d : [e.d])), 'память связей канала');
    if (c.note) chk('n' + c.k, flat(c.note.inputs), 'записная книжка канала');
    for (const p of c.parts) { chk('p' + p.id, flat(p.inputs), 'входы частей'); if (p.gw) chk('gw' + p.id, [...p.gw.keys()].flatMap(keyIds), 'веса памяти части'); } } }
console.log(JSON.stringify({ seed, stale }));

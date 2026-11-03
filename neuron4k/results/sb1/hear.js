// Сб1 (ПЛАН.md): та же мера понимания слов, что в Р2 (results/r2/hear.js), с добавочными ручками третьим аргументом
// (JSON); второй аргумент -- KVOICE. Р2: -- прогноз частей нерва-слова кругом раньше против того, прозвучало ли слово; AUC во
// второй половине жизни. Мозг А10, мир тела с голосом родителя. Запуск: node results/r2/hear.js <сид> <KVOICE> <KEVG> -> строка JSON (поправка ПЛАН.md §5:
// KVSAL=5 KVLAG=3 KVREP=5; у слов событий -- только первый круг слова против кругов без слова)
const path = require('path'), R = path.join(__dirname, '..', '..'), EXTRA = JSON.parse(process.argv[4] || '{}'), ROUNDS0 = +process.argv[5] || 40000;
const K = require(R + '/src/knobs'), { WorldBody } = require(R + '/src/worldbody'), { Brain } = require(R + '/src/market');
const seed = +process.argv[2], KV = +process.argv[3], ROUNDS = ROUNDS0;
const cfg = K.makeConfig({ SQ: 1, RENT: 0.05, MFEAT: 6, WORLD: 'body', ROUNDS, BRAIN: 9, KWATER: 1, KSAT: 1, KTWIN: 1, KPAINEV: 1, KDEATH: 1, KDNERVE: 1, KDPEN: 30,
  KPRED: 1, KBITE: 10, MVAL: 2, MNOPE: 1, MLOAN: 1000, KEXP: 4, MEXP: 2, MAVOID: 4, MBLEND: 2, MVPSI: 1, MAWAY: 1, KVOICE: KV, KVSAL: 5, KVLAG: 3, KVREP: 5, ...EXTRA });
const W = new WorldBody(cfg, seed), B = new Brain(cfg, W, seed);
const words = W.voice.map((ch) => ({ name: ch.kind.replace('слово ', ''), ch, k: W.nerves.findIndex((nv) => nv.ch === ch), pos: [], neg: [], readers: 0 }));
let last = W.voice.map(() => 0), C = 0, nC = 0;
for (let t = 1; t <= ROUNDS; t++) {
  B.step();
  const late = t > ROUNDS / 2;
  // прогноз частей канала слова, сделанный в этом круге до шага мира, -- на наблюдение следующего круга; слово следующего
  // наблюдения мир выбрал в конце этого же круга (W.voice) -- их и сравниваем
  const pred = words.map((w) => { const c = B.ch[w.k]; if (!c) return 0; let s = 0, n = 0; for (const p of c.parts) if (p.age >= 1) { s += p.pred; n++; } return n ? s / n : c.mean; });
  if (late) for (let i = 0; i < words.length; i++) { const v = W.voice[i].val, ev = i < 4;   // слова событий -- 4 первых: только первый круг повтора
    if (!v) words[i].neg.push(pred[i]); else if (!ev || !last[i]) words[i].pos.push(pred[i]); }
  last = W.voice.map((ch) => ch.val);
  if (late) { C += W.comfort(); nC++; }
}
// сколько частей других каналов читают нерв слова (в конце жизни)
const G = B.goods; for (const c of B.ch) for (const p of c.parts) for (const d of p.inputs) { const ids = typeof d === 'number' ? [d] : d; for (const w of words) if (B.ch[w.k] && ids.includes(B.ch[w.k].good) && c.k !== w.k) w.readers++; }
function auc(pos, neg) { if (!pos.length || !neg.length) return null; const all = pos.map((v) => [v, 1]).concat(neg.map((v) => [v, 0])).sort((a, b) => a[0] - b[0]);
  let r = 0, i = 0; while (i < all.length) { let j = i; while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j++; const rank = (i + j) / 2 + 1; for (let q = i; q <= j; q++) if (all[q][1]) r += rank; i = j + 1; }
  return (r - pos.length * (pos.length + 1) / 2) / (pos.length * neg.length); }
const res = W.result();
// какие органы памяти читают части канала слова (их сборки -- по-русски)
const CP = require(R + '/src/compose');
function nameOf(id) { const k = G.kind[id]; if (k === 'нерв') return W.nerves[G.nerve[id]].kind; if (k === 'команда') return 'команда ' + W.nerves[G.nerve[id]].kind; return k || String(id); }
function memOf(w) { const c = B.ch[w.k]; if (!c) return []; const out = [];
  for (const p of c.parts) for (const d of p.inputs) for (const id of (typeof d === 'number' ? [d] : d)) { const o = G.owner[id]; if (o && o.kind === 'память') out.push(o.prog ? CP.show(o.prog).replace(/\((\d+)(?=[,)])/g, (m, id) => '(' + nameOf(+id)) : o.type || 'память'); }
  return out; }
console.log(JSON.stringify({ seed, KVOICE: KV, extra: EXTRA, comfort: C / nC, bites: res.bites, eat: res.eat, deaths2: res.deaths2,
  words: words.map((w) => ({ name: w.name, auc: auc(w.pos, w.neg), n: w.pos.length, readers: w.readers, mem: memOf(w) })) }));

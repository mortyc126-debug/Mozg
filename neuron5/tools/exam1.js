// Экзамен ступени 1 (results/s1/ПЛАН.md §4): понимание слов -- прогноз коры для нерва-слова на круг вперёд против того,
// прозвучало ли слово; AUC во второй половине жизни (у слов событий -- только первый круг слова против кругов без слова).
// Запуск: node tools/exam1.js <сид> [РУЧКА=значение ...] -> строка JSON
const path = require('path'), R = path.join(__dirname, '..', 'src');
const { make } = require(R + '/config'), { World, WORDS } = require(R + '/world'), { Brain } = require(R + '/brain');
const seed = +process.argv[2], over = Object.fromEntries(process.argv.slice(3).map((a) => a.split('=')));
const cfg = make(over), W = new World(cfg, seed), B = new Brain(cfg, W, seed), t00 = Date.now();
const words = W.voice.map((ch, i) => ({ name: WORDS[i], k: W.nerves.indexOf(ch), pos: [], neg: [] })); let last = words.map(() => 0); const fears = [], bitesAt = [];
for (let t = 1; t <= cfg.ROUNDS; t++) {
  B.step();   // прогноз сделан в этом круге до шага мира; слово следующего наблюдения мир выбрал в конце круга
  if (B.amyg && t > cfg.ROUNDS / 2) { fears.push(B.amyg.fear); if (W.ev.bite) bitesAt.push(fears.length - 1); }   // страх круга (до шага мира) и укус в этом шаге
  if (t > cfg.ROUNDS / 2) words.forEach((w, i) => { const v = W.voice[i].val, pr = B.cortex.forecast(w.k); if (!v) w.neg.push(pr); else if (i >= 4 || !last[i]) w.pos.push(pr); });
  last = W.voice.map((ch) => ch.val);
}
function auc(pos, neg) { if (!pos.length || !neg.length) return null; const all = pos.map((v) => [v, 1]).concat(neg.map((v) => [v, 0])).sort((a, b) => a[0] - b[0]);
  let r = 0, i = 0; while (i < all.length) { let j = i; while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j++; const rank = (i + j) / 2 + 1; for (let q = i; q <= j; q++) if (all[q][1]) r += rank; i = j + 1; }
  return (r - pos.length * (pos.length + 1) / 2) / (pos.length * neg.length); }
const kinds = W.truth(), bus = B.bus, ev = (x) => `${kinds[x >> 1]} ${x & 1 ? '+' : '−'}`;
const nameOf = (g) => (bus.kind[g] === 'рефлекс' ? `рефлекс(${bus.name[g]})` : bus.kind[g] === 'нерв' ? kinds[bus.name[g]] : bus.kind[g] === 'след' ? `след(${ev(bus.owner[g].x)}, ${bus.owner[g].D})` : bus.kind[g] === 'прогноз' ? `прогноз(${kinds[bus.name[g]]})` : bus.kind[g] === 'команда' ? `команда(${kinds[bus.name[g]]})` : bus.kind[g]);
console.log(JSON.stringify({ seed, over, sec: (Date.now() - t00) / 1000, opsPerRound: B.led.ops / cfg.ROUNDS, ...W.result(),
  words: words.map((w) => ({ name: w.name, auc: auc(w.pos, w.neg), n: w.pos.length, reads: [...new Set(B.cortex.ch[w.k].parts.flatMap((p) => p.in.map(nameOf)))] })),
  traces: { born: B.hippo.born, dead: B.hippo.dead, live: B.hippo.traces.map((tr) => ({ what: `${ev(tr.x)}, ${tr.D} кр. назад`, for: [...tr.targets].map((k) => kinds[k]), inc: +tr.incAvg.toFixed(3) })) },
  amyg: B.amyg ? (() => { const lab = new Uint8Array(fears.length); for (const i of bitesAt) for (let k = Math.max(0, i - 9); k <= i; k++) lab[k] = 1; const pos = [], neg = []; fears.forEach((x, i) => (lab[i] ? pos : neg).push(x));
    return { auc: auc(pos, neg), pains: B.amyg.pains, fits: B.amyg.fits, mean: +B.amyg.mean.toFixed(4) }; })() : null,
  bg: B.bg ? { al: Object.fromEntries(B.stem.names.map((nm, j) => [nm, +B.bg.al[j].toFixed(3)])), ga: B.cfg.BCTX ? Object.fromEntries(B.stem.names.map((nm, j) => [nm, +B.bg.ga[j].toFixed(3)])) : null, steps: B.bg.steps, vfits: B.critic.fits } : null,
  broca: B.speech ? { babbles: B.speech.babbles, chosen: B.speech.chosen, vb: B.speech.vb, price: Object.fromEntries(WORDS.map((w, i) => [w, { a: +B.speech.S[i].a.toFixed(3), b: +B.speech.S[i].b.toFixed(3), n: B.speech.S[i].n, ...(B.speech.bp ? { ta: +B.speech.bp[i].a.toFixed(3), tb: +B.speech.bp[i].b.toFixed(3), tn: B.speech.bp[i].n } : {}) }])) } : null,
  explorer: B.explorer ? (() => { const I = W.innate, E = B.explorer, mouth = new Set(I.mouth), found = new Set(B.map.mouth);
    return { doneAt: E.doneAt, motorOk: B.map.m === I.m, sign: B.map.sign, mouthOk: I.mouth.every((k) => found.has(k)), falseMouth: B.map.mouth.filter((k) => !mouth.has(k)).length,
      falseMotor: E.verdict.filter((v, k) => v === 'двигатель' && k !== I.m).length, empty: E.verdict.filter((v) => v === 'пусто').length,
      lines: B.speech && B.speech.L ? B.speech.L.map((L) => { const nm = WORDS[I.mouth.indexOf(L.k)], w = Array.from(L.w.slice(1, 1 + WORDS.length)); const top = w.map((x, i) => [WORDS[i], x]).sort((a, b) => b[1] - a[1])[0];
        return { word: nm, n: L.n, topEvidence: top[0], topW: +top[1].toFixed(3) }; }) : null }; })() : null,
  cortex: { births: B.cortex.births, deaths: B.cortex.deaths, parts: B.cortex.ch.reduce((a, c) => a + c.parts.length, 0) }, flow: Object.fromEntries(Object.entries(B.led.flow).map(([k, v]) => [k, Math.round(v)])) }));

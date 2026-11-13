// Экзамен ступени 7 (results/s7/ПЛАН.md): два тела в одном мире, у каждого свой мозг (сид мозга второго -- сид + 1000).
// Запуск: node tools/exam7.js <сид> [РУЧКА=значение ...] -> строка JSON (по телу: польза, еда, речь, веса ганглиев)
const path = require('path'), R = path.join(__dirname, '..', 'src');
const { make } = require(R + '/config'), { World2, WORDS } = require(R + '/world'), { Brain } = require(R + '/brain');
const seed = +process.argv[2], over = Object.fromEntries(process.argv.slice(3).map((a) => a.split('=')));
const cfg = make(over); if (!cfg.TWO) throw new Error('нужно TWO=1 или 2');
const W = new World2(cfg, seed), B = [new Brain(cfg, W.b[0], seed), new Brain(cfg, W.b[1], seed + 1000)], t00 = Date.now();
// для мер: после зова «еда» (другой сказал «еда») -- приблизился ли слушатель к другому за 20 кругов
const app = [{ n: 0, closer: 0 }, { n: 0, closer: 0 }], pend = [[], []];
for (let t = 1; t <= cfg.ROUNDS; t++) {
  B[0].think(); B[1].think(); W.advance(B[0].u, B[1].u);
  if (t > cfg.ROUNDS / 2) for (let i = 0; i < 2; i++) { const me = W.b[i], o = W.b[1 - i], d = Math.hypot(me.x - o.x, me.y - o.y);
    if (o.said === 0 && d > 4) pend[i].push({ t, d });
    while (pend[i].length && t - pend[i][0].t >= 20) { const q = pend[i].shift(); app[i].n++; if (d < q.d - 2) app[i].closer++; } }
}
const body = (i) => { const b = B[i], r = W.b[i].result(), sw = (w) => r.speech.words.find((q) => q.name === w);
  return { comfort: r.comfort, eat: r.eat, food: r.food, water: r.water, bites: r.bites, deaths: r.deaths, talk: r.speech.talk,
    named: { еда: sw('еда').named, вода: sw('вода').named }, said: Object.fromEntries(WORDS.map((w) => [w, sw(w).said])),
    al: Object.fromEntries(b.stem.names.map((nm, j) => [nm, +b.bg.al[j].toFixed(3)])), ga: b.bg.ga ? Object.fromEntries(WORDS.map((w, k) => [w, +b.bg.ga[k].toFixed(3)])) : null,
    approach: app[i].n ? app[i].closer / app[i].n : null, explorerDone: b.explorer ? b.explorer.doneAt : null }; };
console.log(JSON.stringify({ seed, over, sec: (Date.now() - t00) / 1000, near: W.st.near / Math.max(1, W.st.n), bodies: [body(0), body(1)] }));

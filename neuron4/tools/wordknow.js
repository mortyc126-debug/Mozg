// опыт «слово вместо глаза»: насколько мозг предсказывает глубокий канал скрытого источника 1 и покупает ли слово как вход.
// node tools/wordknow.js seed rounds [K=V ...]  -> одна строка JSON
const R = require('path').join(__dirname, '..') + '/';
const K = require(R + 'src/knobs'), { World } = require(R + 'src/world'), { Brain } = require(R + 'src/market');
const seed = +process.argv[2], rounds = +process.argv[3], over = { WORDS: 2, WDLAG: 1, SQ: 1, WSAL: 5, RENT: 0.05 };
for (const a of process.argv.slice(4)) { const [k, v] = a.split('='); over[k] = isNaN(+v) ? v : +v; }
const cfg = K.makeConfig({ ...over, ROUNDS: rounds }), W = new World(cfg, seed), B = new Brain(cfg, W, seed);
const G = B.goods, kd = W.nerves.findIndex((nv) => nv.ch === W.deep[0]);
const wk = W.gEye.ch.map((ch) => W.nerves.findIndex((nv) => nv.ch === ch));
const wgood = () => new Set(wk.map((k) => B.ch[k] && B.ch[k].good));
const leaves = (d) => (typeof d === 'number' ? [d] : d);
const win = [], use = []; let cur = null;
for (let r = 1; r <= rounds; r++) {
  const c = B.ch[kd]; let bp = null; if (c) for (const p of c.parts) if (p.age >= 1 && (!bp || p.mse < bp.mse)) bp = p;
  const pred = bp ? bp.pred : null;
  B.step(); W.score(B);
  const wi = Math.floor((r - 1) / 1000); if (!win[wi]) win[wi] = { e: 0, y: 0, y2: 0, n: 0 };
  if (pred !== null) { const y = G.val[c.good], w = win[wi]; w.e += (y - pred) ** 2; w.y += y; w.y2 += y * y; w.n++; }
  if (r % 1000 === 0 && c) { const ws = wgood(); let byWord = 0, best = false;
    for (const p of c.parts) { const hit = p.inputs.some((d) => leaves(d).some((id) => ws.has(id))); if (hit) byWord++; if (p === bp && hit) best = true; }
    use.push([byWord, c.parts.length, best ? 1 : 0]); }
}
const bits = win.map((w) => { if (!w || w.n < 50) return null; const v = w.y2 / w.n - (w.y / w.n) ** 2; return +(0.5 * Math.log2(v / (w.e / w.n))).toFixed(3); });
console.log(JSON.stringify({ seed, r: W.hid[0].r, bits, use }));

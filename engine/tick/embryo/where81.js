// Замер шага 81 (PRE81_WHERE.md): раскладка прогноза частей медленного канала по вкладам -- что в паузе замолкает, что переживает
const M = require('./neuron2.js'), C = M.CFG, SCH = M.SCH;
const seed = +process.argv[2], cond = process.argv[3], w = M.create(seed);
for (let r = 1; r <= 101000; r++) M.round(w);
const P = { own: 0, rec: 0, pred: 0, sig: 0, sens: 0, line: 0 }; let n = 0;
for (let r = 0; r < 200; r++) {
  M.round(w);
  for (const p of w.parts) {
    if (!p || p.ch !== SCH || !p.x) continue;
    P.own += (p.wSelf * p.x[0]) ** 2; if (C.SELFREC) P.rec += (p.ws * p.xs) ** 2;
    p.xl.forEach((l, i) => { if (p.xt[i]) return;
      let v = l.w * p.x[i + 1]; if (l.xb) for (let j = 0; j < l.xb.length; j++) v += l.tw[j] * l.xb[j];
      const k = l.k === 0 ? 'sens' : l.k === 3 ? 'line' : l.k === 1 ? 'pred' : 'sig'; P[k] += v * v; });
    n++;
  }
}
const tot = Object.values(P).reduce((s, x) => s + x, 0), sh = (k) => P[k] / tot;
const Sp = w.parts.filter((p) => p && p.ch === SCH), g = Sp.map((p) => Math.abs(p.wSelf + p.ws)).sort((a, b) => a - b);
console.log([cond, seed, Sp.length, (sh('sens') + sh('line')).toFixed(3), ...['own', 'rec', 'pred', 'sig', 'sens', 'line'].map((k) => sh(k).toFixed(3)), g[Math.floor(g.length / 2)].toFixed(3)].join('\t'));

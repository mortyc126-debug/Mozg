// Цена забывания: лишняя ошибка прогноза в 20 кругах после паузы, в кругах полного незнания.
// PAUSE=1 -- пауза 50 кругов; PAUSE=0 -- пустой отсчёт, те же окна без паузы.
const M = require('./neuron2.js');
const seed = +process.argv[2], PAUSE = +process.env.PAUSE;
const WARM = 60000, CYC = 20, LIVE = 200, BASEW = 50, PL = 50, POST = 20;
const V = 1 + M.CFG.SN * M.CFG.SN;
const w = M.create(seed);
for (let r = 1; r <= WARM; r++) M.round(w);
const live = () => {                       // один круг жизни: ошибка каждой пережившей части
  const prev = new Map(); for (const p of w.parts) if (p) prev.set(p, p.pred);
  M.round(w);
  const e = new Map(); for (const p of w.parts) if (p && prev.has(p)) e.set(p, (p.s - prev.get(p)) ** 2);
  return e;
};
const group = (ch) => (ch === 9 ? 'к9' : ch <= 2 || ch === 8 ? 'ист' : 'смеси');
const cost = { все: [], ист: [], смеси: [], к9: [] }, prof = [0, 0, 0, 0, 0], profD = [0];
for (let c = 0; c < CYC; c++) {
  const bs = new Map(), bn = new Map();
  for (let r = 1; r <= LIVE; r++) { const e = live();
    if (r > LIVE - BASEW) for (const [p, v] of e) { bs.set(p, (bs.get(p) || 0) + v); bn.set(p, (bn.get(p) || 0) + 1); } }
  const base = new Map(); for (const [p, s] of bs) if (bn.get(p) === BASEW) base.set(p, s / BASEW);
  if (PAUSE) for (let k = 0; k < PL; k++) M.pauseRound(w);
  const ex = new Map(), seen = new Map();
  for (let r = 1; r <= POST; r++) { const e = live();
    for (const [p, v] of e) if (base.has(p)) { const d = v - base.get(p);
      ex.set(p, (ex.get(p) || 0) + d); seen.set(p, (seen.get(p) || 0) + 1);
      if (r <= 5) prof[r - 1] += d; } }
  const num = { все: 0, ист: 0, смеси: 0, к9: 0 }, den = { все: 0, ист: 0, смеси: 0, к9: 0 };
  for (const [p, v] of ex) if (seen.get(p) === POST) { const g = group(p.ch), dd = V - base.get(p);
    num.все += v; den.все += dd; num[g] += v; den[g] += dd; if (true) profD[0] += dd; }
  for (const g of Object.keys(num)) if (den[g] > 0) cost[g].push(num[g] / den[g]);
}
const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2) : NaN; };
const st = M.stats(w);
console.log([seed, PAUSE ? 'пауза' : 'без паузы', ...['все', 'ист', 'смеси', 'к9'].map((g) => med(cost[g]).toFixed(3)),
  prof.map((x) => (x / profD[0]).toFixed(3)).join(','), st.right.toFixed(3), st.nul.toFixed(3)].join('\t'));

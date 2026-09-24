// ворота шага 70 (PRE70_CONFIRM.md §3), расчёт -- как в diag69b.js: 200 моментов (каждые 100 кругов, 60000-80000).
// 1) статистика ворот, усреднённая по моментам; 2) обогащение выбора: как часто лучший из 16 кандидатов (жребий механизма)
// -- линия к A или B, против доли таких линий среди годных кандидатов (слепой поиск)
const M = require('./neuron2.js'), C = M.CFG, O = M.OCH, N = C.N;
const seed = +process.argv[2], cond = process.argv[3], w = M.create(seed);
for (let r = 1; r <= 60000; r++) M.round(w);
let ks = (seed * 2654435761) >>> 0;
const krnd = () => { ks = (ks + 0x6D2B79F5) >>> 0; let t = ks; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const gA = [], gB = []; let pick = 0, pickAB = 0, base = 0, baseN = 0;
for (let r = 1; r <= 20000; r++) {
  M.round(w);
  if (r % 100) continue;
  const P = w.parts;
  for (const p of P) {
    if (!p || p.ch !== O + 2 || !p.eh || p.eh.length < C.CWIN) continue;
    const cand = [];
    for (let j = 0; j < N; j++) for (let k = 0; k < 4; k++) {
      if (!(P[j] && j !== p.slot && !p.links.some((l) => l.j === j && l.k === k))) continue;
      const ab = k === 3 && (P[j].ch === O || P[j].ch === O + 1);
      cand.push({ s: M.cscore(w, p, j, k), k, a: k === 3 && P[j].ch === O, b: k === 3 && P[j].ch === O + 1, ab });
    }
    const lines = cand.filter((c) => c.k === 3).map((c) => c.s);
    const pct = (x) => (lines.filter((v) => v < x).length + 0.5 * lines.filter((v) => v === x).length) / lines.length;
    const A = cand.filter((c) => c.a), B = cand.filter((c) => c.b);
    if (A.length) gA.push(med(A.map((c) => pct(c.s)))); if (B.length) gB.push(med(B.map((c) => pct(c.s))));
    base += cand.filter((c) => c.ab).length; baseN += cand.length;
    for (let t = 0; t < 50; t++) {        // жребий механизма: 16 кандидатов равновероятно среди годных (годность почти всегда)
      let best = null; for (let c = 0; c < 16; c++) { const x = cand[Math.floor(krnd() * cand.length)]; if (!best || x.s > best.s) best = x; }
      pick++; if (best.ab) pickAB++;
    }
  }
}
const f = (x) => x.toFixed(3);
console.log([cond, seed, f(med(gA)), f(med(gB)), f(pickAB / pick), f(base / baseN), f(pickAB / pick / (base / baseN))].join('\t'));

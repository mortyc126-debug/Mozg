// Замер PRE55_WAKE.md: R после длинной тишины и гибель проверенных связей при пробуждении против обычных кругов.
const M = require('./neuron2.js');
const seed = +process.argv[2], cond = process.argv[3], C = M.CFG, SCH = M.SCH;
const V = 1 + C.SN * C.SN, VS = 1 + C.SSIG * C.SSIG + C.SN * C.SN, MIX = [3, 4, 5, 6, 7];
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 4) => (Number.isFinite(x) ? (Math.abs(x) < 1e-3 && x !== 0 ? x.toExponential(2) : x.toFixed(d)) : 'NaN');
const w = M.create(seed);
for (let r = 1; r <= 60000; r++) M.round(w);
function lifeRec(a) {
  const before = w.parts.filter((p) => p && p.x).map((p) => [p, p.pred]);
  M.round(w);
  const s = {}, n = {};
  for (const [p, pr] of before) { if (w.parts[p.slot] !== p) continue; s[p.ch] = (s[p.ch] || 0) + (p.s - pr) ** 2; n[p.ch] = (n[p.ch] || 0) + 1; }
  if (!a) return;
  for (const c of MIX) { a.mix += n[c] ? s[c] / n[c] : V; a.nm++; }
  a.S += n[SCH] ? s[SCH] / n[SCH] : VS; a.nS++;
}
const PARENTS = [[], [], [], [0, 1], [1, 2], [0, 2], [3], [3, 4]];
const GRAND = PARENTS.map((ps) => [...new Set(ps.flatMap((q) => PARENTS[q]))]);
function snap() {       // проверенные связи: [владелец, связь, продавец, верная]
  const T = [];
  for (const p of w.parts) if (p) for (const l of p.links) if (l.age >= C.TRIAL) {
    const q = w.parts[l.j];
    T.push([p, l, q, p.ch >= 3 && p.ch <= 7 && q && (PARENTS[p.ch].includes(q.ch) || (l.k === 1 && GRAND[p.ch].includes(q.ch)))]);
  }
  return T;
}
function lost(T) {      // [доля исчезнувших, из них отмерло (владелец и продавец живы)]
  let g = 0, pr = 0;
  for (const [p, l, q] of T) { if (w.parts[p.slot] === p && p.links.includes(l)) continue; g++; if (w.parts[p.slot] === p && w.parts[l.j] === q) pr++; }
  return [g, pr];
}
const sat = () => { const A = w.parts.filter(Boolean); return A.filter((p) => Math.abs(p.z) >= 4 - 1e-12).length / A.length; };
const out = [cond, seed];
for (const F of [300, 1000]) {
  const pre = { mix: 0, nm: 0, S: 0, nS: 0 }, post = { mix: 0, nm: 0, S: 0, nS: 0 }, drop = [], satA = [], satB = [];
  const L = { base: 0, baseN: 0, wake: 0, wakeN: 0, prune: 0, early: 0, rW: 0, rN: 0 };
  for (let c = 0; c < 3; c++) {
    for (let r = 1; r <= 955; r++) M.round(w);
    const B = snap(); for (let r = 1; r <= 5; r++) M.round(w);
    for (let r = 1; r <= 40; r++) lifeRec(pre);
    { const [g] = lost(B); L.base += g; L.baseN += B.length; }
    satB.push(sat());
    const zv0 = new Map(w.parts.filter(Boolean).map((p) => [p, p.zv]));
    for (let k = 1; k <= F; k++) M.freeRound(w);
    for (const [p, z0] of zv0) if (w.parts[p.slot] === p) drop.push(p.zv / z0);
    const W = snap(), WR = W.filter((t) => t[3]);
    for (let r = 1; r <= 45; r++) { lifeRec(r > 5 ? post : null); if (r <= 5) satA.push(sat()); if (r === 5) L.early += lost(W)[0]; }
    { const [g, pr] = lost(W); L.wake += g; L.wakeN += W.length; L.prune += pr; const [gr] = lost(WR); L.rW += gr; L.rN += WR.length; }
  }
  out.push(f((V - post.mix / post.nm) / (V - pre.mix / pre.nm)), f((VS - post.S / post.nS) / (VS - pre.S / pre.nS)), f(L.wake / L.wakeN), f(L.base / L.baseN), f(L.prune / Math.max(1, L.wake)), f(L.early / Math.max(1, L.wake)), f(L.rW / Math.max(1, L.rN)));
}
console.log(out.join('\t'));

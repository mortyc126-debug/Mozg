// Замер PRE53_LONGLINKS.md: причина и время исчезновения каждой проверенной связи за 1000 кругов свободной активности.
const M = require('./neuron2.js');
const seed = +process.argv[2], C = M.CFG, SCH = M.SCH;
const V = 1 + C.SN * C.SN, VS = 1 + C.SSIG * C.SSIG + C.SN * C.SN, PR = C.PRUNE;
const PARENTS = [[], [], [], [0, 1], [1, 2], [0, 2], [3], [3, 4]];
const GRAND = PARENTS.map((ps) => [...new Set(ps.flatMap((q) => PARENTS[q]))]);
const w = M.create(seed);
for (let r = 1; r <= 60000; r++) M.round(w);
const predC = (p, l) => Math.abs(l.w) * Math.sqrt(l.r2 * ((SLOW() && p.ch === SCH) ? VS : V) / Math.max(p.r2s, 1e-300));
function SLOW() { return C.SLOW; }
const sigC = (p, l) => Math.abs(l.u) * Math.sqrt(l.r2 / p.zv);
const T = [];
for (const p of w.parts) if (p) for (const l of p.links) if (l.age >= C.TRIAL) {
  const q = w.parts[l.j];
  const right = p.ch >= 3 && p.ch <= 7 && q && (PARENTS[p.ch].includes(q.ch) || (l.k === 1 && GRAND[p.ch].includes(q.ch)));
  T.push({ p, l, q, k: l.k, right, byPred: predC(p, l) >= PR, bySig: p.zb > 0.3 && sigC(p, l) >= PR, cause: null });
}
const alive = {};
for (let r = 1; r <= 1000; r++) {
  M.freeRound(w);
  for (const t of T) {
    if (t.cause) continue;
    const ownerAlive = w.parts[t.p.slot] === t.p;
    if (ownerAlive && t.p.links.includes(t.l)) continue;
    if (!ownerAlive) t.cause = 1;
    else if (w.parts[t.l.j] !== t.q) t.cause = 2;
    else if (t.byPred) t.cause = 3;
    else if (t.bySig) t.cause = t.p.zb <= 0.3 ? 4 : 5;
    else t.cause = 6;              // на начало тишины не держалась ни одним путём (не должно быть)
    t.when = r;
  }
  if (r === 100 || r === 300 || r === 1000) alive[r] = [T.filter((t) => !t.cause).length / T.length, T.filter((t) => t.right && !t.cause).length / Math.max(1, T.filter((t) => t.right).length)];
}
const cnt = (A) => [1, 2, 3, 4, 5, 6].map((c) => A.filter((t) => t.cause === c).length);
const R = T.filter((t) => t.right);
const byK5 = [0, 1, 2].map((k) => T.filter((t) => t.cause === 5 && t.k === k).length);
const heldSig = T.filter((t) => !t.byPred && t.bySig).length;
const early = (A, c) => A.filter((t) => t.cause === c && t.when <= 100).length;
const byK = (A, c) => [0, 1, 2].map((k) => A.filter((t) => t.cause === c && t.k === k).length).join(',');
console.log([seed, T.length, T.filter((t) => t.cause).length, cnt(T).join(','), R.length, R.filter((t) => t.cause).length, cnt(R).join(','),
  byK(T, 3), byK(T, 5), early(T, 3) + ',' + early(T, 5), early(R, 3) + ',' + early(R, 5), [100, 300, 1000].map((r) => alive[r].map((x) => x.toFixed(3)).join('/')).join(',')].join('\t'));

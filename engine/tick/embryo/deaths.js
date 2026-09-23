// Замер PRE52_DEATHS.md: R после 1000 кругов тишины -- всех частей и только выживших; доля новичков.
const M = require('./neuron2.js');
const seed = +process.argv[2], cond = process.argv[3], C = M.CFG, SCH = M.SCH;
const V = 1 + C.SN * C.SN, VS = 1 + C.SSIG * C.SSIG + C.SN * C.SN, MIX = [3, 4, 5, 6, 7];
const f = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const w = M.create(seed);
for (let r = 1; r <= 60000; r++) M.round(w);
// один круг жизни; ошибка канала -- среднее по частям из фильтра (или незнающий, если таких нет)
function lifeRec(accs) {
  const before = w.parts.filter((p) => p && p.x).map((p) => [p, p.pred]);
  M.round(w);
  for (const [a, keep] of accs) {
    const s = {}, n = {};
    for (const [p, pr] of before) { if (w.parts[p.slot] !== p || !keep(p)) continue; s[p.ch] = (s[p.ch] || 0) + (p.s - pr) ** 2; n[p.ch] = (n[p.ch] || 0) + 1; }
    for (const c of MIX) { a.mix += n[c] ? s[c] / n[c] : V; a.nm++; }
    a.S += n[SCH] ? s[SCH] / n[SCH] : VS; a.nS++;
  }
}
const acc = () => ({ mix: 0, nm: 0, S: 0, nS: 0 });
const pre = acc(), post = acc(), postS = acc();
let newc = 0, nall = 0, surv = 0, nsurv = 0;
for (let c = 0; c < 3; c++) {
  for (let r = 1; r <= 960; r++) M.round(w);
  for (let r = 1; r <= 40; r++) lifeRec([[pre, () => true]]);
  const old = new Set(w.parts.filter(Boolean));
  for (let k = 1; k <= 1000; k++) M.freeRound(w);
  for (const p of old) { nsurv++; if (w.parts[p.slot] === p) surv++; }
  for (let r = 1; r <= 45; r++) {
    if (r > 5) { lifeRec([[post, () => true], [postS, (p) => old.has(p)]]); const A = w.parts.filter(Boolean); nall += A.length; newc += A.filter((p) => !old.has(p)).length; }
    else lifeRec([]);
  }
}
const R = (Vg, b, a) => (Vg - a) / (Vg - b);
const mb = pre.mix / pre.nm, sb = pre.S / pre.nS;
console.log([cond, seed, f(R(V, mb, post.mix / post.nm)), f(R(VS, sb, post.S / post.nS)), f(R(V, mb, postS.mix / postS.nm)), f(R(VS, sb, postS.S / postS.nS)), f(newc / nall), f(surv / nsurv)].join('\t'));

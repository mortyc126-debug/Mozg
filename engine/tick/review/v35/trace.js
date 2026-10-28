// Замер PRETRACE.md: доля приобретённого знания, пережившего период свободной активности длиной F.
const M = require('./neuron2.js');
const seed = +process.argv[2], F = +process.argv[3], cond = process.argv[4], C = M.CFG, SCH = M.SCH;
const V = 1 + C.SN * C.SN, VS = 1 + C.SSIG * C.SSIG + C.SN * C.SN, TR = C.TRIAL;
const w = M.create(seed);
for (let r = 1; r <= 60000; r++) M.round(w);
const MIX = [3, 4, 5, 6, 7];
// один круг жизни с записью ошибки: среднее e^2 по живым частям канала, пустой канал -- незнающий
function lifeRec(acc) {
  const before = w.parts.filter((p) => p && p.x).map((p) => [p, p.pred]);
  M.round(w);
  const s = {}, n = {};
  for (const [p, pr] of before) { if (w.parts[p.slot] !== p) continue; s[p.ch] = (s[p.ch] || 0) + (p.s - pr) ** 2; n[p.ch] = (n[p.ch] || 0) + 1; }
  if (!acc) return;
  for (const c of MIX) { acc.mix += n[c] ? s[c] / n[c] : V; acc.nm++; }
  acc.S += n[SCH] ? s[SCH] / n[SCH] : VS; acc.nS++;
}
const acc = () => ({ mix: 0, nm: 0, S: 0, nS: 0 });
const pre = acc(); for (let r = 1; r <= 40; r++) lifeRec(pre);
const parts0 = w.parts.filter(Boolean), links0 = [];
for (const p of parts0) for (const l of p.links) if (l.age >= TR) links0.push([p, l]);
let minAlive = parts0.length;
for (let k = 1; k <= F; k++) { M.freeRound(w); minAlive = Math.min(minAlive, w.parts.filter(Boolean).length); }
const partsLeft = parts0.filter((p) => w.parts[p.slot] === p).length / parts0.length;
const linksLeft = links0.filter(([p, l]) => w.parts[p.slot] === p && p.links.includes(l)).length / Math.max(1, links0.length);
const aliveEnd = w.parts.filter(Boolean).length;
const post = acc(); for (let r = 1; r <= 45; r++) lifeRec(r > 5 ? post : null);
const R = (Vg, b, a) => (Vg - a) / (Vg - b);
const mb = pre.mix / pre.nm, ma = post.mix / post.nm, sb = pre.S / pre.nS, sa = post.S / post.nS;
const f = (x) => (Number.isFinite(x) ? x.toFixed(4) : 'NaN');
console.log([cond, seed, F, f(R(V, mb, ma)), f(R(VS, sb, sa)), f(mb), f(ma), f(sb), f(sa), f(partsLeft), f(linksLeft), parts0.length, minAlive, aliveEnd].join('\t'));

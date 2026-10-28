// Замер шага 87 (PRE87_IMPTRACE.md): путь отпечатка у частей канала 3 -- прошлое 60000, промежуток 2000, проверка 300 на своём правиле
const M = require('./neuron2.js'), C = M.CFG;
const seed = +process.argv[2], past = +process.argv[3], sgn = past === 0 ? 1 : -1;   // знак веса на c1 у своего прошлого: + при правиле 0, - при правиле 1
const w = M.create(seed);
const ch1 = (l) => w.parts[l.j] && w.parts[l.j].ch === 1 && l.k !== 2;
const P3 = () => w.parts.filter((p) => p && p.ch === 3);
const lw = (l) => l.w + (l.tw ? l.tw.reduce((s, x) => s + x, 0) * 0 : 0);   // вес текущего отвода; c3(t+1) зависит от c1(t)
w.rel3 = past; for (let r = 1; r <= 60000; r++) M.round(w);
const endPast = P3(), withL = endPast.filter((p) => p.links.some((l) => ch1(l) && l.age >= C.TRIAL));
const signPast = withL.map((p) => Math.sign(p.links.filter((l) => ch1(l) && l.age >= C.TRIAL).reduce((s, l) => s + lw(l), 0)));
w.rel3 = 2; for (let r = 1; r <= 2000; r++) M.round(w);
const T0 = P3();
const a = T0.filter((p) => p.links.some((l) => ch1(l) && l.age >= C.TRIAL)).length / T0.length;
const imp = (p) => p.imp ? ['1:0', '1:1', '1:3'].map((k) => p.imp.get(k)).filter(Boolean) : [];
const b = T0.filter((p) => imp(p).length).length / T0.length;
const good = T0.filter((p) => imp(p).some((m) => Math.sign(m.w) === sgn && Math.abs(m.w) >= 0.2)).length;
const cc = T0.filter((p) => imp(p).length).length ? good / T0.filter((p) => imp(p).length).length : NaN;
const g = T0.filter((p) => endPast.includes(p)).length / T0.length;
w.rel3 = past;
const seen = new Set(T0.flatMap((p) => p.links)), first = new Map(); let nNew = 0, nRec = 0;
for (let r = 1; r <= 300; r++) {
  M.round(w);
  for (const p of P3()) for (const l of p.links) if (!seen.has(l)) { seen.add(l); if (ch1(l) && l.age <= 1) { nNew++; if (l.w !== 0) nRec++; if (!first.has(p)) first.set(p, r); } }
}
const got = T0.filter((p) => first.has(p)), fr = got.map((p) => first.get(p)).sort((x, y) => x - y);
console.log([seed, past, T0.length, (withL.length / endPast.length).toFixed(2), signPast.filter((s) => s === sgn).length + '/' + signPast.length,
  a.toFixed(2), b.toFixed(2), Number.isFinite(cc) ? cc.toFixed(2) : 'NaN', g.toFixed(2), (got.length / T0.length).toFixed(2), fr.length ? fr[Math.floor(fr.length / 2)] : 'NaN', nNew ? (nRec / nNew).toFixed(2) : 'NaN', nNew].join('\t'));

// разбор после чтения шага 78: части Q с линиями к A и B -- возраст, в пробе ли, веса отводов, своя доля верного знака
const M = require('./neuron2.js'), C = M.CFG, O = M.OCH;
const seed = +process.argv[2], w = M.create(seed);
for (let r = 1; r <= 80000; r++) M.round(w);
const hit = new Map(), tot = new Map();
for (let r = 0; r < 20000; r++) {
  const before = w.parts.filter((p) => p && p.ch === O + 2 && p.x).map((p) => [p, p.pred]);
  M.round(w); const q = w.c[O + 2];
  if (q !== 0) for (const [p, pr] of before) if (w.parts[p.slot] === p && pr !== 0) { tot.set(p, (tot.get(p) || 0) + 1); if (Math.sign(pr) === Math.sign(q)) hit.set(p, (hit.get(p) || 0) + 1); }
}
for (const p of w.parts.filter((p) => p && p.ch === O + 2)) {
  const ls = p.links.map((l) => { const s = w.parts[l.j]; const ch = s ? (s.ch === O ? 'A' : s.ch === O + 1 ? 'B' : s.ch === O + 2 ? 'Q' : 'к' + s.ch) : '?';
    return `${ch}/${l.k} возраст ${l.age}${l.age < C.TRIAL ? ' (проба)' : ''} w ${l.w.toFixed(3)}${l.tw ? ' отводы [' + Array.from(l.tw).map((x) => x.toFixed(2)).join(' ') + ']' : ''}`; });
  console.log(`#${p.slot} возраст ${p.age} lr ${p.g.lr.toFixed(3)} доля знака ${tot.get(p) ? (hit.get(p) / tot.get(p)).toFixed(3) : '-'} (${tot.get(p) || 0}) | ${ls.join(' ; ')}`);
}

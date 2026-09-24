// Замер шага 77 (PRE77_FATE8.md): судьба линий (товар 3) частей канала Q к частям каналов A и B -- от рождения до смерти
const M = require('./neuron2.js'), C = M.CFG, O = M.OCH;
const seed = +process.argv[2], w = M.create(seed);
if (!C.ORDER || !C.DLINE) throw new Error('нужны ORDER=1 и DLINE>0');
const V = 1 + C.SN * C.SN;
for (let r = 1; r < 20000; r++) M.round(w);
const tr = new Map(), dead = [];   // связь -> запись
const isAB = (l) => l.k === 3 && w.parts[l.j] && (w.parts[l.j].ch === O || w.parts[l.j].ch === O + 1);
for (let r = 20000; r <= 80000; r++) {
  const snap = [];
  for (const p of w.parts) if (p && p.ch === O + 2) for (const l of p.links) {
    if (!tr.has(l) && isAB(l)) tr.set(l, { p, seller: w.parts[l.j], born: r, age0: l.age, rep: 0, ab: w.parts[l.j].ch === O ? 'A' : 'B' });
    const t = tr.get(l); if (!t) continue;
    const c = (l.tw ? Math.hypot(l.w, ...l.tw) : Math.abs(l.w)) * Math.sqrt(l.r2 * V / Math.max(p.r2s, 1e-300));
    t.last = { age: l.age + 1, c, r2: l.r2, w: l.tw ? Math.hypot(l.w, ...l.tw) : Math.abs(l.w) };
    snap.push(l);
  }
  M.round(w);
  const rep = w.c[O + 2] !== 0;
  for (const l of snap) {
    const t = tr.get(l); if (rep) t.rep++;
    if (t.p.links.includes(l) && w.parts[t.p.slot] === t.p) continue;
    const why = w.parts[t.p.slot] !== t.p ? 'часть' : w.parts[t.seller.slot] !== t.seller ? 'продавец' : 'вклад';
    dead.push({ ...t, why }); tr.delete(l);
  }
}
const born = dead.concat([...tr.values()].map((t) => ({ ...t, why: 'жива' })));
const fresh = born.filter((t) => t.age0 === 0);
const pr = dead.filter((t) => t.age0 === 0 && t.why === 'вклад');
const first = pr.filter((t) => t.last.age <= C.TRIAL + 1), later = pr.filter((t) => t.last.age > C.TRIAL + 1);
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const cnt = (a, k) => a.filter((t) => t.why === k).length;
const survived1 = fresh.filter((t) => !(t.why === 'вклад' && t.last.age <= C.TRIAL + 1) && (t.last ? t.last.age > C.TRIAL + 1 : true)).length;
console.log([seed, fresh.length, first.length, later.length, cnt(fresh, 'продавец'), cnt(fresh, 'часть'), cnt(fresh, 'жива'), survived1,
  med(first.map((t) => t.rep)), med(first.map((t) => t.last.c)).toFixed(3), med(first.map((t) => t.last.r2)).toFixed(3),
  med(later.map((t) => t.last.age)), med(later.map((t) => t.rep)), med(later.map((t) => t.last.c)).toFixed(3), med(later.map((t) => t.last.r2)).toFixed(3),
  med(later.map((t) => t.last.w)).toFixed(3), born.length - fresh.length].join('\t'));

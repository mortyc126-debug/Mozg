// чтение Сб6 (ПЛАН.md §3): мозг сам понял укус, еду, воду; не хуже изобретателя; не ломает остального; парно, Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f)) return null; return new Map(fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Р': L('../r2/r2_SS.jsonl'), 'Г': L('../sb4/sb4_G.jsonl'), 'И': L('../sb5/sb5_I.jsonl'), 'М': L('sb6_M.jsonl') }, ALL = ['еда', 'вода', 'укус', 'удар', 'голодно', 'жажда', 'опасно'];
const aucOf = (r, w) => { const x = r.words.find((q) => q.name === w); return x && x.auc !== null ? x.auc : NaN; };
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: 'нет данных' };
  const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()]; console.log(`${k} миров ${m.size}: польза ${f(med(v.map((r) => r.comfort)), 3)}; AUC: ` + ALL.map((w) => `${w} ${f(med(v.map((r) => aucOf(r, w))))}`).join(', ')); }
const m1 = pair('М', 'Г', (x) => aucOf(x, 'укус'), 1); console.log(`\n1. сам понял укус (М > Г) -- ${m1.s} -> ${m1.ok ? 'ДА' : 'нет'}`);
const m2 = pair('М', 'И', (x) => aucOf(x, 'укус'), 1); console.log(`2. сам не хуже изобретателя (укус, М против И) -- ${m2.s} -> ${m2.bad ? 'нет (хуже)' : 'ДА'}`);
let ok3 = true; for (const w of ['еда', 'вода']) { const r = pair('М', 'Г', (x) => aucOf(x, w), 1); if (!r.ok) ok3 = false; console.log(`3. ${w} (М > Г) -- ${r.s}`); } console.log(`   мера 3: ${ok3 ? 'ДА' : 'нет'}`);
let ok4 = true; for (const w of ['голодно', 'жажда', 'опасно']) { const r = pair('М', 'Г', (x) => aucOf(x, w), 1); if (r.bad) ok4 = false; console.log(`4. ${w} (М против Г) -- ${r.s}`); }
const rc = pair('М', 'Г', (x) => x.comfort, 1); if (rc.bad) ok4 = false; console.log(`4. польза (М против Г) -- ${rc.s}\n   мера 4: ${ok4 ? 'ДА' : 'нет'}`);
console.log('\nдоп.:'); for (const w of ['укус', 'еда', 'вода', 'удар']) console.log(`   ${w}: М против Р -- ${pair('М', 'Р', (x) => aucOf(x, w), 1).s}; М против И -- ${pair('М', 'И', (x) => aucOf(x, w), 1).s}`);
const M = C['М']; if (M) { const first = new Map(), cnt = new Map(); for (const r of M.values()) { const seen = new Set(); for (const x of r.inv || []) { cnt.set(x.target, (cnt.get(x.target) || 0) + 1); if (!seen.has(x.target)) { seen.add(x.target); (first.get(x.target) || first.set(x.target, []).get(x.target)).push(x.t); } } }
  for (const [k, ts] of first) console.log(`   ${k}: первая принятая гипотеза -- в ${ts.length} из ${M.size} миров, медиана круга ${med(ts)}; принято всего ${cnt.get(k)}`); }

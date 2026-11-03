// чтение Сб1 (ПЛАН.md §3): сборщик сам понял событие, не хуже ручной связи, не ломает остального; парно, Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f)) return null; return new Map(fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Н': L('../r2/r2_S.jsonl'), 'Р': L('../r2/r2_SS.jsonl'), 'Сб': L('sb1_C.jsonl') }, ALL = ['еда', 'вода', 'укус', 'удар', 'голодно', 'жажда', 'опасно'];
const aucOf = (r, w) => { const x = r.words.find((q) => q.name === w); return x && x.auc !== null ? x.auc : NaN; };
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: 'нет данных' };
  const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()];
  console.log(`${k.padEnd(3)} миров ${m.size}: польза ${f(med(v.map((r) => r.comfort)), 3)}; AUC (медианы): ` + ALL.map((w) => `${w} ${f(med(v.map((r) => aucOf(r, w))))}`).join(', ')); }
const m1 = pair('Сб', 'Н', (x) => aucOf(x, 'укус'), 1); console.log(`\n1. сам понял событие (укус, Сб > Н) -- ${m1.s} -> ${m1.ok ? 'ДА' : 'нет'}`);
const m2 = pair('Сб', 'Р', (x) => aucOf(x, 'укус'), 1); console.log(`2. сам не хуже ручного (укус, Сб против Р) -- ${m2.s} -> ${m2.bad ? 'нет (хуже)' : 'ДА'}`);
let ok3 = true; for (const w of ['голодно', 'жажда', 'опасно']) { const r = pair('Сб', 'Н', (x) => aucOf(x, w), 1); if (r.bad) ok3 = false; console.log(`3. ${w} (Сб против Н) -- ${r.s}`); }
const rc = pair('Сб', 'Н', (x) => x.comfort, 1); if (rc.bad) ok3 = false; console.log(`3. польза (Сб против Н) -- ${rc.s}\n   мера 3: ${ok3 ? 'ДА' : 'нет'}`);
console.log('\nдоп.:'); for (const w of ['удар', 'еда', 'вода']) console.log(`   ${w}: Сб против Н -- ${pair('Сб', 'Н', (x) => aucOf(x, w), 1).s}; против Р -- ${pair('Сб', 'Р', (x) => aucOf(x, w), 1).s}`);
const S = C['Сб']; if (S) { const cnt = new Map(); let wm = 0; for (const r of S.values()) for (const w of r.words) { if (w.mem && w.mem.length) wm++; for (const m of w.mem || []) { const key = `${w.name}: ${m}`; cnt.set(key, (cnt.get(key) || 0) + 1); } }
  console.log(`   каналов слов с органом памяти: ${wm} из ${S.size * 7}; сборки, которые читают части каналов слов:`);
  for (const [k, n] of [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`     ${n}× ${k}`); }

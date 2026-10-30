// чтение Э5б (ПЛАН.md §4): учёба различает, полезна, лучше прежней, компромисс; парно по мирам, двусторонний Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, comfort: r.summary.comfort }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Б': L('../e4/e4_B.json'), 'МС': L('../e5/e5_S.json'), 'МП': L('e5b_P.json'), 'МП0': L('e5b_0.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  console.log(`${k.padEnd(3)} миров ${m.size}: польза тела ${g('comfort', 3)}; укусов на 1000 ${g('bites')}; еда+вода ${g('eat', 1)}; смертей ${g('deaths2')}`); }
const line = (a, b, key, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: `${a} против ${b}: нет данных` };
  const s = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y), d = s.map((k) => A.get(k)[key] - B.get(k)[key]).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { md, p: t.p, ok: t.p < 0.01 && (want < 0 ? md < 0 : md > 0), s: `${a} против ${b}, ${key}: медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
const signs = (m) => { let tp = 0, tn = 0, ap = 0, an = 0; if (m) for (const x of m.values()) for (const w of (x.exp && x.exp.blend) || []) { if (w.kind === 'к') w.w > 0 ? tp++ : tn++; else w.w > 0 ? ap++ : an++; } return { tp, tn, ap, an }; };
const sP = signs(C['МП']), sS = signs(C['МС']), sh = sP.tp / (sP.tp + sP.tn);
console.log(`\n1. учёба различает: вес «к» > 0 у ${sP.tp} из ${sP.tp + sP.tn} целей (${f(100 * sh, 0)}%; у МС ${sS.tp} из ${sS.tp + sS.tn}) -> ${sh >= 0.9 ? 'ДА' : 'нет'}`);
const m2 = line('МП', 'МП0', 'comfort', 1), m3 = line('МП', 'МС', 'comfort', 1);
console.log(`2. учёба полезна -- ${m2.s} -> ${m2.ok ? 'ДА' : 'нет'}`);
console.log(`3. лучше прежней учёбы -- ${m3.s} -> ${m3.ok ? 'ДА' : 'нет'}`);
const S = C['МП']; let born = 0; const rows = [];
if (S) for (const [seed, x] of [...S.entries()].sort((p, q) => p[0] - q[0])) { const bl = (x.exp && x.exp.blend) || [];
  const ok = bl.some((w) => w.kind === 'от' && w.w > 0) && bl.some((w) => w.kind === 'к' && w.w > 0); if (ok) born++;
  rows.push(`  мир ${seed}: ${bl.map((w) => `${w.kind} ${w.key} ${f(w.w)} (α ${f(w.al)} t ${f(w.tAl, 1)}, γ ${f(w.ga)} t ${f(w.tGa, 1)}, обст. ${f(w.ctx)}, шагов ${w.steps}, проб ${w.nb})`).join('; ')} -> ${ok ? 'смесь' : '-'}`); }
console.log(`4. компромисс родился: в ${born} из ${S ? S.size : 0} миров -> ${born >= 20 ? 'ДА' : 'нет'}`);
console.log(`\nдоп.: знаки «от» у МП: + ${sP.ap}, - ${sP.an} (у МС + ${sS.ap}, - ${sS.an}); у МП0 веса не учатся`);
for (const k of ['comfort', 'bites', 'eat']) console.log(`      ${line('МП', 'Б', k, k === 'bites' ? -1 : 1).s}`);
for (const k of ['bites', 'eat']) console.log(`      ${line('МП', 'МП0', k, k === 'bites' ? -1 : 1).s}`);
console.log('\nвеса по мирам (МП):\n' + rows.join('\n'));

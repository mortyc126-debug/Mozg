// чтение Э5 (ПЛАН.md §3): телу лучше, реже кусают и ест, компромисс родился -- МС против Б; парно по мирам, двусторонний Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, comfort: r.summary.comfort }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Б': L('../e4/e4_B.json'), 'М1': L('../e4b/e4b_1.json'), 'МС': L('e5_S.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  console.log(`${k.padEnd(3)} миров ${m.size}: польза тела ${g('comfort', 3)}; укусов на 1000 ${g('bites')}; еда+вода ${g('eat', 1)}; смертей ${g('deaths2')}`); }
const line = (a, b, key, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: `${a} против ${b}: нет данных` };
  const s = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y), d = s.map((k) => A.get(k)[key] - B.get(k)[key]).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { md, p: t.p, ok: t.p < 0.01 && (want < 0 ? md < 0 : md > 0), bad: t.p < 0.01 && (want < 0 ? md > 0 : md < 0), s: `${a} против ${b}, ${key}: медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
const c = line('МС', 'Б', 'comfort', 1), b = line('МС', 'Б', 'bites', -1), e = line('МС', 'Б', 'eat', 1);
console.log(`\n1. телу лучше -- ${c.s} -> ${c.ok ? 'ДА' : 'нет'}`);
console.log(`2. реже кусают -- ${b.s} -> ${b.ok ? 'ДА' : 'нет'}\n   ест -- ${e.s} -> ${e.bad ? 'нет (меньше)' : 'ДА'}`);
const S = C['МС']; let born = 0, nb = 0; const rows = [];
if (S) for (const [seed, x] of [...S.entries()].sort((p, q) => p[0] - q[0])) { const bl = x.exp && x.exp.blend; if (!bl) { rows.push(`  мир ${seed}: весов нет`); continue; } nb++;
  const away = bl.filter((w) => w.kind === 'от'), to = bl.filter((w) => w.kind === 'к'), ok = away.some((w) => w.w > 0) && to.some((w) => w.w > 0); if (ok) born++;
  const gr = x.exp.goals || {}, tot = Object.values(gr).reduce((a, q) => a + q, 0);
  rows.push(`  мир ${seed}: ${bl.map((w) => `${w.kind} ${w.key} ${f(w.w, 3)} (α ${f(w.al, 3)}, γ ${f(w.ga, 3)}, обст. ${f(w.ctx)})`).join('; ')}; смесь правит ${f(100 * (gr['смесь'] || 0) / (tot || 1), 0)}% кругов -> ${ok ? 'смесь' : '-'}`); }
console.log(`3. компромисс родился (вес «от» при страхе 3 > 0 и вес «к» > 0): в ${born} из ${S ? S.size : 0} миров (веса есть в ${nb}) -> ${born >= 20 ? 'ДА' : 'нет'}`);
console.log(`\nдоп.: ${line('МС', 'М1', 'comfort', 1).s}\n      ${line('МС', 'М1', 'bites', -1).s}\n      ${line('МС', 'М1', 'eat', 1).s}\n      ${line('МС', 'Б', 'deaths2', -1).s}`);
console.log('\nвеса смеси по мирам:\n' + rows.join('\n'));

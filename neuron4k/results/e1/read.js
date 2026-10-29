// чтение Э1 (ПЛАН.md §4): отбор частей по вкладу, нет спирали, выживание; парно по мирам, двусторонний Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, motorDeaths: r.summary.motorDeaths }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Б': L('e1_B.json'), 'БО': L('e1_BO.json'), 'ЭП': L('e1_EP.json'), 'ЭВ': L('e1_EV.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  console.log(`${k.padEnd(3)} миров ${m.size}: еда+вода ${g('eat', 1)}; смертей ${g('deaths2')}; частей ${g('parts2', 1)}, в запахах ${g('partsUse', 1)} (доля ${g('useShare')}); по нужде ${g('need')}; аренда за круг ${g('rent')}; разорений мотора ${g('motorDeaths', 0)}`); }
const line = (a, b, key, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: `${a} против ${b}: нет данных` };
  const s = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y), d = s.map((k) => A.get(k)[key] - B.get(k)[key]).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { md, p: t.p, s: `${a} против ${b}, ${key}: медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
{ const r = line('ЭВ', 'ЭП', 'useShare', 1); console.log(`\n1. отбор: ${r.s} -> ${r.p < 0.01 && r.md > 0 ? 'ДА' : 'нет'}`); }
if (C['ЭВ']) { const v = [...C['ЭВ'].values()], ok = v.filter((x) => x.parts2 >= 3).length; console.log(`2. нет спирали: частей ≥ 3 в ${ok} из ${v.length} -> ${ok >= 20 ? 'ДА' : 'нет'}`); }
{ const e = line('ЭВ', 'БО', 'eat', 1), d = line('ЭВ', 'БО', 'deaths2', -1), bad = (e.p < 0.01 && e.md < 0) || (d.p < 0.01 && d.md > 0);
  console.log(`3. выживание не хуже БО: ${e.s}; ${d.s} -> ${bad ? 'нет (хуже)' : 'ДА'}`); }
for (const [a, b, key, w] of [['БО', 'Б', 'eat', 1], ['БО', 'Б', 'deaths2', -1], ['ЭП', 'БО', 'eat', 1], ['ЭВ', 'ЭП', 'eat', 1], ['ЭВ', 'ЭП', 'parts2', 1]]) console.log('доп.: ' + line(a, b, key, w).s);

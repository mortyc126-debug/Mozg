// чтение Э4 (ПЛАН.md §4): миндалина ждёт укус; страх меняет поведение; парно по мирам, двусторонний Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, motorDeaths: r.summary.motorDeaths }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const label = (T) => { const e = Object.entries(T.tr).sort((a, b) => b[1] - a[1])[0]; return e[1] ? e[0] : null; };
const C = { 'Б': L('e4_B.json'), 'МА': L('e4_A.json'), 'МУ': L('e4_U.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  const away = v.map((x) => { const gr = x.exp.goals || {}, tot = Object.values(gr).reduce((a, b) => a + b, 0); let a = 0; for (const [key, n] of Object.entries(gr)) if (key[0] === '-') a += n; return tot ? a / tot : NaN; });
  console.log(`${k.padEnd(3)} миров ${m.size}: укусов на 1000 ${g('bites')}; еда+вода ${g('eat', 1)}; смертей ${g('deaths2')}; по нужде ${g('need')}; круги с целью «от» ${f(100 * med(away), 0)}%`); }
if (C['МА']) { const s = [...C['МА'].keys()].sort((a, b) => a - b), d = s.map((k) => { const ts = C['МА'].get(k).exp.types.filter((T) => label(T) === 'укус').sort((a, b) => b.tr['укус'] - a.tr['укус']); const T = ts[0]; return T && T.antB !== null && T.antA !== null ? T.antB - T.antA : NaN; });
  const t = wil2(d.filter(Number.isFinite)), pos = d.filter((x) => x > 0).length; console.log(`\n0. миндалина ждёт укус (МА): медиана ${f(med(d), 3)}, больше 0 в ${pos} из ${d.length}; p = ${t.p.toExponential(2)} -> ${pos >= 20 && t.p < 0.01 && med(d) > 0 ? 'ДА' : 'нет'}`); }
const line = (a, b, key, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: `${a} против ${b}: нет данных` };
  const s = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y), d = s.map((k) => A.get(k)[key] - B.get(k)[key]).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { md, p: t.p, ok: t.p < 0.01 && (want < 0 ? md < 0 : md > 0), s: `${a} против ${b}, ${key}: медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
{ const r = line('МА', 'Б', 'bites', -1); console.log(`1. страх меняет поведение: ${r.s} -> ${r.ok ? 'ДА' : 'нет'}`); }
{ const r = line('МА', 'Б', 'eat', 1), bad = r.p < 0.01 && r.md < 0; console.log(`2. без вреда кормлению: ${r.s} -> ${bad ? 'нет (вред)' : 'ДА'}`); }
{ const b = line('МА', 'МУ', 'bites', -1), e = line('МА', 'МУ', 'eat', 1); console.log(`3. миндалина нужна: ${b.s}; ${e.s} -> ${b.ok || e.ok ? 'ДА' : 'нет'}`); }
for (const [a, bb, key, w] of [['МУ', 'Б', 'bites', -1], ['МУ', 'Б', 'eat', 1], ['МА', 'Б', 'deaths2', -1]]) console.log('доп.: ' + line(a, bb, key, w).s);

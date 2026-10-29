// чтение Э4б (ПЛАН.md §3): реже кусают и ест -- для М1 и МП против Б; парно по мирам, двусторонний Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, motorDeaths: r.summary.motorDeaths }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Б': L('../e4/e4_B.json'), 'МУ': L('../e4/e4_U.json'), 'М1': L('e4b_1.json'), 'МП': L('e4b_P.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  const away = v.map((x) => { const gr = x.exp.goals || {}, tot = Object.values(gr).reduce((a, b) => a + b, 0); let a = 0; for (const [key, n] of Object.entries(gr)) if (key[0] === '-') a += n; return tot ? a / tot : NaN; });
  console.log(`${k.padEnd(3)} миров ${m.size}: укусов на 1000 ${g('bites')}; еда+вода ${g('eat', 1)}; смертей ${g('deaths2')}; по нужде ${g('need')}; круги с целью «от» ${f(100 * med(away), 0)}%`); }
const line = (a, b, key, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: `${a} против ${b}: нет данных` };
  const s = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y), d = s.map((k) => A.get(k)[key] - B.get(k)[key]).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { md, p: t.p, ok: t.p < 0.01 && (want < 0 ? md < 0 : md > 0), bad: t.p < 0.01 && (want < 0 ? md > 0 : md < 0), s: `${a} против ${b}, ${key}: медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
let any = false;
for (const k of ['М1', 'МП']) { const b = line(k, 'Б', 'bites', -1), e = line(k, 'Б', 'eat', 1);
  console.log(`\n${k}: 1. реже кусают -- ${b.s} -> ${b.ok ? 'ДА' : 'нет'}\n${k}: 2. ест -- ${e.s} -> ${e.bad ? 'нет (меньше)' : 'ДА'}`); if (b.ok && !e.bad) any = true;
  console.log(`${k}: доп. -- ${line(k, 'МУ', 'eat', 1).s}; ${line(k, 'Б', 'deaths2', -1).s}`); }
console.log(`\nстрах меняет поведение без голода: ${any ? 'ДА' : 'нет'}`);

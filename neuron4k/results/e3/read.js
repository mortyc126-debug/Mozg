// чтение Э3 (ПЛАН.md §3): мозжечок-оценщик -- видит ли лучше нерва, ест ли тело больше; парно по мирам, двусторонний Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, motorDeaths: r.summary.motorDeaths }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Б': L('../e1/e1_B.json'), 'МК': L('e3_K.json'), 'МК0': L('e3_N.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  console.log(`${k.padEnd(3)} миров ${m.size}: еда+вода ${g('eat', 1)}; смертей ${g('deaths2')}; по нужде ${g('need')}; обесценивание ${g('deval')}` + (v[0].estRatio !== undefined ? `; ошибка оценки / нерва (запахи) ${g('estRatio', 3)}` : '')); }
const line = (a, b, key, want) => { const A = C[a], B = C[b]; if (!A || !B) return `${a} против ${b}: нет данных`;
  const s = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y), d = s.map((k) => A.get(k)[key] - B.get(k)[key]).filter(Number.isFinite), t = wil2(d), md = med(d);
  const ok = t.p < 0.01 && (want < 0 ? md < 0 : md > 0);
  return `${a} против ${b}, ${key}: медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)} -> ${ok ? 'ДА' : 'нет'}`; };
if (C['МК']) { const d = [...C['МК'].values()].map((x) => x.estRatio - 1), t = wil2(d); console.log(`\n0а. мозжечок видит лучше нерва: отношение < 1 в ${d.filter((x) => x < 0).length} из ${d.length}, p = ${t.p.toExponential(2)} -> ${t.p < 0.01 && med(d) < 0 ? 'ДА' : 'нет'}`); }
console.log('0б. копия помогает видеть: ' + line('МК', 'МК0', 'estRatio', -1));
console.log('1. тело ест больше: ' + line('МК', 'Б', 'eat', 1));
console.log('2. дело в копии команды: ' + line('МК', 'МК0', 'eat', 1));
for (const [a, b, key, w] of [['МК0', 'Б', 'eat', 1], ['МК', 'Б', 'deaths2', -1], ['МК', 'Б', 'need', 1], ['МК', 'Б', 'deval', -1]]) console.log('доп.: ' + line(a, b, key, w).replace(/ -> (ДА|нет)/, ''));

// чтение Э2 (ПЛАН.md §3): мозжечок -- механизм (ошибка прогноза), еда и вода; парно по мирам, двусторонний Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, motorDeaths: r.summary.motorDeaths }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Б': L('../e1/e1_B.json'), 'МЗ': L('e2_C.json'), 'МЗ0': L('e2_N.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  console.log(`${k.padEnd(3)} миров ${m.size}: еда+вода ${g('eat', 1)}; смертей ${g('deaths2')}; по нужде ${g('need')}; обесценивание ${g('deval')}` + (v[0].cerRatio !== undefined ? `; ошибка мозжечка / «как сейчас» (запахи) ${g('cerRatio', 3)}` : '')); }
const line = (a, b, key, want) => { const A = C[a], B = C[b]; if (!A || !B) return `${a} против ${b}: нет данных`;
  const s = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y), d = s.map((k) => A.get(k)[key] - B.get(k)[key]).filter(Number.isFinite), t = wil2(d), md = med(d);
  const ok = t.p < 0.01 && (want < 0 ? md < 0 : md > 0);
  return `${a} против ${b}, ${key}: медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)} -> ${ok ? 'ДА' : 'нет'}`; };
console.log('\n0. механизм: ' + line('МЗ', 'МЗ0', 'cerRatio', -1));
console.log('1. совет помогает рулю: ' + line('МЗ', 'Б', 'eat', 1));
console.log('2. дело в копии команды: ' + line('МЗ', 'МЗ0', 'eat', 1));
for (const [a, b, key, w] of [['МЗ0', 'Б', 'eat', 1], ['МЗ', 'Б', 'deaths2', -1], ['МЗ', 'Б', 'need', 1], ['МЗ', 'Б', 'deval', -1]]) console.log('доп.: ' + line(a, b, key, w).replace(/ -> (ДА|нет)/, ''));

// чтение К1м2 (ПЛАН_К1м2.md §3): парно по мирам, двусторонний Уилкоксон -- функция из readk1z.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, motorDeaths: r.summary.motorDeaths }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'С': L('k1k_S.json'), 'СП': L('k1m2_P.json'), 'СПШ': L('k1m2_N.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  console.log(`${k.padEnd(3)} миров ${m.size}: смертей 2-я половина ${g('deaths2')}, 1-я ${g('deaths1')}; еда ${g('food', 1)}; разорений мотора ${g('motorDeaths', 1)}` +
    (v[0].gainA !== undefined ? `; множитель руля -- перед смертью ${g('gainB')}, в остальные круги ${g('gainA')}` : '')); }
const line = (a, b, key, want) => { const A = C[a], B = C[b]; if (!A || !B) return `${a} против ${b}: нет данных`;
  const s = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y), d = s.map((k) => A.get(k)[key] - B.get(k)[key]), t = wil2(d), md = med(d);
  const ok = t.p < 0.01 && (want < 0 ? md < 0 : md > 0);
  return `${a} против ${b}, ${key}: медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)} (n = ${t.n}) -> ${ok ? 'ДА' : 'нет'}`; };
console.log('\n1. ' + line('СП', 'С', 'deaths2', -1));
console.log('2. ' + line('СП', 'СПШ', 'deaths2', -1));
console.log('3. ' + line('СП', 'С', 'food', 1) + '   (вспомогательная)');
console.log('3. ' + line('СП', 'СПШ', 'food', 1) + '   (вспомогательная)');
console.log('доп.: ' + line('СПШ', 'С', 'deaths2', -1).replace(/ -> (ДА|нет)/, '') + '   (сама скачущая сила руля)');
for (const k of Object.keys(C)) { const m = C[k]; if (!m) continue; const v = [...m.values()], dd = v.map((x) => x.deaths2 - x.deaths1), fr = v.map((x) => x.fearB - x.fearA);
  console.log(`доп. ${k}: смертей 2-я минус 1-я половина -- медиана ${f(med(dd), 3)}, p = ${wil2(dd).p.toExponential(2)}; страх -- больше 0 в ${fr.filter((x) => x > 0).length} из ${fr.length}`); }

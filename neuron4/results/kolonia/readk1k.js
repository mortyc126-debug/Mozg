// чтение К1к (ПЛАН_К1к.md §4): страх против нуля и парные сравнения по мирам, двусторонний Уилкоксон -- функция из readk1z.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, motorDeaths: r.summary.motorDeaths }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'КД': L('k1i_KD.json'), 'С': L('k1k_S.json'), 'СМ': L('k1k_SM.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  console.log(`${k.padEnd(3)} миров ${m.size}: смертей 2-я половина ${g('deaths2')}, 1-я ${g('deaths1')}; еда ${g('food', 1)}; разорений мотора ${g('motorDeaths', 1)}` +
    (k !== 'КД' ? `; орган страха жив ${f(100 * med(v.map((x) => x.fAlive)), 0)}%, банкротств ${g('fDeaths', 1)}, доход за страх ${g('fPaid', 0)}` : '')); }
const line = (a, b, key, want) => { const A = C[a], B = C[b]; if (!A || !B) return `${a} против ${b}: нет данных`;
  const s = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y), d = s.map((k) => A.get(k)[key] - B.get(k)[key]), t = wil2(d), md = med(d);
  const ok = t.p < 0.01 && (want < 0 ? md < 0 : md > 0);
  return `${a} против ${b}, ${key}: медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)} (n = ${t.n}) -> ${ok ? 'ДА' : 'нет'}`; };
const fearOf = (k) => { const m = C[k]; if (!m) return `${k}: нет данных`; const s = [...m.keys()].sort((x, y) => x - y), d = s.map((q) => m.get(q).fearB - m.get(q).fearA), t = wil2(d), md = med(d), pos = d.filter((x) => x > 0).length;
  return `страх у ${k} (до смерти минус всегда): медиана ${f(md, 4)}, больше 0 в ${pos} из ${d.length}; p = ${t.p.toExponential(2)} -> ${pos >= 20 && t.p < 0.01 && md > 0 ? 'ДА' : 'нет'}; по мирам ${d.map((x) => f(x, 3)).join(' ')}`; };
console.log('\n1. ' + fearOf('С'));
console.log('2. ' + line('СМ', 'С', 'deaths2', -1));
console.log('3. ' + line('СМ', 'С', 'food', 1) + '   (вспомогательная)');
console.log('\nдоп.: ' + fearOf('СМ').replace(/ -> (ДА|нет)/, ''));
console.log('доп.: ' + fearOf('КД').replace(/ -> (ДА|нет)/, '') + '   (части канала, без органа)');
console.log('доп.: ' + line('С', 'КД', 'deaths2', -1).replace(/ -> (ДА|нет)/, '') + '   (сам орган на рынке)');

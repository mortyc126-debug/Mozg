// чтение К1и (ПЛАН_К1и.md §4): парно по мирам, двусторонний Уилкоксон -- функция из readk1z.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, motorDeaths: r.summary.motorDeaths }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'З': L('k1z_Z.json'), 'К': L('k1i_K.json'), 'КД': L('k1i_KD.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  console.log(`${k.padEnd(3)} миров ${m.size}: разорений мотора ${g('motorDeaths', 1)}; смертей тела 2-я половина ${g('deaths2')}, 1-я ${g('deaths1')}; еда ${g('food', 1)}`); }
const line = (a, b, key, want) => { const A = C[a], B = C[b]; if (!A || !B) return `${a} против ${b}: нет данных`;
  const s = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y), d = s.map((k) => A.get(k)[key] - B.get(k)[key]), t = wil2(d), md = med(d);
  const ok = t.p < 0.01 && (want < 0 ? md < 0 : md > 0);
  return `${a} против ${b}, ${key}: медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)} (n = ${t.n}) -> ${ok ? 'ДА' : 'нет'}`; };
console.log('\n1. ' + line('К', 'З', 'motorDeaths', -1) + '   (механизм)');
console.log('2. ' + line('К', 'З', 'deaths2', -1));
console.log('3. ' + line('КД', 'К', 'deaths2', -1));
console.log('4. ' + line('К', 'З', 'food', 1) + '   (вспомогательная)');
console.log('4. ' + line('КД', 'К', 'food', 1) + '   (вспомогательная)');
for (const k of ['К', 'КД']) { const m = C[k]; if (!m) continue; const v = [...m.values()], fr = v.map((x) => x.fearB - x.fearA), dd = v.map((x) => x.deaths2 - x.deaths1);
  console.log(`доп. ${k}: страх -- медиана ${f(med(fr), 4)}, больше 0 в ${fr.filter((x) => x > 0).length} из ${fr.length}; смертей 2-я минус 1-я половина -- медиана ${f(med(dd), 3)}, p = ${wil2(dd).p.toExponential(2)}`); }

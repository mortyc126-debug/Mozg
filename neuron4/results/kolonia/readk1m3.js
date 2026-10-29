// чтение К1м3 (ПЛАН_К1м3.md): повтор К1м2 на сидах 25-48, двусторонний Уилкоксон -- функция из readk1z.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, motorDeaths: r.summary.motorDeaths }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const S = L('k1m3_S.json'), P = L('k1m3_P.json');
for (const [k, m] of [['С', S], ['СП', P]]) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  console.log(`${k.padEnd(3)} миров ${m.size}: смертей 2-я половина ${g('deaths2')}, 1-я ${g('deaths1')}; еда ${g('food', 1)}; разорений мотора ${g('motorDeaths', 1)}`); }
if (S && P) { const s = [...S.keys()].filter((k) => P.has(k)).sort((a, b) => a - b), dif = (key) => s.map((k) => P.get(k)[key] - S.get(k)[key]);
  const d1 = dif('deaths2'), t1 = wil2(d1), m1 = med(d1);
  console.log(`\n1. СП против С, deaths2: медиана разности ${f(m1, 3)}, меньше в ${d1.filter((x) => x < 0).length} из ${d1.length}; p = ${t1.p.toExponential(2)} -> ${t1.p < 0.01 && m1 < 0 ? 'ДА' : 'нет'}`);
  const lp = s.map((k) => P.get(k).deaths2 - P.get(k).deaths1), ls = s.map((k) => S.get(k).deaths2 - S.get(k).deaths1), t2 = wil2(lp), dd = lp.map((x, i) => x - ls[i]), t3 = wil2(dd);
  console.log(`2. СП: 2-я минус 1-я половина -- медиана ${f(med(lp), 3)}, p = ${t2.p.toExponential(2)}; сильнее, чем у С (у С ${f(med(ls), 3)}): медиана разности ${f(med(dd), 3)}, p = ${t3.p.toExponential(2)} -> ${t2.p < 0.01 && med(lp) < 0 && t3.p < 0.05 && med(dd) < 0 ? 'ДА' : 'нет'}`);
  const d4 = dif('food'), t4 = wil2(d4); console.log(`3. еда СП против С: медиана разности ${f(med(d4), 2)}, p = ${t4.p.toExponential(2)}   (вспомогательная)`); }

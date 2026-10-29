// чтение М2 (ПЛАН_М2.md §4): цена события -- связь с сытостью, цена смерти, смерть при штрафе 6
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, r.summary.xres])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const label = (T) => { const e = Object.entries(T.tr).sort((a, b) => b[1] - a[1])[0]; return e[1] ? e[0] : null; };
const E30 = L('m2_E30.json'), E6 = L('m2_E6.json');
if (E30) { const s = [...E30.keys()].sort((a, b) => a - b);
  const main = (x, what) => x.exp.types.filter((T) => label(T) === what).sort((a, b) => b.tr[what] - a.tr[what])[0];
  const c = s.map((k) => { const T = main(E30.get(k), 'еда'); return T && T.price ? T.price.corrE ?? NaN : NaN; }), t = wil2(c.filter(Number.isFinite)), neg = c.filter((x) => x < 0).length;
  console.log(`1. еда дешевеет с сытостью (Е30): корреляция цены главного вида «еда» с сытостью -- медиана ${f(med(c))}, меньше 0 в ${neg} из ${c.length}; p = ${t.p.toExponential(2)} -> ${neg >= 20 && t.p < 0.01 && med(c) < 0 ? 'ДА' : 'нет'}; по мирам ${c.map((x) => f(x)).join(' ')}`);
  const dp = s.map((k) => { const T = main(E30.get(k), 'смерть'); return T && T.price ? T.price.predMean ?? NaN : NaN; }), ok = dp.filter((x) => x >= -30 && x <= -18).length;
  console.log(`2. цена смерти (Е30), предсказанная до события: медиана ${f(med(dp))}, в [−30, −18] в ${ok} из ${dp.length} -> ${ok >= 20 ? 'ДА' : 'нет'}; по мирам ${dp.map((x) => f(x, 1)).join(' ')}`);
  const all = s.flatMap((k) => E30.get(k).exp.types.filter((T) => T.price && T.price.relMed !== null).map((T) => [label(T), T.price.relMed, T.price.predMean]));
  for (const what of ['еда', 'еда-мелкая', 'смерть', 'удар']) { const q = all.filter((x) => x[0] === what); if (q.length) console.log(`доп. Е30, ${what}: точность цены (|предсказано − было| / |было|) -- медиана ${f(med(q.map((x) => x[1])), 3)}; цена -- медиана ${f(med(q.map((x) => x[2])), 2)} (видов ${q.length})`); }
  const cs = s.flatMap((k) => E30.get(k).exp.types.filter((T) => label(T) === 'еда' && T.price && T.price.corrE !== null).map((T) => T.price.corrE)); console.log(`доп. Е30: корреляция с сытостью по всем видам «еда» -- медиана ${f(med(cs))}, меньше 0 у ${cs.filter((x) => x < 0).length} из ${cs.length}`); }
if (E6) { const s = [...E6.keys()].sort((a, b) => a - b), has = s.map((k) => E6.get(k).exp.types.some((T) => label(T) === 'смерть')), no = has.filter((x) => !x).length;
  console.log(`3. смерть бесплатна при штрафе 6 (Е6): вида «смерть» нет в ${no} из ${s.length} -> ${no >= 20 ? 'ДА' : 'нет'}`);
  const w = s.map((k) => E6.get(k).exp.types.map((T) => `${T.key}[${label(T) || '-'}]`).join(' ')); console.log('доп. Е6, виды: ' + w.slice(0, 4).join(' | ') + ' ...');
  console.log(`доп. Е6: смертей во второй половине -- медиана ${f(med(s.map((k) => E6.get(k).exp.tot['смерть'])), 0)}`); }

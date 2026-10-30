// чтение Э7 (ПЛАН.md §4): руль бежит, учёба принимает, реже кусают, следует цене, телу лучше; парно по мирам, Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, comfort: r.summary.comfort }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'С3': L('../e6/e6_3.json'), 'С10': L('../e6/e6_10.json'), 'С30': L('../e6/e6_30.json'), 'А3': L('e7_3.json'), 'А10': L('e7_10.json'), 'А30': L('e7_30.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  console.log(`${k.padEnd(4)} миров ${m.size}: польза тела ${g('comfort', 3)}; укусов на 1000 ${g('bites')}; еда+вода ${g('eat', 1)}; смертей ${g('deaths2')}`); }
const shift = (x, kind) => { const ws = ((x.exp && x.exp.blend) || []).filter((w) => w.kind === kind && w.steps > 0).map((w) => w.w - 0.5); return ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : NaN; };
const away = (x, part) => { const a = x.exp.awayDir; return a && a[part][1] ? a[part][0] / a[part][1] : NaN; };
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: `${a} против ${b}: нет данных` };
  const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, s: `${a} против ${b}: медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
const A30 = C['А30'], nr = A30 ? [...A30.values()].map((x) => away(x, 'near')) : [], ok1 = nr.filter((x) => x > 0.55).length;
console.log(`\n1. руль бежит (доля «прочь» при погоне > 0.55): у А30 в ${ok1} из 24 миров (руль был в ${nr.filter(Number.isFinite).length}; медиана ${f(med(nr))}) -> ${ok1 >= 20 ? 'ДА' : 'нет'}`);
const m2 = pair('А30', 'С30', (x) => shift(x, 'от'), 1), m3 = pair('А30', 'С30', (x) => x.bites, -1), m4 = pair('А30', 'А3', (x) => shift(x, 'от'), 1), m5 = pair('А30', 'С30', (x) => x.comfort, 1);
console.log(`2. учёба принимает руль (сдвиг «от») -- ${m2.s} -> ${m2.ok ? 'ДА' : 'нет'}`);
console.log(`3. реже кусают -- ${m3.s} -> ${m3.ok ? 'ДА' : 'нет'}`);
console.log(`4. учёба следует цене (сдвиг «от») -- ${m4.s} -> ${m4.ok ? 'ДА' : 'нет'}`);
console.log(`5. телу лучше -- ${m5.s} -> ${m5.ok ? 'ДА' : 'нет'}`);
console.log('\nдоп.:');
for (const k of ['А3', 'А10', 'А30']) if (C[k]) { const v = [...C[k].values()]; let born = 0; for (const x of v) { const bl = x.exp.blend || []; if (bl.some((w) => w.kind === 'от' && w.w > 0) && bl.some((w) => w.kind === 'к' && w.w > 0)) born++; }
  console.log(`  ${k}: руль прочь -- всего ${f(med(v.map((x) => away(x, 'all'))))}, при погоне ${f(med(v.map((x) => away(x, 'near'))))} (медианы); сдвиг «от» ${f(med(v.map((x) => shift(x, 'от'))))}; компромисс в ${born} из ${v.length}`); }
for (const k of ['С3', 'С10', 'С30']) if (C[k]) console.log(`  ${k}: сдвиг «от» ${f(med([...C[k].values()].map((x) => shift(x, 'от'))))}`);
for (const kb of ['3', '10', '30']) for (const [key, w] of [['comfort', 1], ['bites', -1], ['eat', 1]]) console.log(`  А${kb} против С${kb}, ${key}: ${pair('А' + kb, 'С' + kb, (x) => x[key], w).s}`);

// чтение Э6 (ПЛАН.md §3): ценность видит угрозу и её цену, учёба следует цене, телу не хуже; парно по мирам, Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, comfort: r.summary.comfort }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'МП3': L('../e5c/e5c_P3.json'), 'МП10': L('../e5b/e5b_P.json'), 'МП30': L('../e5c/e5c_P30.json'), 'С3': L('e6_3.json'), 'С10': L('e6_10.json'), 'С30': L('e6_30.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  console.log(`${k.padEnd(4)} миров ${m.size}: польза тела ${g('comfort', 3)}; укусов на 1000 ${g('bites')}; еда+вода ${g('eat', 1)}; смертей ${g('deaths2')}`); }
// вид «укус» -- больше всего настоящих укусов; его сила в ценности c·sd(ψ)
const biteKey = (x) => { let b = null, n = 0; for (const t of x.exp.types || []) if ((t.tr && t.tr['укус']) > n) { n = t.tr['укус']; b = t.key; } return b; };
const biteForce = (x) => { const vp = x.exp.vpsi, k = biteKey(x); if (!vp || !k) return NaN; const p = vp.psi.find((q) => q.key === k); return p ? p.force : NaN; };
const shift = (x, kind) => { const ws = ((x.exp && x.exp.blend) || []).filter((w) => w.kind === kind && w.steps > 0).map((w) => w.w - 0.5); return ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : NaN; };
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: `${a} против ${b}: нет данных` };
  const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { md, p: t.p, ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `${a} против ${b}: медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
const S30 = C['С30'], bf30 = S30 ? [...S30.values()].map(biteForce) : [], neg = bf30.filter((x) => x < 0).length;
console.log(`\n1. ценность видит угрозу: сила ψ укуса у С30 < 0 в ${neg} из ${bf30.filter(Number.isFinite).length} миров (медиана ${f(med(bf30))}) -> ${neg >= 20 ? 'ДА' : 'нет'}`);
const m2 = pair('С30', 'С3', biteForce, -1); console.log(`2. видит цену угрозы (сила ψ укуса) -- ${m2.s} -> ${m2.ok ? 'ДА' : 'нет'}`);
const m3 = pair('С30', 'С3', (x) => shift(x, 'от'), 1); console.log(`3. учёба следует цене (сдвиг «от») -- ${m3.s} -> ${m3.ok ? 'ДА' : 'нет'}`);
const m4 = pair('С10', 'МП10', (x) => x.comfort, 1); console.log(`4. телу не хуже (польза) -- ${m4.s} -> ${m4.bad ? 'нет (хуже)' : 'ДА'}`);
console.log('\nдоп.:');
for (const k of ['С3', 'С10', 'С30']) if (C[k]) { const v = [...C[k].values()], gain = v.map((x) => x.exp.vpsi && x.exp.vpsi.gainAll), bfs = v.map(biteForce), bd = v.map((x) => { const vp = x.exp.vpsi, kk = biteKey(x); const p = vp && vp.psi.find((q) => q.key === kk); return p ? p.drop : NaN; });
  let tp = 0, tn = 0; for (const x of v) for (const w of (x.exp && x.exp.blend) || []) if (w.steps > 0 && w.kind === 'к') w.w > 0.5 ? tp++ : tn++;
  console.log(`  ${k}: ψ улучшают подгонку V на ${f(100 * med(gain), 1)}% (медиана); сила ψ укуса ${f(med(bfs))}, вклад ψ укуса ${f(100 * med(bd), 2)}%; сдвиг «от» ${f(med(v.map((x) => shift(x, 'от'))))}; вес «к» вырос у ${tp} из ${tp + tn}`); }
for (const kb of ['3', '10', '30']) for (const [key, w] of [['comfort', 1], ['bites', -1], ['eat', 1]]) console.log(`  С${kb} против МП${kb}, ${key}: ${pair('С' + kb, 'МП' + kb, (x) => x[key], w).s}`);
console.log(`  сдвиг «от»: ${pair('С30', 'МП30', (x) => shift(x, 'от'), 1).s}`);

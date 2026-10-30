// чтение Э5в (ПЛАН.md §2): учёба чувствует цену укуса, компромисс где нужен, бегство окупается; парно по мирам, Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, comfort: r.summary.comfort }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'МП3': L('e5c_P3.json'), 'МП10': L('../e5b/e5b_P.json'), 'МП30': L('e5c_P30.json'), 'Б30': L('e5c_B30.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  console.log(`${k.padEnd(4)} миров ${m.size}: польза тела ${g('comfort', 3)}; укусов на 1000 ${g('bites')}; еда+вода ${g('eat', 1)}; смертей ${g('deaths2')}`); }
// сдвиг «от» мира -- среднее (w - 0.5) по обученным целям «от»
const shift = (x, kind) => { const ws = ((x.exp && x.exp.blend) || []).filter((w) => w.kind === kind && w.steps > 0).map((w) => w.w - 0.5); return ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : NaN; };
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: `${a} против ${b}: нет данных` };
  const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, s: `${a} против ${b}: медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
const m1 = pair('МП30', 'МП3', (x) => shift(x, 'от'), 1);
console.log(`\n1. учёба чувствует цену (сдвиг «от») -- ${m1.s} -> ${m1.ok ? 'ДА' : 'нет'}`);
const S = C['МП30']; let born = 0;
if (S) for (const x of S.values()) { const bl = (x.exp && x.exp.blend) || []; if (bl.some((w) => w.kind === 'от' && w.w > 0) && bl.some((w) => w.kind === 'к' && w.w > 0)) born++; }
console.log(`2. компромисс родился у МП30: в ${born} из ${S ? S.size : 0} миров -> ${born >= 20 ? 'ДА' : 'нет'}`);
const m3 = pair('МП30', 'Б30', (x) => x.comfort, 1);
console.log(`3. бегство окупается -- польза тела ${m3.s} -> ${m3.ok ? 'ДА' : 'нет'}`);
console.log('\nдоп.:');
for (const k of ['МП3', 'МП10', 'МП30']) if (C[k]) { const v = [...C[k].values()], sh = v.map((x) => shift(x, 'от')).filter(Number.isFinite);
  let tp = 0, tn = 0, ap = 0, an = 0; for (const x of v) for (const w of (x.exp && x.exp.blend) || []) if (w.steps > 0) { if (w.kind === 'к') w.w > 0.5 ? tp++ : tn++; else w.w > 0.5 ? ap++ : an++; }
  console.log(`  ${k}: медиана сдвига «от» по мирам ${f(med(sh))} (миров ${sh.length}); вес «от» вырос у ${ap} из ${ap + an}; «к» вырос у ${tp} из ${tp + tn}; медиана сдвига «к» ${f(med(v.map((x) => shift(x, 'к'))))}`); }
console.log(`  ${pair('МП30', 'МП10', (x) => shift(x, 'от'), 1).s} (сдвиг «от»)\n  ${pair('МП10', 'МП3', (x) => shift(x, 'от'), 1).s} (сдвиг «от»)`);
for (const k of ['bites', 'eat']) console.log(`  МП30 против Б30, ${k}: ${pair('МП30', 'Б30', (x) => x[k], k === 'bites' ? -1 : 1).s}`);

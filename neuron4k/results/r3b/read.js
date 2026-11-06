// чтение Р3б (ПЛАН.md §3, §5): говорит о событиях; П против Н и Г; У -- доп.; парно по мирам, двусторонний Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null; return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, comfort: r.summary.comfort }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Г': L('../r3/r3_G.json'), 'У': L('r3b_U.json'), 'П': L('r3b_P.json'), 'Н': L('r3b_N.json') }, WORDS = ['еда', 'вода', 'укус', 'удар', 'голодно', 'жажда', 'опасно'];
const wd = (x, w) => (x.speech ? x.speech.words.find((q) => q.w === w) : null), prec = (x, w) => { const q = wd(x, w); return q && q.said ? q.ok / q.said : NaN; }, base = (x, w) => { const q = wd(x, w); return q ? q.tru / q.n : NaN; };
const named = (x) => x.speech && x.speech.biteNamed;
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: 'нет данных' };
  const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()];
  console.log(`${k} миров ${m.size}: польза ${f(med(v.map((x) => x.comfort)), 3)}; говорит в ${f(100 * med(v.map((x) => x.speech.talk)), 0)}% кругов; укус назван ${f(100 * med(v.map(named)), 0)}%`);
  console.log('   точность (база): ' + WORDS.map((w) => `${w} ${f(med(v.map((x) => prec(x, w))))} (${f(med(v.map((x) => base(x, w))))})`).join(', ')); }
const r1 = pair('П', 'Н', (x) => prec(x, 'укус'), 1); console.log(`\n1. говорит «укус» по делу (П > Н) -- ${r1.s} -> ${r1.ok ? 'ДА' : 'нет'}`);
const r2a = pair('П', 'Г', named, 1), r2b = pair('П', 'Н', named, 1); console.log(`2. называет укус: П > Г -- ${r2a.s}; П > Н -- ${r2b.s} -> ${r2a.ok && r2b.ok ? 'ДА' : 'нет'}`);
let ok3 = true; for (const w of ['еда', 'вода']) { const r = pair('П', 'Н', (x) => prec(x, w), 1); if (!r.ok) ok3 = false; console.log(`3. ${w} (П > Н) -- ${r.s}`); } console.log(`   мера 3: ${ok3 ? 'ДА' : 'нет'}`);
let ok4 = true; for (const w of ['опасно', 'жажда']) { const r = pair('П', 'Н', (x) => prec(x, w), 1); if (!r.ok) ok4 = false; console.log(`4. ${w} (П > Н) -- ${r.s}`); } console.log(`   мера 4: ${ok4 ? 'ДА' : 'нет'}`);
const r5 = pair('П', 'Н', (x) => x.comfort, 1); console.log(`5. польза (П против Н) -- ${r5.s} -> ${r5.bad ? 'нет (ниже)' : 'ДА'}`);
console.log('\nдоп. (не меры):');
console.log(`   укус назван: У против Г -- ${pair('У', 'Г', named, 1).s}; П против У -- ${pair('П', 'У', named, 1).s}`);
for (const w of ['укус', 'еда', 'вода', 'опасно', 'жажда']) console.log(`   точность ${w}: У против Г -- ${pair('У', 'Г', (x) => prec(x, w), 1).s}; П против У -- ${pair('П', 'У', (x) => prec(x, w), 1).s}`);

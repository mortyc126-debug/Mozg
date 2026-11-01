// чтение Р3 (ПЛАН.md §3): говорит по делу, называет укус, жить не мешает; Г против Н, парно по мирам, двусторонний Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, comfort: r.summary.comfort }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Г': L('r3_G.json'), 'Н': L('r3_N.json') }, WORDS = ['еда', 'вода', 'укус', 'удар', 'голодно', 'жажда', 'опасно'];
const wd = (x, w) => (x.speech ? x.speech.words.find((q) => q.w === w) : null);
const prec = (x, w) => { const q = wd(x, w); return q && q.said ? q.ok / q.said : NaN; }, base = (x, w) => { const q = wd(x, w); return q ? q.tru / q.n : NaN; }, said = (x, w) => { const q = wd(x, w); return q ? q.said / q.n : NaN; };
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: 'нет данных' };
  const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()];
  console.log(`${k} миров ${m.size}: польза ${f(med(v.map((x) => x.comfort)), 3)}; укусов ${f(med(v.map((x) => x.bites)))}; еда+вода ${f(med(v.map((x) => x.eat)), 1)}; говорит в ${f(100 * med(v.map((x) => x.speech && x.speech.talk)), 0)}% кругов; укус назван ${f(100 * med(v.map((x) => x.speech && x.speech.biteNamed)), 0)}%`);
  for (const w of WORDS) console.log(`   ${w.padEnd(8)} точность ${f(med(v.map((x) => prec(x, w))))} при базе ${f(med(v.map((x) => base(x, w))))}; говорит в ${f(100 * med(v.map((x) => said(x, w))), 1)}% кругов`); }
let ok1 = true; console.log('\n1. говорит по делу (точность Г > Н):');
for (const w of ['опасно', 'жажда', 'укус']) { const r = pair('Г', 'Н', (x) => prec(x, w), 1); if (!r.ok) ok1 = false; console.log(`   ${w}: ${r.s} -> ${r.ok ? 'да' : 'нет'}`); }
console.log(`   мера 1: ${ok1 ? 'ДА' : 'нет'}`);
const r2 = pair('Г', 'Н', (x) => x.speech && x.speech.biteNamed, 1); console.log(`2. называет укус -- ${r2.s} -> ${r2.ok ? 'ДА' : 'нет'}`);
const r3 = pair('Г', 'Н', (x) => x.comfort, 1); console.log(`3. жить не мешает -- ${r3.s} -> ${r3.bad ? 'нет (ниже)' : 'ДА'}`);
console.log('\nдоп.: точность Г против Н по остальным словам:');
for (const w of ['еда', 'вода', 'удар', 'голодно']) console.log(`   ${w}: ${pair('Г', 'Н', (x) => prec(x, w), 1).s}`);
const G = C['Г']; if (G) { const v = [...G.values()]; console.log(`   миров, где «опасно» точнее базы вдвое: ${v.filter((x) => prec(x, 'опасно') > 2 * base(x, 'опасно')).length} из ${v.length}; «жажда»: ${v.filter((x) => prec(x, 'жажда') > 2 * base(x, 'жажда')).length} из ${v.length}`); }

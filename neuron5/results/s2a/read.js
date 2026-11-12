// чтение ступени 2а (ПЛАН.md §3): выбор лучше рефлексов, учёба а не шум, понимание не теряется, учёба повторима
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f)) return null; return new Map(fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r])); };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Р': L('s2a_R.jsonl'), 'Б0': L('s2a_B0.jsonl'), 'Б': L('s2a_B.jsonl') }, EV = ['укус', 'еда', 'вода', 'удар'], ST = ['голодно', 'жажда', 'опасно'], half = 20000;
const wd = (r, w) => r.words.find((q) => q.name === w), aucOf = (r, w) => { const x = wd(r, w); return x && x.auc !== null ? x.auc : NaN; };
const ceil = (r, w) => { const x = wd(r, w); if (!x || !x.n) return NaN; const ps = Math.min(1, x.n / half / 0.1), q = 0.9 * ps / (1 - 0.1 * ps); return 1 - q / 2; }, share = (r, w) => (aucOf(r, w) - 0.5) / (ceil(r, w) - 0.5);
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: 'нет данных' };
  const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((r) => r[key])), d);
  console.log(`${k.padEnd(2)} миров ${m.size}: польза ${g('comfort', 3)}; еда+вода ${g('eat', 1)}; укусов ${g('bites', 1)}; смертей ${g('deaths', 2)}; у стены ${f(100 * med(v.map((r) => r.wall)), 0)}%`); }
const m1 = pair('Б', 'Р', (x) => x.comfort, 1); console.log(`\n1. выбор лучше рефлексов (польза Б > Р) -- ${m1.s} -> ${m1.ok ? 'ДА' : 'нет'}`);
const m2 = pair('Б', 'Б0', (x) => x.comfort, 1); console.log(`2. учёба, а не шум (польза Б > Б0) -- ${m2.s} -> ${m2.ok ? 'ДА' : 'нет'}`);
let ok3 = true; console.log('3. понимание не теряется (Б против Р):');
for (const w of EV) { const r = pair('Б', 'Р', (x) => aucOf(x, w), 1); if (r.bad) ok3 = false; console.log(`   ${w} (AUC): ${r.s}${r.bad ? ' -- ХУЖЕ' : ''}`); }
for (const w of ST) { const r = pair('Б', 'Р', (x) => share(x, w), 1); if (r.bad) ok3 = false; console.log(`   ${w} (доля потолка): ${r.s}${r.bad ? ' -- ХУЖЕ' : ''}`); }
console.log(`   мера 3: ${ok3 ? 'ДА' : 'нет'}`);
const B = [...C['Б'].values()], names = Object.keys(B[0].bg.al); let ok4 = false; console.log('4. учёба повторима (сдвиг веса от 1):');
for (const nm of names) { const sh = B.map((r) => r.bg.al[nm] - 1), up = sh.filter((x) => x > 0).length, dn = sh.filter((x) => x < 0).length; if (Math.max(up, dn) >= 20) ok4 = true; console.log(`   «${nm}»: медиана веса ${f(med(B.map((r) => r.bg.al[nm])))}; вырос в ${up}, упал в ${dn} из ${B.length}`); }
console.log(`   мера 4: ${ok4 ? 'ДА' : 'нет'}`);
console.log('\nдоп.:'); for (const [key, w] of [['eat', 1], ['bites', -1], ['wall', -1]]) console.log(`   ${key}: Б против Р -- ${pair('Б', 'Р', (x) => x[key], w).s}`);
console.log(`   цена проб (польза Б0 против Р) -- ${pair('Б0', 'Р', (x) => x.comfort, 1).s}`);
console.log(`   время мира: Р ${f(med([...C['Р'].values()].map((r) => r.sec)), 1)} с, Б ${f(med(B.map((r) => r.sec)), 1)} с`);

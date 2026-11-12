// чтение ступени 2б (ПЛАН.md §3): миндалина ждёт боль, реже кусают, без потери еды, польза не ниже, обстановка нужна, понимание
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f)) return null; return new Map(fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r])); };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Р': L('../s2a/s2a_R.jsonl'), 'Б': L('../s2a/s2a_B.jsonl'), 'О': L('s2b_O.jsonl'), 'Ок': L('s2b_K.jsonl') }, EV = ['укус', 'еда', 'вода', 'удар'], ST = ['голодно', 'жажда', 'опасно'], half = 20000;
const wd = (r, w) => r.words.find((q) => q.name === w), aucOf = (r, w) => { const x = wd(r, w); return x && x.auc !== null ? x.auc : NaN; };
const ceil = (r, w) => { const x = wd(r, w); if (!x || !x.n) return NaN; const ps = Math.min(1, x.n / half / 0.1), q = 0.9 * ps / (1 - 0.1 * ps); return 1 - q / 2; }, share = (r, w) => (aucOf(r, w) - 0.5) / (ceil(r, w) - 0.5);
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: 'нет данных' };
  const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((r) => r[key])), d);
  console.log(`${k.padEnd(2)} миров ${m.size}: польза ${g('comfort', 3)}; еда+вода ${g('eat', 1)}; укусов ${g('bites', 1)}; AUC: ` + [...EV, ...ST].map((w) => `${w} ${f(med(v.map((r) => aucOf(r, w))))}`).join(', ')); }
const O = [...C['О'].values()], a0 = O.map((r) => r.amyg.auc), n0 = a0.filter((x) => x > 0.75).length;
console.log(`\n0. миндалина ждёт боль: AUC страха > 0.75 в ${n0} из ${O.length} миров (медиана ${f(med(a0))}) -> ${n0 >= 20 ? 'ДА' : 'нет'}`);
const m1 = pair('О', 'Б', (x) => x.bites, -1), m2 = pair('О', 'Б', (x) => x.eat, 1), m3 = pair('О', 'Б', (x) => x.comfort, 1), m4 = pair('О', 'Ок', (x) => x.bites, -1);
console.log(`1. реже кусают (О < Б) -- ${m1.s} -> ${m1.ok ? 'ДА' : 'нет'}`);
console.log(`2. без потери еды (О против Б) -- ${m2.s} -> ${m2.bad ? 'нет (меньше)' : 'ДА'}`);
console.log(`3. польза не ниже (О против Б) -- ${m3.s} -> ${m3.bad ? 'нет (ниже)' : 'ДА'}`);
console.log(`4. обстановка нужна (укусов О < Ок) -- ${m4.s} -> ${m4.ok ? 'ДА' : 'нет'}`);
let ok5 = true; console.log('5. понимание не теряется (О против Б):');
for (const w of EV) { const r = pair('О', 'Б', (x) => aucOf(x, w), 1); if (r.bad) ok5 = false; console.log(`   ${w} (AUC): ${r.s}${r.bad ? ' -- ХУЖЕ' : r.ok ? ' -- лучше' : ''}`); }
for (const w of ST) { const r = pair('О', 'Б', (x) => aucOf(x, w), 1), q = pair('О', 'Б', (x) => share(x, w), 1); if (r.bad && q.bad) ok5 = false; console.log(`   ${w}: AUC -- ${r.s}${r.bad ? ' (ниже)' : r.ok ? ' (выше)' : ''}; доля потолка -- ${q.s}${q.bad ? ' (ниже)' : q.ok ? ' (выше)' : ''}`); }
console.log(`   мера 5: ${ok5 ? 'ДА' : 'нет'}`);
console.log('\nдоп.: веса и наклоны по рефлексам (О):'); for (const nm of Object.keys(O[0].bg.al)) { const g = O.map((r) => r.bg.ga[nm]); console.log(`   «${nm}»: α ${f(med(O.map((r) => r.bg.al[nm])))}; γ ${f(med(g))} (γ > 0 в ${g.filter((x) => x > 0).length}, γ < 0 в ${g.filter((x) => x < 0).length} из ${g.length})`); }
console.log(`   польза О против Р (рефлексы как есть) -- ${pair('О', 'Р', (x) => x.comfort, 1).s}`);
console.log(`   польза О против Ок -- ${pair('О', 'Ок', (x) => x.comfort, 1).s}`);
console.log(`   кто читает «страх» в коре (О): ${[...new Set(O.flatMap((r) => r.words.filter((w) => w.reads.includes('страх')).map((w) => w.name)))].map((w) => `${w} в ${O.filter((r) => wd(r, w).reads.includes('страх')).length} мирах`).join(', ') || 'никто'}`);

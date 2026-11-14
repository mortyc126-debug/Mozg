// чтение ступени 9 (ПЛАН.md §4): карта места и путь в обход
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => new Map(fs.readFileSync(path.join(__dirname, n), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r]));
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Б': L('s9_B.jsonl'), 'Н': L('s9_N.jsonl'), 'Н0': L('s9_N0.jsonl'), 'О': L('s9_O.jsonl'), 'ОН': L('s9_ON.jsonl') }, V = (k) => [...C[k].values()];
const auc = (r, w) => r.words.find((q) => q.name === w).auc, named = (r) => r.speech.words[0].named, navw = (r) => Math.max(r.bg.al['к еде по карте'], r.bg.al['к воде по карте']);
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const k of Object.keys(C)) { const v = V(k), g = (fn, d) => f(med(v.map(fn)), d);
  console.log(`${k.padEnd(2)}: еда+вода ${g((r) => r.eat)}; польза ${g((r) => r.comfort, 3)}; смертей ${g((r) => r.deaths)}; у стены ${g((r) => r.wall, 3)}` + (v[0].nav ? `; вес карты (еда/вода) ${g((r) => r.bg.al['к еде по карте'])} / ${g((r) => r.bg.al['к воде по карте'])}; верных стен ${g((r) => r.nav.wallsTrue)}; ошибка мест ${g((r) => r.nav.placeErr[0] ?? NaN, 1)} / ${g((r) => r.nav.placeErr[1] ?? NaN, 1)}; сбросов ${g((r) => r.nav.resets, 0)}` : '')); }
const m1 = pair('Н', 'Б', (x) => x.eat, 1); console.log(`\n1. карта помогает (еда+вода Н > Б): ${m1.s} -> ${m1.ok ? 'ДА' : 'нет'}`);
const m2 = pair('Н', 'Н0', (x) => x.eat, 1); console.log(`2. нужны стены (Н > Н0): ${m2.s} -> ${m2.ok ? 'ДА' : 'нет'}`);
const k3 = V('Н').filter((r) => navw(r) > 0.5).length; console.log(`3. мозг сам поверил карте (вес > 0.5): в ${k3} из 24 -> ${k3 >= 20 ? 'ДА' : 'нет'}`);
const m4 = pair('ОН', 'О', (x) => x.comfort, 1); console.log(`4. не мешает без преграды (польза ОН против О): ${m4.s} -> ${m4.bad ? 'нет' : 'ДА'}`);
let ok5 = true; for (const [nm, fn] of [['AUC еда', (x) => auc(x, 'еда')], ['AUC вода', (x) => auc(x, 'вода')], ['названо еды', named]]) { const r = pair('Н', 'Б', fn, 1); if (r.bad) ok5 = false; console.log(`5. ${nm} (Н против Б): ${r.s}${r.bad ? ' -- ХУЖЕ' : ''}`); }
console.log(`   мера 5: ${ok5 ? 'ДА' : 'нет'}`);
console.log(`\nдоп.: польза Н против Б: ${pair('Н', 'Б', (x) => x.comfort, 1).s}; еда ОН против О: ${pair('ОН', 'О', (x) => x.eat, 1).s}; смертей Н против Б: ${pair('Н', 'Б', (x) => x.deaths, -1).s}`);

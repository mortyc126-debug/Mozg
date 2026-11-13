// чтение ступени 7 (ПЛАН.md §4): зов к еде. Мера -- среднее двух тел мира; меры 3 -- по телам
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => new Map(fs.readFileSync(path.join(__dirname, n), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r]));
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'З': L('s7_Z.jsonl'), 'Зк': L('s7_K.jsonl'), 'Зб': L('s7_B.jsonl') }, V = (k) => [...C[k].values()];
const avg = (r, fn) => (fn(r.bodies[0]) + fn(r.bodies[1])) / 2, eat = (r) => avg(r, (b) => b.eat), comf = (r) => avg(r, (b) => b.comfort);
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const k of Object.keys(C)) { const v = V(k), g = (fn, d) => f(med(v.map(fn)), d);
  console.log(`${k.padEnd(2)}: еда+вода ${g(eat)}; польза ${g(comf, 3)}; рядом ${g((r) => r.near)}; подход после зова ${g((r) => avg(r, (b) => b.approach || 0))}; названо еды ${g((r) => avg(r, (b) => b.named.еда || 0))}; вес «к другому» ${g((r) => avg(r, (b) => b.al['к другому']))}; смертей ${g((r) => avg(r, (b) => b.deaths))}`); }
const m1 = pair('З', 'Зк', eat, 1); console.log(`\n1. зов полезен (еда+вода З > Зк): ${m1.s} -> ${m1.ok ? 'ДА' : 'нет'}`);
const m2 = pair('З', 'Зб', eat, 1); console.log(`2. слушает, а не просто ходит вместе (З > Зб): ${m2.s} -> ${m2.ok ? 'ДА' : 'нет'}`);
const bodies = V('З').flatMap((r) => r.bodies), W = ['еда', 'вода', 'укус', 'удар', 'голодно', 'жажда', 'опасно'];
const pos = bodies.filter((b) => b.ga.еда > 0).length, others = W.filter((w) => w !== 'еда' && w !== 'вода'), mo = med(bodies.map((b) => Math.max(...others.map((w) => b.ga[w])))), me = med(bodies.map((b) => b.ga.еда));
console.log(`3. понял, какое слово -- зов: γ «еда» > 0 у ${pos} тел из ${bodies.length}; медиана γ «еда» ${f(me, 3)} против наибольшего γ прочих слов ${f(mo, 3)} -> ${pos >= 36 && me > mo ? 'ДА' : 'нет'}`);
console.log('   γ по словам (медиана по телам): ' + W.map((w) => `${w} ${f(med(bodies.map((b) => b.ga[w])), 3)} (>0 у ${bodies.filter((b) => b.ga[w] > 0).length})`).join(', '));
const m4 = pair('З', 'Зб', comf, 1); console.log(`4. жить не мешает (польза З против Зб): ${m4.s} -> ${m4.bad ? 'нет' : 'ДА'}`);
console.log(`\nдоп.: польза З против Зк: ${pair('З', 'Зк', comf, 1).s}; подход после зова З против Зб: ${pair('З', 'Зб', (r) => avg(r, (b) => b.approach || 0), 1).s}`);

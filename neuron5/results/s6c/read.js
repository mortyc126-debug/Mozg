// чтение ступени 6в (ПЛАН.md): таламус -- чистые ощущения
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => new Map(fs.readFileSync(path.join(__dirname, n), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r]));
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'ФР': L('../s6b/s6b_FR.jsonl'), 'ФРТ': L('s6c_FRT.jsonl'), 'Г0Р': L('../s6b/s6b_G0R.jsonl'), 'Г0РТ': L('s6c_G0RT.jsonl') }, V = (k) => [...C[k].values()];
const sw = (r, w) => r.speech.words.find((q) => q.name === w), auc = (r, w) => r.words.find((q) => q.name === w).auc;
const named = (r, w) => (sw(r, w).named !== null ? sw(r, w).named : NaN), lift = (r, w) => (sw(r, w).prec !== null ? sw(r, w).prec / sw(r, w).base : NaN);
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
const W = ['еда', 'вода', 'укус', 'удар', 'голодно', 'жажда', 'опасно'];
for (const k of Object.keys(C)) { const v = V(k), g = (fn, d) => f(med(v.map(fn)), d);
  console.log(`${k.padEnd(4)}: польза ${g((r) => r.comfort, 3)}; AUC ` + W.map((w) => `${w} ${g((r) => auc(r, w))}`).join(', ') + `; названо еды ${g((r) => named(r, 'еда'))}, питья ${g((r) => named(r, 'вода'))}; подъём голодно ${g((r) => lift(r, 'голодно'), 1)}, жажда ${g((r) => lift(r, 'жажда'), 1)}; ${g((r) => r.sec, 1)} с`); }
let ok1 = true; for (const w of ['еда', 'вода']) { const r = pair('ФРТ', 'ФР', (x) => auc(x, w), 1); if (!r.ok) ok1 = false; console.log(`\n1. AUC «${w}» ФРТ > ФР: ${r.s}`); } console.log(`   мера 1: ${ok1 ? 'ДА' : 'нет'}`);
const m2 = pair('ФРТ', 'ФР', (x) => auc(x, 'удар'), 1); console.log(`2. AUC «удар» ФРТ > ФР: ${m2.s} -> ${m2.ok ? 'ДА' : 'нет'}`);
let ok3 = true; console.log('3. ничего не теряет:');
for (const [a, b] of [['ФРТ', 'ФР'], ['Г0РТ', 'Г0Р']]) for (const [nm, fn] of [...['еда', 'вода', 'укус', 'голодно', 'жажда'].map((w) => [`AUC ${w}`, (x) => auc(x, w)]), ['названо еды', (x) => named(x, 'еда')], ['названо питья', (x) => named(x, 'вода')], ['подъём голодно', (x) => lift(x, 'голодно')], ['подъём жажда', (x) => lift(x, 'жажда')], ['польза', (x) => x.comfort]]) {
  const r = pair(a, b, fn, 1); if (r.bad) ok3 = false; if (r.bad || r.ok) console.log(`   ${a} против ${b}, ${nm}: ${r.s}${r.bad ? ' -- ХУЖЕ' : ' (лучше)'}`); }
console.log(`   мера 3: ${ok3 ? 'ДА' : 'нет'}`);
const must = ['слово еда', 'слово вода', 'слово укус', 'слово удар', 'касание слева', 'касание справа'], never = ['запах', 'сытость', 'напоённость'];
const good = V('ФРТ').filter((r) => must.every((m) => r.thal.includes(m)) && !r.thal.some((x) => never.some((q) => x.startsWith(q)))).length;
console.log(`4. двоичные нервы найдены верно: в ${good} из 24 -> ${good >= 22 ? 'ДА' : 'нет'}`);
const cnt = {}; for (const r of V('ФРТ')) for (const x of r.thal) cnt[x] = (cnt[x] || 0) + 1; console.log('   признаны двоичными (в скольких мирах): ' + Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
console.log(`\nдоп.: «удар» Г0РТ против Г0Р: ${pair('Г0РТ', 'Г0Р', (x) => auc(x, 'удар'), 1).s}; «еда» Г0РТ против Г0Р: ${pair('Г0РТ', 'Г0Р', (x) => auc(x, 'еда'), 1).s}`);

// чтение ступени 6б (ПЛАН.md): речь по следам при разной и ровной задержке
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => new Map(fs.readFileSync(path.join(__dirname, n), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r]));
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Ф': L('../s6/s6_F.jsonl'), 'ФР': L('s6b_FR.jsonl'), 'Г0': L('../s6/s6_G0.jsonl'), 'Г0Р': L('s6b_G0R.jsonl') }, V = (k) => [...C[k].values()];
const sw = (r, w) => r.speech.words.find((q) => q.name === w), auc = (r, w) => r.words.find((q) => q.name === w).auc;
const named = (r, w) => (sw(r, w).named !== null ? sw(r, w).named : NaN), prec = (r, w) => (sw(r, w).prec !== null ? sw(r, w).prec : NaN), lift = (r, w) => prec(r, w) / sw(r, w).base;
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const k of Object.keys(C)) { const v = V(k), g = (fn, d) => f(med(v.map(fn)), d);
  console.log(`${k.padEnd(3)}: польза ${g((r) => r.comfort, 3)}; AUC еда ${g((r) => auc(r, 'еда'))}, вода ${g((r) => auc(r, 'вода'))}; названо еды ${g((r) => named(r, 'еда'))}, питья ${g((r) => named(r, 'вода'))}, укусов ${g((r) => named(r, 'укус'))}; точность еда ${g((r) => prec(r, 'еда'))}, вода ${g((r) => prec(r, 'вода'))}; подъём голодно ${g((r) => lift(r, 'голодно'), 1)}, жажда ${g((r) => lift(r, 'жажда'), 1)}; просьб ${g((r) => r.speech.helps[0] + r.speech.helps[1])}`); }
let ok1 = true; for (const w of ['еда', 'вода']) { const r = pair('ФР', 'Ф', (x) => named(x, w), 1), m = med(V('ФР').map((x) => named(x, w))); if (!r.ok || !(m >= 0.5)) ok1 = false; console.log(`\n1. называет «${w}» (ФР > Ф, медиана ${f(m)}): ${r.s}`); }
console.log(`   мера 1: ${ok1 ? 'ДА' : 'нет'}`);
let ok2 = true; for (const w of ['еда', 'вода']) { const r = pair('ФР', 'Ф', (x) => prec(x, w), 1); if (!r.ok) ok2 = false; console.log(`2. точность «${w}» (ФР > Ф): ${r.s}`); } console.log(`   мера 2: ${ok2 ? 'ДА' : 'нет'}`);
let ok3 = true; for (const [nm, fn] of [['AUC еда', (x) => auc(x, 'еда')], ['AUC вода', (x) => auc(x, 'вода')], ['подъём голодно', (x) => lift(x, 'голодно')], ['подъём жажда', (x) => lift(x, 'жажда')], ['польза', (x) => x.comfort]]) {
  const r = pair('ФР', 'Ф', fn, 1); if (r.bad) ok3 = false; console.log(`3. ${nm}: ${r.s}${r.bad ? ' -- ХУЖЕ' : ''}`); } console.log(`   мера 3: ${ok3 ? 'ДА' : 'нет'}`);
let ok4 = true; for (const w of ['еда', 'вода']) { const p = pair('Г0Р', 'Г0', (x) => prec(x, w), 1), n = pair('Г0Р', 'Г0', (x) => named(x, w), 1); if (!p.ok || n.bad) ok4 = false; console.log(`4. ровная задержка, «${w}»: точность ${p.s}; названо ${n.s}`); }
console.log(`   мера 4: ${ok4 ? 'ДА' : 'нет'}`);
console.log(`\nдоп.: укусов названо ФР против Ф: ${pair('ФР', 'Ф', (x) => named(x, 'укус'), 1).s}; польза Г0Р против Г0: ${pair('Г0Р', 'Г0', (x) => x.comfort, 1).s}`);

// чтение ступени 6 (ПЛАН.md §4): задача есть, понимает лучше, изобрёл сам, не ломает
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => new Map(fs.readFileSync(path.join(__dirname, n), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r]));
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Г0': L('s6_G0.jsonl'), 'Г': L('s6_G.jsonl'), 'Ф': L('s6_F.jsonl') }, V = (k) => [...C[k].values()];
const auc = (r, w) => { const x = r.words.find((q) => q.name === w); return x && x.auc !== null ? x.auc : NaN; }, named = (r, w) => { const x = r.speech.words.find((q) => q.name === w); return x.named !== null ? x.named : NaN; };
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
const W = ['еда', 'вода', 'укус', 'удар', 'голодно', 'жажда', 'опасно'];
for (const k of Object.keys(C)) { const v = V(k); console.log(`${k.padEnd(2)}: польза ${f(med(v.map((r) => r.comfort)), 3)}; AUC ` + W.map((w) => `${w} ${f(med(v.map((r) => auc(r, w))))}`).join(', ') + `; названо еды ${f(med(v.map((r) => named(r, 'еда'))))}, питья ${f(med(v.map((r) => named(r, 'вода'))))}`); }
let c0 = true; for (const w of ['еда', 'вода']) { const r = pair('Г', 'Г0', (x) => auc(x, w), -1); if (!r.ok) c0 = false; console.log(`\n0. задача есть (${w}: AUC Г < Г0): ${r.s}`); } console.log(`   условие 0: ${c0 ? 'ДА' : 'нет'}`);
let ok1 = true; for (const w of ['еда', 'вода']) { const r = pair('Ф', 'Г', (x) => auc(x, w), 1); if (!r.ok) ok1 = false; console.log(`1. понимает лучше (${w}: AUC Ф > Г): ${r.s}`); } console.log(`   мера 1: ${ok1 ? 'ДА' : 'нет'}`);
const F = V('Ф'), isW = (a, w) => a.for === 'слово ' + w, got = F.filter((r) => r.inventor.accepted.some((a) => isW(a, 'еда') || isW(a, 'вода'))).length;
console.log(`2. изобрёл сам (принято для «еда» или «вода»): в ${got} из ${F.length} -> ${got >= 20 ? 'ДА' : 'нет'}`);
let ok3 = true; for (const w of ['голодно', 'жажда']) { const r = pair('Ф', 'Г', (x) => auc(x, w), 1); if (r.bad) ok3 = false; console.log(`3. не ломает (${w}): ${r.s}${r.bad ? ' -- ХУЖЕ' : ''}`); }
const m3 = pair('Ф', 'Г', (x) => x.comfort, 1); if (m3.bad) ok3 = false; console.log(`   польза Ф против Г: ${m3.s}`); console.log(`   мера 3: ${ok3 ? 'ДА' : 'нет'}`);
console.log('\nдоп.:');
for (const w of ['укус', 'удар']) console.log(`   ${w} (AUC Ф против Г): ${pair('Ф', 'Г', (x) => auc(x, w), 1).s}`);
for (const w of ['еда', 'вода', 'укус']) console.log(`   ${w} (AUC Ф против Г0): ${pair('Ф', 'Г0', (x) => auc(x, w), 1).s}`);
for (const w of ['еда', 'вода']) console.log(`   названо «${w}» Ф против Г: ${pair('Ф', 'Г', (x) => named(x, w), 1).s}`);
const forms = {}; for (const r of F) for (const a of r.inventor.accepted) { const k = `${a.for} ← ${a.form.replace(/ (слева|справа)/, '')}`; forms[k] = (forms[k] || 0) + 1; }
console.log('   принятые формы (по всем мирам; сторона запаха не различается):'); for (const [k, n] of Object.entries(forms).sort((a, b) => b[1] - a[1])) console.log(`      ${n} × ${k}`);
const firstT = (w) => med(F.map((r) => { const a = r.inventor.accepted.find((q) => isW(q, w)); return a ? a.t : NaN; }).filter(Number.isFinite));
console.log(`   первая принятая форма (медиана круга): еда ${firstT('еда')}, вода ${firstT('вода')}, укус ${firstT('укус')}, удар ${firstT('удар') || '-'}`);
console.log(`   запросов (медиана) ${med(F.map((r) => r.inventor.requests))}, примерок ${med(F.map((r) => r.inventor.tried))}; «и» принято ${F.reduce((a, r) => a + r.inventor.accepted.filter((q) => q.form.includes(' и ')).length, 0)} раз`);
console.log(`   время мира: Г ${f(med(V('Г').map((r) => r.sec)), 1)} с, Ф ${f(med(F.map((r) => r.sec)), 1)} с`);

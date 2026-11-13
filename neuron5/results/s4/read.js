// чтение ступени 4 (ПЛАН.md §4): говорит по делу, называет события, состояния не в жертву, понимание не теряется, жить не мешает
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f)) return null; return new Map(fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r])); };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Б': L('../s2a/s2a_B.jsonl'), 'С': L('s4_S.jsonl'), 'Н': L('s4_N.jsonl'), 'Сл': L('s4_L.jsonl') }, half = 20000;
const ALL = ['еда', 'вода', 'удар', 'укус', 'голодно', 'жажда', 'опасно'];
const sw = (r, w) => r.speech && r.speech.words.find((q) => q.name === w);
const prec = (r, w) => { const x = sw(r, w); return x && x.prec !== null ? x.prec : NaN; }, base = (r, w) => { const x = sw(r, w); return x ? x.base : NaN; };
const lift = (r, w) => prec(r, w) / base(r, w), named = (r, w) => { const x = sw(r, w); return x && x.named !== null && x.named !== undefined ? x.named : NaN; };
const wd = (r, w) => r.words.find((q) => q.name === w), aucOf = (r, w) => { const x = wd(r, w); return x && x.auc !== null ? x.auc : NaN; };
const ceil = (r, w) => { const x = wd(r, w); if (!x || !x.n) return NaN; const ps = Math.min(1, x.n / half / 0.1), q = 0.9 * ps / (1 - 0.1 * ps); return 1 - q / 2; }, share = (r, w) => (aucOf(r, w) - 0.5) / (ceil(r, w) - 0.5);
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: 'нет данных' };
  const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
const V = (k) => [...C[k].values()];
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((r) => r[key])), d);
  console.log(`${k.padEnd(2)} миров ${m.size}: польза ${g('comfort', 3)}; еда+вода ${g('eat', 1)}; укусов ${g('bites', 1)}` + (v[0].speech ? `; говорит ${f(100 * med(v.map((r) => r.speech.talk)), 0)}% кругов` : '')); }
console.log('\nточность / база (медианы по мирам); названо событий');
console.log('слово      | ' + ['С', 'Н', 'Сл'].map((k) => k.padEnd(22)).join('| '));
for (const w of ALL) console.log(`${w.padEnd(10)} | ` + ['С', 'Н', 'Сл'].map((k) => { const v = V(k); return `${f(med(v.map((r) => prec(r, w))))} / ${f(med(v.map((r) => base(r, w))), 3)}` + (Number.isFinite(med(v.map((r) => named(r, w)))) ? ` наз ${f(med(v.map((r) => named(r, w))))}` : ''); }).map((s) => s.padEnd(22)).join('| '));
let ok1 = true; console.log('\n1. говорит по делу (точность С > Н):');
for (const w of ['еда', 'вода', 'удар', 'голодно', 'жажда']) { const r = pair('С', 'Н', (x) => prec(x, w), 1); if (!r.ok) ok1 = false; console.log(`   ${w}: ${r.s}${r.ok ? '' : ' -- НЕТ'}`); }
console.log(`   мера 1: ${ok1 ? 'ДА' : 'нет'}`);
let ok2 = true; console.log('2. называет события (С > Сл, медиана С >= 0.5):');
for (const w of ['еда', 'вода']) { const r = pair('С', 'Сл', (x) => named(x, w), 1), m = med(V('С').map((x) => named(x, w))); if (!r.ok || !(m >= 0.5)) ok2 = false; console.log(`   ${w}: медиана С ${f(m)}; против Сл: ${r.s}`); }
console.log(`   мера 2: ${ok2 ? 'ДА' : 'нет'}`);
let ok3 = true; console.log('3. состояния не в жертву (подъём С >= 2 хотя бы в 20 мирах из 24):');
for (const w of ['голодно', 'жажда']) { const ls = V('С').map((r) => lift(r, w)), k = ls.filter((x) => x >= 2).length; if (k < 20) ok3 = false; console.log(`   ${w}: подъём медиана ${f(med(ls))}, не меньше 2 в ${k} из ${ls.length}`); }
console.log(`   мера 3: ${ok3 ? 'ДА' : 'нет'}`);
let ok4 = true; console.log('4. понимание не теряется (С против Б):');
for (const w of ['еда', 'вода', 'удар']) { const r = pair('С', 'Б', (x) => aucOf(x, w), 1); if (r.bad) ok4 = false; console.log(`   ${w} (AUC): ${r.s}${r.bad ? ' -- ХУЖЕ' : ''}`); }
for (const w of ['голодно', 'жажда']) { const a = pair('С', 'Б', (x) => aucOf(x, w), 1), s = pair('С', 'Б', (x) => share(x, w), 1); if (a.bad && s.bad) ok4 = false; console.log(`   ${w}: AUC ${a.s}; доля потолка ${s.s}${a.bad && s.bad ? ' -- ХУЖЕ' : ''}`); }
console.log(`   мера 4: ${ok4 ? 'ДА' : 'нет'}`);
const m5 = pair('С', 'Б', (x) => x.comfort, 1); console.log(`5. жить не мешает (польза С против Б) -- ${m5.s} -> ${m5.bad ? 'нет' : 'ДА'}`);
console.log('\nдоп.:');
for (const w of ['укус', 'удар']) console.log(`   названо «${w}»: С ${f(med(V('С').map((r) => named(r, w))))}, Н ${f(med(V('Н').map((r) => named(r, w))))}, Сл ${f(med(V('Сл').map((r) => named(r, w))))}`);
for (const w of ['еда', 'вода']) console.log(`   названо «${w}» С против Н: ${pair('С', 'Н', (x) => named(x, w), 1).s}`);
for (const w of ALL) console.log(`   подъём «${w}» у С: медиана ${f(med(V('С').map((r) => lift(r, w))))}`);
console.log('   цены в конце жизни у С (медианы a + b·довод): ' + ALL.map((w) => `${w} ${f(med(V('С').map((r) => r.broca.price[w].a)), 3)} + ${f(med(V('С').map((r) => r.broca.price[w].b)), 3)}`).join('; '));
console.log(`   польза С против Н: ${pair('С', 'Н', (x) => x.comfort, 1).s}; Сл против Б: ${pair('Сл', 'Б', (x) => x.comfort, 1).s}`);
console.log(`   время мира: Б ${f(med(V('Б').map((r) => r.sec)), 1)} с, С ${f(med(V('С').map((r) => r.sec)), 1)} с`);
// разбор после счёта (не мера): «сам» -- выбор слова не мог опираться на это слово родителя; «вслед» -- родитель сказал его
// в шагах t-11..t-2; когда названо событие -- круг после события (4 -- одновременно с первым словом родителя, до того как оно услышано)
console.log('\nразбор (не мера; у С):');
for (const w of ['еда', 'вода', 'удар', 'укус', 'голодно', 'жажда', 'опасно']) { const v = V('С').map((r) => sw(r, w)).filter((q) => q && q.after !== undefined);
  const a = med(v.map((q) => q.after / q.said)), ps = med(v.map((q) => (q.ok - q.afterOk) / Math.max(1, q.said - q.after))), pa = med(v.map((q) => q.afterOk / Math.max(1, q.after))), b = med(v.map((q) => q.base));
  let s = `   ${w.padEnd(8)} вслед ${f(100 * a, 0)}% сказанного; точность сам ${f(ps)} (подъём ${f(ps / b, 1)}), вслед ${f(pa)}; база ${f(b, 3)}`;
  if (v[0].when) { const tot = [0, 0, 0, 0, 0]; v.forEach((q) => q.when.forEach((x, i) => (tot[i] += x))); const S = tot.reduce((x, y) => x + y, 0); s += `; названо в круге 1..5 после события: ${tot.map((x) => f(x / S)).join(' ')}`; }
  console.log(s); }
const flat = V('С').filter((r) => ['еда', 'вода'].some((w) => named(r, w) < 0.5)).map((r) => `мир ${r.seed}: ${['еда', 'вода'].filter((w) => named(r, w) < 0.5).map((w) => `«${w}» названо ${f(named(r, w))}, цена ${r.broca.price[w].a} + ${r.broca.price[w].b}·довод, высказываний ${r.broca.price[w].n}`).join('; ')}`);
console.log('   не научились: ' + (flat.length ? flat.join(' | ') : 'нет'));

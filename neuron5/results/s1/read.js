// чтение ступени 1 (ПЛАН.md §4): понимание слов -- С5 против К5 и против нейрона-4 (Сб6); парно по мирам, Уилкоксон
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f)) return null; return new Map(fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r])); };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'С5': L('s1_S.jsonl'), 'К5': L('s1_K.jsonl'), 'М4': L('../../../neuron4k/results/sb6/sb6_M.jsonl') }, EV = ['укус', 'еда', 'вода', 'удар'], ST = ['голодно', 'жажда', 'опасно'];
const aucOf = (r, w) => { const x = r.words.find((q) => q.name === w); return x && x.auc !== null ? x.auc : NaN; };
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: 'нет данных' };
  const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()]; console.log(`${k} миров ${m.size}: AUC (медианы): ` + [...EV, ...ST].map((w) => `${w} ${f(med(v.map((r) => aucOf(r, w))))}`).join(', ')); }
const S = [...C['С5'].values()]; let ok1 = true;
console.log('\n1. понимает слова событий:');
for (const w of EV) { const m = med(S.map((r) => aucOf(r, w))), th = w === 'удар' ? 0.65 : 0.85, r = pair('С5', 'К5', (x) => aucOf(x, w), 1), ok = m >= th && r.ok; if (!ok) ok1 = false; console.log(`   ${w}: медиана ${f(m)} (порог ${th}); против К5 -- ${r.s} -> ${ok ? 'да' : 'нет'}`); }
console.log(`   мера 1: ${ok1 ? 'ДА' : 'нет'}`);
let ok2 = true; console.log('2. понимает слова состояний (С5 > К5):');
for (const w of ST) { const r = pair('С5', 'К5', (x) => aucOf(x, w), 1); if (!r.ok) ok2 = false; console.log(`   ${w}: ${r.s} -> ${r.ok ? 'да' : 'нет'}`); }
console.log(`   мера 2: ${ok2 ? 'ДА' : 'нет'}`);
let ok3 = true; console.log('3. не хуже нейрона-4 (С5 против М4):');
for (const w of [...EV, ...ST]) { const r = pair('С5', 'М4', (x) => aucOf(x, w), 1); if (r.bad) ok3 = false; console.log(`   ${w}: ${r.s}${r.bad ? ' -- ХУЖЕ' : r.ok ? ' -- лучше' : ''}`); }
console.log(`   мера 3: ${ok3 ? 'ДА' : 'нет'}`);
const s1 = C['С5'].get(1).sec; console.log(`4. дешевле: мир 1 -- ${f(s1, 1)} с против 208 с у нейрона-4 (в ${f(208 / s1, 0)} раз) -> ${208 / s1 >= 5 ? 'ДА' : 'нет'}`);
console.log(`\nдоп.: тело на рефлексах -- польза ${f(med(S.map((r) => r.comfort)))}, еда+вода ${f(med(S.map((r) => r.eat)), 1)}, укусов ${f(med(S.map((r) => r.bites)), 1)}, смертей ${f(med(S.map((r) => r.deaths)), 2)}, у стены ${f(100 * med(S.map((r) => r.wall)), 0)}% кругов`);
console.log(`   следов рождено ${f(med(S.map((r) => r.traces.born)), 0)}, пало ${f(med(S.map((r) => r.traces.dead)), 0)}, живы ${f(med(S.map((r) => r.traces.live.length)), 0)} (медианы); частей коры ${f(med(S.map((r) => r.cortex.parts)), 0)}; работа ${f(med(S.map((r) => r.opsPerRound)), 0)} операций за круг; время мира ${f(med(S.map((r) => r.sec)), 1)} с`);
const cnt = new Map(); for (const r of S) for (const w of r.words) for (const x of w.reads) { const k = `${w.name} <- ${x}`; cnt.set(k, (cnt.get(k) || 0) + 1); }
console.log('   что читают части нервов-слов (в скольких мирах из 24):'); for (const [k, n] of [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 24)) console.log(`     ${n}× ${k}`);

// чтение ступени 5б (ПЛАН.md §3): часть А -- свои нужды; часть Б -- просьба снова
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f)) return null; return new Map(fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r])); };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'С': L('../s4/s4_S.jsonl'), 'Св': L('s5b_S.jsonl'), 'П0в': L('s5b_P0.jsonl'), 'Пв': L('s5b_P.jsonl'), 'Пкв': L('s5b_K.jsonl'), 'П(5)': L('../s5/s5_P.jsonl') };
const V = (k) => [...C[k].values()], sw = (r, w) => r.speech.words.find((q) => q.name === w);
const prec = (r, w) => { const x = sw(r, w); return x.prec !== null ? x.prec : NaN; }, lift = (r, w) => prec(r, w) / sw(r, w).base;
const self = (r, w) => { const q = sw(r, w); return q.said - q.after > 0 ? ((q.ok - q.afterOk) / (q.said - q.after)) / q.base : NaN; };
const named = (r, w) => { const x = sw(r, w); return x.named !== null ? x.named : NaN; }, helps = (r) => (r.speech.helps ? r.speech.helps[0] + r.speech.helps[1] : 0);
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const k of Object.keys(C)) { const v = V(k), g = (fn, d) => f(med(v.map(fn)), d);
  console.log(`${k.padEnd(4)}: польза ${g((r) => r.comfort, 3)}; еда+вода ${g((r) => r.eat, 1)}; помощь ${g(helps)}; говорит ${g((r) => 100 * r.speech.talk, 0)}%; названо еды ${g((r) => named(r, 'еда'))}, питья ${g((r) => named(r, 'вода'))}; ` +
    ['голодно', 'жажда'].map((w) => `«${w}» т ${g((r) => prec(r, w))} / б ${g((r) => sw(r, w).base, 3)}, подъём ${g((r) => lift(r, w), 1)}, сам ×${g((r) => self(r, w), 1)}`).join('; ')); }
console.log('\nЧАСТЬ А');
let a1 = true; for (const w of ['голодно', 'жажда']) { const ls = V('Св').map((r) => self(r, w)), k = ls.filter((x) => x >= 2).length, r = pair('Св', 'С', (x) => self(x, w), 1); if (k < 20 || !r.ok) a1 = false;
  console.log(`А1 ${w}: подъём «сам» у Св медиана ${f(med(ls), 1)}, не меньше 2 в ${k} из ${ls.length}; против С: ${r.s}`); }
console.log(`А1. знает свои нужды: ${a1 ? 'ДА' : 'нет'}`);
let a2 = true; for (const w of ['еда', 'вода']) { const r = pair('Св', 'С', (x) => named(x, w), 1); if (r.bad) a2 = false; console.log(`А2 ${w}: ${r.s}`); } console.log(`А2. события не забыты: ${a2 ? 'ДА' : 'нет'}`);
const a3 = pair('Св', 'С', (x) => x.comfort, 1); console.log(`А3. жить не мешает (польза Св против С): ${a3.s} -> ${a3.bad ? 'нет' : 'ДА'}`);
console.log('\nЧАСТЬ Б');
const b1 = pair('Пв', 'Св', (x) => x.comfort, 1); console.log(`Б1. просьба кормит (польза Пв > Св): ${b1.s} -> ${b1.ok ? 'ДА' : 'нет'}`);
const b2 = pair('Пв', 'П0в', helps, 1); console.log(`Б2. тело учит речь (просьб Пв > П0в): ${b2.s} -> ${b2.ok ? 'ДА' : 'нет'}`);
const b3 = pair('Пв', 'Пкв', (x) => x.comfort, 1); console.log(`Б3. просьба, а не подарок (польза Пв > Пкв): ${b3.s} -> ${b3.ok ? 'ДА' : 'нет'}`);
let b4 = true; for (const w of ['голодно', 'жажда']) { const ls = V('Пв').map((r) => lift(r, w)), k = ls.filter((x) => x >= 2).length; if (k < 20) b4 = false; console.log(`Б4 ${w}: подъём у Пв медиана ${f(med(ls), 1)}, не меньше 2 в ${k} из ${ls.length}`); }
console.log(`Б4. не врёт: ${b4 ? 'ДА' : 'нет'}`);
let b5 = true; for (const w of ['еда', 'вода']) { const r = pair('Пв', 'Св', (x) => named(x, w), 1); if (r.bad) b5 = false; console.log(`Б5 ${w}: ${r.s}`); } console.log(`Б5. события не забыты: ${b5 ? 'ДА' : 'нет'}`);
console.log('\nдоп.:');
for (const [a, b] of [['П0в', 'Св'], ['П0в', 'Пкв'], ['Пв', 'П0в'], ['П0в', 'П(5)']]) console.log(`   польза ${a} против ${b}: ${pair(a, b, (x) => x.comfort, 1).s}`);
for (const [a, b] of [['П0в', 'Св']]) console.log(`   еда+вода ${a} против ${b}: ${pair(a, b, (x) => x.eat, 1).s}`);
for (const w of ['голодно', 'жажда']) { const ls = V('П0в').map((r) => lift(r, w)); console.log(`   П0в «${w}»: подъём медиана ${f(med(ls), 1)}, не меньше 2 в ${ls.filter((x) => x >= 2).length} из 24`); }
const spam = (k) => V(k).filter((r) => sw(r, 'голодно').said > 3000 || sw(r, 'жажда').said > 3000).map((r) => r.seed); console.log(`   твердит просьбу (> 3000 раз за полжизни): Пв -- ${spam('Пв').join(', ') || 'нет'}; П0в -- ${spam('П0в').join(', ') || 'нет'}`);
console.log(`   время мира: С ${f(med(V('С').map((r) => r.sec)), 1)} с, Св ${f(med(V('Св').map((r) => r.sec)), 1)} с`);

// чтение ступени 5 (ПЛАН.md §4): просьба кормит, тело учит речь, просьба а не подарок, не врёт, события не забыты
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f)) return null; return new Map(fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r])); };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'С': L('../s4/s4_S.jsonl'), 'П0': L('s5_P0.jsonl'), 'П': L('s5_P.jsonl'), 'Пк': L('s5_K.jsonl') };
const ALL = ['еда', 'вода', 'удар', 'укус', 'голодно', 'жажда', 'опасно'], V = (k) => [...C[k].values()];
const sw = (r, w) => r.speech.words.find((q) => q.name === w);
const prec = (r, w) => { const x = sw(r, w); return x.prec !== null ? x.prec : NaN; }, base = (r, w) => sw(r, w).base, lift = (r, w) => prec(r, w) / base(r, w);
const named = (r, w) => { const x = sw(r, w); return x.named !== null ? x.named : NaN; };
const helps = (r) => (r.speech.helps ? r.speech.helps[0] + r.speech.helps[1] : 0);
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: 'нет данных' };
  const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const k of Object.keys(C)) { const v = V(k), g = (fn, d) => f(med(v.map(fn)), d);
  console.log(`${k.padEnd(2)}: польза ${g((r) => r.comfort, 3)}; еда+вода ${g((r) => r.eat, 1)}; помощь на 1000 (еда+вода) ${g(helps, 2)}; говорит ${g((r) => 100 * r.speech.talk, 0)}%; названо еды ${g((r) => named(r, 'еда'))}, питья ${g((r) => named(r, 'вода'))}`); }
console.log('\nточность / база (медианы):'); for (const w of ALL) console.log(`   ${w.padEnd(8)} ` + Object.keys(C).map((k) => `${k} ${f(med(V(k).map((r) => prec(r, w))))}/${f(med(V(k).map((r) => base(r, w))), 3)}`).join('   '));
const m1 = pair('П', 'С', (x) => x.comfort, 1); console.log(`\n1. просьба кормит (польза П > С) -- ${m1.s} -> ${m1.ok ? 'ДА' : 'нет'}`);
const m2 = pair('П', 'П0', helps, 1); console.log(`2. тело учит речь (исполненных просьб П > П0) -- ${m2.s} -> ${m2.ok ? 'ДА' : 'нет'}`);
const m3 = pair('П', 'Пк', (x) => x.comfort, 1); console.log(`3. просьба, а не подарок (польза П > Пк) -- ${m3.s} -> ${m3.ok ? 'ДА' : 'нет'}`);
let ok4 = true; console.log('4. не врёт (подъём П >= 2 хотя бы в 20 мирах из 24):');
for (const w of ['голодно', 'жажда']) { const ls = V('П').map((r) => lift(r, w)), k = ls.filter((x) => x >= 2).length; if (k < 20) ok4 = false; console.log(`   ${w}: подъём медиана ${f(med(ls))}, не меньше 2 в ${k} из ${ls.length}`); }
console.log(`   мера 4: ${ok4 ? 'ДА' : 'нет'}`);
let ok5 = true; console.log('5. события не забыты (названо у П против С):');
for (const w of ['еда', 'вода']) { const r = pair('П', 'С', (x) => named(x, w), 1); if (r.bad) ok5 = false; console.log(`   ${w}: ${r.s}${r.bad ? ' -- ХУЖЕ' : ''}`); }
console.log(`   мера 5: ${ok5 ? 'ДА' : 'нет'}`);
console.log('\nдоп.:');
for (const [a, b] of [['П', 'П0'], ['П0', 'С'], ['Пк', 'С'], ['П0', 'Пк']]) console.log(`   польза ${a} против ${b}: ${pair(a, b, (x) => x.comfort, 1).s}`);
console.log(`   еда+вода П против С: ${pair('П', 'С', (x) => x.eat, 1).s}`);
for (const w of ['голодно', 'жажда']) { console.log(`   сказано «${w}» за полжизни (медиана): ` + Object.keys(C).map((k) => `${k} ${med(V(k).map((r) => sw(r, w).said))}`).join(', ') + `; доля сказанного вслед за родителем у П ${f(med(V('П').map((r) => sw(r, w).after / Math.max(1, sw(r, w).said))))}`); }
for (const w of ['голодно', 'жажда']) { const tw = V('П').map((r) => r.broca.price[w]); console.log(`   цена «${w}» у П: улыбка ${f(med(tw.map((p) => p.a)), 3)} + ${f(med(tw.map((p) => p.b)), 3)}·довод, тело ${f(med(tw.map((p) => p.ta)), 3)} + ${f(med(tw.map((p) => p.tb)), 3)}·довод`); }
console.log(`   средний квадрат урока по телу у П (медиана): ${f(med(V('П').map((r) => r.broca.vb)), 1)}`);
const spam = V('П').filter((r) => sw(r, 'голодно').said > 3000 || sw(r, 'жажда').said > 3000).map((r) => r.seed); console.log(`   миры, где П твердит просьбу (> 3000 раз за полжизни): ${spam.join(', ') || 'нет'}`);

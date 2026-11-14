// чтение ступени 8 (ПЛАН.md §5): новые действия -- моторная кора
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => new Map(fs.readFileSync(path.join(__dirname, n), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r]));
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Б': L('s8_B.jsonl'), 'М': L('s8_M.jsonl'), 'М0': L('s8_M0.jsonl'), 'О': L('s8_O.jsonl'), 'ОМ': L('s8_OM.jsonl') }, V = (k) => [...C[k].values()];
const auc = (r, w) => r.words.find((q) => q.name === w).auc, named = (r) => r.speech.words[0].named;
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const k of Object.keys(C)) { const v = V(k), g = (fn, d) => f(med(v.map(fn)), d);
  console.log(`${k.padEnd(2)}: еда+вода ${g((r) => r.eat)}; польза ${g((r) => r.comfort, 3)}; смертей ${g((r) => r.deaths)}; у стены ${g((r) => r.wall, 3)}; AUC еда ${g((r) => auc(r, 'еда'))}, вода ${g((r) => auc(r, 'вода'))}; названо еды ${g(named)}`); }
const m1 = pair('М', 'Б', (x) => x.eat, 1); console.log(`\n1. выучил новое действие (еда+вода М > Б): ${m1.s} -> ${m1.ok ? 'ДА' : 'нет'}`);
const m2 = pair('М', 'М0', (x) => x.eat, 1); console.log(`2. учёба, а не шум проб (М > М0): ${m2.s} -> ${m2.ok ? 'ДА' : 'нет'}`);
const m3 = pair('ОМ', 'О', (x) => x.comfort, 1); console.log(`3. не мешает без преграды (польза ОМ против О): ${m3.s} -> ${m3.bad ? 'нет' : 'ДА'}`);
let ok4 = true; for (const [nm, fn] of [['AUC еда', (x) => auc(x, 'еда')], ['AUC вода', (x) => auc(x, 'вода')], ['названо еды', named]]) { const r = pair('М', 'Б', fn, 1); if (r.bad) ok4 = false; console.log(`4. ${nm} (М против Б): ${r.s}${r.bad ? ' -- ХУЖЕ' : ''}`); }
console.log(`   мера 4: ${ok4 ? 'ДА' : 'нет'}`);
const M = V('М'); console.log(`\nдоп.: веса касаний одного знака (идёт вдоль стены) у ${M.filter((r) => r.motor.touch[0] * r.motor.touch[1] > 0).length} из 24; оба нуля у ${M.filter((r) => !r.motor.touch[0] && !r.motor.touch[1]).length}`);
const cnt = {}; for (const r of M) for (const [k, w] of r.motor.top.slice(0, 3)) if (w) cnt[k] = (cnt[k] || 0) + 1; console.log('   чаще всего в тройке сильнейших весов: ' + Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ${n}`).join(', '));
console.log(`   пробы стоят (М0 против Б): ${pair('М0', 'Б', (x) => x.eat, 1).s}; польза М против Б: ${pair('М', 'Б', (x) => x.comfort, 1).s}`);

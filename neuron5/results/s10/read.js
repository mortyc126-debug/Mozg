// чтение ступени 10 (ПЛАН.md §3): цель -- лобная кора
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => new Map(fs.readFileSync(path.join(__dirname, n), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r]));
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'Н': L('../s9/s9_N.jsonl'), 'Ц': L('s10_C.jsonl'), 'Ц0': L('s10_C0.jsonl'), 'ОН': L('../s9/s9_ON.jsonl'), 'ОЦ': L('s10_OC.jsonl') }, V = (k) => [...C[k].values()];
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const k of Object.keys(C)) { const v = V(k), g = (fn, d) => f(med(v.map(fn)), d);
  console.log(`${k.padEnd(2)}: еда+вода ${g((r) => r.eat)}; польза ${g((r) => r.comfort, 3)}; смертей ${g((r) => r.deaths)}; у стены ${g((r) => r.wall, 3)}` + (v[0].pfc ? `; порог ${g((r) => r.pfc.m, 3)}; смен цели ${g((r) => r.pfc.switches, 0)}` : '')); }
const m1 = pair('Ц', 'Н', (x) => x.eat, 1); console.log(`\n1. цель помогает (еда+вода Ц > Н): ${m1.s} -> ${m1.ok ? 'ДА' : 'нет'}`);
const m2 = pair('Ц', 'Ц0', (x) => x.eat, 1); console.log(`2. нужно удержание (Ц > Ц0): ${m2.s} -> ${m2.ok ? 'ДА' : 'нет'}`);
const k3 = V('Ц').filter((r) => r.pfc.m > 0.05).length; console.log(`3. научился держать цель (порог > 0.05): в ${k3} из 24 -> ${k3 >= 20 ? 'ДА' : 'нет'}`);
const m4 = pair('ОЦ', 'ОН', (x) => x.comfort, 1); console.log(`4. не мешает без преграды (польза ОЦ против ОН): ${m4.s} -> ${m4.bad ? 'нет' : 'ДА'}`);
console.log(`\nдоп.: польза Ц против Н: ${pair('Ц', 'Н', (x) => x.comfort, 1).s}; смертей Ц против Н: ${pair('Ц', 'Н', (x) => x.deaths, -1).s}; Ц0 против Н (еда): ${pair('Ц0', 'Н', (x) => x.eat, 1).s}; еда ОЦ против ОН: ${pair('ОЦ', 'ОН', (x) => x.eat, 1).s}`);

// чтение ступени 11, часть Б (ПЛАН_Б.md §3): мозг учится запасать сам
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => new Map(fs.readFileSync(path.join(__dirname, n), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r]));
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'А': L('s11_A.jsonl'), 'Р': L('s11_R.jsonl'), 'Б': L('s11_B.jsonl'), 'Б0': L('s11_B0.jsonl') }, V = (k) => [...C[k].values()];
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
const share = (r) => r.seas.deliverShare ?? 0;
for (const k of Object.keys(C)) { const v = V(k), g = (fn, d) => f(med(v.map(fn)), d);
  console.log(`${k.padEnd(2)}: польза ${g((r) => r.comfort, 3)}; смертей зимой ${g((r) => r.seas.winterDeaths)}; доля донесённой ${g(share)}; запас ${g((r) => r.seas.store, 1)}` + (v[0].car ? `; вес «к норе» ${g((r) => r.car.al)}; γ ноши ${g((r) => r.car.gCarry)}; γ голода ${g((r) => r.car.gHunger)}` : '')); }
const m1 = pair('Б', 'А', share, 1); console.log(`\n1. научился запасать (доля донесённой Б > А): ${m1.s} -> ${m1.ok ? 'ДА' : 'нет'}`);
const m2a = pair('Б', 'А', (x) => x.seas.winterDeaths, -1), m2b = pair('Б', 'А', (x) => x.comfort, 1); console.log(`2. зима не убивает: смертей зимой ${m2a.s}; польза ${m2b.s} -> ${m2a.ok && m2b.ok ? 'ДА' : 'нет'}`);
const m3 = pair('Б', 'Б0', (x) => x.comfort, 1); console.log(`3. нужна обстановка (польза Б > Б0): ${m3.s} -> ${m3.ok ? 'ДА' : 'нет'}`);
const k4 = V('Б').filter((r) => r.car.gCarry > 0.5).length; console.log(`4. понял, когда идти в нору (γ ноши > 0.5): в ${k4} из 24 -> ${k4 >= 20 ? 'ДА' : 'нет'}`);
console.log(`\nдоп.: Б против Р (польза): ${pair('Б', 'Р', (x) => x.comfort, 1).s}; Б0 против А (доля донесённой): ${pair('Б0', 'А', share, 1).s}`);

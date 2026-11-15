// чтение ступени 11, часть А (ПЛАН.md §2): мир запасов годится?
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => new Map(fs.readFileSync(path.join(__dirname, n), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r]));
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'А': L('s11_A.jsonl'), 'Р': L('s11_R.jsonl') }, V = (k) => [...C[k].values()];
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const k of Object.keys(C)) { const v = V(k), g = (fn, d) => f(med(v.map(fn)), d);
  console.log(`${k}: польза ${g((r) => r.comfort, 3)}; еда+вода ${g((r) => r.eat, 1)}; смертей ${g((r) => r.deaths)}, из них зимой ${g((r) => r.seas.winterDeaths)}; взял ношу ${g((r) => r.seas.picked)}, донёс ${g((r) => r.seas.delivered)}, испортилось ${g((r) => r.seas.spoiled)} (на 1000); доля донесённой ${g((r) => r.seas.deliverShare ?? NaN)}; запас в среднем ${g((r) => r.seas.store, 1)}; ел из запаса ${g((r) => r.seas.fromStore)}`); }
const a1 = pair('А', 'Р', (x) => x.seas.winterDeaths, 1); console.log(`\nА1. зима убивает (смертей зимой А > Р): ${a1.s} -> ${a1.ok ? 'ДА' : 'нет'}`);
const a2 = pair('Р', 'А', (x) => x.comfort, 1); console.log(`А2. запас спасает (польза Р > А): ${a2.s} -> ${a2.ok ? 'ДА' : 'нет'}`);
const ds = (k) => med(V(k).map((r) => r.seas.deliverShare ?? 0)); console.log(`А3. нести надо до конца: доля донесённой у Р ${f(ds('Р'))} (нужно >= 0.5), у А ${f(ds('А'))} (нужно < 0.1) -> ${ds('Р') >= 0.5 && ds('А') < 0.1 ? 'ДА' : 'нет'}`);

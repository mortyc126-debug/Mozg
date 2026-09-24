// Чтение ТЕЛО-2 (PRE_BODY2.md §6)
const R = require('fs').readFileSync('out/body2.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
function wil1(d) { d = d.filter((x) => Number.isFinite(x) && x !== 0); const n = d.length; if (!n) return 1; const o = d.map((x, i) => [Math.abs(x), i]).sort((x, y) => x[0] - y[0]), rk = new Array(n);
  for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) rk[o[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  const W = d.reduce((s, x, i) => s + (x > 0 ? rk[i] : 0), 0); let ge = 0; for (let q = 0; q < 1 << n; q++) { let s = 0; for (let i = 0; i < n; i++) if (q >> i & 1) s += rk[i]; if (s >= W - 1e-9) ge++; } return ge / (1 << n); }
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
for (const G of ['6', '9']) {
  const col = (c, i) => new Map(R.filter((r) => r[0] === c && r[2] === G).map((r) => [r[1], +r[i]]));
  const cmp = (a, b, i, sgn = 1) => { const A = col(a, i), B = col(b, i), s = [...A.keys()].filter((k) => B.has(k)); const d = s.map((k) => sgn * (A.get(k) - B.get(k))); const p = wil1(d); return `${a} ${sgn > 0 ? '>' : '<'} ${b}: p = ${p.toExponential(2)} (n=${s.length}) -> ${p < 0.01 && med(d) > 0 ? 'ДА' : 'нет'}`; };
  const row = (i, d = 3) => ['К', 'Т', 'Б', 'М0', 'СП'].map((c) => `${c} ${f(med([...col(c, i).values()]), d)}`).join(' | ');
  console.log(`\n========== ЛАБИРИНТ ${G} x ${G} (прогонов ${R.filter((r) => r[2] === G).length}) ==========`);
  console.log(`1. исследование (доля клеток, конец фазы А): ${row(3)}\n   ${cmp('К', 'Б', 3)}; ${cmp('К', 'М0', 3)}; ${cmp('К', 'Т', 3)}`);
  console.log(`2. опытов пройдено в фазе Б (из скольких): ${row(4, 1)}  / ${row(5, 1)}\n   ${cmp('К', 'Б', 4)}`);
  console.log(`   быстрота, медиана время/кратчайшее: ${row(6, 2)}`);
  console.log(`3. скрытое научение, первые 3 опыта (кругов): ${row(7, 0)}\n   ${cmp('К', 'Б', 7, -1)}; ${cmp('К', 'М0', 7, -1)}`);
  const Ft = col('К', 8), Lt = col('К', 9), ks = [...Ft.keys()];
  console.log(`4. маршрут (К): первая треть ${f(med([...Ft.values()]), 0)}, последняя ${f(med([...Lt.values()]), 0)}; последняя < первой: p = ${wil1(ks.map((k) => Ft.get(k) - Lt.get(k))).toExponential(2)}`);
  const rc = [...col('К', 13).values()];
  console.log(`5. новый лабиринт, отношение времени В/Б: ${row(13)}; у К больше 1.5 в ${rc.filter((x) => x > 1.5).length} сидах из ${rc.length} -> ${rc.filter((x) => x > 1.5).length >= 9 ? 'выучен МАРШРУТ' : 'маршрут не выучен'}`);
  console.log(`   опытов в фазе В: ${row(10, 1)}; быстрота В: ${row(12, 2)}`);
  console.log(`6. ошибка частей пола в конце фазы А (доля дисперсии): ${row(14)}`);
  console.log(`   моторных частей (ср./мин): ${row(15, 2)} / ${row(16, 0)}; доход мотора в фазе А: ${row(17)}`);
  console.log(`   проверка меры: правая рука прошла опытов ${f(med([...col('СП', 4).values()]), 0)}, быстрота ${f(med([...col('СП', 6).values()]), 2)} -> ${med([...col('СП', 4).values()]) > 0 ? 'меры читаются' : 'МЕРЫ НЕ ЧИТАЮТСЯ'}`);
}

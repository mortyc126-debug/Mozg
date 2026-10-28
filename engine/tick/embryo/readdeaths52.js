// точный знаковый ранговый критерий Уилкоксона, односторонний: верно ли, что a > b
function wilcoxon(a, b) {
  const d = [...a.keys()].filter((k) => b.has(k)).map((k) => a.get(k) - b.get(k)).filter((x) => Number.isFinite(x) && x !== 0);
  const n = d.length, o = d.map((x, i) => [Math.abs(x), i]).sort((x, y) => x[0] - y[0]), rk = new Array(n);
  for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) rk[o[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  const W = d.reduce((s, x, i) => s + (x > 0 ? rk[i] : 0), 0);
  let ge = 0; for (let m = 0; m < 1 << n; m++) { let s = 0; for (let i = 0; i < n; i++) if (m >> i & 1) s += rk[i]; if (s >= W - 1e-9) ge++; }
  return { W, n, p: ge / (1 << n) };
}
const fs = require('fs');
const R = fs.readFileSync('out/deaths52.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const get = (c, i) => new Map(R.filter((r) => r[0] === c).map((r) => [+r[1], +r[i]]));
const M = (c, i) => med([...get(c, i).values()]);
console.log('условие | R смеси | R канал S | R выживших: смеси / S | доля новичков | выжило частей');
for (const c of ['Д1', 'Д2']) console.log(`${c.padEnd(7)} | ${f(M(c, 2)).padStart(7)} | ${f(M(c, 3)).padStart(9)} | ${f(M(c, 4))} / ${f(M(c, 5))} | ${f(M(c, 6)).padStart(13)} | ${f(M(c, 7)).padStart(13)}`);
for (const c of ['Д1', 'Д2']) console.log(`   ${c} R смеси по сидам: ${[...get(c, 2).entries()].sort((a, b) => a[0] - b[0]).map((e) => f(e[1], 2)).join(' ')}`);
console.log(`   Д1 R выживших смеси по сидам: ${[...get('Д1', 4).entries()].sort((a, b) => a[0] - b[0]).map((e) => f(e[1], 2)).join(' ')}`);
const t = wilcoxon(get('Д2', 2), get('Д1', 2));
console.log(`1. главная причина -- гибель частей: R смесей Д2 ${f(M('Д2', 2))} (порог 0.9), выше Д1: W = ${t.W}, n = ${t.n}, p = ${t.p.toExponential(2)} -> ${M('Д2', 2) >= 0.9 && t.p < 0.01 ? 'ДА' : 'нет'}`);
console.log(`2. выжившие держат знание: R выживших смеси в Д1 ${f(M('Д1', 4))} (порог 0.9) -> ${M('Д1', 4) >= 0.9 ? 'ДА' : 'нет'}`);

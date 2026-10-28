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
const R = fs.readFileSync('out/gate60.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const get = (c, i) => new Map(R.filter((r) => r[0] === c).map((r) => [+r[1], +r[i]]));
const Md = (c, i) => med([...get(c, i).values()]);
const name = { 'Г0': 'как есть', 'Г1': 'защита канала Q', 'Г2': 'линия задержки', 'Г3': 'защита и линия' };
console.log('условие               | доля верного знака | частей в Q | живых');
for (const c of ['Г0', 'Г1', 'Г2', 'Г3']) console.log(`${(c + ' ' + name[c]).padEnd(21)} | ${f(Md(c, 2)).padStart(18)} | ${String(Md(c, 7)).padStart(10)} | ${Md(c, 6)}\n   по сидам: ${[...get(c, 2).entries()].sort((a, b) => a[0] - b[0]).map((e) => f(e[1], 2)).join(' ')}`);
const t = (c) => wilcoxon(get(c, 2), get('Г0', 2));
const ok = (c) => Md(c, 2) >= 0.75 && t(c).p < 0.01;
for (const c of ['Г1', 'Г2', 'Г3']) console.log(`${c} выше Г0: p = ${t(c).p.toExponential(2)}, медиана ${f(Md(c, 2))} -> ${ok(c) ? 'не ниже 0.75 и выше Г0' : 'нет'}`);
const econ = ok('Г1'), mem = (ok('Г2') || ok('Г3')) && Md('Г1', 2) < 0.75, learn = Md('Г3', 2) >= 0.75;
console.log(`\nнехватка -- экономика: ${econ ? 'ДА' : 'нет'}\nнехватка -- глубина памяти: ${mem ? 'ДА' : 'нет'}\nLMS учится порядку, если память дана (Г3 >= 0.75): ${learn ? 'ДА' : 'нет'}`);

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
const R = fs.readFileSync('out/wake55.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const get = (c, i) => new Map(R.filter((r) => r[0] === c).map((r) => [+r[1], +r[i]]));
const Md = (c, i) => med([...get(c, i).values()]);
for (const [F, b] of [[300, 2], [1000, 9]]) {
  console.log(`\nF = ${F}${F === 1000 ? ' (главная длина)' : ' (для отчёта)'}`);
  console.log('условие | R смеси | R канал S | гибель связей при пробуждении | отсчёт (45 обычных кругов) | из них отмерло | в первые 5 кругов | верные смесей');
  for (const c of ['П1', 'П2']) console.log(`${c.padEnd(7)} | ${f(Md(c, b)).padStart(7)} | ${f(Md(c, b + 1)).padStart(9)} | ${f(Md(c, b + 2)).padStart(29)} | ${f(Md(c, b + 3)).padStart(26)} | ${f(Md(c, b + 4)).padStart(14)} | ${f(Md(c, b + 5)).padStart(17)} | ${f(Md(c, b + 6)).padStart(13)}`);
  for (const c of ['П1', 'П2']) console.log(`   ${c} R смеси по сидам: ${[...get(c, b).entries()].sort((x, y) => x[0] - y[0]).map((e) => f(e[1], 2)).join(' ')}`);
  const wk = Md('П1', b + 2), bs = Md('П1', b + 3), pr = Md('П1', b + 4);
  console.log(`1. пробуждение убивает связи (П1): гибель ${f(wk)} против отсчёта ${f(bs)} (в ${f(wk / bs, 1)} раза, порог 3), отмерло ${f(pr)} (порог 0.5) -> ${wk >= 3 * bs && pr >= 0.5 ? 'ДА' : 'нет'}`);
  const t = wilcoxon(get('П2', b), get('П1', b)), m2 = Md('П2', b);
  console.log(`2. это главная причина потери: R смеси П2 ${f(m2)} (порог 0.9), выше П1: W = ${t.W}, n = ${t.n}, p = ${t.p.toExponential(2)} -> ${m2 >= 0.9 && t.p < 0.01 ? 'ДА' : 'нет'}`);
}

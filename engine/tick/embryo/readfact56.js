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
const R = fs.readFileSync('out/fact56.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const get = (c, i) => new Map(R.filter((r) => r[0] === c).map((r) => [+r[1], +r[i]]));
const Md = (c, i) => med([...get(c, i).values()]);
const C = ['00', 'Z0', '0G', 'ZG'];
for (const [F, b] of [[300, 2], [1000, 9]]) {
  console.log(`\nF = ${F}${F === 1000 ? ' (главная длина)' : ' (для отчёта)'}`);
  console.log('условие | R смеси | R канал S | гибель связей при пробуждении | отсчёт | верные смесей');
  for (const c of C) console.log(`${c.padEnd(7)} | ${f(Md(c, b)).padStart(7)} | ${f(Md(c, b + 1)).padStart(9)} | ${f(Md(c, b + 2)).padStart(29)} | ${f(Md(c, b + 3)).padStart(6)} | ${f(Md(c, b + 6)).padStart(13)}`);
  for (const c of C) console.log(`   ${c} R смеси по сидам: ${[...get(c, b).entries()].sort((x, y) => x[0] - y[0]).map((e) => f(e[1], 2)).join(' ')}`);
  const t1 = wilcoxon(get('ZG', b), get('00', b)), tz = wilcoxon(get('ZG', b), get('Z0', b)), tg = wilcoxon(get('ZG', b), get('0G', b)), m = Md('ZG', b);
  console.log(`1. вместе чинят: R смеси ZG ${f(m)} (порог 0.9), выше 00: p = ${t1.p.toExponential(2)} -> ${m >= 0.9 && t1.p < 0.01 ? 'ДА' : 'нет'}`);
  console.log(`2. нужны обе: ZG выше Z0 p = ${tz.p.toExponential(2)}, выше 0G p = ${tg.p.toExponential(2)} (каждое < 0.005) -> ${tz.p < 0.005 && tg.p < 0.005 ? 'ДА' : 'нет'}`);
}

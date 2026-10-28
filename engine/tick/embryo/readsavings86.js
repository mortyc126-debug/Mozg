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
const R = fs.readFileSync(process.argv[2] || 'out/savings58.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const E = (lab, seed, T) => { const r = R.find((x) => x[0] === lab && +x[1] === seed && +x[4] === T); return r ? +r[5] : NaN; };
const seeds = [...new Set(R.map((r) => +r[1]))].sort();
// сбережение: [E_b(+) - E_a(+)] + [E_a(-) - E_b(-)], относительное -- к половине суммы четырёх
function sav(a, b) {
  const m = new Map(), rel = new Map();
  for (const s of seeds) {
    const ap = E(a, s, 0), am = E(a, s, 1), bp = E(b, s, 0), bm = E(b, s, 1);
    const S = (bp - ap) + (am - bm); m.set(s, S); rel.set(s, S / ((ap + am + bp + bm) / 2));
  }
  return { m, rel };
}
const show = (name, x) => console.log(`${name}: медиана относительного сбережения ${f(med([...x.rel.values()]))}; по сидам ${[...x.rel.entries()].map((e) => f(e[1], 2)).join(' ')}`);
console.log('ошибка канала 3 в первые 300 кругов проверки (доля V), медианы:');
for (const [lab, name] of [['A', 'прошлое +, промежуток 2000'], ['B', 'прошлое −, промежуток 2000'], ['A0', 'прошлое +, без промежутка'], ['B0', 'прошлое −, без промежутка'], ['Bn', 'прошлое + (другой шум), промежуток 2000']])
  console.log(`  ${name.padEnd(40)} проверка +: ${f(med(seeds.map((s) => E(lab, s, 0))))}, проверка −: ${f(med(seeds.map((s) => E(lab, s, 1))))}`);
const pos = sav('A0', 'B0'), nul = sav('A', 'Bn'), main = sav('A', 'B');
console.log(''); show('положительный отсчёт (без промежутка)', pos); show('нуль (одно правило, разный шум)', nul); show('ОСНОВНОЙ (промежуток 2000)', main);
const zero = new Map(seeds.map((s) => [s, 0])), t = wilcoxon(main.m, zero);
const okPos = med([...pos.rel.values()]) >= 0.3, okNul = Math.abs(med([...nul.rel.values()])) < 0.05;
console.log(`\nпроверка меры: положительный отсчёт ${okPos ? 'выполнен' : 'НЕ выполнен'} (порог 0.3), нуль ${okNul ? 'выполнен' : 'НЕ выполнен'} (|медиана| < 0.05)`);
const mm = med([...main.rel.values()]);
console.log(`СТРОКА 5: сбережение ${f(mm)} (порог 0.10), больше нуля: W = ${t.W}, n = ${t.n}, p = ${t.p.toExponential(2)} -> ${!(okPos && okNul) ? 'мера сломана, не читается' : mm >= 0.1 && t.p < 0.01 ? 'ЕСТЬ' : 'НЕТ'}`);

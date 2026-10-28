const fs = require('fs');
const R = fs.readFileSync('out/hstat63.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t').map(Number)).sort((a, b) => a[0] - b[0]);
const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const f = (x) => x.toFixed(3);
const K = { 10: 0.534, 30: 0.238 };
// колонки: сид; T=10: половина1 (ткань, нуль, оптимум), половина2 (...); T=30: то же
const half = (r, T, h) => { const b = 1 + (T === 10 ? 0 : 6) + 3 * h; return { net: r[b], nul: r[b + 1], kal: r[b + 2] }; };
const both = (r, T) => { const a = half(r, T, 0), b = half(r, T, 1); return { net: a.net + b.net, nul: a.nul + b.nul, kal: a.kal + b.kal }; };
const Hold = (x) => (x.nul - x.net) / (x.nul - x.kal);
const HA = (xs) => xs.reduce((s, x) => s + x.nul - x.net, 0) / xs.reduce((s, x) => s + x.nul - x.kal, 0);
const HB = (x, T) => (1 - x.net / x.nul) / K[T];
let rs = 12345; const rnd = () => { rs = (rs * 1103515245 + 12345) >>> 0; return rs / 4294967296; };
const res = {};
for (const T of [10, 30]) {
  const all = R.map((r) => both(r, T)), h1 = R.map((r) => half(r, T, 0)), h2 = R.map((r) => half(r, T, 1));
  const ha = HA(all), boot = [];
  for (let b = 0; b < 2000; b++) { const s = []; for (let i = 0; i < all.length; i++) s.push(all[Math.floor(rnd() * all.length)]); boot.push(HA(s)); }
  const mb = boot.reduce((s, x) => s + x, 0) / boot.length, sdA = Math.sqrt(boot.reduce((s, x) => s + (x - mb) ** 2, 0) / boot.length);
  const splitA = Math.abs(HA(h1) - HA(h2));
  const hb = med(all.map((x) => HB(x, T))), repB = med(R.map((r) => Math.abs(HB(half(r, T, 0), T) - HB(half(r, T, 1), T)))) / Math.SQRT2;
  const hold = med(all.map(Hold));
  res[T] = { ha, sdA, splitA, hb, repB, hold };
  console.log(`T = ${T}: прежняя H (медиана по сидам) ${f(hold)} | А: ${f(ha)}, бутстреп СО ${f(sdA)}, половины ${f(HA(h1))}/${f(HA(h2))} (расхождение ${f(splitA)}) | Б: медиана ${f(hb)}, повторяемость ${f(repB)}`);
  console.log(`   прежняя H по сидам: ${all.map((x) => f(Hold(x))).join(' ')}\n   Б по сидам:         ${all.map((x) => f(HB(x, T))).join(' ')}`);
}
const okA = res[30].sdA <= 0.10 && res[30].splitA <= 0.15, okB = res[30].repB <= 0.15;
const sameA = Math.abs(res[10].ha - res[10].hold) <= 0.1, sameB = Math.abs(res[10].hb - res[10].hold) <= 0.1;
console.log(`\nА: бутстреп ${f(res[30].sdA)} (<= 0.10), половины ${f(res[30].splitA)} (<= 0.15) -> ${okA ? 'проходит' : 'нет'}; при T = 10 совпадает с прежней (${f(res[10].ha)} против ${f(res[10].hold)}) -> ${sameA ? 'да' : 'нет'}`);
console.log(`Б: повторяемость ${f(res[30].repB)} (<= 0.15) -> ${okB ? 'проходит' : 'нет'}; при T = 10 совпадает с прежней (${f(res[10].hb)} против ${f(res[10].hold)}) -> ${sameB ? 'да' : 'нет'}`);
const pick = okA && sameA ? 'А' : okB && sameB ? 'Б' : null;
console.log(`ВЫБОР: ${pick ? 'статистика ' + pick : 'ни одна -- строка 0 остаётся на старой мере с оговоркой'}`);
if (pick) { const v10 = pick === 'А' ? res[10].ha : res[10].hb, v30 = pick === 'А' ? res[30].ha : res[30].hb; console.log(`СТРОКА 0 у действующего зародыша по новой статистике: H(10) ${f(v10)}, H(30) ${f(v30)} (порог 0.5) -> ${v10 >= 0.5 && v30 >= 0.5 ? 'ЕСТЬ' : 'НЕТ'}`); }

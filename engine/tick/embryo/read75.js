// Чтение проверки меры шага 75 (PRE75_STAT3.md §3): статистика А против старой меры в трёх условиях режима 'проверка3'
const fs = require('fs');
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const V = [1.01, 2.01];
const RA = (xs, j) => { let a = 0, b = 0; for (const t of xs) { a += V[j] - t[4 + 2 * j] / t[5 + 2 * j]; b += V[j] - t[2 * j] / t[1 + 2 * j]; } return a / b; };
function A(xs, j) { let rs = 12345; const rnd = () => { rs = (rs * 1103515245 + 12345) >>> 0; return rs / 4294967296; };
  const bt = []; for (let b = 0; b < 2000; b++) { const s = []; for (let i = 0; i < xs.length; i++) s.push(xs[Math.floor(rnd() * xs.length)]); bt.push(RA(s, j)); }
  const mb = bt.reduce((s, x) => s + x, 0) / bt.length; return [RA(xs, j), Math.sqrt(bt.reduce((s, x) => s + (x - mb) ** 2, 0) / bt.length)]; }
const out = {};
for (const c of ['К0', 'КС', 'Ю']) {
  const R = fs.readFileSync(`out/check75_${c}.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t'));
  const t3 = R.map((r) => r[19].split(',').map(Number)), t3L = R.map((r) => r[20].split(',').map(Number));
  const o = { n: R.length, m3: A(t3, 0), s3: A(t3, 1), mL: A(t3L, 0), sL: A(t3L, 1),
    old: [12, 13, 14, 15].map((i) => med(R.map((r) => +r[i]))), span: [13, 15].map((i) => { const v = R.map((r) => +r[i]); return [Math.min(...v), Math.max(...v)]; }) };
  out[c] = o;
  console.log(`${c} (сидов ${o.n}): 3 прямо -- смеси ${f(o.m3[0])} ± ${f(o.m3[1])}, S ${f(o.s3[0])} ± ${f(o.s3[1])} | 3Д -- смеси ${f(o.mL[0])} ± ${f(o.mL[1])}, S ${f(o.sL[0])} ± ${f(o.sL[1])}`);
  console.log(`      старая мера (медианы): 3 прямо ${f(o.old[0])} / ${f(o.old[1])}, 3Д ${f(o.old[2])} / ${f(o.old[3])}; S по сидам: 3 прямо ${f(o.span[0][0], 2)}-${f(o.span[0][1], 2)}, 3Д ${f(o.span[1][0], 2)}-${f(o.span[1][1], 2)}`);
}
const k = out['К0'], w = out['КС'];
const in1 = (x) => Math.abs(x - 1) <= 0.1;
const c1 = [k.m3, k.s3, k.mL, k.sL].every((x) => in1(x[0]) && x[0] >= 0.9);
const c2 = w.s3[0] < 0.9 && w.sL[0] < 0.9;
const c3 = k.s3[1] <= 0.1 && k.sL[1] <= 0.1;
console.log(`\n1. положительный контроль (1 ± 0.1, ЕСТЬ): ${c1 ? 'да' : 'НЕТ'}\n2. отрицательный контроль (S ниже 0.9 в обеих строках): ${c2 ? 'да' : 'НЕТ'}\n3. разброс S в положительном контроле не больше 0.1: ${c3 ? 'да' : 'НЕТ'} (${f(k.s3[1])}, ${f(k.sL[1])})`);
console.log(`-> МЕРА ${c1 && c2 && c3 ? 'ГОДНА' : 'НЕ ГОДНА'}`);

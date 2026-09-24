// Чтение шага 94 (PRE94_CROSS6.md §4): перекрёстная проба -- эффект D и сдвиг места b на сид
const R = require('fs').readFileSync('out/exp94.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const m = (c, i) => new Map(R.filter((r) => r[0] === c).map((r) => [r[1], +r[i]]));
function wil1(d) { d = d.filter((x) => x !== 0); const n = d.length, o = d.map((x, i) => [Math.abs(x), i]).sort((x, y) => x[0] - y[0]), rk = new Array(n);
  for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) rk[o[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  const W = d.reduce((s, x, i) => s + (x > 0 ? rk[i] : 0), 0); let ge = 0; for (let q = 0; q < 1 << n; q++) { let s = 0; for (let i = 0; i < n; i++) if (q >> i & 1) s += rk[i]; if (s >= W - 1e-9) ge++; } return ge / (1 << n); }
function mw2(a, b) { const n = a.length, mm = b.length; let U = 0; for (const x of a) for (const y of b) U += x > y ? 1 : x === y ? 0.5 : 0;
  let dp = Array.from({ length: n + 1 }, () => new Float64Array(n * mm + 1)); dp[0][0] = 1;
  for (let i = 1; i <= n + mm; i++) { const nd = Array.from({ length: n + 1 }, () => new Float64Array(n * mm + 1));
    for (let k = 0; k <= Math.min(i, n); k++) for (let u = 0; u <= n * mm; u++) { const v = dp[k][u]; if (!v) continue; if (k + 1 <= n) nd[k + 1][u + (i - 1 - k)] += v; nd[k][u] += v; } dp = nd; }
  const d = dp[n]; let t = 0, ge = 0, le = 0; for (let u = 0; u <= n * mm; u++) { t += d[u]; if (u >= U - 1e-9) ge += d[u]; if (u <= U + 1e-9) le += d[u]; } return Math.min(1, 2 * Math.min(ge, le) / t); }
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const res = {};
for (const w of ['X', 'Y']) {
  const a = m(w + 'L1', 4), b = m(w + 'L0', 4), na = m(w + 'N1', 4), nb = m(w + 'N0', 4);   // столбец 4 -- нечёт минус чёт
  const seeds = [...a.keys()].filter((s) => b.has(s));
  const D = seeds.map((s) => (a.get(s) - b.get(s)) / 2), B = seeds.map((s) => (a.get(s) + b.get(s)) / 2);   // при LLSIDE=0 учатся чётные: (чёт − нечёт) = −(нечёт − чёт)
  const DN = seeds.map((s) => (na.get(s) - nb.get(s)) / 2);
  const lookL = [...m(w + 'L1', 5).values(), ...m(w + 'L0', 6).values()];   // частота взгляда у обучаемых половин
  res[w] = { D, p: wil1(D), DN, lookL };
  console.log(`${w}: D медиана ${f(med(D))} (по сидам ${D.map((x) => f(x, 2)).join(' ')}), p = ${wil1(D).toExponential(2)}; сдвиг места b медиана ${f(med(B))}; нуль D: ${DN.every((x) => x === 0) ? 'ровно 0 во всех сидах' : 'НЕ ноль: ' + DN.map((x) => f(x, 3)).join(' ')}; взгляд обучаемых ${f(med(lookL))}`);
}
const c1 = res.X.p < 0.01 && res.Y.p < 0.01 && med(res.X.D) > 0 && med(res.Y.D) > 0, c2 = res.X.DN.every((x) => x === 0) && res.Y.DN.every((x) => x === 0);
const pa = mw2(res.X.lookL, res.Y.lookL), c3 = pa < 0.01;
console.log(`\n1. D > 0 в обоих мирах -> ${c1 ? 'да' : 'НЕТ'}\n2. нуль ровно 0 -> ${c2 ? 'да' : 'НЕТ'}\n3. подстройка частоты взгляда: p = ${pa.toExponential(2)} -> ${c3 ? 'да' : 'НЕТ'}\nСТРОКА 6: ${c1 && c2 && c3 ? 'ПОДТВЕРЖДЕНА' : 'не подтверждена'}`);

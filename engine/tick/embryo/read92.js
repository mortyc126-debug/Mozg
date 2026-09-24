// Чтение шага 92 (PRE92_MIX6.md §4)
const R = require('fs').readFileSync('out/exp92.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const g = (c, i) => R.filter((r) => r[0] === c).map((r) => +r[i]);
function wil1(d) { d = d.filter((x) => x !== 0); const n = d.length, o = d.map((x, i) => [Math.abs(x), i]).sort((x, y) => x[0] - y[0]), rk = new Array(n);
  for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) rk[o[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  const W = d.reduce((s, x, i) => s + (x > 0 ? rk[i] : 0), 0); let ge = 0, le = 0;
  for (let m = 0; m < 1 << n; m++) { let s = 0; for (let i = 0; i < n; i++) if (m >> i & 1) s += rk[i]; if (s >= W - 1e-9) ge++; if (s <= W + 1e-9) le++; }
  return { W, up: ge / (1 << n), two: Math.min(1, 2 * Math.min(ge, le) / (1 << n)) }; }
function mw2(a, b) { const n = a.length, m = b.length; let U = 0; for (const x of a) for (const y of b) U += x > y ? 1 : x === y ? 0.5 : 0;
  let dp = Array.from({ length: n + 1 }, () => new Float64Array(n * m + 1)); dp[0][0] = 1;
  for (let i = 1; i <= n + m; i++) { const nd = Array.from({ length: n + 1 }, () => new Float64Array(n * m + 1));
    for (let k = 0; k <= Math.min(i, n); k++) for (let u = 0; u <= n * m; u++) { const v = dp[k][u]; if (!v) continue; if (k + 1 <= n) nd[k + 1][u + (i - 1 - k)] += v; nd[k][u] += v; } dp = nd; }
  const d = dp[n]; let t = 0, ge = 0, le = 0; for (let u = 0; u <= n * m; u++) { t += d[u]; if (u >= U - 1e-9) ge += d[u]; if (u <= U + 1e-9) le += d[u]; } return { U, p: Math.min(1, 2 * Math.min(ge, le) / t) }; }
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
for (const c of ['Xm', 'Ym', 'X0', 'Y0']) console.log(`${c}: нечётные ${f(med(g(c, 2)))}, чётные ${f(med(g(c, 3)))}, разность ${f(med(g(c, 4)))} (по сидам ${g(c, 4).map((x) => f(x, 2)).join(' ')}); взгляд на действие ${f(med(g(c, 5)))} / ${f(med(g(c, 6)))}`);
const tX = wil1(g('Xm', 4)), tY = wil1(g('Ym', 4)), nX = wil1(g('X0', 4)), nY = wil1(g('Y0', 4));
const c1 = tX.up < 0.01 && tY.up < 0.01;
const c2 = nX.two > 0.05 && nY.two > 0.05 && Math.abs(med(g('X0', 4))) < 0.5 * med(g('Xm', 4)) && Math.abs(med(g('Y0', 4))) < 0.5 * med(g('Ym', 4));
const a = mw2(g('Xm', 5), g('Ym', 5)), c3 = a.p < 0.01;
console.log(`\n1. выгода: Xm p=${tX.up.toExponential(2)}, Ym p=${tY.up.toExponential(2)} -> ${c1 ? 'да' : 'НЕТ'}`);
console.log(`2. нуль: X0 p=${f(nX.two)}, Y0 p=${f(nY.two)} -> ${c2 ? 'да' : 'НЕТ'}`);
console.log(`3. подстройка (частота взгляда обучаемых в Xm и Ym разная): U=${a.U} p=${a.p.toExponential(2)} -> ${c3 ? 'да' : 'НЕТ'}`);
console.log(`ВТОРАЯ ПОЛОВИНА СТРОКИ 6: ${c1 && c2 && c3 ? 'ЕСТЬ' : 'нет'}; гипотеза трагедии общин (выгода в Ym): ${tY.up < 0.01 ? 'подтверждена' : 'нет'}`);

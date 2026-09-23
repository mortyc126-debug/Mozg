const fs = require('fs');
const R = fs.readFileSync('out/exp.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2; };
function mwE(n, m) { const max = n*m, N = n+m; let dp = Array.from({length: n+1}, () => new Float64Array(max+1)); dp[0][0] = 1;
  for (let i = 1; i <= N; i++) { const nd = Array.from({length: n+1}, () => new Float64Array(max+1));
    for (let k = 0; k <= Math.min(i, n); k++) for (let u = 0; u <= max; u++) { const v = dp[k][u]; if (!v) continue;
      if (k+1 <= n) nd[k+1][u+(i-1-k)] += v; nd[k][u] += v; } dp = nd; } return dp[n]; }
function mw(a, b) { const n = a.length, m = b.length; let U = 0; for (const x of a) for (const y of b) U += x > y ? 1 : x === y ? 0.5 : 0;
  const d = mwE(n, m); let t = 0; for (let u = 0; u <= n*m; u++) t += d[u]; let ge = 0; for (let u = Math.ceil(U); u <= n*m; u++) ge += d[u];
  return { U, p: ge / t }; }
const col = (c, i) => R.filter((r) => r[0] === c).sort((a, b) => a[1] - b[1]).map((r) => +r[i]);
const A = col('А', 2), B = col('Б', 2), V = col('В', 2), G = col('Г', 2);
const f = (a) => a.map((x) => (100*x).toFixed(1)).sort((x, y) => x - y).join(' ');
console.log('ДОЛЯ ВЕРНЫХ ДЕЙСТВИЙ, сиды 101-112');
for (const [n, a] of [['А долгое, без множителя', A], ['Б долгое, МНОЖИТЕЛЬ', B], ['В короткое, без множителя', V], ['Г короткое, множитель', G]])
  console.log(`  ${n.padEnd(26)}: ${f(a)} | медиана ${(100*med(a)).toFixed(1)}`);
const r1 = mw(B, A);
console.log(`\nусловие 1 -- Б выше А: U = ${r1.U} из 144, p = ${r1.p.toExponential(2)} (нужно < 0.01)`);
const gL = med(B) - med(A), gS = med(G) - med(V), obs = gL - gS;
let cnt = 0; const NP = 20000;
for (let it = 0; it < NP; it++) { const b1 = [], a1 = [], b2 = [], a2 = [];
  for (let i = 0; i < 12; i++) { if (Math.random() < 0.5) { b1.push(B[i]); a1.push(A[i]); b2.push(G[i]); a2.push(V[i]); }
    else { b1.push(G[i]); a1.push(V[i]); b2.push(B[i]); a2.push(A[i]); } }
  if ((med(b1) - med(a1)) - (med(b2) - med(a2)) >= obs) cnt++; }
console.log(`прирост от решения: при долгом ${(100*gL).toFixed(2)} п.п., при коротком ${(100*gS).toFixed(2)} п.п.`);
console.log(`условие 2 -- разность разностей ${(100*obs).toFixed(2)} п.п., p = ${(cnt/NP).toFixed(4)} (нужно < 0.01)`);
// выученный множитель -- столбец 27 (индекс 26)
const mB = col('Б', 26), mG = col('Г', 26);
console.log(`\nвыученный множитель, Б (долгое): ${mB.map((x) => x.toFixed(2)).join(' ')} | медиана ${med(mB).toFixed(3)}`);
console.log(`выученный множитель, Г (короткое): ${mG.map((x) => x.toFixed(2)).join(' ')} | медиана ${med(mG).toFixed(3)}`);
console.log(`(ворота: лучший закреплённый при долгом -- 0.85; при коротком, шаг 31 -- 1.0)`);

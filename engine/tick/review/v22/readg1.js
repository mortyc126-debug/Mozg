const fs = require('fs');
const R = fs.readFileSync('out/gate1.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2; };
function mwE(n, m) { const max = n*m, N = n+m; let dp = Array.from({length: n+1}, () => new Float64Array(max+1)); dp[0][0] = 1;
  for (let i = 1; i <= N; i++) { const nd = Array.from({length: n+1}, () => new Float64Array(max+1));
    for (let k = 0; k <= Math.min(i, n); k++) for (let u = 0; u <= max; u++) { const v = dp[k][u]; if (!v) continue;
      if (k+1 <= n) nd[k+1][u+(i-1-k)] += v; nd[k][u] += v; } dp = nd; } return dp[n]; }
function mw(a, b) { const n = a.length, m = b.length; let U = 0; for (const x of a) for (const y of b) U += x > y ? 1 : x === y ? 0.5 : 0;
  const d = mwE(n, m); let t = 0; for (let u = 0; u <= n*m; u++) t += d[u]; let ge = 0; for (let u = Math.ceil(U); u <= n*m; u++) ge += d[u];
  return { U, p: ge / t }; }
const g = {}; for (const r of R) (g[r[0]] = g[r[0]] || []).push(+r[2]);
const base = g['σ=0'];
console.log('ВОРОТА 1, KEEP=0.9, сиды 201-212, разброс у всех добытчиков одинаковый');
let best = null;
for (const k of ['σ=0', 'σ=0.05', 'σ=0.1', 'σ=0.2', 'σ=0.3']) {
  const a = g[k], line = `  ${k.padEnd(7)}: ${a.map((x) => (100*x).toFixed(1)).sort((x, y) => x - y).join(' ')} | медиана ${(100*med(a)).toFixed(1)}%`;
  if (k === 'σ=0') { console.log(line + '  <- отсчёт'); continue; }
  const r = mw(a, base), d = 100 * (med(a) - med(base));
  console.log(line + ` | ${d >= 0 ? '+' : ''}${d.toFixed(1)} п.п., U = ${r.U}, p = ${r.p.toFixed(4)}`);
  if (!best || med(a) > best.m) best = { k, m: med(a), d, p: r.p };
}
const pass = best.d >= 3 && best.p < 0.0125;
console.log(`ВОРОТА 1: σ* = ${best.k.slice(2)} (наибольшая медиана), ${best.d >= 0 ? '+' : ''}${best.d.toFixed(1)} п.п., p = ${best.p.toFixed(4)} -> ${pass ? 'ЩЕЛЬ ЕСТЬ' : 'щели нет'} (нужно >= 3 п.п. и p < 0.0125)`);

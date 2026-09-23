const fs = require('fs');
const R = fs.readFileSync('out/gate.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2; };
function mwE(n, m) { const max = n*m, N = n+m; let dp = Array.from({length: n+1}, () => new Float64Array(max+1)); dp[0][0] = 1;
  for (let i = 1; i <= N; i++) { const nd = Array.from({length: n+1}, () => new Float64Array(max+1));
    for (let k = 0; k <= Math.min(i, n); k++) for (let u = 0; u <= max; u++) { const v = dp[k][u]; if (!v) continue;
      if (k+1 <= n) nd[k+1][u+(i-1-k)] += v; nd[k][u] += v; } dp = nd; } return dp[n]; }
function mw(a, b) { const n = a.length, m = b.length; let U = 0; for (const x of a) for (const y of b) U += x > y ? 1 : x === y ? 0.5 : 0;
  const d = mwE(n, m); let t = 0; for (let u = 0; u <= n*m; u++) t += d[u]; let ge = 0; for (let u = Math.ceil(U); u <= n*m; u++) ge += d[u];
  return { U, p: ge / t }; }
const g = {}; for (const r of R) { (g[r[0]] = g[r[0]] || []).push(+r[2]); }
for (const K of ['0.6', '0.9']) {
  console.log(`\nKEEP = ${K}: доля верных действий, множитель закреплён рукой, 8 сидов`);
  const base = g[`K=${K} мн=1.0`];
  let best = null;
  for (const G of ['0.7', '0.85', '1.0', '1.15', '1.3']) {
    const a = g[`K=${K} мн=${G}`];
    const line = `  мн=${G.padEnd(4)}: ${a.map((x) => (100*x).toFixed(1)).sort((x, y) => x - y).join(' ')} | медиана ${(100*med(a)).toFixed(1)}%`;
    if (G !== '1.0') { const r = mw(a, base), d = 100*(med(a) - med(base));
      console.log(line + ` | против 1.0: ${d >= 0 ? '+' : ''}${d.toFixed(1)} п.п., U = ${r.U}, p = ${r.p.toFixed(3)}`);
      if (!best || d > best.d) best = { G, d, p: r.p }; }
    else console.log(line + '  <- отсчёт');
  }
  const pass = best.d >= 3 && best.p < 0.05;
  console.log(`  ВОРОТА: лучший множитель ${best.G}, ${best.d >= 0 ? '+' : ''}${best.d.toFixed(1)} п.п., p = ${best.p.toFixed(3)} -> ${pass ? 'ЩЕЛЬ ЕСТЬ' : 'щели нет'} (нужно >= 3 п.п. и p < 0.05)`);
}

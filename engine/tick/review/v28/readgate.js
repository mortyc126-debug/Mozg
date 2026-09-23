const fs = require('fs');
const R = fs.readFileSync('out/gate.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2; };
function mwE(n, m) { const max = n*m, N = n+m; let dp = Array.from({length: n+1}, () => new Float64Array(max+1)); dp[0][0] = 1;
  for (let i = 1; i <= N; i++) { const nd = Array.from({length: n+1}, () => new Float64Array(max+1));
    for (let k = 0; k <= Math.min(i, n); k++) for (let u = 0; u <= max; u++) { const v = dp[k][u]; if (!v) continue;
      if (k+1 <= n) nd[k+1][u+(i-1-k)] += v; nd[k][u] += v; } dp = nd; } return dp[n]; }
function mw(a, b) { const n = a.length, m = b.length; let U = 0; for (const x of a) for (const y of b) U += x > y ? 1 : x === y ? 0.5 : 0;
  const d = mwE(n, m); let t = 0; for (let u = 0; u <= n*m; u++) t += d[u]; let ge = 0; for (let u = Math.ceil(U); u <= n*m; u++) ge += d[u];
  return { U, p: ge / t }; }
const col = (c, i) => R.filter((r) => r[0] === c).sort((a, b) => a[1] - b[1]).map((r) => +r[i]);
console.log('условие | живых S | r2 сети | наивный | Калман | биты 3-7 | усил. в паузе | ws медл. | ws 3-7 | верные');
for (const c of ['Г0', 'Г1', 'Г2']) console.log(`${c.padEnd(7)} | ${med(col(c,2)).toFixed(1).padStart(7)} | ${med(col(c,3)).toFixed(3).padStart(7)} | ${med(col(c,4)).toFixed(3).padStart(7)} | ${med(col(c,5)).toFixed(3).padStart(6)} | ${med(col(c,6)).toFixed(3).padStart(8)} | ${med(col(c,7)).toFixed(3).padStart(13)} | ${med(col(c,8)).toFixed(2).padStart(8)} | ${med(col(c,9)).toFixed(2).padStart(6)} | ${(100*med(col(c,10))).toFixed(0)}%`);
const old = fs.readFileSync('../v27/out/slow.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t')).sort((a, b) => a[0] - b[0]).map((r) => r[2]);
const g0 = col('Г0', 3).map((x) => x.toFixed(3));
console.log(`\nдетерминизм: r2 Г0 по сидам совпадает с шагом 38 -- ${JSON.stringify(g0) === JSON.stringify(old) ? 'ДА, до третьего знака во всех 12' : 'НЕТ: ' + g0.join(' ') + ' против ' + old.join(' ')}`);
const g1 = med(col('Г1', 3));
console.log(`\nВОРОТА 1 (петля может накапливать): r2 в Г1 = ${g1.toFixed(3)}, порог 0.647 -> ${g1 >= 0.647 ? 'ПРОЙДЕНЫ' : 'не пройдены'}`);
console.log(`   по сидам: ${col('Г1', 3).map((x) => x.toFixed(3)).join(' ')}`);
const r = mw(col('Г0', 6), col('Г2', 6));
console.log(`ВОРОТА 2 (0.82 всем портит быстрые каналы): биты 3-7 Г0 ${med(col('Г0',6)).toFixed(3)} против Г2 ${med(col('Г2',6)).toFixed(3)}, U = ${r.U}, p = ${r.p.toExponential(2)} -> ${r.p < 0.01 ? 'ПРОЙДЕНЫ' : 'не пройдены'} (нужно p < 0.01)`);

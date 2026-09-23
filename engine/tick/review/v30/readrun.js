const med = (a) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2; };
function mwE(n, m) { const max = n*m, N = n+m; let dp = Array.from({length: n+1}, () => new Float64Array(max+1)); dp[0][0] = 1;
  for (let i = 1; i <= N; i++) { const nd = Array.from({length: n+1}, () => new Float64Array(max+1));
    for (let k = 0; k <= Math.min(i, n); k++) for (let u = 0; u <= max; u++) { const v = dp[k][u]; if (!v) continue;
      if (k+1 <= n) nd[k+1][u+(i-1-k)] += v; nd[k][u] += v; } dp = nd; } return dp[n]; }
function mw(a, b) { const n = a.length, m = b.length; let U = 0; for (const x of a) for (const y of b) U += x > y ? 1 : x === y ? 0.5 : 0;
  const d = mwE(n, m); let t = 0; for (let u = 0; u <= n*m; u++) t += d[u]; let ge = 0; for (let u = Math.ceil(U); u <= n*m; u++) ge += d[u];
  return { U, p: ge / t }; }
const fs = require('fs');
const R = fs.readFileSync('out/run.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const rows = (c) => R.filter((r) => r[0] === c).sort((a, b) => a[1] - b[1]);
const ok = (x) => Number.isFinite(x);
const col = (c, i) => rows(c).map((r) => +r[i]).filter(ok);
const f = (x, d = 3) => ok(x) ? x.toFixed(d) : 'NaN';
const A = 0.01 / 3;
console.log('усл. | живых S | r2 S  | наивн | Калман | биты 3-7 | верные | возраст S | плата мира S | ws S  | ws 3-7 | усил. в паузе');
for (const c of ['О0', 'О1', 'О2', 'О3', 'О4']) {
  const dead = rows(c).filter((r) => !ok(+r[6])).map((r) => r[1]), noS = rows(c).filter((r) => ok(+r[6]) && !ok(+r[3])).map((r) => r[1]);
  console.log(`${c}   | ${f(med(col(c,2)),1).padStart(7)} | ${f(med(col(c,3)))} | ${f(med(col(c,4)))} | ${f(med(col(c,5)))}  | ${f(med(col(c,6))).padStart(8)} | ${(100*med(col(c,10))).toFixed(0).padStart(5)}% | ${String(med(col(c,13))).padStart(9)} | ${f(med(col(c,14))).padStart(12)} | ${f(med(col(c,8)),2).padStart(5)} | ${f(med(col(c,9)),2).padStart(6)} | ${f(med(col(c,7)))}` +
    (dead.length ? `   вымерли: ${dead.join(' ')}` : '') + (noS.length ? `   канал S пуст: ${noS.join(' ')}` : ''));
  console.log(`        r2 по сидам: ${rows(c).map((r) => f(+r[3], 2)).join(' ')}`);
}
const b0 = med(col('О0', 6));
const guard = (c) => { const b = med(col(c, 6)), rt = med(col(c, 10)), dead = rows(c).filter((r) => !ok(+r[6])).length;
  const g = b >= 0.95 * b0 && rt >= 0.95 && dead <= 1;
  console.log(`  страж ${c}: биты 3-7 ${f(b)} (${f(100 * b / b0, 1)}% от О0), верные ${(100 * rt).toFixed(0)}%, вымерло ${dead} -> ${g ? 'выполнен' : 'НЕ выполнен'}`); return g; };
console.log('\nСТРАЖИ'); const g1 = guard('О1'), g2 = guard('О2');
console.log(`\nПРОВЕРКИ (Манн-Уитни, односторонний, порог p < ${A.toFixed(4)})`);
const t1 = mw(col('О1', 2), col('О0', 2));
const v1 = t1.p < A && g1;
console.log(`1. канал живёт: живых S О1 ${f(med(col('О1',2)),1)} против О0 ${f(med(col('О0',2)),1)}, U = ${t1.U}, p = ${t1.p.toExponential(2)} -> ${v1 ? 'ДА' : 'нет'}`);
const t2 = mw(col('О1', 3), col('О0', 3)), m1 = med(col('О1', 3));
const v2 = m1 >= 0.647 && t2.p < A && g1;
console.log(`2. оплата даёт накопление: r2 О1 ${f(m1)} (порог 0.647) против О0 ${f(med(col('О0',3)))}, U = ${t2.U}, p = ${t2.p.toExponential(2)} -> ${v2 ? 'ДА' : 'нет'}`);
const t3 = mw(col('О2', 3), col('О1', 3)), m2 = med(col('О2', 3));
const v3 = m2 >= 0.647 && t3.p < A && g2;
console.log(`3. выученная петля сверх оплаты: r2 О2 ${f(m2)} (порог 0.647) против О1 ${f(m1)}, U = ${t3.U}, p = ${t3.p.toExponential(2)} -> ${v3 ? 'ДА' : 'нет'}`);

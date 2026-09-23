const med = (a) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2; };
function mwE(n, m) { const max = n*m, N = n+m; let dp = Array.from({length: n+1}, () => new Float64Array(max+1)); dp[0][0] = 1;
  for (let i = 1; i <= N; i++) { const nd = Array.from({length: n+1}, () => new Float64Array(max+1));
    for (let k = 0; k <= Math.min(i, n); k++) for (let u = 0; u <= max; u++) { const v = dp[k][u]; if (!v) continue;
      if (k+1 <= n) nd[k+1][u+(i-1-k)] += v; nd[k][u] += v; } dp = nd; } return dp[n]; }
function mw(a, b) { const n = a.length, m = b.length; let U = 0; for (const x of a) for (const y of b) U += x > y ? 1 : x === y ? 0.5 : 0;
  const d = mwE(n, m); let t = 0; for (let u = 0; u <= n*m; u++) t += d[u]; let ge = 0; for (let u = Math.ceil(U); u <= n*m; u++) ge += d[u];
  return { U, p: ge / t }; }
const fs = require('fs');
const rd = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => l.split('\t'));
const G = rd('out/gate.tsv'), R = rd('out/run.tsv');
const col = (T, c, i) => T.filter((r) => r[0] === c).sort((a, b) => a[1] - b[1]).map((r) => +r[i]);
const fin = (a) => a.filter(Number.isFinite);
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
console.log(`ВОРОТА (сиды 1201-1212, HOLD=0): H(0) ${f(med(col(G,'ворота',2)))}, H(10) ${f(med(col(G,'ворота',3)))}, H(30) ${f(med(col(G,'ворота',5)))} -> ${med(col(G,'ворота',3)) < 0.5 ? 'ПРОЙДЕНЫ (нехватка есть)' : 'не пройдены'}`);
console.log(`   H(10) по сидам: ${col(G,'ворота',3).map((x) => f(x,2)).join(' ')}`);
for (const c of ['HOLD=0', 'HOLD=1']) {
  const dead = R.filter((r) => r[0] === c && r[13] === '0').map((r) => r[1]);
  console.log(`\n${c}: H(0) ${f(med(fin(col(R,c,2))))} | H(10) ${f(med(fin(col(R,c,3))))} | H(30) ${f(med(fin(col(R,c,5))))} | активность S в конце тишины 10: ${f(med(fin(col(R,c,6))))}, 30: ${f(med(fin(col(R,c,7))))}` + (dead.length ? ` | мир вымер: ${dead.join(' ')}` : ''));
  console.log(`   H(10) по сидам: ${col(R,c,3).map((x) => f(x,2)).join(' ')}`);
  console.log(`   H(30) по сидам: ${col(R,c,5).map((x) => x.toExponential(1)).join(' ')}`);
  console.log(`   взрыв (наибольшее RMS в тишине / в жизни): ${col(R,c,8).map((x) => f(x,2)).join(' ')}`);
}
const inf = (a) => a.map((x) => (Number.isFinite(x) ? x : Infinity));
const bl = med(inf(col(R,'HOLD=1',8)).sort((a, b) => a - b));
const b0 = med(fin(col(R,'HOLD=0',9))), b1 = med(fin(col(R,'HOLD=1',9))), r0 = med(fin(col(R,'HOLD=0',10))), r1 = med(fin(col(R,'HOLD=1',10)));
const h00 = med(fin(col(R,'HOLD=0',2))), h01 = med(fin(col(R,'HOLD=1',2)));
console.log(`\nСТРАЖИ HOLD=1 (вымерший мир считается взрывом):`);
console.log(`  нет взрыва: медиана ${f(bl)} (порог 2) -> ${bl <= 2 ? 'выполнен' : 'НЕ выполнен'}`);
console.log(`  жизнь: биты 3-7 ${f(b1)} против ${f(b0)} (${f(100*b1/b0,1)}%), верные ${f(100*r1,1)}% против ${f(100*r0,1)}% -> ${b1 >= 0.95*b0 && r1 >= 0.95*r0 ? 'выполнен' : 'НЕ выполнен'} (по живым мирам)`);
console.log(`  H(0): ${f(h01)} против ${f(h00)} -> ${h01 >= 0.95*h00 ? 'выполнен' : 'НЕ выполнен'}`);
const neg = (a) => a.map((x) => (Number.isFinite(x) ? x : -Infinity));
for (const [T, i] of [[10, 3], [30, 5]]) {
  const a = neg(col(R,'HOLD=1',i)), b = neg(col(R,'HOLD=0',i)), t = mw(a, b), m1 = med([...a].sort((x, y) => x - y));
  console.log(`ПРОВЕРКА H(${T}): HOLD=1 ${f(m1)} против HOLD=0 ${f(med([...b].sort((x, y) => x - y)))}, U = ${t.U}, p = ${t.p.toExponential(2)} -> по числам ${m1 >= 0.5 && t.p < 0.005 ? 'выполнена' : 'нет'}; засчитывается: нет (стражи)`);
}

const med = (a) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2; };
function mwE(n, m) { const max = n*m, N = n+m; let dp = Array.from({length: n+1}, () => new Float64Array(max+1)); dp[0][0] = 1;
  for (let i = 1; i <= N; i++) { const nd = Array.from({length: n+1}, () => new Float64Array(max+1));
    for (let k = 0; k <= Math.min(i, n); k++) for (let u = 0; u <= max; u++) { const v = dp[k][u]; if (!v) continue;
      if (k+1 <= n) nd[k+1][u+(i-1-k)] += v; nd[k][u] += v; } dp = nd; } return dp[n]; }
function mw(a, b) { const n = a.length, m = b.length; let U = 0; for (const x of a) for (const y of b) U += x > y ? 1 : x === y ? 0.5 : 0;
  const d = mwE(n, m); let t = 0; for (let u = 0; u <= n*m; u++) t += d[u]; let ge = 0; for (let u = Math.ceil(U); u <= n*m; u++) ge += d[u];
  return { U, p: ge / t }; }
const fs = require('fs');
const R = fs.readFileSync('out/poor.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const rows = (c) => R.filter((r) => r[0] === c).sort((a, b) => a[1] - b[1]);
const live = (c) => rows(c).filter((r) => r[3] !== 'NaN');
const col = (c, i) => live(c).map((r) => +r[i]);
const f = (x, d = 3) => Number.isFinite(x) ? x.toFixed(d) : 'NaN';
for (const c of ['Г0', 'Г1', 'Г3', 'Г0з']) { const dead = rows(c).filter((r) => r[3] === 'NaN').map((r) => r[1]); if (dead.length) console.log(`${c}: вымерли (канал S пуст) сиды ${dead.join(' ')}`); }
console.log('\nРАСКЛАДКА ДОХОДА (Г0, мир шага 38), тактов на часть за круг, медианы по сидам');
console.log(`  S:    мир ${f(med(col('Г0',8)))} | чтения ${f(med(col('Г0',9)))} | прочий расход ${f(med(col('Г0',10)))} | аренда 0.4 | потолок Калмана ${f(med(col('Г0',14)))}`);
console.log(`  3-7:  мир ${f(med(col('Г0',11)))} | чтения ${f(med(col('Г0',12)))} | прочий расход ${f(med(col('Г0',13)))}`);
console.log(`  платных связей, читающих S: из S ${f(med(col('Г0',15)),2)}, из других каналов ${f(med(col('Г0',16)),2)} за круг`);
console.log(`  живых на S ${med(col('Г0',2))}, возраст частей S ${med(col('Г0',7))} кругов`);
console.log(`  потолок по сидам: ${col('Г0',14).map((x) => f(x)).join(' ')}`);
console.log(`  плата мира на S по сидам: ${col('Г0',8).map((x) => f(x)).join(' ')}`);
const ceil = med(col('Г0',14)), world = med(col('Г0',8)), reads = med(col('Г0',9));
console.log(`\nА. потолок ${f(ceil)} < аренды 0.4 -> ${ceil < 0.4 ? 'ВЫПОЛНЕНО' : 'не выполнено'}`);
console.log(`Б. доход от чтений на S ${f(reads)} < 0.04 -> ${reads < 0.04 ? 'ВЫПОЛНЕНО' : 'не выполнено'}`);
console.log(`В. плата мира на S ${f(world)} < половины потолка ${f(ceil / 2)} -> ${world < ceil / 2 ? 'ВЫПОЛНЕНО' : 'не выполнено'}`);
console.log('\nПОВТОР РАЗБОРА ШАГА 39 (сиды 901-912)');
for (const c of ['Г0', 'Г1', 'Г3', 'Г0з']) console.log(`  ${c.padEnd(4)} живых S ${med(col(c,2))} | r2 ${f(med(col(c,3)))} (наивный ${f(med(col(c,4)))}, Калман ${f(med(col(c,5)))}) | вес на датчик ${f(med(col(c,6)))} | возраст ${med(col(c,7))} | плата мира S ${f(med(col(c,8)))}\n        r2 по сидам: ${col(c,3).map((x) => f(x,2)).join(' ')}`);
const tt = mw(col('Г3',3), col('Г1',3)), above = live('Г3').filter((r) => +r[3] > +r[4]).length;
console.log(`  Г3 > Г1: U = ${tt.U}, p = ${tt.p.toExponential(2)}; Г3 выше наивного в ${above} из ${live('Г3').length}`);
console.log(`  -> повтор ${tt.p < 0.01 && above >= 10 ? 'ПОДТВЕРЖДЁН' : 'НЕ подтверждён'}`);

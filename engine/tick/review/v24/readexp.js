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
const col = (h, c, i) => R.filter((r) => r[0] === `HQ=${h} ${c}`).map((r) => +r[i]);
const HS = ['0.005', '0.02', '0.08'], CS = ['L', '1', '3', '10', '30'];
const name = (c) => (c === 'L' ? 'после неудачи' : `часы n=${c}`);
console.log('ЧИСТЫЙ ДОХОД на добытчика за круг (медианы, сиды 501-512)');
console.log('                 ' + HS.map((h) => `HQ=${h}`.padStart(12)).join(''));
for (const c of CS) console.log(`  ${name(c).padEnd(15)}` + HS.map((h) => med(col(h, c, 3)).toFixed(3).padStart(12)).join(''));
console.log('\nЧАСТОТА ВЗГЛЯДА (взглядов на действие)');
for (const c of CS) console.log(`  ${name(c).padEnd(15)}` + HS.map((h) => med(col(h, c, 4)).toFixed(3).padStart(12)).join(''));
console.log('\nДОЛЯ ВЕРНЫХ ДЕЙСТВИЙ');
for (const c of CS) console.log(`  ${name(c).padEnd(15)}` + HS.map((h) => (100*med(col(h, c, 2))).toFixed(1).padStart(11) + '%').join(''));

// А
const a = mw(col('0.08', 'L', 4), col('0.005', 'L', 4));
console.log(`\nА. частота взгляда после неудачи выше при HQ=0.08, чем при 0.005: U = ${a.U} из 144, p = ${a.p.toExponential(2)} -> ${a.p < 0.01 ? 'да' : 'нет'} (нужно p < 0.01)`);
// Б
let B = true;
console.log('Б. для каждого периода часов есть мир, где взгляд после неудачи богаче (нужно p < 0.0042):');
for (const c of ['1', '3', '10', '30']) {
  let best = null;
  for (const h of HS) { const r = mw(col(h, 'L', 3), col(h, c, 3)); if (!best || r.p < best.p) best = { h, ...r }; }
  const ok = best.p < 0.0042; B = B && ok;
  console.log(`   часы n=${c.padEnd(2)}: сильнее всего при HQ=${best.h}, U = ${best.U}, p = ${best.p.toExponential(2)} -> ${ok ? 'да' : 'нет'}`);
}
// В
let V = true;
console.log('В. нигде не ниже 90% лучших часов этого мира:');
for (const h of HS) {
  let bc = null; for (const c of ['1', '3', '10', '30']) if (!bc || med(col(h, c, 3)) > med(col(h, bc, 3))) bc = c;
  const rel = med(col(h, 'L', 3)) / med(col(h, bc, 3)); const ok = rel >= 0.9; V = V && ok;
  console.log(`   HQ=${h}: лучшие часы n=${bc} (${med(col(h, bc, 3)).toFixed(3)}), после неудачи ${med(col(h, 'L', 3)).toFixed(3)} = ${(100*rel).toFixed(0)}% -> ${ok ? 'да' : 'нет'}`);
}
console.log(`\nВЕРДИКТ: А ${a.p < 0.01 ? 'да' : 'нет'}, Б ${B ? 'да' : 'нет'}, В ${V ? 'да' : 'нет'} -> ${a.p < 0.01 && B && V ? 'ВТОРАЯ ПОЛОВИНА СТРОКИ 6 ЗАСЧИТАНА' : 'не засчитано'}`);

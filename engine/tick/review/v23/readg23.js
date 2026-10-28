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
const col = (c, i) => R.filter((r) => r[0] === c).map((r) => +r[i]);
const C = ['знает', 'никогда', '1', '3', '10', '30'];
console.log('условие   | доля верных | чистый доход/круг | взглядов на действие | h=1 | живых доб. | действий на доб.');
for (const c of C) console.log(`${c.padEnd(9)} | ${(100*med(col(c,2))).toFixed(1).padStart(10)}% | ${med(col(c,3)).toFixed(3).padStart(17)} | ${med(col(c,4)).toFixed(3).padStart(20)} | ${med(col(c,5)).toFixed(2)} | ${med(col(c,6)).toFixed(1).padStart(10)} | ${med(col(c,7)).toFixed(3)}`);
const r0 = mw(col('знает', 2), col('никогда', 2)), d0 = 100 * (med(col('знает', 2)) - med(col('никогда', 2)));
console.log(`\nПРОВЕРКА 0: знающие даром против никогда: ${d0 >= 0 ? '+' : ''}${d0.toFixed(1)} п.п. доли, U = ${r0.U}, p = ${r0.p.toExponential(2)} -> ${d0 >= 10 && r0.p < 0.01 ? 'мир построен верно' : 'МИР ПОСТРОЕН НЕВЕРНО'}`);
const net = (c) => col(c, 3);
let best = null; for (const c of ['3', '10', '30']) if (!best || med(net(c)) > med(net(best))) best = c;
console.log(`\nВОРОТА (чистый доход): лучший из внутренних -- n = ${best}, медиана ${med(net(best)).toFixed(3)}`);
let pass = true;
for (const e of ['1', 'никогда']) {
  const r = mw(net(best), net(e)), me = med(net(e)), rel = 100 * (med(net(best)) - me) / Math.abs(me);
  const ok = rel >= 10 && r.p < 0.0083; pass = pass && ok;
  console.log(`  против ${e.padEnd(7)}: медиана ${me.toFixed(3)}, прирост ${rel >= 0 ? '+' : ''}${rel.toFixed(1)}%, U = ${r.U}, p = ${r.p.toExponential(2)} -> ${ok ? 'да' : 'нет'} (нужно >= 10% и p < 0.0083)`);
}
console.log(`ВОРОТА: ${pass ? 'ПРОЙДЕНЫ -- оптимум частоты взгляда внутри' : 'не пройдены'}`);

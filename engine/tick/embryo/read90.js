// Чтение ворот шага 90 (PRE90_GATE6.md §3): лучшие часы в каждом мире и перекрёстная проверка пар миров
const R = require('fs').readFileSync('out/gate90.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const Q = ['0.0005', '0.005', '0.05', '0.3'], N = ['1', '3', '10', '30', '100'];
const get = (q, n) => new Map(R.filter((r) => r[0] === `HQ=${q} n=${n}`).map((r) => [r[1], +r[3]]));
const best = {};
for (const q of Q) {
  const row = N.map((n) => [n, med([...get(q, n).values()])]);
  best[q] = row.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  console.log(`HQ=${q}: ` + row.map(([n, v]) => `n=${n} ${v.toFixed(3)}`).join('  ') + `  -> лучшие n=${best[q]}`);
}
let pass = false;
for (let i = 0; i < Q.length; i++) for (let j = i + 1; j < Q.length; j++) {
  const x = Q[i], y = Q[j]; if (best[x] === best[y]) continue;
  const cnt = (q, a, b) => { const A = get(q, a), B = get(q, b); let k = 0; for (const [s, v] of A) if (v > B.get(s)) k++; return k; };
  const kx = cnt(x, best[x], best[y]), ky = cnt(y, best[y], best[x]);
  const ok = kx >= 5 && ky >= 5; if (ok) pass = true;
  console.log(`пара HQ=${x} (n=${best[x]}) и HQ=${y} (n=${best[y]}): в первом свои богаче на ${kx}/6, во втором -- на ${ky}/6 -> ${ok ? 'РАЗНЫЕ ОПТИМУМЫ' : 'нет'}`);
}
console.log(`\nВОРОТА ${pass ? 'ПРОЙДЕНЫ' : 'НЕ ПРОЙДЕНЫ'}`);

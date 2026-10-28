// Фаза 1 шага 96 (PRE96_BLIND.md §4): лучшие часы в Z1 и Z2 по медиане чистого дохода на добытчика; пишет out/clocks96.txt
const R = require('fs').readFileSync('out/gate96.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
let out = '';
for (const v of ['Z1', 'Z2']) {
  const row = ['10', '30', '100'].map((n) => [n, med(R.filter((r) => r[0] === `${v} n=${n}`).map((r) => +r[3])), R.filter((r) => r[0] === `${v} n=${n}`).length]);
  const best = row.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  console.log(`${v}: ` + row.map(([n, x, k]) => `n=${n} ${x.toFixed(4)} (${k} сидов)`).join('  ') + `  -> часы ${best}`);
  out += `${v} ${best}\n`;
}
require('fs').writeFileSync('out/clocks96.txt', out);

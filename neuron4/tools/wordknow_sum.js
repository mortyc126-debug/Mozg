// сводка опыта «слово вместо глаза»: node tools/wordknow_sum.js файл... (строки JSON от tools/wordknow.js)
const fs = require('fs');
for (const f of process.argv.slice(2)) { const L = fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).sort((a, b) => a.seed - b.seed);
  const W = L[0].bits.length, med = (a) => { a = a.filter((x) => x !== null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
  const row = []; for (let w = 1; w < W; w += 2) row.push(`${w + 1}: ${med(L.map((x) => x.bits[w])).toFixed(2)}`);
  const late = L.map((x) => { const b = x.bits.slice(10).filter((v) => v !== null); return b.reduce((a, c) => a + c, 0) / b.length; });
  const useBest = L.map((x) => x.use.slice(10).reduce((a, u) => a + u[2], 0) / x.use.slice(10).length);
  const useAny = L.map((x) => x.use.slice(10).reduce((a, u) => a + (u[1] ? u[0] / u[1] : 0), 0) / x.use.slice(10).length);
  console.log(`== ${f}\n  бит по тысячам (медиана): ${row.join('  ')}\n  вторая половина по мирам: ${late.map((v) => v.toFixed(2)).join(' ')} -- среднее ${(late.reduce((a, b) => a + b, 0) / late.length).toFixed(2)}\n  лучшая часть покупает слово: ${useBest.map((v) => (100 * v).toFixed(0) + '%').join(' ')}; доля частей со словом ${useAny.map((v) => (100 * v).toFixed(0) + '%').join(' ')}`); }

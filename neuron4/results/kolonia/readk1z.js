// чтение К1з (ПЛАН_К1з.md §3-4): парно по мирам, двусторонний Уилкоксон (нормальное приближение при n > 20, иначе точный)
const fs = require('fs'), path = require('path');
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null; return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, r.summary.xres])); };
function wil2(d) { d = d.filter((x) => Number.isFinite(x) && x !== 0); const n = d.length; if (!n) return { p: 1, n };
  const o = d.map((x, i) => [Math.abs(x), i]).sort((x, y) => x[0] - y[0]), rk = new Array(n);
  for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) rk[o[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  const W = d.reduce((s, x, i) => s + (x > 0 ? rk[i] : 0), 0), mu = n * (n + 1) / 4, sd = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24);
  if (n <= 20) { let ge = 0, le = 0; for (let q = 0; q < 1 << n; q++) { let s = 0; for (let i = 0; i < n; i++) if (q >> i & 1) s += rk[i]; if (s >= W - 1e-9) ge++; if (s <= W + 1e-9) le++; } return { p: Math.min(1, 2 * Math.min(ge, le) / (1 << n)), n, W }; }
  const z = (Math.abs(W - mu) - 0.5) / sd, erfc = (x) => { const t = 1 / (1 + 0.5 * x), y = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return y; };
  return { p: erfc(z / Math.SQRT2), n, W }; }
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'З': L('k1z_Z.json'), 'З-тишина': L('k1z_S.json'), 'З-шум': L('k1z_N.json'), 'З-нет': L('k1z_0.json') };
for (const [k, m] of Object.entries(C)) if (m) console.log(`${k.padEnd(9)} миров ${m.size}: смертей во 2-й половине -- медиана ${f(med([...m.values()].map((x) => x.deaths2)))}, в 1-й ${f(med([...m.values()].map((x) => x.deaths1)))}; еда -- медиана ${f(med([...m.values()].map((x) => x.food)), 1)}`);
const cmp = (a, b, key, sign = 1) => { const A = C[a], B = C[b]; if (!A || !B) return null; const s = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y);
  const d = s.map((k) => A.get(k)[key] - B.get(k)[key]), t = wil2(d), md = med(d); return { d, t, md, s }; };
const line = (a, b, key, want) => { const r = cmp(a, b, key); if (!r) return `${a} против ${b}: нет данных`;
  const ok = r.t.p < 0.01 && (want < 0 ? r.md < 0 : r.md > 0); return `${a} против ${b}, ${key}: медиана разности ${f(r.md, 3)}, разность по мирам ${r.d.map((x) => f(x, 2)).join(' ')}; p = ${r.t.p.toExponential(2)} (n = ${r.t.n}) -> ${ok ? 'ДА' : 'нет'}`; };
console.log('\n1. ' + line('З', 'З-тишина', 'deaths2', -1));
console.log('2. ' + line('З', 'З-шум', 'deaths2', -1));
console.log('3. ' + line('З', 'З-тишина', 'food', 1) + '   (вспомогательная)');
console.log('\nдоп.: ' + line('З-тишина', 'З-нет', 'deaths2', -1).replace(' -> ДА', ' (отличие)').replace(' -> нет', ''));
const Z = C['З']; if (Z) { const fr = [...Z.values()].map((x) => x.fearB - x.fearA); console.log(`доп.: страх у З (прогноз смерти перед ней минус всегда): медиана ${f(med(fr), 4)}, больше 0 в ${fr.filter((x) => x > 0).length} из ${fr.length}`);
  const r = [...Z.values()]; console.log(`доп.: смертей у З, 1-я против 2-й половины: медиана разности ${f(med(r.map((x) => x.deaths2 - x.deaths1)), 3)}, p = ${wil2(r.map((x) => x.deaths2 - x.deaths1)).p.toExponential(2)}`); }

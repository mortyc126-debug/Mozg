// Планки для мира цифр (разбор 22.10): те же данные (data/digits.csv), то же деление и та же стандартизация пикселей, что у
// src/worldimg.js; экзамен -- первые WTEST тестовых цифр, как у мира. Мозг видит учебные цифры по одной, по ~15 раз за жизнь;
// планки видят всю учёбу сразу -- это потолки, а не соперники в равных условиях.
//   node tools/digits_planks.js [WTEST=500]
const fs = require('fs'), path = require('path');
const WTEST = +((process.argv.find((a) => a.startsWith('WTEST=')) || 'WTEST=500').split('=')[1]);
const txt = fs.readFileSync(path.join(__dirname, '..', 'data', 'digits.csv'), 'utf8');
const rows = txt.split('\n').filter((l) => l && l[0] !== '#').map((l) => l.split(',').map(Number));
const tr = [], te = []; rows.forEach((r, i) => (r[65] ? te : tr).push(i));
const mu = new Float64Array(64), sd = new Float64Array(64);
for (const i of tr) for (let c = 0; c < 64; c++) mu[c] += rows[i][c] / tr.length;
for (const i of tr) for (let c = 0; c < 64; c++) sd[c] += (rows[i][c] - mu[c]) ** 2 / tr.length;
const keep = []; for (let c = 0; c < 64; c++) if (sd[c] > 0) keep.push(c);
const X = (i) => keep.map((c) => (rows[i][c] - mu[c]) / Math.sqrt(sd[c])), y = (i) => rows[i][64];
const test = te.slice(0, WTEST), XT = tr.map(X);
console.log(`  цифры: учёба ${tr.length}, экзамен -- первые ${test.length} тестовых, пикселей ${keep.length}`);
// k ближайших соседей
for (const k of [1, 3, 5]) { let ok = 0;
  for (const i of test) { const x = X(i), d = tr.map((j, a) => { let s = 0; const z = XT[a]; for (let q = 0; q < x.length; q++) s += (z[q] - x[q]) ** 2; return [s, y(j)]; }).sort((a, b) => a[0] - b[0]).slice(0, k);
    const cnt = new Array(10).fill(0); d.forEach(([, c], r) => { cnt[c] += 1 + 1e-6 * (k - r); }); if (cnt.indexOf(Math.max(...cnt)) === y(i)) ok++; }
  console.log(`    ${k} ближайших соседей: ${(100 * ok / test.length).toFixed(1)}%`); }
// гребневая линейная регрессия на метки (один против всех) -- как линейный прогноз метки по пикселям
const m = keep.length + 1, A = new Float64Array(m * m), C = Array.from({ length: 10 }, () => new Float64Array(m));
for (const i of tr) { const f = [...X(i), 1]; for (let a = 0; a < m; a++) { for (let b = 0; b < m; b++) A[a * m + b] += f[a] * f[b]; for (let d = 0; d < 10; d++) C[d][a] += f[a] * (y(i) === d ? 1 : 0); } }
for (let a = 0; a < m - 1; a++) A[a * m + a] += 1;
const solve = (A0, b0) => { const n = b0.length, M = Array.from({ length: n }, (_, i) => [...A0.slice(i * n, i * n + n), b0[i]]);
  for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } }
  return M.map((r, i) => r[n] / r[i]); };
const Wt = C.map((c) => solve(A, c)); let ok = 0;
for (const i of test) { const f = [...X(i), 1]; let best = -1, bv = -Infinity; Wt.forEach((w, d) => { let s = 0; for (let a = 0; a < m; a++) s += w[a] * f[a]; if (s > bv) { bv = s; best = d; } }); if (best === y(i)) ok++; }
console.log(`    гребневая линейная регрессия на метки: ${(100 * ok / test.length).toFixed(1)}%`);

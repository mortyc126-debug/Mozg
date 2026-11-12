'use strict';
// Статистика экзаменов: парный двусторонний Уилкоксон (нормальное приближение, как в нейроне-4), медиана.
function wil2(d) { d = d.filter((x) => Number.isFinite(x) && x !== 0); const n = d.length; if (!n) return { p: 1, n };
  const o = d.map((x, i) => [Math.abs(x), i]).sort((x, y) => x[0] - y[0]), rk = new Array(n);
  for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) rk[o[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  const W = d.reduce((s, x, i) => s + (x > 0 ? rk[i] : 0), 0), mu = n * (n + 1) / 4, sd = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24);
  if (n <= 20) { let ge = 0, le = 0; for (let q = 0; q < 1 << n; q++) { let s = 0; for (let i = 0; i < n; i++) if (q >> i & 1) s += rk[i]; if (s >= W - 1e-9) ge++; if (s <= W + 1e-9) le++; } return { p: Math.min(1, 2 * Math.min(ge, le) / (1 << n)), n, W }; }
  const z = (Math.abs(W - mu) - 0.5) / sd, erfc = (x) => { const t = 1 / (1 + 0.5 * x), y = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return y; };
  return { p: erfc(z / Math.SQRT2), n, W }; }
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
module.exports = { wil2, med };

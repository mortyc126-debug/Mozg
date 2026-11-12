'use strict';
// Наименьшие квадраты с гребнем для малых систем (входов у части не больше 8-10). Возвращает веса, диагональ обратной
// матрицы (для вклада «без одного входа»: насколько выросла бы сумма квадратов ошибки без входа i -- w_i^2 / inv_ii)
// и сумму квадратов ошибки.
function solve(A, c, m, yy, ridgeMask) {
  // A -- m x m (по строкам), c -- m; ridgeMask[i] -- добавлять ли гребень к диагонали i
  const L = new Float64Array(m * m); let tr = 0;
  for (let i = 0; i < m; i++) tr += A[i * m + i];
  const lam = (tr / m) * 1e-9 + 1e-12;
  const M = Float64Array.from(A);
  for (let i = 0; i < m; i++) if (ridgeMask[i]) M[i * m + i] += ridgeMask[i] * tr / m; else M[i * m + i] += lam;
  // Холецкий
  for (let i = 0; i < m; i++) for (let j = 0; j <= i; j++) {
    let s = M[i * m + j]; for (let k = 0; k < j; k++) s -= L[i * m + k] * L[j * m + k];
    if (i === j) { if (s <= 0) return null; L[i * m + i] = Math.sqrt(s); } else L[i * m + j] = s / L[j * m + j];
  }
  const fwd = (b) => { const y = new Float64Array(m); for (let i = 0; i < m; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i * m + k] * y[k]; y[i] = s / L[i * m + i]; } return y; };
  const bwd = (y) => { const x = new Float64Array(m); for (let i = m - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < m; k++) s -= L[k * m + i] * x[k]; x[i] = s / L[i * m + i]; } return x; };
  const w = bwd(fwd(c));
  const inv = new Float64Array(m);
  for (let i = 0; i < m; i++) { const e = new Float64Array(m); e[i] = 1; inv[i] = bwd(fwd(e))[i]; }
  // сумма квадратов ошибки: yy - 2 w.c + w A w (A -- без гребня)
  let wc = 0, wAw = 0; for (let i = 0; i < m; i++) { wc += w[i] * c[i]; let s = 0; for (let j = 0; j < m; j++) s += A[i * m + j] * w[j]; wAw += w[i] * s; }
  return { w, inv, sse: Math.max(0, yy - 2 * wc + wAw), ops: 2 * m * m * m + m * m };
}
module.exports = { solve };

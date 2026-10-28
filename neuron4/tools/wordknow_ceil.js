// потолок опыта «слово вместо глаза»: сколько бит о глубоком канале дают прошлое значение и слово (линейно), по r
const rs = process.argv.slice(2).map(Number);
let s = 12345; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
function fit(X, y) { const m = X[0].length, A = Array.from({ length: m }, () => new Array(m).fill(0)), b = new Array(m).fill(0);
  X.forEach((x, n) => { for (let i = 0; i < m; i++) { b[i] += x[i] * y[n]; for (let j = 0; j < m; j++) A[i][j] += x[i] * x[j]; } });
  for (let i = 0; i < m; i++) { let p = i; for (let k = i + 1; k < m; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let k = i + 1; k < m; k++) { const f = A[k][i] / A[i][i]; for (let j = i; j < m; j++) A[k][j] -= f * A[i][j]; b[k] -= f * b[i]; } }
  const w = new Array(m).fill(0); for (let i = m - 1; i >= 0; i--) { let v = b[i]; for (let j = i + 1; j < m; j++) v -= A[i][j] * w[j]; w[i] = v / A[i][i]; }
  let e = 0, my = 0, vy = 0; y.forEach((v) => (my += v)); my /= y.length; X.forEach((x, n) => { let p = 0; for (let i = 0; i < m; i++) p += w[i] * x[i]; e += (y[n] - p) ** 2; vy += (y[n] - my) ** 2; });
  return 0.5 * Math.log2(vy / e); }
for (const r of rs) { let h = 0; const X0 = [], X1 = [], y = [];
  for (let t = 0; t < 200000; t++) { const hp = h; h = r * h + Math.sqrt(1 - r * r) * gauss(); const obsPrev = hp + 0.1 * gauss(), word = [h > 0.8 ? 1 : 0, h < -0.8 ? 1 : 0];
    X0.push([1, obsPrev]); X1.push([1, obsPrev, ...word]); y.push(h + 0.1 * gauss()); }
  console.log(`r=${r.toFixed(3)}: без слова ${fit(X0, y).toFixed(3)} бит, со словом ${fit(X1, y).toFixed(3)} бит`); }

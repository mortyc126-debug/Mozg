// П1 (матрица -- это тишина) и П2 (радиус считается верно)
const L = require('./lin.js');
if (process.argv[2] === 'П2') {
  const n = 50, M = new Float64Array(n * n), th = 0.7; let s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296 - 0.5; };
  M[0] = 1.05 * Math.cos(th); M[1] = -1.05 * Math.sin(th); M[n] = 1.05 * Math.sin(th); M[n + 1] = 1.05 * Math.cos(th);
  for (let i = 2; i < n; i++) M[i * n + i] = 0.9;
  for (let i = 0; i < n; i++) for (let j = Math.max(i + 1, 2); j < n; j++) M[i * n + j] = rnd();   // верхний треугольник: собственные числа те же, матрица ненормальная
  const pw = L.radius({ M, n }).r, r = L.eig([{ M, n }])[0].r;
  console.log(`П2 (степенной метод давал ${pw.toFixed(4)}): радиус ${r.toFixed(4)} при настоящем 1.05, ошибка ${Math.abs(r - 1.05).toFixed(4)} -> ${Math.abs(r - 1.05) <= 0.01 ? 'выполнена' : 'НЕ выполнена'}`);
} else {
  const M = require('./neuron2.js'), seed = +process.argv[2], mode = M.CFG.HOLD === 2 ? 'LC' : M.CFG.HCAP ? 'C' : M.CFG.HOLD ? 'H' : '0', w = M.create(seed);
  for (let r = 1; r <= 60000; r++) M.round(w);
  const A = L.build(w, M.CFG, mode), x = new Float64Array(A.n);
  A.parts.forEach((p, k) => { x[2 * k] = p.pred; x[2 * k + 1] = p.z; });
  const y = L.mv(A.M, A.n, x);
  const capped = A.parts.filter((p) => Math.abs(p.wSelf + p.ws) > 0.99).length;
  M.pauseRound(w);
  let dp = 0, dz = 0, nz = 0;
  A.parts.forEach((p, k) => { dp = Math.max(dp, Math.abs(p.pred - y[2 * k])); if (Math.abs(y[2 * k + 1]) < 4) { dz = Math.max(dz, Math.abs(p.z - y[2 * k + 1])); nz++; } });
  console.log(`проверка замера: сид ${seed} HOLD=${M.CFG.HOLD} HCAP=${M.CFG.HCAP}: частей ${A.parts.length}, расхождение прогнозов ${dp.toExponential(1)}, сигналов ${dz.toExponential(1)} (${nz} без ограничения) частей под пределом ${capped} -> ${dp <= 1e-9 && dz <= 1e-9 ? 'выполнена' : 'НЕ выполнена'}`);
}

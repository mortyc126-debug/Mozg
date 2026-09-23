// Замер паузы: 60 000 кругов жизни, затем 500 кругов паузы. CUT=1 -- пустой отсчёт (связи отрезаны).
const M = require('./neuron2.js');
const seed = +process.argv[2], WARM = +process.env.WARM || 60000, CUT = +process.env.CUT || 0;
const w = M.create(seed);
for (let r = 1; r <= WARM; r++) M.round(w);
const A = w.parts.filter(Boolean);
if (CUT) for (const p of A) p.links = [];
const rms = (f) => Math.sqrt(A.reduce((s, p) => s + f(p) ** 2, 0) / A.length);
const P0 = A.map((p) => p.pred), p0 = rms((p) => p.pred), z0 = rms((p) => p.z);
const corr = (a, b) => { const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let s = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { s += (a[i]-ma)*(b[i]-mb); da += (a[i]-ma)**2; db += (b[i]-mb)**2; }
  return da > 0 && db > 0 ? s / Math.sqrt(da * db) : 0; };
const K = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500], out = [];
for (let k = 1; k <= 500; k++) {
  M.pauseRound(w);
  if (K.includes(k)) out.push(`${k}:${(rms((p) => p.pred) / p0).toExponential(2)}:${(rms((p) => p.z) / (z0 || 1)).toExponential(2)}:${corr(P0, A.map((p) => p.pred)).toFixed(3)}`);
}
console.log([seed, CUT ? 'отрезано' : 'сеть', p0.toFixed(4), z0.toFixed(4), ...out].join('\t'));

// проверка шага 65: матрица 'LC' воспроизводит один настоящий pauseRound в конфигурации зародыша
const M = require('./neuron2.js'), L = require('./lin.js');
const seed = +process.argv[2], w = M.create(seed);
for (let r = 1; r <= 60000; r++) M.round(w);
const A = L.build(w, M.CFG, 'LC'), x = new Float64Array(A.n);
A.parts.forEach((p, k) => { x[2 * k] = p.pred; x[2 * k + 1] = p.z; });
const y = L.mv(A.M, A.n, x);
const capped = A.parts.filter((p) => Math.abs(p.wSelf + p.ws) > 0.99).length;
M.pauseRound(w);
let dp = 0, dz = 0;
A.parts.forEach((p, k) => { dp = Math.max(dp, Math.abs(p.pred - y[2 * k])); if (Math.abs(y[2 * k + 1]) < 4) dz = Math.max(dz, Math.abs(p.z - y[2 * k + 1])); });
console.log(`сид ${seed}: частей ${A.parts.length}, под пределом ${capped}, расхождение прогнозов ${dp.toExponential(1)}, сигналов ${dz.toExponential(1)} -> ${dp <= 1e-9 && dz <= 1e-9 ? 'совпадает' : 'НЕ совпадает'}`);

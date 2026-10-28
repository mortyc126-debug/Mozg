// проверка шага 72: матрица 'LS' воспроизводит один настоящий pauseRound при HOLDS=1 в конфигурации зародыша
const M = require('./neuron2.js'), L = require('./lin.js');
const seed = +process.argv[2], w = M.create(seed);
if (!M.CFG.HOLDS) throw new Error('нужен HOLDS=1');
for (let r = 1; r <= 60000; r++) M.round(w);
const A = L.build(w, M.CFG, 'LS', M.SCH), x = new Float64Array(A.n);
A.parts.forEach((p, k) => { x[2 * k] = p.pred; x[2 * k + 1] = p.z; });
const y = L.mv(A.M, A.n, x);
M.pauseRound(w);
let dp = 0, dz = 0;
A.parts.forEach((p, k) => { dp = Math.max(dp, Math.abs(p.pred - y[2 * k])); if (Math.abs(y[2 * k + 1]) < 4) dz = Math.max(dz, Math.abs(p.z - y[2 * k + 1])); });
console.log(`сид ${seed}: частей ${A.parts.length}, расхождение прогнозов ${dp.toExponential(1)}, сигналов ${dz.toExponential(1)} -> ${dp <= 1e-9 && dz <= 1e-9 ? 'совпадает' : 'НЕ совпадает'}`);

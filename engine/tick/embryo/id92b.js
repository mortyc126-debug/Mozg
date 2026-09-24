// шаг 92: без скрытой величины LLEARN=1 ничего не меняет -- отпечаток состояния после жизни, пауз и свободной активности
const M = require('./neuron2.js'), w = M.create(+process.argv[2]);
for (let r = 1; r <= 30000; r++) { M.round(w); if (r % 5000 === 0) { for (let k = 0; k < 20; k++) M.pauseRound(w); for (let k = 0; k < 60; k++) M.freeRound(w); } }
const h = require('crypto').createHash('md5').update(w.parts.map(p => p ? `${p.slot}:${p.credit}:${p.pred}:${p.mse}:${p.links.length}` : '-').join('|')).digest('hex');
console.log(`LLEARN=${M.CFG.LLEARN} HID=${M.CFG.HID}: ${h}`);

// шаг 92: при LLMIX=0 движок побитово равен движку шага 91
const A = require('./history/neuron2_s91.js'), B = require('./neuron2.js');
const seed = +process.argv[2], wa = A.create(seed), wb = B.create(seed);
const f = (w) => w.parts.map(p => p ? `${p.slot}:${p.credit.toFixed(12)}:${p.pred.toFixed(12)}:${p.links.length}:${p.hb}` : '-').join('|');
for (let r = 1; r <= 30000; r++) { A.round(wa); B.round(wb); if (r % 2500 === 0 && f(wa) !== f(wb)) { console.log(`сид ${seed}: РАСХОЖДЕНИЕ на круге ${r}`); process.exit(1); } }
console.log(`сид ${seed} (LLMIX=${B.CFG.LLMIX} LLEARN=${B.CFG.LLEARN} HID=${B.CFG.HID} LOOKN=${B.CFG.LOOKN} LOSEK=${B.CFG.LOSEK}): побитово одинаковы 30000 кругов`);

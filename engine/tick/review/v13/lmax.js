// строка 245: при замене продавца связь добавляется без проверки предела LMAX
const M = require('./neuron2.js');
const w = M.create(+process.argv[2]); let over = 0, mx = 0;
for (let r = 1; r <= 60000; r++) { M.round(w);
  for (const p of w.parts) if (p) { if (p.links.length > 4) over++; mx = Math.max(mx, p.links.length); } }
console.log(`сид ${process.argv[2]}: частей-кругов сверх предела ${over}, наибольшее число связей ${mx} (LMAX=4)`);

// санитарная проверка шага 85: при LNOS=1 у частей медленного канала нет связей-линий; у прочих -- есть
const M = require('./neuron2.js'), C = M.CFG, SCH = M.SCH;
const w = M.create(+process.argv[2]); for (let r = 1; r <= 100000; r++) M.round(w);
const cnt = (f) => w.parts.filter(f).reduce((s, p) => s + p.links.filter((l) => l.k === 3).length, 0);
console.log(`сид ${process.argv[2]} (LNOS=${C.LNOS}): линий у частей медленного канала ${cnt((p) => p && p.ch === SCH)}, у прочих ${cnt((p) => p && p.ch !== SCH)}`);

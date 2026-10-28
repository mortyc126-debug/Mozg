const M = require('./' + process.argv[2]);
const seed = +process.argv[3], w = M.create(seed);
for (let r = 1; r <= 100000; r++) M.round(w);
const s = M.stats(w);
console.log(`${process.argv[2]}\tсид ${seed}\tживых ${s.alive}\tканал9: частей ${s.n9}, бит ${(+s.bits9).toFixed(2)}\tостальные бит ${(+s.bitsX).toFixed(2)}\tвес на верных ${(100*s.right).toFixed(0)}% (нуль ${(100*s.nul).toFixed(0)}%)`);

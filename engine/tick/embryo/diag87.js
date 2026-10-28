// разбор после чтения шага 87: веса отпечатков рода «канал 1» у частей канала 3 в начале проверки, и вес связи с каналом 1 в конце прошлого
const M = require('./neuron2.js'), C = M.CFG;
const seed = +process.argv[2], past = +process.argv[3], w = M.create(seed);
const ch1 = (l) => w.parts[l.j] && w.parts[l.j].ch === 1 && l.k !== 2;
w.rel3 = past; for (let r = 1; r <= 60000; r++) M.round(w);
console.log('конец прошлого, веса связей с каналом 1:', w.parts.filter((p) => p && p.ch === 3).map((p) => p.links.filter(ch1).map((l) => l.w.toFixed(2) + '/' + l.k).join(',')).join(' | '));
w.rel3 = 2; for (let r = 1; r <= 2000; r++) M.round(w);
console.log('начало проверки, отпечатки рода «канал 1»:', w.parts.filter((p) => p && p.ch === 3).map((p) => p.imp ? ['1:0', '1:1', '1:3'].filter((k) => p.imp.get(k)).map((k) => k + '=' + p.imp.get(k).w.toFixed(3)).join(',') : '-').join(' | '));

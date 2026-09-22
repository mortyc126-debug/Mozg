const M = require('./neuron2.js');
const w = M.create(+process.argv[2]);
for (let r = 1; r <= 100000; r++) M.round(w);
const P = w.parts, g = ['датчик','прогноз','сигнал'];
const r2z = (q) => q.zz > 1e-9 ? q.cz*q.cz/q.zz : 0;
for (const q of P) if (q && q.ch !== 9 && r2z(q) >= 0.25)
  console.log(`носитель на канале ${q.ch}: r^2 сигнала ${r2z(q).toFixed(2)} | свой датчик в сигнале uSelf ${q.uSelf.toFixed(3)} | входы сигнала: ` +
    q.links.map(l => P[l.j] ? `к${P[l.j].ch}.${g[l.k]} u=${l.u.toFixed(2)}` : '').filter(Boolean).join(', ') +
    ` | спрос zb ${q.zb.toFixed(1)}`);

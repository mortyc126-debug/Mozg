// Сколько каналов засыпает при спячке в мире эпох (базовый мозг, 24 000 кругов). HIB=1 или HIB=2 -- переменной окружения.
const R = require('path').join(__dirname, '../..');
const K = require(R + '/src/knobs'), { WorldEp } = require(R + '/src/worldep'), { Brain } = require(R + '/src/market');
const cfg = K.makeConfig({ SQ: 1, RENT: 0.05, ROUNDS: 24000, EPL: 8000, HIB: +(process.env.HIB || 1), WORLD: 'exam' });
const W = new WorldEp(cfg, 1), B = new Brain(cfg, W, 1), tr = W.truth();
const owner = []; W.xs.forEach((w, i) => { for (let k = 0; k < w.n; k++) owner[w.off + k] = i; });
for (let r = 1; r <= cfg.ROUNDS; r++) { B.step(); W.score(B);
  if (r % 2000 === 0) { const a = W.active, by = {};
    for (const c of B.ch) { if (owner[c.k] === a) continue; const k = tr[c.k]; by[k] = by[k] || [0, 0]; by[k][1]++; if (c.asleep) by[k][0]++; }
    const ratio = (kind) => { const cs = B.ch.filter((c) => owner[c.k] !== a && tr[c.k] === kind); return cs.length ? (cs.reduce((s, c) => s + (c.qv ?? 0) / (c.vhi || 1), 0) / cs.length).toFixed(3) : '-'; };
    console.log(`круг ${r}, живёт мир ${W.names[a]}: спят (по видам нервов спящих миров) ${Object.entries(by).map(([k, [s, n]]) => `${k} ${s}/${n}`).join(', ')} | быстрый/живой разброс: слово ${ratio('слово')}, предмет ${ratio('предмет')}, источник ${ratio('источник')}`); } }
console.log('засыпаний', B.stat.sleeps || 0, 'пробуждений', B.stat.wakes || 0);

#!/usr/bin/env node
'use strict';
/* Разбор break_cause.js: «прочее» разложено, и посчитано, беднее ли посредник соседей по каналу. */
const M = require('./neuron2.js');
const { PRUNE, TRIAL } = M.CFG;
const carZ = (q) => q.zz > 1e-9 && q.cz * q.cz / q.zz >= 0.25;
const carP = (q) => q.pp > 1e-9 && q.cp * q.cp / q.pp >= 0.25;
const qual = (p, l, q) => l.age >= TRIAL && Math.abs(l.w) * Math.sqrt(l.r2 || 1) >= PRUNE &&
  ((l.k === 2 && carZ(q)) || (l.k === 1 && carP(q)));
const links = (w) => { const out = [];
  for (const p of w.parts) if (p && p.ch === 9) for (const l of p.links) { const q = w.parts[l.j];
    if (q && qual(p, l, q)) out.push({ b: p.slot, ba: p.age, s: l.j, sa: q.age, k: l.k, sch: q.ch }); }
  return out; };
const seed = +process.argv[2] || 1, END = +process.argv[3] || 100000;
const w = M.create(seed);
const why = {}, add = (k, n) => (why[k] = (why[k] || 0) + n);
let prev = [], on = 0, onBits = 0, since = 0, breaks = 0, sellerDied = 0, total = 0;
let carRich = 0, carPoor = 0, carN = 0;
for (let r = 1; r <= END; r++) {
  M.round(w);
  const cur = links(w), P = w.parts;
  const c9 = P.filter((p) => p && p.ch === 9);
  if (c9.some((p) => p.bits > 0.6)) onBits++;      // хоть у одной части канала 9 сжатие выше порога
  if (cur.length) { on++; since++; }
  else if (prev.length && since >= 200) {
    breaks++;
    for (const e of prev) { total++;
      const q = P[e.s], p = P[e.b];
      if (!q || q.age !== e.sa + 1) { add('погиб посредник', 1); sellerDied++; }
      else if (!p || p.age !== e.ba + 1) add('погиб покупатель', 1);
      else { const l = p.links.find((m) => m.j === e.s && m.k === e.k);
        if (!l) add('покупатель сбросил связь', 1);
        else if (l.age < TRIAL) add('связь пересажена и снова на пробе', 1);
        else if (!(e.k === 2 ? carZ(q) : carP(q))) add('товар посредника перестал нести прошлое', 1);
        else if (Math.abs(l.w) * Math.sqrt(l.r2 || 1) < PRUNE) add('ВЕС ПОКУПАТЕЛЯ УПАЛ, связь жива', 1);
        else add('необъяснённое', 1); } }
    since = 0;
  } else since = 0;
  prev = cur;
  if (r % 500 === 0) {                              // беднее ли посредник соседей по каналу
    for (const q of P) if (q && q.ch !== 9 && (carZ(q) || carP(q))) {
      const sib = P.filter((o) => o && o.ch === q.ch && o !== q);
      if (!sib.length) continue;
      const m = sib.map((o) => o.credit).sort((a, b) => a - b)[sib.length >> 1];
      carN++; if (q.credit > m) carRich++; else carPoor++; }
  }
}
console.log(`сид ${seed}: связь с носителем ${(100*on/END).toFixed(0)}% кругов, сжатие выше порога хоть у одной части ${(100*onBits/END).toFixed(0)}% кругов
  разрывов ${breaks}, связей в них ${total}, из них смерть посредника ${sellerDied}
  ` + Object.entries(why).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}: ${v}`).join('; ') + `
  посредник богаче соседей по каналу в ${carN ? (100*carRich/carN).toFixed(0) : '-'}% замеров (${carN} замеров)`);

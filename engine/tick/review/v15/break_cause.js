#!/usr/bin/env node
'use strict';
/* Что рвёт передатчик глубины 2. Каждый круг смотрим, есть ли у канала 9 устоявшаяся связь
   с носителем нужного прошлого. Когда все такие связи разом пропадают, разбираем по каждой
   из них, что случилось первым: погиб посредник, погиб покупатель, покупатель сам сбросил
   связь, его вес упал ниже порога, посредник потерял свой вход или его сигнал уехал в сторону.
   Считаются ВСЕ связи разрыва: у одного разрыва причин бывает несколько. */
const M = require(process.env.MOD || './neuron2.js');
const { PRUNE, TRIAL } = M.CFG;
const carZ = (q) => q.zz > 1e-9 && q.cz * q.cz / q.zz >= 0.25;
const carP = (q) => q.pp > 1e-9 && q.cp * q.cp / q.pp >= 0.25;
const links = (w) => {
  const out = [];
  for (const p of w.parts) if (p && p.ch === 9) for (const l of p.links) {
    const q = w.parts[l.j];
    if (l.age >= TRIAL && Math.abs(l.w) * Math.sqrt(l.r2 || 1) >= PRUNE &&
        ((l.k === 2 && carZ(q)) || (l.k === 1 && carP(q))))
      out.push({ b: p.slot, ba: p.age, s: l.j, sa: q.age, k: l.k, cr: q.credit, hu: q.hungry, sch: q.ch });
  }
  return out;
};
const seed = +process.argv[2] || 1, END = +process.argv[3] || 100000;
const w = M.create(seed);
const why = {}, add = (k) => (why[k] = (why[k] || 0) + 1);
let prev = [], on = 0, since = 0, breaks = 0, lens = [], rich = 0, ready = 0, deaths = 0;
let ids = new Set(), carriers = [], maxAge = 0;   // переживает ли постройка свои части
let prevIds = new Set(), swaps = 0, swapsRun = [];   // полная смена состава носителей внутри отрезка
const med0 = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : 0);
for (let r = 1; r <= END; r++) {
  M.round(w);
  const cur = links(w);
  const c9 = w.parts.filter((p) => p && p.ch === 9);
  if (med0(c9.map((p) => p.bits)) > 0.6) rich++;   // канал 9 и вправду сжимает выше потолка
  if (cur.length) {
    on++; since++;
    const now = new Set();
    for (const e of cur) { const id = e.s + ':' + (r - e.sa); ids.add(id); now.add(id); maxAge = Math.max(maxAge, e.sa); }
    if (prevIds.size && ![...now].some((id) => prevIds.has(id))) swaps++;   // ни один прежний носитель не остался
    prevIds = now;
  }
  else if (prev.length && since >= 200) {          // передатчик работал и разом пропал
    breaks++; lens.push(since);
    const cause = {};
    for (const e of prev) {
      const q = w.parts[e.s], p = w.parts[e.b];
      let c;
      if (!q || q.age !== e.sa + 1) {
        c = e.cr < 0 || e.hu > 0 ? 'посредник разорился' : 'посредник погиб от сбоя';
        deaths++;                                   // был ли наготове родич с таким же входом
        const kin = w.parts.filter((o) => o && o.ch === e.sch && o.links.some((l) =>
          w.parts[l.j] && w.parts[l.j].ch === 8 && Math.abs(l.u) * Math.sqrt((l.r2 || 1) / o.zv) >= PRUNE));
        if (kin.length) ready++;
      }
      else if (!p || p.age !== e.ba + 1) c = 'погиб покупатель';
      else if (!p.links.some((l) => l.j === e.s && l.k === e.k)) c = 'покупатель сбросил связь';
      else if (!p.links.some((l) => l.j === e.s && l.k === e.k && l.age >= TRIAL &&
               Math.abs(l.w) * Math.sqrt(l.r2 || 1) >= PRUNE)) c = 'вес покупателя упал, связь жива';
      else if (!(e.k === 2 ? carZ(q) : carP(q)))
        c = q.links.some((l) => w.parts[l.j] && w.parts[l.j].ch === 8) ? 'сигнал посредника уехал' : 'посредник потерял вход';
      else c = 'прочее';
      cause[c] = (cause[c] || 0) + 1;
    }
    for (const [k, v] of Object.entries(cause)) why[k] = (why[k] || 0) + v;   // считаем все связи разрыва, а не одну частую
    carriers.push(ids.size); swapsRun.push(swaps); ids = new Set(); prevIds = new Set(); swaps = 0; since = 0;
  } else since = 0;
  prev = cur;
}
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : 0);
if (since) { carriers.push(ids.size); swapsRun.push(swaps); }
console.log(`сид ${seed}: разных носителей за отрезок ${carriers.filter((v) => v).join(',') || '-'} | полных смен состава ${swapsRun.join(',') || '-'} | наибольший возраст носителя ${maxAge} | ` +
  `пересадка родичу ${w.kinPick || 0}, мимо ${w.kinMiss || 0} | связь с носителем ${(100 * on / END).toFixed(0)}% времени, сжатие выше потолка ${(100 * rich / END).toFixed(0)}%, родич наготове ${ready}/${deaths}, разрывов ${breaks}, медиана отрезка ${med(lens)} кругов | причины: ` +
  (Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'нет'));

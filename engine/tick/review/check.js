'use strict';
/* Проверка меры «вес на верных», а не результата.
   Три вопроса:
   1. Сколько было бы, если считать СВЯЗИ, а не вес? Вес -- это ровно
      то, по чему связи отбираются, значит мера может читать отбор.
   2. Что даст ПЕРЕСТАНОВКА таблицы родителей? Если мера и там покажет
      много -- она читает не причинность.
   3. Есть ли каналы, не родители, но осведомлённые? Канал 5 = c0-c2
      несёт c0, то есть полезен части 3 (её канал = (c0+c1)/2^.5).
      Если таких связей нет вовсе -- мир нашёл именно ПРЯМЫХ родителей. */
process.env.ROUNDS = process.env.ROUNDS || '20000';
const M = require('./neuron2.js');
const PARENTS = [[], [], [], [0,1], [1,2], [0,2], [3], [3,4]];
// осведомлённые, но не прямые родители: делят источник с каналом части
const SHARE = [[], [], [], [4,5,7], [3,5,7], [3,4], [0,1,7], [0,1,2,6]];
const ROUNDS = +process.env.ROUNDS;

function perm(rnd) { const a=[0,1,2,3,4,5,6,7];
  for(let i=7;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

const rows = [];
for (const seed of [1,2,3,4,5]) {
  const w = M.create(seed);
  for (let r = 0; r < ROUNDS; r++) M.round(w);
  const P = w.parts.filter(Boolean);
  const X = P.filter(p => p.ch >= 3);
  let wRight=0, wAll=0, nRight=0, nAll=0, wShare=0, nShare=0;
  const perPart = [];
  for (const p of X) {
    let pr=0, pa=0;
    for (const l of p.links) {
      const a = Math.abs(l.w), c = w.parts[l.j].ch;
      wAll += a; nAll++; pa += a;
      if (PARENTS[p.ch].includes(c)) { wRight += a; nRight++; pr += a; }
      else if (SHARE[p.ch].includes(c)) { wShare += a; nShare++; }
    }
    if (pa > 0) perPart.push(pr / pa);
  }
  // перестановочный нуль: таблица родителей перемешана
  let permW = 0;
  const rnd = (() => { let a = (seed*2654435761)>>>0;
    return () => { a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1);
      t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };})();
  for (let t = 0; t < 200; t++) {
    const pm = perm(rnd); let wr = 0, wa = 0;
    for (const p of X) for (const l of p.links) {
      const a = Math.abs(l.w), c = w.parts[l.j].ch;
      wa += a; if (PARENTS[pm[p.ch]].includes(pm[c])) wr += a;
    }
    permW += wa ? wr / wa : 0;
  }
  const med = a => a.length ? [...a].sort((x,y)=>x-y)[Math.floor(a.length/2)] : NaN;
  rows.push({ seed, wRight: wRight/wAll, nRight: nRight/nAll, wShare: wShare/wAll,
    nShare: nShare/nAll, perm: permW/200, links: nAll, medPart: med(perPart),
    lr: med(P.map(p=>p.g.lr)), cap: med(P.map(p=>p.cap)) });
}
const m = f => rows.reduce((a,r)=>a+f(r),0)/rows.length;
console.log(`${ROUNDS} кругов, 5 сидов, части с каналом >= 3\n`);
console.log(' сид | связей | вес на верных | СВЯЗЕЙ верных | перестановочный нуль | вес на осведомлённых');
for (const r of rows)
  console.log(`${String(r.seed).padStart(4)} | ${String(r.links).padStart(6)} | `+
    `${(100*r.wRight).toFixed(1).padStart(12)}% | ${(100*r.nRight).toFixed(1).padStart(12)}% | `+
    `${(100*r.perm).toFixed(1).padStart(19)}% | ${(100*r.wShare).toFixed(1).padStart(19)}%`);
console.log(`\nсредние: вес на верных ${(100*m(r=>r.wRight)).toFixed(1)}%, связей верных ${(100*m(r=>r.nRight)).toFixed(1)}%,`);
console.log(`         перестановочный нуль ${(100*m(r=>r.perm)).toFixed(1)}%, на осведомлённых, но не родителях ${(100*m(r=>r.wShare)).toFixed(1)}%`);
console.log(`         медиана доли верных ПО ЧАСТЯМ ${(100*m(r=>r.medPart)).toFixed(1)}%  (седьмое правило)`);

// разбор потери AUC «еда» по видам отрицательных кругов (ИССЛЕДОВАНИЕ_ВРЕМЯ.md §6). Запуск: node results/r6/loss.js <сид> [РУЧКА=значение ...]
// откуда потеря AUC «еда»: какие отрицательные круги стоят выше начала слова
const R='/home/user/Mozg/neuron5/src';const { make } = require(R + '/config'), { World } = require(R + '/world'), { Brain } = require(R + '/brain');
const seed=+process.argv[2], over=Object.fromEntries(process.argv.slice(3).map(a=>a.split('=')));
const cfg=make({BG:1,SPEAK:1,SPX:1,REQ:1,MAP:0,HLAG:10,VJIT:6,INV:1,SPT:1,...over}), W=new World(cfg,seed), B=new Brain(cfg,W,seed);
const kE=W.nerves.indexOf(W.voice[0]); let lastAte=-1e9, lastWordEnd=-1e9, prevV=0, onAt=-1e9; const pos=[], neg=[];
for(let t=1;t<=cfg.ROUNDS;t++){B.step(); if(W.ev.ate) lastAte=t; const v=W.voice[0].val, pr=B.cortex.forecast(kE);
 if(prevV&&!v) lastWordEnd=t; if(v&&!prevV) onAt=t;
 if(t>20000){ if(v&&!prevV) pos.push(pr); else if(!v){ const cat = t-lastWordEnd<=3 ? 'сразу после слова' : (t-lastAte<=10 && onAt<lastAte ? 'после еды, слова ещё не было' : (t-lastAte<=12 ? 'после еды, слово уже было' : 'вдали')); neg.push([pr,cat]); } }
 prevV=v; }
const ps=pos.slice().sort((a,b)=>a-b), above=(x)=>{let lo=0,hi=ps.length;while(lo<hi){const m=(lo+hi)>>1;if(ps[m]<x)lo=m+1;else hi=m;}return (ps.length-lo)/ps.length;};
// вклад категории в потерю AUC: доля пар (начало, отрицательный), где отрицательный выше
const cats={}; for(const [x,c] of neg){ const k=cats[c]||(cats[c]={n:0,loss:0}); k.n++; k.loss+=1-above(x); }
let tot=0; for(const k of Object.values(cats)) tot+=k.loss; console.log('AUC',(1-tot/neg.length).toFixed(3),'начал',pos.length);
for(const [c,k] of Object.entries(cats)) console.log(c.padEnd(30),'кругов',String(k.n).padStart(6),' потеря AUC',(k.loss/neg.length).toFixed(4),' на круг',(k.loss/k.n).toFixed(3));

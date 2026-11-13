// какие начала слова «еда» кора не ждала (ИССЛЕДОВАНИЕ_ВРЕМЯ.md §7). Запуск из коммита 61f30e4 или новее: node results/r6/unexpected.js <сид>
// начала слова «еда», которые кора не ждала: когда было событие и звучал ли изобретённый след
const R='/home/user/Mozg/neuron5/src';const { make } = require(R + '/config'), { World } = require(R + '/world'), { Brain } = require(R + '/brain');
const seed=+process.argv[2], over=Object.fromEntries(process.argv.slice(3).map(a=>a.split('=')));
const cfg=make({BG:1,SPEAK:1,SPX:1,REQ:1,MAP:0,HLAG:10,VJIT:6,INV:1,SPT:1,...over}), W=new World(cfg,seed), B=new Brain(cfg,W,seed);
const kE=W.nerves.indexOf(W.voice[0]); let prevV=0; const ates=[]; const far=[], pos=[];
for(let t=1;t<=cfg.ROUNDS;t++){B.step(); if(W.ev.ate) ates.push(t); const v=W.voice[0].val, pr=B.cortex.forecast(kE);
 const inv=B.hippo.traces.find(q=>q.inv&&q.targets.has(kE)); const trOn=inv?B.bus.val[inv.good]:-1;
 if(t>20000){ const lag=t-(ates.length?ates[ates.length-1]:-1e9); if(v&&!prevV) pos.push({pr,lag,trOn, prevAte: ates.length>1? t-ates[ates.length-2]:1e9}); else if(!v&&lag>15) far.push(pr); }
 prevV=v;}
far.sort((a,b)=>a-b); const q=(p)=>far[Math.floor(p*far.length)];
console.log('обычные круги: медиана',q(0.5).toFixed(3),' 90%',q(0.9).toFixed(3),' 99%',q(0.99).toFixed(3));
const low=pos.filter(p=>p.pr<q(0.9)); console.log('начал',pos.length,' из них ниже 90% обычных:',low.length);
const hist={}; for(const p of pos){const k=(p.pr<q(0.9)?'НЕ ждал':'ждал')+' | задержка от еды '+(p.lag>12?'>12':p.lag)+' | след '+(p.trOn<0?'нет':p.trOn>0?'звучит':'молчит'); hist[k]=(hist[k]||0)+1;}
for(const [k,n] of Object.entries(hist).sort()) console.log('  ',k.padEnd(52),n);

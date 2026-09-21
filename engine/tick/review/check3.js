'use strict';
/* То же вмешательство, но теперь оно ДЕЙСТВУЕТ: BIRTH читается из
   окружения. Проверяю заодно, что размножение правда выключено. */
const { execFileSync } = require('child_process');
function run(env, label) {
  const out = execFileSync(process.execPath, ['-e', `
    process.env.ROUNDS='20000';
    ${Object.entries(env).map(([k,v])=>`process.env.${k}='${v}';`).join('')}
    const M=require('${__dirname}/n2p.js');
    const PARENTS=[[],[],[],[0,1],[1,2],[0,2],[3],[3,4]];
    const med=a=>a.length?[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)]:NaN;
    const res=[];
    for(const seed of [1,2,3]){
      const w=M.create(seed);
      for(let r=0;r<20000;r++) M.round(w);
      const P=w.parts.filter(Boolean), X=P.filter(p=>p.ch>=3);
      let wr=0,wa=0; const per=[];
      for(const p of X){let a=0,b=0;
        for(const l of p.links){const q=Math.abs(l.w),c=w.parts[l.j].ch;
          wa+=q;b+=q;if(PARENTS[p.ch].includes(c)){wr+=q;a+=q;}}
        if(b>0)per.push(a/b);}
      res.push({right:wa?wr/wa:NaN, med:med(per), alive:P.length, births:w.births,
        founders:P.filter(p=>p.age>=19999).length, lr:med(P.map(p=>p.g.lr)),
        bits:med(X.map(p=>p.bits)), links:med(X.map(p=>p.links.length))});
    }
    const m=f=>res.reduce((a,r)=>a+f(r),0)/res.length;
    console.log(JSON.stringify({right:m(r=>r.right),med:m(r=>r.med),alive:m(r=>r.alive),
      births:m(r=>r.births),founders:m(r=>r.founders),lr:m(r=>r.lr),bits:m(r=>r.bits),links:m(r=>r.links)}));
  `], { maxBuffer: 1 << 24 }).toString();
  const r = JSON.parse(out);
  console.log(`${label.padEnd(40)} верных ${(100*r.right).toFixed(1).padStart(5)}%, медиана ${(100*r.med).toFixed(1).padStart(5)}%, `+
    `бит ${r.bits.toFixed(2)}, связей ${r.links.toFixed(1)}, живых ${r.alive.toFixed(0)}, `+
    `рождений ${r.births.toFixed(0)}, основателей ${r.founders.toFixed(0)}, lr ${r.lr.toFixed(3)}`);
}
console.log('20000 кругов, 3 сида. BIRTH теперь читается из окружения.\n');
run({}, 'как есть');
run({ FAULT:'0', BIRTH:'1e12' }, 'размножение ВЫКЛЮЧЕНО, сбоев нет');
run({ BIRTH:'1e12' }, 'размножение выключено, сбои есть');

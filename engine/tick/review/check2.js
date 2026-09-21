'use strict';
/* Чем найдена причинность -- ОТБОРОМ или УЧЁБОЙ каждой части порознь?
   Замысел автора -- про хозяйство и размножение. Но веса правит LMS
   внутри одной части, и отбор может быть ни при чём.
   Вмешательство: выключить смену поколений (сбоев нет, копия
   недоступна) -- если причинность всё равно находится, дело в учёбе. */
const { execFileSync } = require('child_process');
function run(env, label) {
  const out = execFileSync(process.execPath, ['-e', `
    process.env.ROUNDS='20000';
    ${Object.entries(env).map(([k,v])=>`process.env.${k}='${v}';`).join('')}
    const M=require('${__dirname}/neuron2.js');
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
      res.push({right:wa?wr/wa:NaN, med:med(per), alive:P.length,
        births:w.births, lr:med(P.map(p=>p.g.lr)), cap:med(P.map(p=>p.cap)),
        bits:med(X.map(p=>p.bits)), age:med(P.map(p=>p.age))});
    }
    const m=f=>res.reduce((a,r)=>a+f(r),0)/res.length;
    console.log(JSON.stringify({right:m(r=>r.right),med:m(r=>r.med),alive:m(r=>r.alive),
      births:m(r=>r.births),lr:m(r=>r.lr),cap:m(r=>r.cap),bits:m(r=>r.bits),age:m(r=>r.age)}));
  `], { maxBuffer: 1 << 24 }).toString();
  const r = JSON.parse(out);
  console.log(`${label.padEnd(38)} вес на верных ${(100*r.right).toFixed(1).padStart(5)}%, `+
    `медиана по частям ${(100*r.med).toFixed(1).padStart(5)}%, бит ${r.bits.toFixed(2)}, `+
    `живых ${r.alive.toFixed(0)}, рождений ${r.births.toFixed(0)}, возраст ${r.age.toFixed(0)}, `+
    `гены: lr ${r.lr.toFixed(3)}, связей ${r.cap.toFixed(1)}`);
}
console.log('20000 кругов, 3 сида\n');
run({}, 'как есть (отбор + учёба)');
run({ FAULT: '0', BIRTH: '1e9' }, 'без смены поколений (одна учёба)');
run({ FAULT: '0' }, 'без сбоев, размножение есть');

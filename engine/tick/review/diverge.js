'use strict';
/* Где именно расходятся прежняя сборка и новая при SELECT=0 RULE=0?
   Ищу первый круг, а не гадаю по диффу. */
const { execFileSync } = require('child_process');
function trace(file, env, rounds) {
  return execFileSync(process.execPath, ['-e', `
    ${Object.entries(env).map(([k,v])=>`process.env.${k}='${v}';`).join('')}
    process.env.ROUNDS='${rounds}';
    const M=require('${__dirname}/${file}');
    const w=M.create(1); const out=[];
    for(let r=0;r<${rounds};r++){
      M.round(w);
      const A=w.parts.filter(Boolean);
      let h=0; for(const p of A) h+=p.credit*1e-3+p.wSelf+p.links.length+p.s;
      out.push(A.length+':'+h.toFixed(9)+':'+w.births+':'+w.deaths.bank+'/'+w.deaths.fault);
    }
    console.log(out.join('\\n'));
  `], { maxBuffer: 1<<26 }).toString().trim().split('\n');
}
const R = 5000;
const a = trace('neuron2.js', {}, R);
const b = trace('n3.js', { SELECT:'0', RULE:'0' }, R);
let first = -1;
for (let i = 0; i < R; i++) if (a[i] !== b[i]) { first = i; break; }
if (first < 0) console.log(`совпадают все ${R} кругов`);
else {
  console.log(`первое расхождение на круге ${first + 1}:`);
  console.log('  прежняя:', a[first]);
  console.log('  новая:  ', b[first]);
  if (first > 0) console.log('  круг до:', a[first-1], '|', b[first-1]);
}

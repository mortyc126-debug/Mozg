const fs = require('fs');
const K=['cond','seed','share','rate','winners','burn','varF','sf','relay','bare','nRelay','nBare','acts','aliveF','gAct','net','give','alive','bitsX','bits9','right','nul','byK','dUse','dHit','qArg'];
const D = fs.readFileSync('out/dec.tsv','utf8').trim().split('\n').map(l=>l.split('\t'))
  .map(r=>Object.fromEntries(K.map((k,i)=>[k, i<2||i>=22?r[i]:+r[i]])));
const by=(c)=>D.filter(d=>d.cond===c);
const med=(a)=>{const s=[...a].sort((x,y)=>x-y),n=s.length;return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;};
function mwExact(n,m){const max=n*m,N=n+m;let dp=Array.from({length:n+1},()=>new Float64Array(max+1));dp[0][0]=1;
  for(let i=1;i<=N;i++){const nd=Array.from({length:n+1},()=>new Float64Array(max+1));
    for(let k=0;k<=Math.min(i,n);k++)for(let u=0;u<=max;u++){const v=dp[k][u];if(!v)continue;
      if(k+1<=n)nd[k+1][u+(i-1-k)]+=v; nd[k][u]+=v;} dp=nd;} return dp[n];}
function mw(a,b){const n=a.length,m=b.length;let U=0;for(const x of a)for(const y of b)U+=x>y?1:x===y?0.5:0;
  const d=mwExact(n,m);let tot=0;for(let u=0;u<=n*m;u++)tot+=d[u];let ge=0;for(let u=Math.ceil(U);u<=n*m;u++)ge+=d[u];
  return {U,p:ge/tot};}
const S=(c)=>by(c).map(d=>d.share);
const A=S('А'),B=S('Б'),V=S('В'),G=S('Г'),NP=S('безПрогноза');
const f=(a)=>a.map(x=>(100*x).toFixed(1)).sort((x,y)=>x-y).join(' ');
console.log('ДОЛЯ ВЕРНЫХ ДЕЙСТВИЙ, %');
for (const [n,a] of [['А настоящий мир, без решения',A],['Б настоящий мир, РЕШЕНИЕ',B],
                     ['В запаздывающий, без решения',V],['Г запаздывающий, решение',G],['   без прогноза',NP]])
  console.log(`  ${n.padEnd(30)}: ${f(a)} | медиана ${(100*med(a)).toFixed(1)}`);
const r1=mw(B,A);
console.log(`\nусловие 1 -- Б выше А: U = ${r1.U} из ${B.length*A.length}, p = ${r1.p.toExponential(2)} (нужно < 0.01)`);
const gR=med(B)-med(A), gL=med(G)-med(V);
console.log(`\nприрост от решения: в настоящем мире ${(100*gR).toFixed(2)} п.п., в запаздывающем ${(100*gL).toFixed(2)} п.п.`);
// перестановочная проверка взаимодействия: меняем метки мира местами
let cnt=0, NP2=20000, obs=gR-gL;
const all=[[B,A],[G,V]];
for(let it=0;it<NP2;it++){
  const b1=[],a1=[],b2=[],a2=[];
  for(let i=0;i<12;i++){ if(Math.random()<0.5){b1.push(B[i]);a1.push(A[i]);b2.push(G[i]);a2.push(V[i]);}
    else {b1.push(G[i]);a1.push(V[i]);b2.push(B[i]);a2.push(A[i]);} }
  if((med(b1)-med(a1))-(med(b2)-med(a2))>=obs) cnt++;
}
console.log(`условие 2 -- прирост в настоящем больше: разность разностей ${(100*obs).toFixed(2)} п.п., p = ${(cnt/NP2).toFixed(4)} (нужно < 0.01)`);
console.log(`\nвыученный сдвиг (сколько добытчиков выбрали каждый argmax) и доля попаданий по сдвигам:`);
for (const c of ['Б','Г','безПрогноза']) { const d=by(c);
  console.log(`  ${c}: argmax ${d.slice(0,4).map(x=>x.qArg).join('  |  ')}`);
  console.log(`     применено ${d[0].dUse}  попаданий ${d[0].dHit}`); }
for (const c of ['А','Б','В','Г']) { const d=by(c), M2=(k,p=2)=>med(d.map(x=>x[k])).toFixed(p);
  console.log(`\n${c}: живых добытчиков ${M2('aliveF')}/8 | действий на добытчика ${M2('rate',3)} | дисперсия F ${M2('varF')}` +
    ` | самосогл. ${(100*med(d.map(x=>x.sf))).toFixed(0)}% | с передатчиком ${(100*med(d.map(x=>x.relay))).toFixed(1)}% / без ${(100*med(d.map(x=>x.bare))).toFixed(1)}%`);
  console.log(`   по числу действующих: ${d[0].byK}`); }

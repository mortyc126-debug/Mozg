let s=7;const re=()=>{s=(s*16807)%2147483647;return s/2147483647};const ri=(a,b)=>a+Math.floor(re()*(b-a+1));
// одиночные следы X и Y (0.85) в круге вопроса: лучшая точность порога по одному следу
const a=[],b=[],y=[];for(let i=0;i<20000;i++){const sh=re()<0.5,d=sh?ri(1,2):ri(5,8),x0=ri(0,6);a.push(0.85**(16-x0));b.push(0.85**(16-x0-d));y.push(sh?1:-1)}
const best=(v)=>{let bb=0;for(const th of v.slice(0,500)){for(const sg of[1,-1]){let ok=0;for(let i=0;i<v.length;i++)if(((v[i]>th)?sg:-sg)===y[i])ok++;bb=Math.max(bb,ok/v.length)}}return bb};
console.log('trace X only',best(a).toFixed(3),'trace Y only',best(b).toFixed(3),'ratio',best(a.map((x,i)=>b[i]/x)).toFixed(3),'diff',best(a.map((x,i)=>b[i]-x)).toFixed(3));

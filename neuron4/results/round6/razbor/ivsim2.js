let s=7;const re=()=>{s=(s*16807)%2147483647;return s/2147483647};const ri=(a,b)=>a+Math.floor(re()*(b-a+1));
for(const W of [8,12,16]){const a=[],b=[],y=[];for(let i=0;i<20000;i++){const sh=re()<0.5,d=sh?ri(1,2):ri(5,8),qy=ri(2,2+W);a.push(0.85**(qy+d));b.push(0.85**qy);y.push(sh?1:-1)}
const best=(v)=>{let bb=0;const ts=[...new Set(v)].sort((p,q)=>p-q);for(const th of ts){for(const sg of[1,-1]){let ok=0;for(let i=0;i<v.length;i++)if(((v[i]>th)?sg:-sg)===y[i])ok++;bb=Math.max(bb,ok/v.length)}}return bb};
console.log('Q-Y 2..'+(2+W),'X only',best(a).toFixed(3),'Y only',best(b).toFixed(3),'ratio',best(a.map((x,i)=>x/b[i])).toFixed(3),'diff',best(a.map((x,i)=>b[i]-x)).toFixed(3));}

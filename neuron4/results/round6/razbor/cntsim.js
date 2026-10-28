let s=1;const re=()=>{s=(s*16807)%2147483647;return s/2147483647};const ri=(a,b)=>a+Math.floor(re()*(b-a+1));
const T=20000;let X=[],Q=[],P=[];let ep=null,gap=0;
for(let t=0;t<T;t++){let x=0,q=0,p=0;
 if(ep&&ep.stage==='ans'){p=ep.ans;ep=null;gap=ri(3,8);}
 else{ if(!ep){ if(gap>0){gap--;} else {const two=re()<0.5;let at=0;const say=[[0,'X']];if(two){at=ri(2,4);say.push([at,'X'])}say.push([at+ri(2,5),'Q']);ep={t0:t,say,i:0,ans:two?1:-1,stage:'say'}}}
  if(ep&&ep.stage==='say'){while(ep.i<ep.say.length&&t-ep.t0>=ep.say[ep.i][0]){const w=ep.say[ep.i++][1];if(w==='X')x=1;else q=1;if(ep.i===ep.say.length)ep.stage='ans';}}}
 X.push(x);Q.push(q);P.push(p);}
function r2(xs,ys){let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;for(let i=0;i<xs.length;i++){const x=xs[i],y=ys[i];n++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y}const c=sxy-sx*sy/n;return c*c/((sxx-sx*sx/n)*(syy-sy*sy/n))}
for(const lam of [0.85,1,0.7,0.5]){let S=0;const a=[],b=[];for(let t=0;t<T-1;t++){S=Math.min(16,lam*S+X[t]);a.push(Q[t]?S:0);b.push(P[t+1]);}
 console.log('lam',lam,'r2 при(Q,н(X)) =',r2(a,b).toFixed(3));
 // только в кругах вопроса
 const a2=[],b2=[];for(let t=0;t<T-1;t++)if(Q[t]){a2.push(a[t]);b2.push(b[t])} console.log('   only Q rounds r2',r2(a2,b2).toFixed(3));
 // с порогом/сдвигом
 const m=a2.reduce((x,y)=>x+y,0)/a2.length; const a3=a.map((v,t)=>Q[t]?v-m:0); console.log('   centered при r2',r2(a3,b).toFixed(3));
}
{let S=0;const a=[],b=[];for(let t=0;t<T-1;t++){S=Math.min(16,0.85*S+X[t]);if(Q[t]){a.push(S);b.push(P[t+1])}}
 let best=0,bt=0;for(let th=0.3;th<1.5;th+=0.01){let ok=0;for(let i=0;i<a.length;i++)if((a[i]>th?1:-1)===b[i])ok++;if(ok/a.length>best){best=ok/a.length;bt=th}}
 const m=a.reduce((x,y)=>x+y,0)/a.length;let ok=0;for(let i=0;i<a.length;i++)if((a[i]>m?1:-1)===b[i])ok++;
 console.log('best threshold acc',best.toFixed(3),'at',bt.toFixed(2),'; mean-threshold acc',(ok/a.length).toFixed(3),'mean',m.toFixed(2));}

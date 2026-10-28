let s=13;const re=()=>{s=(s*16807)%2147483647;return s/2147483647};const ri=(a,b)=>a+Math.floor(re()*(b-a+1));
const N=20000;
// первое после метки: a/b 1-3 до M, 3-5 после; +1, если первым после метки было a
{let okL=0,okF=0,okP=0;for(let i=0;i<N;i++){const pre=Array.from({length:ri(1,3)},()=>re()<0.5?'a':'b'),post=Array.from({length:ri(3,5)},()=>re()<0.5?'a':'b');const ans=post[0]==='a'?1:-1;
 if((post[post.length-1]==='a'?1:-1)===ans)okL++;const na=post.filter(x=>x==='a').length,nb=post.length-na;const f=na>nb?1:na<nb?-1:(re()<0.5?1:-1);if(f===ans)okF++;if((pre[pre.length-1]==='a'?1:-1)===ans)okP++;}
 console.log('первое после метки: по последнему',(okL/N).toFixed(3),'по частоте после метки',(okF/N).toFixed(3),'по последнему до метки',(okP/N).toFixed(3));}
// из трёх до метки: a/b/c 2-4 до M (последнее до метки -- a или b, поровну) и 1-3 после; +1, если последним до метки было a
{let okL=0,okF=0;for(let i=0;i<N;i++){const w=()=>['a','b','c'][ri(0,2)];const pre=[...Array.from({length:ri(1,3)},w),re()<0.5?'a':'b'],post=Array.from({length:ri(1,3)},w);const ans=pre[pre.length-1]==='a'?1:-1;
 if((post[post.length-1]==='a'?1:-1)===ans)okL++;const all=[...pre,...post],na=all.filter(x=>x==='a').length,nb=all.filter(x=>x==='b').length;const f=na>nb?1:na<nb?-1:(re()<0.5?1:-1);if(f===ans)okF++;}
 console.log('из трёх до метки: по последнему',(okL/N).toFixed(3),'по частоте a против b',(okF/N).toFixed(3));}

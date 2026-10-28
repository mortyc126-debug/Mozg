let s=11;const re=()=>{s=(s*16807)%2147483647;return s/2147483647};const ri=(a,b)=>a+Math.floor(re()*(b-a+1));
// счёт до метки: до M -- X 1 или 2 раза; после M -- X 0-2 раза; вопрос; +1, если до M было два
{let tot=[],y=[];for(let i=0;i<20000;i++){const two=re()<0.5,after=ri(0,2);tot.push((two?2:1)+after);y.push(two?1:-1)}
 let best=0;for(const th of [1.5,2.5,3.5]){let ok=0;for(let i=0;i<tot.length;i++)if((tot[i]>th?1:-1)===y[i])ok++;best=Math.max(best,ok/tot.length)}console.log('счёт до метки: по общему счёту при вопросе -- потолок',best.toFixed(3));}
// до метки: слова a/b звучат 2-4 раза до M, 1-3 после; +1, если последним до M было a. Короткие пути: последнее перед вопросом; чаще звучавшее
{let okL=0,okF=0,N=20000;for(let i=0;i<N;i++){const pre=Array.from({length:ri(2,4)},()=>re()<0.5?'a':'b'),post=Array.from({length:ri(1,3)},()=>re()<0.5?'a':'b');const ans=pre[pre.length-1]==='a'?1:-1;
 const last=post[post.length-1]==='a'?1:-1;if(last===ans)okL++;const all=[...pre,...post],na=all.filter(x=>x==='a').length,nb=all.length-na;const f=na>nb?1:na<nb?-1:(re()<0.5?1:-1);if(f===ans)okF++;}
 console.log('до метки: по последнему слову при вопросе',(okL/N).toFixed(3),'по частоте',(okF/N).toFixed(3));}

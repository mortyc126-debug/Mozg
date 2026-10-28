// Что видит отбор: связь удалённости закона от LMS с битами, доходом и ЧИСЛОМ ПОТОМКОВ.
// Без отсева по возрасту -- берём каждую умершую часть, рождённую после 10000-го круга.
const M = require('./nfit.js');
const seed = +process.argv[2], END = +process.argv[3] || 60000;
const w = M.create(seed); w.log = [];
for (let r = 1; r <= END; r++) M.round(w);
const L = w.log.filter((e) => e.life > 30);
const cor = (f, g) => { const n = L.length; if (!n) return NaN;
  const ma = L.reduce((s,e)=>s+f(e),0)/n, mb = L.reduce((s,e)=>s+g(e),0)/n;
  let s=0, da=0, db=0; for (const e of L) { s += (f(e)-ma)*(g(e)-mb); da += (f(e)-ma)**2; db += (g(e)-mb)**2; }
  return da>0 && db>0 ? s/Math.sqrt(da*db) : NaN; };
const q = (f,t) => L.map(f).sort((x,y)=>x-y)[Math.floor(t*L.length)];
console.log(`сид ${seed}: умерших с жизнью > 30 кругов: ${L.length} | удалённость от LMS: четверти ${q(e=>e.d,0.25).toFixed(2)} / ${q(e=>e.d,0.5).toFixed(2)} / ${q(e=>e.d,0.75).toFixed(2)}
  удалённость <-> биты ${cor(e=>e.d,e=>e.bits).toFixed(2)} | <-> доход ${cor(e=>e.d,e=>e.gain).toFixed(2)} | <-> ПОТОМКИ ${cor(e=>e.d,e=>e.kids).toFixed(2)} | <-> срок жизни ${cor(e=>e.d,e=>e.life).toFixed(2)}
  удалённость <-> число связей ${cor(e=>e.d,e=>e.links).toFixed(2)} | <-> плата за чтение ${cor(e=>e.d,e=>e.paid).toFixed(2)} | <-> плата мира ${cor(e=>e.d,e=>e.world).toFixed(2)} | <-> доход от чтения ${cor(e=>e.d,e=>e.got).toFixed(2)}
  а сами биты <-> доход ${cor(e=>e.bits,e=>e.gain).toFixed(2)} | биты <-> ПОТОМКИ ${cor(e=>e.bits,e=>e.kids).toFixed(2)} | доход <-> потомки ${cor(e=>e.gain,e=>e.kids).toFixed(2)} | СРОК ЖИЗНИ <-> потомки ${cor(e=>e.life,e=>e.kids).toFixed(2)}`);

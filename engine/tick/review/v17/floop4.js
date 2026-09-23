// Истощение при РАЗНОЙ численности действующих: в петлю входит среднее по названным местам.
// Мера прежняя -- насколько решения сети двигают мир сильнее, чем двигали бы решения жребием.
const M = 4, DEEP = 2, QN = [-0.6744898, 0, 0.6744898], EM2 = (M * M - 1) / 12;
const mk = (s0) => { let s = s0 >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const binOf = (z) => (z < QN[0] ? 0 : z < QN[1] ? 1 : z < QN[2] ? 2 : 3);
const mval = (b) => b - (M - 1) / 2;
function sim(LOOP, k, q, N) {
  const rh = mk(11), rd = mk(22), rr = mk(33), div = Math.sqrt(1 + LOOP * LOOP * EM2);
  const gauss = () => Math.sqrt(-2 * Math.log(rh() + 1e-12)) * Math.cos(2 * Math.PI * rh());
  let c8 = 0, h = new Array(DEEP + 1).fill(0), Fa = 0, Fb = 0;
  const A = [], D = [], hits = [];
  for (let t = 0; t < N; t++) {
    c8 = 0.5 * c8 + Math.sqrt(0.75) * gauss();
    const hid = h[DEEP]; h.unshift(c8); h.length = DEEP + 1;
    const tA = binOf(Fa), tB = binOf(Fb);
    let sA = 0, sB = 0, hit = 0;
    for (let i = 0; i < k; i++) {
      const sk = rd(), dr = rr();
      const aA = sk < q ? tA : Math.floor(sk * M) % M;   // умелый называет то, где еда сейчас
      const aB = Math.floor(dr * M) % M;
      sA += mval(aA); sB += mval(aB); if (aA === tA) hit++;
    }
    Fa = (hid - LOOP * (sA / k)) / div;                 // истощение: названное место ОТТАЛКИВАЕТ
    Fb = (hid - LOOP * (sB / k)) / div;
    if (t > 3000) { A.push(Fa); D.push(Fa - Fb); hits.push(hit / k); }
  }
  const n = A.length, m = A.reduce((x, y) => x + y, 0) / n;
  let v = 0, vd = 0; for (let i = 0; i < n; i++) { v += (A[i] - m) ** 2; vd += D[i] * D[i]; }
  return { infl: 100 * vd / v, hit: 100 * hits.reduce((x, y) => x + y, 0) / n };
}
console.log('истощение, влияние сети против жребия (в скобках -- доля попаданий):');
for (const LOOP of [0.5, 1.0]) {
  for (const k of [1, 2, 4, 8]) {
    console.log(`  LOOP=${LOOP.toFixed(1)}, действуют ${k}: ` + [0.25, 0.5, 0.9]
      .map((q) => { const r = sim(LOOP, k, q, 200000); return `умелость ${(100*q).toFixed(0)}%: ${r.infl.toFixed(0)}% (${r.hit.toFixed(0)}%)`; }).join(' | '));
  }
}

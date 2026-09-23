// Чем именно управляет сеть. Место еды задаёт скрытое прошлое; сеть решает только,
// УГАДАЛ ЛИ КТО-ТО. Гоняем два мира на одном и том же скрытом потоке: в одном
// признак угадывания настоящий, в другом всегда 1. Разность -- то, что двигает сеть.
const M = 4, DEEP = 2;
const mk = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const QN = [-0.6744898, 0, 0.6744898];
const binOf = (z) => (z < QN[0] ? 0 : z < QN[1] ? 1 : z < QN[2] ? 2 : 3);
const mval = (b) => b - (M - 1) / 2;
function pair(LOOP, q, N) {
  const rh = mk(11), rw = mk(22);                 // отдельные потоки: скрытое и угадывание
  const div = Math.sqrt(1 + LOOP * LOOP * ((M * M - 1) / 12));
  let c8 = 0, h = new Array(DEEP + 1).fill(0), Fa = 0, Fb = 0;
  const A = [], B = [];
  const gauss = () => Math.sqrt(-2 * Math.log(rh() + 1e-12)) * Math.cos(2 * Math.PI * rh());
  for (let t = 0; t < N; t++) {
    c8 = 0.5 * c8 + Math.sqrt(0.75) * gauss();
    const hid = h[DEEP]; h.unshift(c8); h.length = DEEP + 1;
    const won = rw() < q ? 1 : 0;
    Fa = (hid + LOOP * mval(binOf(Fa)) * won) / div;    // мир как есть
    Fb = (hid + LOOP * mval(binOf(Fb)) * 1) / div;      // мир, где угадывают всегда
    if (t > 3000) { A.push(Fa); B.push(Fb); }
  }
  const n = A.length, mA = A.reduce((x, y) => x + y, 0) / n;
  let vA = 0, vD = 0; for (let i = 0; i < n; i++) { vA += (A[i] - mA) ** 2; vD += (A[i] - B[i]) ** 2; }
  return 100 * (vD / n) / (vA / n);
}
console.log('какую долю дисперсии F двигает сама сеть (разность с миром, где угадывают всегда):');
for (const LOOP of [0.3, 0.6, 1.0]) {
  console.log(`  LOOP=${LOOP.toFixed(1)}: ` + [0.25, 0.5, 0.75, 0.9, 0.99]
    .map((q) => `угадывают ${(100*q).toFixed(0)}%: ${pair(LOOP, q, 300000).toFixed(1)}%`).join(' | '));
}

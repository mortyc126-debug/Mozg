// Потолок доли верных действий при истощении. Толпа, назвавшая место a, отталкивает
// еду от a. Значит верно только самосогласованное место: bin((скрытое - LOOP*m(a))/div) == a.
// Считаем, в какой доле кругов такое место существует, и сколько их бывает.
const M = 4, EM2 = (M * M - 1) / 12;
let s = 777; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const QN = [-0.6744898, 0, 0.6744898];
const binOf = (z) => (z < QN[0] ? 0 : z < QN[1] ? 1 : z < QN[2] ? 2 : 3);
const mval = (b) => b - (M - 1) / 2;
for (const LOOP of [0.25, 0.5, 1.0]) {
  const div = Math.sqrt(1 + LOOP * LOOP * EM2);
  const cnt = new Array(M + 1).fill(0); let N = 300000;
  for (let i = 0; i < N; i++) {
    const hid = gauss();                       // скрытое прошлое: тот же масштаб, дисперсия 1
    let k = 0;
    for (let a = 0; a < M; a++) if (binOf((hid - LOOP * mval(a)) / div) === a) k++;
    cnt[k]++;
  }
  const none = 100 * cnt[0] / N;
  console.log(`LOOP=${LOOP.toFixed(2)} (делитель ${div.toFixed(3)}): самосогласованных мест ` +
    cnt.map((c, k) => `${k}: ${(100*c/N).toFixed(1)}%`).join(' ') +
    ` -> потолок для единодушной толпы ${(100 - none).toFixed(1)}%`);
}

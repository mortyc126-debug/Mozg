// Канал F по §1 правки 2, отдельно от всего мира. Два вопроса:
// (а) равновероятны ли доли при границах по нормальным квантилям;
// (б) какой долей дисперсии F управляет сеть -- то есть признак «кто-то угадал».
const M = 4, DEEP = 2;
let s = 987654321;
const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
// квантили стандартного нормального для M=4: -0.6745, 0, +0.6745
const QN = [-0.6744898, 0, 0.6744898];
const binOf = (v, sd) => { const z = v / sd; return z < QN[0] ? 0 : z < QN[1] ? 1 : z < QN[2] ? 2 : 3; };
const mval = (b) => b - (M - 1) / 2;          // место как число: -1.5, -0.5, +0.5, +1.5

function run(LOOP, q, N) {
  let c8 = 0, h = new Array(DEEP + 1).fill(0), F = 0, Fp = 0;
  const div = Math.sqrt(1 + LOOP * LOOP * ((M * M - 1) / 12));   // держим дисперсию около 1
  const cnt = new Array(M).fill(0), Fs = [], ws = [], ms = [];
  for (let t = 0; t < N; t++) {
    c8 = 0.5 * c8 + Math.sqrt(0.75) * gauss();
    const hidden = h[DEEP]; h.unshift(c8); h.length = DEEP + 1;
    const b = binOf(F, 1);                       // где еда в этом круге
    const won = rnd() < q ? 1 : 0;               // угадал ли кто-нибудь
    Fp = F;
    F = (hidden + LOOP * mval(b) * won) / div;
    if (t > 2000) { cnt[binOf(F, 1)]++; Fs.push(F); ws.push(won); ms.push(mval(b)); }
  }
  const n = Fs.length, tot = cnt.reduce((a, b) => a + b, 0);
  // какую долю дисперсии F объясняет признак «кто-то угадал» при известном месте
  const mF = Fs.reduce((a, b) => a + b, 0) / n;
  let sv = 0; for (const v of Fs) sv += (v - mF) ** 2;
  // предсказываем F по (место * признак) -- это ровно то, чем управляет сеть
  const x = ms.map((m, i) => m * ws[i]), mx = x.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (Fs[i] - mF); sxx += (x[i] - mx) ** 2; }
  const r2 = sxx > 0 ? (sxy * sxy) / (sxx * sv) : 0;
  return { shares: cnt.map((c) => (100 * c / tot).toFixed(1) + '%'), r2 };
}
console.log('доли мест при границах по нормальным квантилям (должны быть по 25%):');
for (const LOOP of [0, 0.3, 0.6, 1.0]) {
  const r = run(LOOP, 0.6, 200000);
  console.log(`  LOOP=${LOOP.toFixed(1)}: ${r.shares.join(' ')}`);
}
console.log('\nдоля дисперсии F, которой управляет сеть (место, взятое по факту угадывания):');
for (const LOOP of [0.3, 0.6, 1.0]) {
  const line = [0.25, 0.5, 0.75, 0.9, 0.99].map((q) => `угадывают ${(100*q).toFixed(0)}%: ${(100 * run(LOOP, q, 200000).r2).toFixed(1)}%`);
  console.log(`  LOOP=${LOOP.toFixed(1)}: ` + line.join(' | '));
}

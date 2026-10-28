// Какой множитель прогноза верен? Наивный прогноз не учитывает собственный толчок.
// Верное место -- самосогласованное: a = доля((скрытое - LOOP*m(a))/делитель).
// Наивный прогноз при совершенном передатчике -- скрытое/делитель. Сколько на него надо умножить?
const M = 4, QN = [-0.6744898, 0, 0.6744898];
let s = 20240923;
const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const mval = (b) => b - (M - 1) / 2;
for (const LOOP of [0.5]) {
  const div = Math.sqrt(1 + LOOP * LOOP * (M * M - 1) / 12);
  for (const k of [1, 2, 3, 6]) {           // сколько действующих делят толчок
    const push = LOOP / k;                  // вклад одного в среднее
    const best = [];
    for (let gi = 0; gi <= 30; gi++) {
      const g = 0.4 + gi * 0.04;
      let hit = 0, n = 200000;
      for (let i = 0; i < n; i++) {
        const hid = gauss();
        // верное место: самосогласованное при том, что ВСЕ k называют его же
        let truth = -1;
        for (let a = 0; a < M; a++) { const F = (hid - LOOP * mval(a)) / div;
          const b = F < QN[0] ? 0 : F < QN[1] ? 1 : F < QN[2] ? 2 : 3; if (b === a) { truth = a; break; } }
        if (truth < 0) continue;
        const p0 = hid / div;               // наивный прогноз, не знающий о толчке
        const v = g * p0;
        const named = v < QN[0] ? 0 : v < QN[1] ? 1 : v < QN[2] ? 2 : 3;
        if (named === truth) hit++;
      }
      best.push([g, hit / n]);
    }
    best.sort((a, b) => b[1] - a[1]);
    const at1 = best.find((x) => Math.abs(x[0] - 1.0) < 1e-9);
    console.log(`LOOP=${LOOP}, действующих ${k}: лучший множитель ${best[0][0].toFixed(2)} (попаданий ${(100*best[0][1]).toFixed(1)}%)` +
      ` | при множителе 1.00 -- ${(100*at1[1]).toFixed(1)}% | выигрыш ${(100*(best[0][1]-at1[1])).toFixed(1)} п.п.`);
  }
}

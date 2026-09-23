// Пустой отсчёт для доли «похожих на LMS»: тот же жребий основателей и та же мутация,
// но без мира, без отбора и без смерти. Сколько занимает эта область сама по себе?
const rnd = (() => { let a = 12345; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isLMS = (g) => g.b / g.a > 0.8 && g.b / g.a < 1.25 && g.c / g.a < 0.1;
for (const MUT of [0.3, 1, 3]) {
  const mut = (v) => clamp(v * Math.exp(MUT * 0.2 * gauss()), 1e-4, 2);
  const out = [];
  for (const GEN of [0, 100, 1000]) {
    let hit = 0, n = 20000;
    for (let i = 0; i < n; i++) {
      let g = { a: 0.001 + 0.3 * rnd(), b: 0.001 + 0.3 * rnd(), c: 0.001 + 0.3 * rnd() };
      for (let t = 0; t < GEN; t++) g = { a: mut(g.a), b: mut(g.b), c: mut(g.c) };
      if (isLMS(g)) hit++;
    }
    out.push(`${GEN} поколений ${(100 * hit / n).toFixed(1)}%`);
  }
  console.log(`MUT=${MUT}: ` + out.join(' | '));
}

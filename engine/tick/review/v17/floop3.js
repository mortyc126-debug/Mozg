// Три устройства петли, мера одна: насколько решения сети двигают мир СИЛЬНЕЕ,
// чем двигали бы решения жребием. Скрытый поток один и тот же.
const M = 4, DEEP = 2, QN = [-0.6744898, 0, 0.6744898];
const mk = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const binOf = (z) => (z < QN[0] ? 0 : z < QN[1] ? 1 : z < QN[2] ? 2 : 3);
const mval = (b) => b - (M - 1) / 2;
const EM2 = (M * M - 1) / 12;

function sim(kind, q, N) {
  const rh = mk(11), rd = mk(22), rr = mk(33);
  const div = Math.sqrt(1 + EM2);
  const gauss = () => Math.sqrt(-2 * Math.log(rh() + 1e-12)) * Math.cos(2 * Math.PI * rh());
  let c8 = 0, h = new Array(DEEP + 1).fill(0), Fa = 0, Fb = 0;
  const A = [], D = [];
  for (let t = 0; t < N; t++) {
    c8 = 0.5 * c8 + Math.sqrt(0.75) * gauss();
    const hid = h[DEEP]; h.unshift(c8); h.length = DEEP + 1;
    const skill = rd(), draw = rr();              // одни и те же жребии обоим мирам
    if (kind === 'как в правке 2') {
      // сеть влияет только через «угадал ли кто-то»
      const wA = skill < q ? 1 : 0, wB = draw < 0.25 ? 1 : 0;
      Fa = (hid + mval(binOf(Fa)) * wA) / div;
      Fb = (hid + mval(binOf(Fb)) * wB) / div;
    } else {
      // сеть называет место; съеденное место СМЕЩАЕТ канал -- прочь (истощение) или к себе (пророчество)
      const sgn = kind === 'истощение' ? -1 : +1;
      const trueA = binOf(Fa), trueB = binOf(Fb);
      const aA = skill < q ? trueA : Math.floor(skill * M) % M;   // умелая толпа называет верно
      const aB = Math.floor(draw * M) % M;                        // толпа жребием
      Fa = (hid + sgn * mval(aA)) / div;
      Fb = (hid + sgn * mval(aB)) / div;
    }
    if (t > 3000) { A.push(Fa); D.push(Fa - Fb); }
  }
  const n = A.length, m = A.reduce((x, y) => x + y, 0) / n;
  let v = 0, vd = 0; for (let i = 0; i < n; i++) { v += (A[i] - m) ** 2; vd += D[i] * D[i]; }
  return 100 * vd / v;
}
for (const kind of ['как в правке 2', 'истощение', 'пророчество']) {
  console.log(`${kind}: ` + [0.25, 0.5, 0.75, 0.9, 0.99]
    .map((q) => `умелость ${(100*q).toFixed(0)}%: ${sim(kind, q, 300000).toFixed(0)}%`).join(' | '));
}

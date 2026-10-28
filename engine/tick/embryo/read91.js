// Чтение опыта шага 91 (PRE91_LLEARN.md §4): для взгляда после промахов (K2) и обучаемого взгляда (LL) -- условия А, Б, В
const R = require('fs').readFileSync('out/exp91.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const col = (q, c, i) => new Map(R.filter((r) => r[0] === `HQ=${q} ${c}`).map((r) => [r[1], +r[i]]));
function mwp(a, b) { // односторонний Манна-Уитни: a > b, точно
  const n = a.length, m = b.length; let U = 0; for (const x of a) for (const y of b) U += x > y ? 1 : x === y ? 0.5 : 0;
  let dp = Array.from({ length: n + 1 }, () => new Float64Array(n * m + 1)); dp[0][0] = 1;
  for (let i = 1; i <= n + m; i++) { const nd = Array.from({ length: n + 1 }, () => new Float64Array(n * m + 1));
    for (let k = 0; k <= Math.min(i, n); k++) for (let u = 0; u <= n * m; u++) { const v = dp[k][u]; if (!v) continue; if (k + 1 <= n) nd[k + 1][u + (i - 1 - k)] += v; nd[k][u] += v; } dp = nd; }
  const d = dp[n]; let t = 0, ge = 0; for (let u = 0; u <= n * m; u++) { t += d[u]; if (u >= Math.ceil(U)) ge += d[u]; } return { U, p: ge / t };
}
function wil(a, b) { // односторонний Уилкоксон: a > b парно
  const d = [...a.keys()].filter((k) => b.has(k)).map((k) => a.get(k) - b.get(k)).filter((x) => x !== 0), n = d.length;
  const o = d.map((x, i) => [Math.abs(x), i]).sort((x, y) => x[0] - y[0]), rk = new Array(n);
  for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) rk[o[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  const W = d.reduce((s, x, i) => s + (x > 0 ? rk[i] : 0), 0); let ge = 0;
  for (let m = 0; m < 1 << n; m++) { let s = 0; for (let i = 0; i < n; i++) if (m >> i & 1) s += rk[i]; if (s >= W - 1e-9) ge++; } return { W, p: ge / (1 << n) };
}
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
for (const q of ['0.005', '0.05']) console.log(`HQ=${q}: ` + ['n10', 'n30', 'n100', 'K2', 'LL'].map((c) => `${c} доход ${f(med([...col(q, c, 3).values()]))} взгляд ${f(med([...col(q, c, 4).values()]))}`).join(' | '));
for (const M of ['K2', 'LL']) {
  const a = mwp([...col('0.005', M, 4).values()], [...col('0.05', M, 4).values()]);
  const A = a.p < 0.01;
  let B = true; const bs = [];
  for (const n of ['n10', 'n30', 'n100']) { let hit = null; for (const q of ['0.005', '0.05']) { const t = wil(col(q, M, 3), col(q, n, 3)); if (t.p < 0.0083 && !hit) hit = `${q} (p=${t.p.toExponential(1)})`; }
    bs.push(`${n}: ${hit || 'нет'}`); if (!hit) B = false; }
  let V = true; const vs = [];
  for (const q of ['0.005', '0.05']) { const best = Math.max(...['n10', 'n30', 'n100'].map((n) => med([...col(q, n, 3).values()]))); const r = med([...col(q, M, 3).values()]) / best; vs.push(`${q}: ${f(r)}`); if (r < 0.9) V = false; }
  console.log(`\n${M}: А (взгляд в медленном мире чаще, чем в быстром) U=${a.U} p=${a.p.toExponential(1)} -> ${A ? 'да' : 'НЕТ'}; Б ${bs.join('; ')} -> ${B ? 'да' : 'НЕТ'}; В доля лучших часов ${vs.join(', ')} -> ${V ? 'да' : 'НЕТ'}  ==> ${A && B && V ? 'ВТОРАЯ ПОЛОВИНА СТРОКИ 6 ЕСТЬ' : 'нет'}`);
}

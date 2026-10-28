// Чтение ТЕЛО-1 (PRE_BODY1.md §5)
const R = require('fs').readFileSync('out/body1.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const col = (c, i) => new Map(R.filter((r) => r[0] === c).map((r) => [r[1], +r[i]]));
function wil1(d) { d = d.filter((x) => Number.isFinite(x) && x !== 0); const n = d.length; if (!n) return 1; const o = d.map((x, i) => [Math.abs(x), i]).sort((x, y) => x[0] - y[0]), rk = new Array(n);
  for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) rk[o[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  const W = d.reduce((s, x, i) => s + (x > 0 ? rk[i] : 0), 0); let ge = 0; for (let q = 0; q < 1 << n; q++) { let s = 0; for (let i = 0; i < n; i++) if (q >> i & 1) s += rk[i]; if (s >= W - 1e-9) ge++; } return ge / (1 << n); }
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const pair = (a, b, i, sgn = 1) => { const A = col(a, i), B = col(b, i), s = [...A.keys()].filter((k) => B.has(k)); const d = s.map((k) => sgn * (A.get(k) - B.get(k))); return { d, p: wil1(d), n: s.length }; };
const show = (c, i) => `${c} ${f(med([...col(c, i).values()]))}`;
console.log(`прогонов: ${R.length}`);
console.log(`\n1. ПОЛЗЁТ ЛИ К ЕДЕ (съедено на 1000 кругов): ${show('M', 2)}, ${show('M0', 2)}, Брайтенберг ${show('BR', 2)}`);
let t = pair('M', 'M0', 2); console.log(`   М > М0: медиана разности ${f(med(t.d))}, p = ${t.p.toExponential(2)} (n=${t.n}) -> ${t.p < 0.01 && med(t.d) > 0 ? 'ДА' : 'нет'}`);
console.log(`   индекс хемотаксиса (корр. слева−справа с поворотом): ${show('M', 4)}, ${show('M0', 4)}, ${show('BR', 4)}; по сидам М: ${[...col('M', 4).values()].map((x) => f(x, 2)).join(' ')}`);
console.log(`\n2. СТЕНКИ (касаний на 1000 кругов): ${show('M', 3)}, ${show('M0', 3)}, ${show('BR', 3)}`);
t = pair('M', 'M0', 3, -1); console.log(`   М < М0: медиана разности ${f(-med(t.d))}, p = ${t.p.toExponential(2)} -> ${t.p < 0.01 && med(t.d) > 0 ? 'ДА' : 'нет'}`);
const E = col('M', 9), L = col('M', 10), s = [...E.keys()];
const dh = s.map((k) => E.get(k) - L.get(k)), pe = wil1(s.map((k) => E.get(k))), pe2 = wil1(s.map((k) => -E.get(k)));
console.log(`\n3. ПРИВЫКАНИЕ К ВСПЫШКЕ (М): ответ в начале ${f(med([...E.values()]), 4)}, в конце ${f(med([...L.values()]), 4)}; ответ в начале отличен от 0: p = ${Math.min(1, 2 * Math.min(pe, pe2)).toExponential(2)}; падение: p = ${wil1(dh).toExponential(2)}`);
console.log(`   -> ${wil1(dh) < 0.01 && Math.min(1, 2 * Math.min(pe, pe2)) < 0.01 ? 'ПРИВЫКАНИЕ ЕСТЬ' : 'привыкания нет'}; М0: в начале ${f(med([...col('M0', 9).values()]), 4)}, в конце ${f(med([...col('M0', 10).values()]), 4)}`);
console.log(`\n4. ПАМЯТЬ МЕСТА (BFIX, съедено на 1000 кругов в блоках без запаха): ${show('FM', 8)}, ${show('FM0', 8)}, ${show('FBR', 8)}; всего: ${show('FM', 2)}, ${show('FM0', 2)}, ${show('FBR', 2)}`);
t = pair('FM', 'FM0', 8); console.log(`   FM > FM0 без запаха: медиана разности ${f(med(t.d))}, p = ${t.p.toExponential(2)} -> ${t.p < 0.01 && med(t.d) > 0 ? 'ДА' : 'нет'}`);
console.log(`\nмоторных частей живо во второй половине (ср., медиана по сидам): М ${show('M', 5)}, М0 ${show('M0', 5)}, FM ${show('FM', 5)}; мин. М ${Math.min(...col('M', 6).values())}`);

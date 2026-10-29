// чтение К1ж (ПЛАН_К1ж.md §3 с поправкой §6)
const L = (n) => JSON.parse(require('fs').readFileSync(__dirname + '/' + n)).res.sort((a, b) => a.seed - b.seed).map((r) => r.summary.xres);
function wil1(d) { d = d.filter((x) => Number.isFinite(x) && x !== 0); const n = d.length; if (!n) return 1; const o = d.map((x, i) => [Math.abs(x), i]).sort((x, y) => x[0] - y[0]), rk = new Array(n);
  for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) rk[o[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  const W = d.reduce((s, x, i) => s + (x > 0 ? rk[i] : 0), 0); let ge = 0; for (let q = 0; q < 1 << n; q++) { let s = 0; for (let i = 0; i < n; i++) if (q >> i & 1) s += rk[i]; if (s >= W - 1e-9) ge++; } return ge / (1 << n); }
const med = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const f = (x, d = 2) => x.toFixed(d), Zh = L('k1zh_Zh.json'), Z0 = L('k1zh_Zh0.json'), P = L('k1zh_P.json'), E2 = L('k1e_E2.json');
const fz = Zh.map((x) => x.food), fe = E2.map((x) => x.food), fp = med(P.map((x) => x.food));
console.log(`еда по мирам 1-8: Ж ${fz.map((x) => f(x, 1)).join(' ')} | Е2 без смерти ${fe.map((x) => f(x, 1)).join(' ')} | Ж0 ${Z0.map((x) => f(x.food, 1)).join(' ')} | П медиана ${f(fp, 1)}`);
const up = fz.filter((x, i) => x > fe[i]).length;
console.log(`1. Ж выше Е2 в ${up} мирах из 8 (порог 6); медиана Ж ${f(med(fz))} (порог ${f(fp / 2)}) -> ${up >= 6 && med(fz) >= fp / 2 ? 'ДА' : 'нет'}`);
const d1 = Zh.map((x) => x.deaths1), d2 = Zh.map((x) => x.deaths2), p2 = wil1(d1.map((x, i) => x - d2[i]));
console.log(`2. смертей на 1000: первая половина ${d1.map((x) => f(x)).join(' ')}; вторая ${d2.map((x) => f(x)).join(' ')}; вторая меньше: p = ${p2.toExponential(2)} -> ${p2 < 0.01 ? 'ДА' : 'нет'}`);
const fr = Zh.map((x) => x.fearB - x.fearA), p3 = wil1(fr);
console.log(`3. страх (прогноз смерти перед ней минус всегда): ${fr.map((x) => x.toFixed(4)).join(' ')}; больше 0 в ${fr.filter((x) => x > 0).length} из 8, p = ${p3.toExponential(2)} -> ${fr.filter((x) => x > 0).length >= 6 && p3 < 0.01 ? 'ДА' : 'нет'}`);
const z2 = Z0.map((x) => x.deaths2), p4 = wil1(z2.map((x, i) => x - d2[i]));
console.log(`4. смертей во второй половине: Ж ${d2.map((x) => f(x)).join(' ')} | Ж0 ${z2.map((x) => f(x)).join(' ')}; Ж меньше: p = ${p4.toExponential(2)} -> ${p4 < 0.05 ? 'ДА' : 'нет'}`);
console.log(`планка: смертей во второй половине ${P.map((x) => f(x.deaths2)).join(' ')}`);

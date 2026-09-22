#!/usr/bin/env node
'use strict';
/* ЛАНДШАФТ ЗАКОНОВ УЧЁБЫ -- проверка к neuron2.js (правки 3-4)
   Закон (a*s' - b*p)*x - c*w останавливается на весе w = a*(b*C + c*I)^-1 * E[s'x],
   где C -- связанность входов между собой. Считаем, сколько бит сжатия даёт этот вес
   в каждом канале, если часть видит свой датчик и всех настоящих родителей:
   LMS (b = a, c = 0) против законов с забыванием. Мир тот же, что в neuron2.js; a = 1. */
function landscape(RHO, MIX) {
  let seed = 7; const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const g = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
  const K3 = Math.sqrt(1 + MIX * MIX + 2 * MIX * RHO), K4 = Math.sqrt(1 + MIX * MIX - 2 * MIX * RHO);
  const C34 = (RHO - MIX * RHO + MIX - MIX * MIX * RHO) / (K3 * K4), K7 = Math.sqrt(1 + MIX * MIX - 2 * MIX * C34);
  const PAR = { 3: [0, 1], 4: [1, 2], 5: [0, 2], 6: [3], 7: [3, 4] }, T = 200000, sens = [];
  let c = new Array(8).fill(0);
  for (let t = 0; t < T; t++) {
    const n = new Array(8), gc = g();
    for (let k = 0; k < 3; k++) n[k] = 0.5 * c[k] + Math.sqrt(0.75) * (Math.sqrt(RHO) * gc + Math.sqrt(1 - RHO) * g());
    n[3] = (c[0] + MIX * c[1]) / K3; n[4] = (c[1] - MIX * c[2]) / K4; n[5] = (c[0] - MIX * c[2]) / K4;
    n[6] = c[3]; n[7] = (c[3] - MIX * c[4]) / K7;
    c = n; sens.push(c.map((v) => v + 0.1 * g()));   // что видят датчики
  }
  const solve = (A, b) => { const n = b.length, M = A.map((row, i) => [...row, b[i]]);
    for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
      [M[i], M[p]] = [M[p], M[i]];
      for (let k = 0; k < n; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; } }
    return M.map((row, i) => row[n] / M[i][i]); };
  const lines = [];
  for (const ch of [3, 4, 5, 6, 7]) {
    const idx = [ch, ...PAR[ch]], d = idx.length, m = T - 1001;
    const C = [...Array(d)].map(() => new Array(d).fill(0)), rv = new Array(d).fill(0); let vy = 0;
    for (let t = 1000; t < T - 1; t++) {
      const x = idx.map((k) => sens[t][k]), y = sens[t + 1][ch];
      for (let i = 0; i < d; i++) { rv[i] += y * x[i] / m; for (let j = 0; j < d; j++) C[i][j] += x[i] * x[j] / m; }
      vy += y * y / m;
    }
    const bits = (b, cc) => { const w = solve(C.map((row, i) => row.map((v, j) => b * v + (i === j ? cc : 0))), rv);
      let e = vy; for (let i = 0; i < d; i++) { e -= 2 * w[i] * rv[i]; for (let j = 0; j < d; j++) e += w[i] * C[i][j] * w[j]; }
      return 0.5 * Math.log2(1.01 / Math.max(e, 1e-9)); };
    const best = (lo, hi) => { let v = -9; for (let cc = lo; cc <= hi + 1e-9; cc += 0.05) for (let b = 0; b <= 1.5; b += 0.01) v = Math.max(v, bits(b, cc)); return v; };
    lines.push(`  канал ${ch}: LMS ${bits(1, 0).toFixed(2)} | лучший при c/a 0.1: ${best(0.1, 0.1).toFixed(2)} | лучший при c/a от 0.3: ${best(0.3, 3).toFixed(2)}`);
  }
  return lines.join('\n');
}
console.log('Бит сжатия у неподвижной точки закона (чем больше, тем лучше)\n');
console.log('старый мир (RHO 0, MIX 1):\n' + landscape(0, 1) + '\n');
console.log('связанный мир (RHO 0.7, MIX 0.5):\n' + landscape(0.7, 0.5));

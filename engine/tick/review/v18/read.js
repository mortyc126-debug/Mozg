// Чтение по §4: ранговый критерий (точный Манна-Уитни) для доли верных действий
const fs = require('fs');
const rows = fs.readFileSync('out/loop.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const K = ['cond','seed','share','rate','winners','burn','varF','sf','relay','bare','nRelay','nBare','acts','aliveF','gAct','net','give','alive','bitsX','bits9','right','nul','byK'];
const D = rows.map((r) => Object.fromEntries(K.map((k, i) => [k, i < 2 || k === 'byK' ? r[i] : +r[i]])));
const by = (c) => D.filter((d) => d.cond === c);
const med = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length;
  return n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2; };
// точный Манна-Уитни: распределение U при n,m
function mwExact(n, m) {
  let f = [1];                               // число размещений с данным U
  for (let i = 1; i <= n; i++) {             // стандартная рекурсия по числу разбиений
    const g = new Array(i * m + 1).fill(0);
    for (let u = 0; u < g.length; u++) { /* заполним ниже */ }
    f = f;
  }
  // проще: динамика по числу выборок
  const N = n + m, max = n * m;
  let dp = Array.from({ length: n + 1 }, () => new Float64Array(max + 1));
  dp[0][0] = 1;
  for (let i = 1; i <= N; i++) {
    const nd = Array.from({ length: n + 1 }, () => new Float64Array(max + 1));
    for (let k = 0; k <= Math.min(i, n); k++) for (let u = 0; u <= max; u++) {
      const v = dp[k][u]; if (!v) continue;
      if (k + 1 <= n) nd[k + 1][u + (i - 1 - k)] += v;   // этот ранг -- из первой выборки
      nd[k][u] += v;                                      // из второй
    }
    dp = nd;
  }
  return dp[n];
}
function mw(a, b) {                          // односторонний: верно ли, что a больше b
  const n = a.length, m = b.length;
  let U = 0; for (const x of a) for (const y of b) U += x > y ? 1 : x === y ? 0.5 : 0;
  const dist = mwExact(n, m);
  let tot = 0; for (let u = 0; u <= n * m; u++) tot += dist[u];
  let ge = 0; for (let u = Math.ceil(U); u <= n * m; u++) ge += dist[u];
  return { U, p: ge / tot };
}
const P = by('петля').map((d) => d.share), A = by('нульА').map((d) => d.share),
      B = by('нульБ').map((d) => d.share), V = by('нульВ').map((d) => d.share);
const fmt = (a) => a.map((x) => (100 * x).toFixed(1)).sort((x, y) => x - y).join(' ');
console.log('ДОЛЯ ВЕРНЫХ ДЕЙСТВИЙ по сидам, %');
console.log('  петля:', fmt(P), '| медиана', (100 * med(P)).toFixed(1));
console.log('  нуль А:', fmt(A), '| медиана', (100 * med(A)).toFixed(1));
console.log('  нуль Б:', fmt(B), '| медиана', (100 * med(B)).toFixed(1));
console.log('  нуль В:', fmt(V), '| медиана', (100 * med(V)).toFixed(1));
const rA = mw(P, A), rB = mw(P, B), rV = mw(P, V);
console.log(`\nпетля против нуля А: U = ${rA.U}, p = ${rA.p.toExponential(2)}  (нужно p < 0.01)`);
console.log(`петля против нуля Б: U = ${rB.U}, p = ${rB.p.toExponential(2)}  (нужно p < 0.01)`);
console.log(`петля против нуля В: U = ${rV.U}, p = ${rV.p.toExponential(2)}  (для чтения, не для зачёта)`);
console.log(`\nразница медиан: с нулём А ${(100*(med(P)-med(A))).toFixed(1)} п.п., с нулём Б ${(100*(med(P)-med(B))).toFixed(1)} п.п., с нулём В ${(100*(med(P)-med(V))).toFixed(1)} п.п.`);
console.log(`пол 25.0%, потолок при LOOP=0.5 -- 62.5%`);
for (const c of ['петля','нульА','нульБ','нульВ']) { const d = by(c);
  const M = (k, p = 2) => med(d.map((x) => x[k])).toFixed(p);
  console.log(`\n${c}: действий на добытчика ${M('rate',3)} | ген частоты ${M('gAct')} | живых добытчиков ${M('aliveF')}/8` +
    ` | угадавших зараз ${M('winners')} | фонд сгорел ${(100*med(d.map(x=>x.burn))).toFixed(0)}%` +
    ` | самосогл. место ${(100*med(d.map(x=>x.sf))).toFixed(0)}% | дисперсия F ${M('varF')}` +
    `\n   с передатчиком ${(100*med(d.map(x=>x.relay))).toFixed(1)}% против ${(100*med(d.map(x=>x.bare))).toFixed(1)}% без` +
    ` | всего живых ${M('alive',0)} | бит у 3-7 ${M('bitsX')} | вес на верных ${(100*med(d.map(x=>x.right))).toFixed(0)}% (нуль ${(100*med(d.map(x=>x.nul))).toFixed(0)}%)`);
}

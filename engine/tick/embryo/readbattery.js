function mwE(n, m) { const max = n*m, N = n+m; let dp = Array.from({length: n+1}, () => new Float64Array(max+1)); dp[0][0] = 1;
  for (let i = 1; i <= N; i++) { const nd = Array.from({length: n+1}, () => new Float64Array(max+1));
    for (let k = 0; k <= Math.min(i, n); k++) for (let u = 0; u <= max; u++) { const v = dp[k][u]; if (!v) continue;
      if (k+1 <= n) nd[k+1][u+(i-1-k)] += v; nd[k][u] += v; } dp = nd; } return dp[n]; }
function mw(a, b) { const n = a.length, m = b.length; let U = 0; for (const x of a) for (const y of b) U += x > y ? 1 : x === y ? 0.5 : 0;
  const d = mwE(n, m); let t = 0; for (let u = 0; u <= n*m; u++) t += d[u]; let ge = 0; for (let u = Math.ceil(U); u <= n*m; u++) ge += d[u];
  return { U, p: ge / t }; }
const fs = require('fs');
const FILE = process.argv[2] || 'out/battery.tsv', RULEB = process.argv[3] || '1';
const L = fs.readFileSync(FILE, 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const E = L.filter((r) => r[0] === 'зародыш').sort((a, b) => a[1] - b[1]).map((r) => ({ seed: +r[1], alive: +r[2], right: +r[3], nul: +r[4], b9: +r[5], hold9: +r[6], kept: +r[7], ch: r[8].split(',').map(Number), food: +r[9], H10: +r[10], H30: +r[11], Rmix: +r[12], RS: +r[13] }));
const N = new Map(L.filter((r) => r[0] === 'нульА').map((r) => [+r[1], +r[2]]));
const dead = E.filter((e) => !(e.alive > 0)).map((e) => e.seed), live = E.filter((e) => e.alive > 0);
const m = (k) => med(live.map((e) => e[k]));
const rows = [];
const put = (line, name, status, detail) => rows.push({ line, name, status, detail });
const h10 = m('H10'), h30 = m('H30');
put(0, 'живёт между касаниями', h10 >= 0.5 && h30 >= 0.5 ? 'ЕСТЬ' : 'нет', `H(10) ${f(h10)}, H(30) ${f(h30)} (порог 0.5)`);
put(1, 'принимает мир', 'дана', 'конструкцией мира');
put(2, 'держит след опыта', m('right') >= 0.95 ? 'ЕСТЬ' : 'нет', `вес на верных связях ${f(100 * m('right'), 1)}% (порог 95%, нуль ${f(100 * m('nul'), 1)}%)`);
// путь В: в прогоне 1 -- удержание и смена состава; с шага 48 -- только удержание (смена состава оказалась полной всегда)
const pathB = live.filter((e) => e.hold9 >= 0.9 && (RULEB === '2' || e.kept <= 0.5)).length;
put('3В', 'след во времени, путь В', pathB >= 6 ? 'ЕСТЬ' : 'нет', `в ${pathB} сидах из 12 канал 9 держит прошлое в 90% замеров${RULEB === '2' ? '' : ' при смене большей части состава'} (порог 6); доля замеров медиана ${f(m('hold9'), 2)}, дожило частей медиана ${f(m('kept'), 2)}`);
put('3', 'след во времени, прямо', m('Rmix') >= 0.9 && m('RS') >= 0.9 ? 'ЕСТЬ' : 'нет', `после 100 кругов свободной активности R смеси ${f(m('Rmix'))}, канал S ${f(m('RS'))} (порог 0.9)`);
const n4 = live.filter((e) => e.b9 > 0.6).length;
put(4, 'проводит на расстояние', n4 >= 6 ? 'ЕСТЬ' : 'нет', `bits9 > 0.6 в ${n4} сидах из 12 (порог 6), медиана ${f(m('b9'))}`);
put(5, 'собственное прошлое', 'нет', 'меры нет');
const fa = live.map((e) => e.food), fn = live.map((e) => N.get(e.seed)), t6 = mw(fa, fn);
put(6, 'действует и различает удачу', t6.p < 0.01 ? 'наполовину' : 'нет', `доля верных действий ${f(100 * med(fa), 1)}% против жребия ${f(100 * med(fn), 1)}%, U = ${t6.U}, p = ${t6.p.toExponential(1)} (порог 0.01)`);
const b7 = med(live.map((e) => med(e.ch)));
put(7, 'сводит два входа', b7 >= 1.5 ? 'ЕСТЬ' : 'нет', `биты каналов 3,4,5,7 ${f(b7, 2)} (порог 1.5; потолок одного входа 0.68, двух 2.55-2.83)`);
put(8, 'различает порядок', 'нет', 'меры нет');
console.log(`вымерших миров: ${dead.length ? dead.join(' ') : 'нет'}; живых частей медиана ${med(live.map((e) => e.alive))}\n`);
for (const r of rows) console.log(`${String(r.line).padEnd(3)} ${r.name.padEnd(28)} ${r.status.padEnd(11)} ${r.detail}`);
console.log('\nпо сидам:');
for (const e of E) console.log(`  ${e.seed}: живых ${e.alive}, H ${f(e.H10, 2)}/${f(e.H30, 2)}, верные ${f(100 * e.right, 0)}%, bits9 ${f(e.b9, 2)} (держит ${f(e.hold9, 2)}, дожило ${f(e.kept, 2)}), биты 3,4,5,7 ${e.ch.map((x) => f(x, 2)).join('/')}, еда ${f(100 * e.food, 1)}% (жребий ${f(100 * N.get(e.seed), 1)}%), R ${f(e.Rmix, 2)}/${f(e.RS, 2)}`);
module.exports = rows;

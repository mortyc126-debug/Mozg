const fs = require('fs');
const R = fs.readFileSync('out/pause65.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t').map(Number));
const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const main = R.filter((r) => r[0] !== 3809), d3809 = R.filter((r) => r[0] === 3809);
const G = ['медленный', 'источники 0-2 и 8', 'смеси 3-7', 'канал 9', 'еда'];
for (const [name, A] of [['сиды 3901-3912', main], ['сид 3809 (описательно)', d3809]]) {
  const un = A.filter((r) => r[2] > 1), boom = A.filter((r) => r[4] > 2);
  console.log(`${name}: пауз ${A.length}, радиус > 1 в ${un.length} (${f(100 * un.length / A.length, 1)}%), взорвалось (разгон > 2) ${boom.length}; радиус медиана ${f(med(A.map((r) => r[2])))}, наибольший ${f(Math.max(...A.map((r) => r[2])))}`);
  if (un.length) {
    console.log(`   в неустойчивых: доли ведущего вектора (медианы) -- ${G.map((g, i) => `${g} ${f(med(un.map((r) => r[5 + i])))}`).join(', ')}`);
    console.log(`   радиус одних петель медленного канала > 1: ${un.filter((r) => r[3] > 1).length} из ${un.length}; наибольшее |wSelf+ws| -- медиана ${f(med(un.map((r) => r[10])))}; частей медленного канала -- медиана ${med(un.map((r) => r[11]))}`);
    console.log(`   по паузам: ${un.slice(0, 12).map((r) => `[${r[0]}:${r[1]} r=${f(r[2])} rS=${f(r[3])} разгон=${r[4].toExponential(1)}]`).join(' ')}`);
  }
}
const pred = (r) => Math.pow(r[2], 30) > 2, boom = (r) => r[4] > 2;
const tp = main.filter((r) => pred(r) && boom(r)).length, tn = main.filter((r) => !pred(r) && !boom(r)).length, nb = main.filter(boom).length;
const acc = (tp + tn) / main.length, rec = nb ? tp / nb : NaN;
const un = main.filter((r) => r[2] > 1);
const shm = [0, 1, 2, 3, 4].map((i) => med(un.map((r) => r[5 + i]))), top = shm.indexOf(Math.max(...shm));
const loopS = un.length ? un.filter((r) => r[3] > 1).length / un.length : NaN;
console.log(`\n1. радиус объясняет взрывы: точность ${f(acc)}, из взорвавшихся предсказано ${f(rec)} (${tp}/${nb}) -> ${acc >= 0.9 && (nb === 0 || rec >= 0.8) ? 'да' : 'нет'}${nb === 0 ? ' (взрывов не было)' : ''}`);
console.log(`2. где неустойчивость: ${un.length ? (shm[top] >= 0.5 ? G[top] + ' (' + f(shm[top]) + ')' : 'смешанная') : 'неустойчивых пауз нет'}`);
console.log(`3. петля внутри медленного канала: ${un.length ? f(loopS) + ' неустойчивых пауз -> ' + (loopS >= 0.5 ? 'да' : 'нет') : '--'}`);

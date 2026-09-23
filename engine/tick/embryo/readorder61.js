const fs = require('fs');
const R = fs.readFileSync('out/order61.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const rows = (c) => R.filter((r) => r[0] === c).sort((a, b) => a[1] - b[1]);
for (const c of ['порядок', 'нуль']) {
  const A = rows(c);
  console.log(`${c}: доля верного знака у ткани -- медиана ${f(med(A.map((r) => +r[2])))} (по сидам ${A.map((r) => f(+r[2], 2)).join(' ')}); линейный предсказатель ${f(med(A.map((r) => +r[4])))}; живых частей ${med(A.map((r) => +r[6]))}, в канале Q ${med(A.map((r) => +r[7]))}; отчётов на сид ${med(A.map((r) => +r[5]))}`);
}
const P = rows('порядок'), Nn = rows('нуль');
const dead = R.filter((r) => !(+r[6] > 0)).map((r) => r[0] + ' ' + r[1]);
const okPos = med(P.map((r) => +r[4])) >= 0.85, nm = med(Nn.map((r) => +r[2])), okNul = nm >= 0.45 && nm <= 0.55, okG = !dead.length;
console.log(`\nпроверки меры: положительный отсчёт (линейный предсказатель >= 0.85) ${okPos ? 'выполнен' : 'НЕ выполнен'}; нуль (0.45-0.55) ${okNul ? 'выполнен' : 'НЕ выполнен'}; страж (не вымер) ${okG ? 'выполнен' : 'НЕ выполнен: ' + dead.join(', ')}`);
const m = med(P.map((r) => +r[2]));
console.log(`СТРОКА 8: доля верного знака ${f(m)} (порог 0.75) -> ${!(okPos && okNul && okG) ? 'мера не читается' : m >= 0.75 ? 'ЕСТЬ' : 'НЕТ'}`);

// Чтение шага 95, строка 8: доля верного знака и нуль в каждом варианте единого мира
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
for (const v of ['U1', 'U2']) {
  const R = require('fs').readFileSync(`out/order95_${v}.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t'));
  const P = R.filter((r) => r[0] === 'порядок'), Z = R.filter((r) => r[0] === 'нуль');
  const m = med(P.map((r) => +r[2])), nz = med(Z.map((r) => +r[2])), pr = med(P.map((r) => +r[4]));
  console.log(`${v}: строка 8 ${m.toFixed(3)} (по сидам ${P.sort((a, b) => a[1] - b[1]).map((r) => (+r[2]).toFixed(2)).join(' ')}), нуль ${nz.toFixed(3)}, предсказатель ${pr.toFixed(3)}, частей Q ${med(P.map((r) => +r[7]))}, с линиями к A и B ${med(P.map((r) => +r[8])).toFixed(2)}, возраст Q ${med(P.map((r) => +r[10]))} -> ${m >= 0.75 && nz >= 0.45 && nz <= 0.55 && pr >= 0.85 ? 'ЕСТЬ' : 'НЕТ'}`);
}

const fs = require('fs');
const R = fs.readFileSync('out/trace50.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const col = (c, F, i) => R.filter((r) => r[0] === c && +r[2] === F).sort((a, b) => a[1] - b[1]).map((r) => +r[i]);
console.log('условие       F    | R смеси | R канал S | части пережили | связи пережили | живых: до / мин / конец');
const C = [['оба', 100], ['оба', 300], ['оба', 1000]];
for (const [c, F] of C) {
  console.log(`${c.padEnd(8)} ${String(F).padStart(5)} | ${f(med(col(c, F, 3))).padStart(7)} | ${f(med(col(c, F, 4))).padStart(9)} | ${f(med(col(c, F, 9)), 2).padStart(14)} | ${f(med(col(c, F, 10)), 2).padStart(14)} | ${med(col(c, F, 11))} / ${med(col(c, F, 12))} / ${med(col(c, F, 13))}`);
  console.log(`                    R смеси по сидам: ${col(c, F, 3).map((x) => f(x, 2)).join(' ')}`);
}
const ok = (F) => med(col('оба', F, 3)) >= 0.9 && med(col('оба', F, 4)) >= 0.9;
const Fs = [100, 300, 1000].filter(ok);
console.log(`\nСТРОКА 3 по полному правилу шага 46: ${Fs.length === 3 ? 'ЕСТЬ' : Fs.length ? 'срок хранения ' + Math.max(...Fs) + ' кругов' : 'НЕТ'}  (по F: ${[100, 300, 1000].map((F) => `${F}: ${ok(F) ? 'да' : 'нет'}`).join(', ')})`);

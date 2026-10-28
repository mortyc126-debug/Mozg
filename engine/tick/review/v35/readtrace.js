const fs = require('fs');
const R = fs.readFileSync('out/trace.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const col = (c, i) => R.filter((r) => r[0] === c).sort((a, b) => a[1] - b[1]).map((r) => +r[i]);
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
console.log('условие    | R смеси 3-7 | R канал S | MSE смеси до/после | MSE S до/после | части пережили | связи пережили | живых: до / мин / конец');
const C = ['Ф0', 'Ф100', 'Ф300', 'Ф1000', 'Ф1000-с', 'Ф1000-х'];
for (const c of C) {
  console.log(`${c.padEnd(10)} | ${f(med(col(c, 3))).padStart(11)} | ${f(med(col(c, 4))).padStart(9)} | ${f(med(col(c, 5)))} / ${f(med(col(c, 6)))} | ${f(med(col(c, 7)))} / ${f(med(col(c, 8)))} | ${f(med(col(c, 9)), 2).padStart(14)} | ${f(med(col(c, 10)), 2).padStart(14)} | ${med(col(c, 11))} / ${med(col(c, 12))} / ${med(col(c, 13))}`);
  console.log(`             R смеси по сидам: ${col(c, 3).map((x) => f(x, 2)).join(' ')}\n             R S по сидам:     ${col(c, 4).map((x) => f(x, 2)).join(' ')}`);
}
const ok = (c) => med(col(c, 3)) >= 0.9 && med(col(c, 4)) >= 0.9;
console.log(`\nПРОВЕРКА МЕРЫ (Ф0: R >= 0.9 в обеих группах): ${ok('Ф0') ? 'выполнена' : 'НЕ выполнена -- чтения нет'}`);
const Fs = [['Ф100', 100], ['Ф300', 300], ['Ф1000', 1000]].filter(([c]) => ok(c)).map(([, F]) => F);
const all = ok('Ф100') && ok('Ф300') && ok('Ф1000');
console.log(`СТРОКА 3: ${all ? 'ЕСТЬ' : Fs.length ? 'срок хранения ' + Math.max(...Fs) + ' кругов' : 'НЕТ -- приобретённое не переживает и ста кругов свободной активности'}`);
console.log(`   по F: ${['Ф100', 'Ф300', 'Ф1000'].map((c) => `${c}: ${ok(c) ? 'да' : 'нет'}`).join(', ')}`);

const fs = require('fs');
const R = fs.readFileSync('out/pause.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const K = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500];
const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2; };
for (const kind of ['сеть', 'отрезано']) {
  const rows = R.filter((r) => r[1] === kind);
  const at = (i, k) => rows.map((r) => +r[4 + K.indexOf(k)].split(':')[i]);
  console.log(`\n${kind === 'сеть' ? 'СЕТЬ КАК ЕСТЬ' : 'ПУСТОЙ ОТСЧЁТ (связи отрезаны)'}, ${rows.length} сидов -- медиана по сидам, доля от уровня до паузы`);
  console.log('  круг паузы:   ' + K.map((k) => String(k).padStart(9)).join(''));
  console.log('  прогнозы:     ' + K.map((k) => med(at(1, k)).toExponential(1).padStart(9)).join(''));
  console.log('  сигналы:      ' + K.map((k) => med(at(2, k)).toExponential(1).padStart(9)).join(''));
  console.log('  память:       ' + K.map((k) => med(at(3, k)).toFixed(2).padStart(9)).join(''));
  if (kind === 'сеть') {
    const quiet = rows.filter((r, i) => at(1, 10)[i] < 0.01 && at(2, 10)[i] < 0.01).length;
    const alive = rows.filter((r, i) => at(1, 200)[i] > 0.1 || at(2, 200)[i] > 0.1).length;
    console.log(`\n  ТИШИНА (обе ниже 1% к 10-му кругу): ${quiet} из 12 -- нужно >= 10`);
    console.log(`  ЖИЗНЬ (хоть одна выше 10% на 200-м кругу): ${alive} из 12 -- нужно >= 10`);
    console.log(`  по сидам на 200-м кругу (прогнозы / сигналы): ` + rows.map((r, i) => `${at(1, 200)[i].toExponential(1)}/${at(2, 200)[i].toExponential(1)}`).join('  '));
    // полупериод по прогнозам: первый круг, где доля ниже 0.5
    const half = rows.map((r) => { const v = K.map((k) => +r[4 + K.indexOf(k)].split(':')[1]); const i = v.findIndex((x) => x < 0.5); return i < 0 ? '>500' : K[i]; });
    console.log(`  первый замер ниже половины (прогнозы): ${half.join(' ')}`);
  }
}

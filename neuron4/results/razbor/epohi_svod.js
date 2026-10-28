// Сводка мира эпох со спячкой и без против порогов раунда 9 (results/round9/ИТОГ_промежуточный.md, этап 3), записанных до прогона:
//   1) возврат мира -- точность в первые 1 000 кругов эпохи второго круга -- не меньше 80% для всех четырёх миров;
//   2) цена эпохи второго круга -- не больше 1.1 x цены мозга одного мира (вторая эпоха EPONLY);
//   3) экзамены не хуже раунда 8 -- здесь не меряется.
// Прогоны (папка epohi/, команды -- в epohi/КОМАНДЫ.txt): nohib_sN, hib1_sN, hib2_sN (64 000 кругов, EPL=8000), onlyW_sN (16 000).
//   node results/razbor/epohi_svod.js [ПАПКА]
const fs = require('fs'), path = require('path');
const D = process.argv[2] || path.join(__dirname, 'epohi'), rd = (f) => { const p = path.join(D, f + '.json'); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const W = ['факт', 'память', 'счёт', 'до метки'], P = (x) => `${(100 * x).toFixed(0)}%`.padStart(5), K = (x) => `${(x / 1000).toFixed(0)}к`.padStart(5);
const seeds = [1, 2, 3, 4, 5, 6, 7, 8].filter((s) => rd(`nohib_s${s}`));
for (const s of seeds) {
  console.log(`\nмир ${s}${s <= 2 ? ' (пороги -- по мирам 1-2)' : ''}`);
  console.log(`  ${'мир эпохи'.padEnd(9)}  ${'возврат: без / HIB=1 / HIB=2'.padEnd(26)}  ${'1-й круг, конец'.padEnd(20)}  ${'цена 2-го круга'.padEnd(20)}  один мир`);
  W.forEach((w, i) => {
    const r = (v) => rd(`${v}_s${s}`), only = rd(`only${i}_s${s}`), base = only ? only[1].opsRound : NaN;
    const cell = (sel) => ['nohib', 'hib1', 'hib2'].map((v) => { const x = r(v); return x ? sel(x) : '  -  '; }).join(' /');
    console.log(`  ${w.padEnd(9)}  ${cell((x) => P(x[4 + i].early))}       ${cell((x) => P(x[i].late))}  ${cell((x) => K(x[4 + i].opsRound))}  ${only ? K(base) : '  -'}`);
  });
}
// пороги
for (const v of ['nohib', 'hib1', 'hib2']) {
  const ss = [1, 2].filter((s) => rd(`${v}_s${s}`)); if (!ss.length) continue; let ret = true, cost = true, nc = 0; const why = [], whyC = [];
  for (const s of ss) { const x = rd(`${v}_s${s}`); W.forEach((w, i) => { if (x[4 + i].early < 0.8) { ret = false; why.push(`${w} мир ${s} ${P(x[4 + i].early).trim()}`); }
    const o = rd(`only${i}_s${s}`); if (!o) return; nc++; if (x[4 + i].opsRound > 1.1 * o[1].opsRound) { cost = false; whyC.push(`${w} мир ${s} ${(x[4 + i].opsRound / o[1].opsRound).toFixed(2)}x`); } }); }
  console.log(`\n${v}: порог возврата ${ret ? 'взят' : 'НЕ взят'}${ret ? '' : ' (' + why.join(', ') + ')'}; порог цены ${!nc ? 'не мерен (нет onlyW_sN)' : cost ? 'взят' : 'НЕ взят (' + whyC.join(', ') + ')'}`);
}

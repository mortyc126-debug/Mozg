#!/usr/bin/env node
'use strict';
/* Сводка по четырём частям опыта own.js. Правило не пересказывается
   вольно, а применяется буквально -- оно объявлено в заголовке own.js и
   закоммичено до запуска. */
const fs = require('fs');

const rows = [];
for (const f of fs.readdirSync('results').filter((x) => /^own_\d+\.jsonl$/.test(x)))
  for (const line of fs.readFileSync(`results/${f}`, 'utf8').trim().split('\n'))
    rows.push(JSON.parse(line));
rows.sort((a, b) => a.i - b.i);

const live = rows.filter((r) => r.alive);
console.log('ЖИВЁТ ЛИ ТКАНЬ СВОИМ -- свежие сиды 9500-10099');
console.log(`мутантов ${rows.length}, живых ${live.length} ` +
  `(${(live.length / rows.length * 100).toFixed(1)}%)\n`);

const tally = {};
for (const r of live) tally[r.cls] = (tally[r.cls] || 0) + 1;
for (const k of ['ЖИВЁТ СВОИМ', 'ЭХО ПО СВЯЗЯМ', 'ЖИВЁТ ЧУЖИМ', 'НЕ РАЗДЕЛЕНО'])
  console.log(`  ${k}: ${tally[k] || 0}`);

const own = live.filter((r) => r.cls === 'ЖИВЁТ СВОИМ');
if (own.length) {
  console.log('\nживущие своим -- петля порвана с обоих концов:');
  console.log('    № | стреляло | нагрузка | глухота | немота | градиент | ресурс | всё');
  for (const r of own)
    console.log(`${String(r.i).padStart(5)} | ${(r.asis.share * 100).toFixed(0).padStart(7)}% | ` +
      `${(r.asis.per * 100).toFixed(0).padStart(7)}% | ${r.rOwn.toFixed(2).padStart(7)} | ` +
      `${r.rMute.toFixed(2).padStart(6)} | ${r.rGrad.toFixed(2).padStart(8)} | ` +
      `${r.rRes.toFixed(2).padStart(6)} | ${r.rAll.toFixed(2)}`);
}

const echo = tally['ЭХО ПО СВЯЗЯМ'] || 0;
console.log(`\nПРОВЕРКА СПЕЦИФИЧНОСТИ: тканей, не заметивших полной глухоты -- ${echo}`);
if (echo === 0) {
  console.log('вмешательство гасит ВСЕХ -- оно слишком грубое, ВЕРДИКТ НЕ ВЫНОСИТСЯ');
} else {
  let v;
  if (own.length >= 5) v = 'ПОКАЗАНО: ткань, живущая своим, существует и не единична';
  else if (own.length === 0) v = 'НЕ ПОКАЗАНО: ни одной ткани, живущей своим';
  else v = `НЕ РАЗРЕШЕНО: таких ${own.length} при объявленном пороге 5`;
  console.log(`\n${v}`);
}
console.log(`доля живущих своим среди живых: ` +
  `${live.length ? ((own.length / live.length) * 100).toFixed(1) : 0}%`);
console.log('ЭТО НЕ ОТБОР: мутанты ни с чем не соревновались.');

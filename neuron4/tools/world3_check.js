// Сверка: схема мира-смеси нейрона-4 (src/world3.js) совпадает со схемой нейрона-3 (ref/neuron3.js, WMIX=1) -- виды каналов,
// родители, коэффициенты, источники и задержки глубоких каналов, нормы смесей -- при данных WK и WSEED.
// (До разбора 22.10 сверялись только виды каналов, хотя шапка обещала всё; теперь -- все поля SCHEMA нейрона-3.)
//   node tools/world3_check.js [WK ...]
const path = require('path'), { execFileSync } = require('child_process');
if (process.env.W3CHILD) {   // в нейроне-3 ручки читаются при загрузке -- поэтому отдельный процесс
  const m = require(path.join(__dirname, '..', 'ref', 'neuron3.js')), S = m.SCHEMA;
  console.log(JSON.stringify({ type: S.type, parents: S.parents, coef: S.coef, dsrc: S.dsrc, dD: S.dD, norm: Array.from(S.norm || []) })); process.exit(0);
}
const { makeSchema, mixKnobs } = require('../src/world3');
let bad = 0;
for (const K of (process.argv.slice(2).length ? process.argv.slice(2) : ['32', '128', '512']).map(Number)) for (const WS of [1, 2]) {
  const ref = JSON.parse(execFileSync('node', [__filename], { env: { ...process.env, W3CHILD: '1', WORLD: '2', WMIX: '1', WK: String(K), WSEED: String(WS), SEEDS: '1' }, maxBuffer: 1 << 26 }).toString().trim().split('\n').pop());
  const S = makeSchema(mixKnobs(K), WS), diff = [];
  for (const f of ['type', 'parents', 'coef', 'dsrc', 'dD']) if (JSON.stringify(S[f]) !== JSON.stringify(ref[f])) diff.push(f);
  if (ref.norm.length !== S.norm.length || ref.norm.some((v, i) => Math.abs(v - S.norm[i]) > 1e-12)) diff.push('norm');
  if (diff.length) bad++;
  const cnt = {}; for (const t of S.type) cnt[t] = (cnt[t] || 0) + 1;
  console.log(`  ${diff.length ? 'НЕТ' : 'ok '} WK=${K} WSEED=${WS}: ${Object.entries(cnt).map(([t, n]) => `${t} ${n}`).join(', ')}; задержки ${S.deepCh.map((k) => S.dD[k]).join(',')}${diff.length ? ' -- не совпало: ' + diff.join(', ') : ' -- совпали виды, родители, коэффициенты, задержки, нормы'}`);
}
process.exit(bad ? 1 : 0);

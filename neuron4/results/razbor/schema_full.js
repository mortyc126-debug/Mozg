// Полная сверка схемы мира-смеси: не только виды каналов (как tools/world3_check.js), но и родители, коэффициенты, задержки, нормы
const path = require('path'), { execFileSync } = require('child_process'), R = path.join(__dirname, '../..');
if (process.env.CHILD) { const m = require(R + '/ref/neuron3.js'); const S = m.SCHEMA; console.log(JSON.stringify({ type: S.type, parents: S.parents, coef: S.coef, dsrc: S.dsrc, dD: S.dD, norm: Array.from(S.norm || []) })); process.exit(0); }
const { makeSchema, mixKnobs } = require(R + '/src/world3');
for (const K of [32, 128]) for (const WS of [1, 2]) {
  const ref = JSON.parse(execFileSync('node', [__filename], { env: { ...process.env, CHILD: '1', WORLD: '2', WMIX: '1', WK: String(K), WSEED: String(WS), SEEDS: '1' } }).toString().trim().split('\n').pop());
  const S = makeSchema(mixKnobs(K), WS), cmp = {};
  for (const f of ['type', 'parents', 'coef', 'dsrc', 'dD']) cmp[f] = JSON.stringify(S[f]) === JSON.stringify(ref[f]);
  cmp.norm = ref.norm.length ? ref.norm.every((v, i) => Math.abs(v - S.norm[i]) < 1e-12) : 'нет у нейрона-3';
  console.log(`WK=${K} WSEED=${WS}:`, JSON.stringify(cmp));
}

// Опыт «неизвестный орган» (нейрон-4). Варианты на одних мирах (жребий мира у вариантов общий -- сравнение парное):
//   A -- без устройств (DEV=0)                       B -- устройства есть, исследователя нет (EXPL=0): выходной нерв молчит
//   C -- мозг: исследователь и моторные органы       D -- вшитый потолок: команда по истинной модели конечности (EXPL=2)
//   E -- пересадка на круге 12 000: знак усиления обратный      F -- пересадка: ещё и двигатель с чувством положения меняются нервами
//   node tools/devtest.js ПАПКА [СИДЫ] [КРУГОВ]       REUSE=1 -- взять готовые прогоны; VARS=A,C -- только эти; EXTRA="DLAG=2" -- ручки всем
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const dir = process.argv[2] || '/tmp/devtest', seeds = process.argv[3] || '1-8', R = +(process.argv[4] || 20000);
fs.mkdirSync(dir, { recursive: true });
const V = [['A', 'без устройств', 'DEV=0'], ['B', 'устройства, без исследователя', 'EXPL=0'], ['C', 'мозг: исследователь + моторные органы', ''],
  ['D', 'вшитый потолок (истинная модель)', 'EXPL=2'], ['E', 'мозг, пересадка: знак обратный', `TSWAP=${Math.round(R * 0.6)} SWAPK=1`],
  ['F', 'мозг, пересадка: нервы местами', `TSWAP=${Math.round(R * 0.6)} SWAPK=2`]].filter((v) => !process.env.VARS || process.env.VARS.split(',').includes(v[0]));
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? (b.length & 1 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const out = {};
for (const [id, name, knobs] of V) {
  const fn = path.join(dir, id + '.json');
  if (!(process.env.REUSE && fs.existsSync(fn))) {
    const args = [path.join(__dirname, '..', 'neuron4.js'), `SEEDS=${seeds}`, `ROUNDS=${R}`, 'OUT=json', 'EVERY=250', ...(process.env.EXTRA || '').split(' ').filter(Boolean), ...knobs.split(' ').filter(Boolean)];
    fs.writeFileSync(fn, execFileSync('node', args, { maxBuffer: 1 << 30 }).toString().trim().split('\n').pop());
  }
  out[id] = JSON.parse(fs.readFileSync(fn, 'utf8'));
}
const L = [`  миры ${seeds}, ${R} кругов${process.env.EXTRA ? ', ' + process.env.EXTRA : ''}, устройства -- на круге 4 000; среднее второй половины жизни, медиана по мирам`,
  '  вариант                                    польза   (z-g)^2   бит: глубокий   глаз  пустышка   карта верна   смертей органа   частей   работа/круг'];
for (const [id, name] of V) { const S = out[id].res.map((r) => r.summary);
  L.push(`  ${(id + ': ' + name).padEnd(42)} ${f(med(S.map((s) => s.comfort))).padStart(6)}   ${f(med(S.map((s) => s.d2))).padStart(7)}   ${f(med(S.map((s) => s.bits['глубокий']))).padStart(13)}   ${f(med(S.map((s) => s.bits['глаз']))).padStart(4)}   ${f(med(S.map((s) => s.bits['пустышка']))).padStart(7)}` +
    `   ${String(S.filter((s) => s.mapOK).length + '/' + S.length).padStart(11)}   ${f(med(S.map((s) => s.motorDeaths)), 1).padStart(14)}   ${f(med(S.map((s) => s.parts)), 0).padStart(6)}   ${f(med(S.map((s) => s.ops)) / 1000, 1).padStart(9)}k`); }
// время до находки и до пользы
if (out.C) { const r = out.C.res; L.push('', `  C: двигатель найден через ${r.map((x) => x.firstEff - 4000).join(', ')} кругов после подключения; орган построен через ${r.map((x) => x.firstMotor - 4000).join(', ')}`); }
// пересадка: польза по окнам 250 кругов вокруг круга пересадки
for (const id of ['E', 'F']) if (out[id]) { const T = Math.round(R * 0.6), res = out[id].res;
  const rows = []; for (let t = T - 500; t <= T + 3000; t += 250) { const v = med(res.map((r) => (r.snaps.find((s) => s.t === t) || {}).comfort)); rows.push(`${t - T >= 0 ? '+' : ''}${t - T}: ${f(v)}`); }
  L.push(`  ${id}: польза по окнам 250 кругов вокруг пересадки -- ${rows.join('  ')}`); }
console.log(L.join('\n'));
fs.writeFileSync(path.join(dir, 'table.txt'), L.join('\n') + '\n');

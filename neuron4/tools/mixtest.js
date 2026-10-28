// Мир-смесь нейрона-3 (WMIX=1) на нейроне-4 и на нейроне-3 (ref/neuron3.js): одна схема мира (WK, WSEED), одни сиды,
// одна мера «понято» (доля структуры мира: рёбра смесей, глубокие >= 1 бит, произведения >= 0.5, этажи >= 1.5, значения >= 1.5
// по окну) -- среднее по видам. Нейрон-3 -- BRAIN=9 с тем же числом частей на канал.
//   node tools/mixtest.js ПАПКА [WK] [СИДЫ] [КРУГОВ] [ЧАСТЕЙ]      REUSE=1 -- взять готовые прогоны; N3=0 -- без нейрона-3
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const [dir = '/tmp/mix', K = '32', seeds = '1-4', R = '10000', PER = '2'] = process.argv.slice(2);
fs.mkdirSync(dir, { recursive: true });
const run = (fn, args) => { if (!(process.env.REUSE && fs.existsSync(fn))) fs.writeFileSync(fn, execFileSync('node', args, { maxBuffer: 1 << 30 }).toString()); return fs.readFileSync(fn, 'utf8').trim().split('\n').pop(); };
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? (b.length & 1 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN; };
const pc = (x) => (Number.isFinite(x) ? `${Math.round(100 * x)}%` : '-'), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
// нейрон-4
const t4 = Date.now();
const EX = (process.env.EXTRA || '').split(' ').filter(Boolean);   // EXTRA="ИМЯ=значение ..." -- ручки нейрона-4
const o4 = JSON.parse(run(path.join(dir, `n4_wk${K}_${seeds}_${R}_per${PER}${EX.length ? '_' + EX.join('_') : ''}.json`), [path.join(__dirname, '..', 'neuron4.js'), 'WORLD=mix', `WK=${K}`, `SEEDS=${seeds}`, `ROUNDS=${R}`, `PER=${PER}`, 'OUT=json', ...EX]));
const r4 = o4.res.sort((a, b) => a.seed - b.seed), last = (r) => r.snaps[r.snaps.length - 1];
const U4 = (f) => r4.map((r) => last(r).und[f]), B4 = (k) => r4.map((r) => last(r).bits[k]);
const row4 = { share: U4('share'), recall: U4('recall'), prec: U4('prec'), deep: U4('deepOK'), prod: U4('prodOK'), hier: U4('hierOK'), val: U4('valOK'),
  bmix: B4('смесь'), bdeep: B4('глубокий'), bprod: B4('произведение'), bhier: B4('этаж'), bval: B4('значение'), parts: r4.map((r) => last(r).parts), ops: r4.map((r) => r.opsTotal / +R / 1000), sec: r4.map((r) => r.sec) };
// нейрон-3
let row3 = null;
if (process.env.N3 !== '0') {
  const o3 = JSON.parse(run(path.join(dir, `n3_wk${K}_${seeds}_${R}_per${PER}.json`), [path.join(__dirname, '..', 'ref', 'neuron3.js'), 'WMIX=1', `WK=${K}`, 'BRAIN=9', `PER=${PER}`, `SEEDS=${seeds}`, `ROUNDS=${R}`, 'OUT=json']));
  const S = o3.summary, r = (n) => { const x = S.rows.find((y) => y.name === n); return x ? x.med : NaN; };
  row3 = { share: r('доля структуры мира (среднее по видам)'), recall: r('найдено истинных рёбер схемы'), prec: r('точность найденных рёбер'), deep: r('глубоких каналов с >= 1 бит'),
    prod: r('произведений решено (>= 0.5 бит)'), hier: r('иерархических решено (>= 1.5 бит)'), val: r('значений решено (>= 1.5 бит)'), bmix: r('бит у смесей'), bdeep: r('бит у глубоких'),
    bprod: r('бит у произведений'), bhier: r('бит у иерархических'), bval: r('бит у значений'), parts: r('живых частей'),
    ops: r('работа частей за круг, тыс.') + (r('работа органов-программ за круг, тыс.') || 0) };
}
const L = [`  мир-смесь нейрона-3: ${K} каналов, миры ${seeds}, ${R} кругов, ${PER} части на канал; медиана миров (у нейрона-4 -- и по мирам)`,
  '                         нейрон-3 BRAIN=9    нейрон-4      нейрон-4 по мирам'];
const line = (name, k, fmt) => L.push(`  ${name.padEnd(22)} ${(row3 ? fmt(row3[k]) : '-').padStart(10)}    ${fmt(med(row4[k])).padStart(10)}      ${row4[k].map(fmt).join(' ')}`);
line('понято', 'share', pc); line('рёбра смесей', 'recall', pc); line('точность рёбер', 'prec', pc); line('глубокие решены', 'deep', pc); line('произведения решены', 'prod', pc);
line('этажи решены', 'hier', pc); line('значения решены', 'val', pc); line('бит: смеси', 'bmix', f2); line('бит: глубокие', 'bdeep', f2); line('бит: произведения', 'bprod', f2);
line('бит: этажи', 'bhier', f2); line('бит: значения', 'bval', f2); line('частей', 'parts', (x) => (Number.isFinite(x) ? String(Math.round(x)) : '-'));
line('работа за круг, тыс.', 'ops', (x) => (Number.isFinite(x) ? x.toFixed(0) : '-'));
L.push(`  у нейрона-3 работа -- части и органы-программы; у нейрона-4 -- все участники (части, органы памяти, строитель, исследователь)`);
L.push('', '  органы памяти нейрона-4 (живые в конце жизни):'); for (const r of r4) L.push(`    мир ${r.seed}: ${r.memOrgans.join('; ') || 'нет'}  (построено ${r.memBuilt} за ${r.memScanned} примерок)`);
console.log(L.join('\n')); fs.writeFileSync(path.join(dir, `table_wk${K}.txt`), `# node tools/mixtest.js ${dir} ${K} ${seeds} ${R} ${PER}\n` + L.join('\n') + '\n');

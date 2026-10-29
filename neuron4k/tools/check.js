// Проверка нейрона-4 (как tools/golden.js у нейрона-3): несколько настроек по 2 мира, хэш итогов против эталона.
// Деньги сходятся в каждом круге (CHECKM=1: иначе прогон падает с ошибкой). Совпало -- поведение не менялось;
// не совпало -- правка задела старое, и это надо объяснить в шапке.
// Пересняты: две настройки с ATTN и CMERGE -- правила изменились (внимание дешевле и только у плохо понятого канала, не
// больше NCAND / 2 кандидатов; из лишних входов первым уходит тот, где нет понятия). Остальные 24 совпали бит в бит.
// Пересняты ещё раз (экзамен готовности): те же две и третья (общий словарь со всеми правилами) -- слова, которые мозг
// однажды признал словами, остаются словами, когда молчат (ATTN, SURP, ESUP смотрят на них так же). Прежние 24 -- бит в бит.
// Раунд 3: настройка «цепочка» переснята -- в итоге мира новое поле first10 (мера по первым 10 пробам); без него хэш прежний
// бит в бит. Добавлены две: цепочка с KHOLD, KPRIOR, ONEIN и ключ с MHOLD. Раунд 4: ещё две -- цепочка с ONEIN=2 KPLIFE и
// ключ с MHOLD=2 MCUR2; и долгий факт с PLONG. После слияния с веткой (results/vetka/): память через 15-30 кругов с WLAST MACC; сложение с WLAST MACC=2.
// Разбор 22.10 (results/razbor/ИТОГ.md): исправлено переиспользование номеров товаров -- когда номер павшего товара переходит
// к товару другого смысла, все, кто его держит, забывают его (src/goods.js onReuse, src/market.js forget, src/explorer.js forget).
// Детектор висячих номеров на прежнем коде (results/razbor/aba2.js) предсказал, какие эталоны обязаны измениться: ровно 5 настроек
// с органами выбора (слова с речью, диалог, три общих мира с CHOOSE) -- в них органы выбора держали номера, отданные товарам
// другого смысла. Изменились ровно эти 5, остальные 32 -- бит в бит (results/razbor/check_make.txt). Добавлены 6 настроек, которых
// раньше не было: сборщик органов (COMP, язык v2), лучший мозг раунда 8 (BRAIN=8) на интервале и долгом факте, мир эпох без
// спячки и со спячкой обоих видов (HIB=1, HIB=2).
//   node tools/check.js            -- сверить       node tools/check.js --make -- снять эталон заново
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const GOLD = path.join(__dirname, 'check.json');
const CASES = ['', 'DEV=0', 'EXPL=0', 'EXPL=2', 'TSWAP=5000 SWAPK=2', 'DLAG=2', 'PER=1 NOTE=0', 'WORLD=mix', 'WORLD=mix PROD=0 MEM=0 SADAPT=0', 'WORLD=img', 'WORLD=txt PER=4 RENT=0.05', 'THINKB=1 FADAPT=2', 'WORDS=1 SQ=1 WSAL=5 RENT=0.05', 'WORDS=7 SPEAK=1 CHOOSE=1 SQ=1 WSAL=5 RENT=0.05', 'WORDS=7 SPEAK=1 CHOOSE=1 ASK=1 OWNV=1 CIMIT=1 CWATCH=80 CPROD=4 CFEAT=8 SQ=1 WSAL=5 RENT=0.05', 'WORDS=10 WDLAG=1 RQPAY=3 MFEAT=6 SQ=1 WSAL=5 RENT=0.05', 'WORLD=exam EXAM=перенос CONC=1 SQ=1 RENT=0.05', 'WORLD=exam EXAM=сложение CONC=1 SQ=1 RENT=0.05', 'WORLD=exam EXAM=сложение CONC=1 SCHEMA=1 SQ=1 RENT=0.05', 'WORLD=exam EXAM=память WMEM=1 SQ=1 RENT=0.05', 'MLONG=1', 'MLONG=1 MPLAN=1 WORDS=8 RQPAY=3 MFEAT=6 SQ=1 WSAL=5 RENT=0.05', 'WORLD=one SPEAK=1 ASK=1 OWNV=1 WSAL=5 RQPAY=3 SQ=1 RENT=0.05 CONC=1 MLONG=1 MPLAN=1 WMEM=1', 'WORLD=one SPEAK=1 ASK=1 OWNV=1 WSAL=5 RQPAY=3 RQSAY=0 SQ=1 RENT=0.05 CHOOSE=1 CIMIT=1 CONC=1 MLONG=1 MPLAN=1 WMEM=1 WMEMN=8 CKEEP=200 ESAVG=1 MSRCH=16 PDROP=1', 'WORLD=exam EXAM=сложение CONC=1 SCHEMA=1 SQ=1 RENT=0.05 ESUP=5 ATTN=3 CMERGE=1', 'WORLD=one ONEVOC=1 SPEAK=1 ASK=1 OWNV=1 WSAL=5 RQPAY=3 RQSAY=0 SQ=1 RENT=0.05 CHOOSE=1 CIMIT=1 CONC=1 SCHEMA=1 MLONG=1 MPLAN=1 WMEM=1 WMEMN=8 CKEEP=200 ESAVG=1 MSRCH=16 PDROP=1 ESUP=5 PPROD=1 ATTN=3 CMERGE=1', 'WORLD=one ONEVOC=1 SPEAK=1 ASK=1 OWNV=1 WSAL=5 RQPAY=3 RQSAY=0 SQ=1 RENT=0.05 CHOOSE=1 CIMIT=1 CONC=1 SCHEMA=1 MLONG=1 MPLAN=1 WMEM=1 WMEMN=8 CKEEP=200 ESAVG=1 MSRCH=16 PDROP=1 ESUP=5 PPROD=1 ATTN=3 CMERGE=1 MCONC=1 SURP=1 CPHR=1', 'WORLD=exam EXAM=факт WMEM=1 PARA=1 SQ=1 RENT=0.05', 'WORLD=exam EXAM=ключ MPLAN=1 MLONG=1 MTD=0.9 MFEAT=6 SQ=1 RENT=0.05', 'WORLD=exam EXAM=цепочка KEEPW=1 FILL=1 ATTN=3 CONC=1 SQ=1 RENT=0.05', 'WORLD=exam EXAM=цепочка KEEPW=1 FILL=1 ATTN=3 CONC=1 SQ=1 RENT=0.05 KHOLD=1 KPRIOR=1 ONEIN=1', 'WORLD=exam EXAM=ключ MPLAN=1 MLONG=1 MTD=0.9 MFEAT=6 SQ=1 RENT=0.05 MHOLD=1', 'WORLD=exam EXAM=цепочка KEEPW=1 FILL=1 ATTN=3 CONC=1 SQ=1 RENT=0.05 KHOLD=1 KPRIOR=1 ONEIN=2 KPLIFE=200', 'WORLD=exam EXAM=ключ MPLAN=1 MLONG=1 MTD=0.9 MFEAT=6 SQ=1 RENT=0.05 MHOLD=2 MCUR2=1', 'WORLD=exam EXAM=факт XFLONG=1 WMEM=1 PARA=1 SQ=1 RENT=0.05 KPRIOR=1 KEEPW=1 PLONG=8192', 'WORLD=exam EXAM=память XDMIN=15 XDMAX=30 WMEM=1 WLAST=1 MACC=1 SQ=1 RENT=0.05', 'WORLD=exam EXAM=сложение CONC=1 SCHEMA=1 SQ=1 RENT=0.05 WMEM=1 WLAST=1 MACC=2',
  // разбор 22.10: мозг раундов 6-9 прежде не был под проверкой
  'WORLD=exam EXAM=счёт COMP=1 CV2=1 SQ=1 RENT=0.05', 'WORLD=exam EXAM=интервал BRAIN=8 SQ=1 RENT=0.05 MFEAT=6 CHOOSE=1 CIMIT=1 CWATCH=80 CPROD=4 CFEAT=8',
  'WORLD=exam EXAM=факт XFLONG=1 BRAIN=8 SQ=1 RENT=0.05 MFEAT=6 CHOOSE=1 CIMIT=1 CWATCH=80 CPROD=4 CFEAT=8', 'WORLD=ep EPL=1500 SQ=1 RENT=0.05',
  'WORLD=ep EPL=1500 SQ=1 RENT=0.05 HIB=1', 'WORLD=ep EPL=1500 BRAIN=8 SQ=1 RENT=0.05 MFEAT=6 CHOOSE=1 CIMIT=1 CWATCH=80 CPROD=4 CFEAT=8 HIB=2'];
const res = {};
for (const c of CASES) {
  const out = execFileSync('node', [path.join(__dirname, '..', 'neuron4.js'), 'SEEDS=1,2', 'ROUNDS=6000', 'OUT=json', 'CHECKM=1', ...c.split(' ').filter(Boolean)], { maxBuffer: 1 << 28 }).toString();
  const o = JSON.parse(out.trim().split('\n').pop()); for (const r of o.res) delete r.sec; o.res.sort((a, b) => a.seed - b.seed);
  res[c || '(по умолчанию)'] = crypto.createHash('sha256').update(JSON.stringify(o.res)).digest('hex').slice(0, 16);
}
if (process.argv.includes('--make')) {   // перед записью -- что изменилось против прежнего эталона (чтобы объяснить в шапке)
  const old = fs.existsSync(GOLD) ? JSON.parse(fs.readFileSync(GOLD, 'utf8')) : {};
  for (const [k, h] of Object.entries(res)) console.log(`  ${old[k] === undefined ? 'нов' : old[k] === h ? 'ok ' : 'ИЗМ'} ${k}`);
  fs.writeFileSync(GOLD, JSON.stringify(res, null, 1)); console.log(`эталон снят: ${Object.keys(res).length} настроек`); process.exit(0); }
const gold = JSON.parse(fs.readFileSync(GOLD, 'utf8')); let bad = 0;
for (const [k, h] of Object.entries(res)) { const ok = gold[k] === h; if (!ok) bad++; console.log(`  ${ok ? 'ok ' : 'НЕТ'} ${k}`); }
console.log(bad ? `\nНЕ СОВПАЛО: ${bad} из ${CASES.length}` : `\nВСЁ СОВПАЛО: ${CASES.length} настроек x 2 мира; деньги сходятся в каждом круге`);
process.exit(bad ? 1 : 0);

// разведка к ступени 6б (ИССЛЕДОВАНИЕ_ВРЕМЯ.md): сравнение вариантов на мирах 201-208 (не мерные)
const fs = require('fs'), path = require('path'), { med } = require('../../tools/stats'), D = __dirname;
const V = fs.readFileSync(path.join(D, 'variants.txt'), 'utf8').trim().split('\n').map((l) => l.split('|'));
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
console.log('вариант'.padEnd(13) + 'польза | AUC еда вода укус удар | названо еда вода укус удар | точность «еда» | подъём «голодно» «жажда» | изобр. для еды');
for (const [nm, args] of V) { const R = fs.readFileSync(path.join(D, nm + '.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const a = (w) => med(R.map((r) => r.words.find((q) => q.name === w).auc)), sw = (r, w) => r.speech.words.find((q) => q.name === w);
  const n = (w) => med(R.map((r) => sw(r, w).named).filter((x) => x !== null)), lift = (w) => med(R.map((r) => sw(r, w).prec / sw(r, w).base));
  console.log(nm.padEnd(13) + f(med(R.map((r) => r.comfort)), 3) + ' | ' + ['еда', 'вода', 'укус', 'удар'].map((w) => f(a(w))).join(' ') + ' | ' + ['еда', 'вода', 'укус', 'удар'].map((w) => f(n(w))).join(' ') +
    ' | ' + f(med(R.map((r) => sw(r, 'еда').prec || 0))) + ' | ' + f(lift('голодно'), 1) + ' ' + f(lift('жажда'), 1) + ' | ' + R.filter((r) => r.inventor && r.inventor.accepted.some((q) => q.for === 'слово еда')).length + '/' + R.length + '   (' + args.replace(/BG=1 SPEAK=1 SPX=1 REQ=1 MAP=0 HLAG=10 ?/, '') + ')'); }

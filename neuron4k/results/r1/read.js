// чтение Р1 (ПЛАН.md §5): сбалансированная точность ответов переводчика против правды мира, по 90 отрезкам трёх миров;
// значимость -- перестановками правды по отрезкам внутри мира (10000 раз). Ответы -- out/<имя>.json; правда -- in/truth_<сид>.json.
// Слепые имена файлов переводчика: a1, b2, a3 -- настоящие зачатки миров 1, 2, 3; b1, a2, b3 -- перемешанные.
const fs = require('fs'), path = require('path');
const NAMES = { real: { 1: 'a1', 2: 'b2', 3: 'a3' }, shuf: { 1: 'b1', 2: 'a2', 3: 'b3' } }, QS = ['q1', 'q2', 'q3', 'q4'];
const QT = { q1: 'сейчас ждёт плохого (хищник ближе 8)', q2: 'было хорошее (ел или пил)', q3: 'было сильно плохо (укус или смерть)', q4: 'скоро будет хорошее (ел или пил в следующем)' };
const load = (n) => { const f = path.join(__dirname, 'out', n + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const truth = (s) => JSON.parse(fs.readFileSync(path.join(__dirname, 'in', `truth_${s}.json`), 'utf8')).truth;
const ba = (pairs) => { let tp = 0, p = 0, tn = 0, n = 0; for (const [a, t] of pairs) { if (t) { p++; if (a) tp++; } else { n++; if (!a) tn++; } } return p && n ? (tp / p + tn / n) / 2 : NaN; };
let rs = 12345; const rnd = () => ((rs = (rs * 1103515245 + 12345) % 2147483648) / 2147483648);
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function score(kind, q) {
  const worlds = []; for (const s of [1, 2, 3]) { const A = load(NAMES[kind][s]); if (!A) continue; const T = truth(s), ans = [], tr = [];
    for (let i = 0; i < T.length; i++) { const a = A.find((x) => x.i === i + 1); if (!a || T[i][q] === null || T[i][q] === undefined) continue; ans.push(!!a[q]); tr.push(T[i][q]); } worlds.push({ s, ans, tr }); }
  if (!worlds.length) return null;
  const pairsOf = (ws, trs) => ws.flatMap((w, k) => w.ans.map((a, i) => [a, trs[k][i]]));
  const obs = ba(pairsOf(worlds, worlds.map((w) => w.tr))); let ge = 0; const N = 10000;
  for (let k = 0; k < N; k++) if (ba(pairsOf(worlds, worlds.map((w) => shuffle(w.tr)))) >= obs) ge++;
  return { obs, p: (ge + 1) / (N + 1), per: worlds.map((w) => `${w.s}: ${ba(w.ans.map((a, i) => [a, w.tr[i]])).toFixed(2)}`).join(', '), n: worlds.reduce((a, w) => a + w.ans.length, 0), yes: worlds.reduce((a, w) => a + w.ans.filter(Boolean).length, 0) };
}
const sig = { real: 0, shuf: 0 };
for (const kind of ['real', 'shuf']) { console.log(kind === 'real' ? '\nНАСТОЯЩИЕ ЗАЧАТКИ' : '\nПЕРЕМЕШАННЫЕ ЗАЧАТКИ (контроль)');
  for (const q of QS) { const r = score(kind, q); if (!r) { console.log(`  ${q}: нет ответов`); continue; } if (r.p < 0.01) sig[kind]++;
    console.log(`  ${q} ${QT[q]}: сбалансированная точность ${r.obs.toFixed(3)} (по мирам ${r.per}); «да» в ${r.yes} из ${r.n}; p = ${r.p.toFixed(4)}${r.p < 0.01 ? ' -- значимо' : ''}`); } }
console.log(`\n1. смысл идёт из мозга (значимо хотя бы 3 из 4 по настоящим): ${sig.real} из 4 -> ${sig.real >= 3 ? 'ДА' : 'нет'}`);
console.log(`2. не из модели (по перемешанным значимых нет): ${sig.shuf} -> ${sig.shuf === 0 ? 'ДА' : 'нет'}`);
const ex = load('a1'); if (ex) { const T = truth(1); console.log('\nпримеры внутренней речи (мир 1, настоящие зачатки) и правда:');
  for (const x of ex.slice(0, 30)) { const t = T[x.i - 1]; console.log(`  ${x.i}. «${x['речь']}»  [хищник рядом ${t.q1 ? 'да' : 'нет'}, ел/пил ${t.q2 ? 'да' : 'нет'}, укус ${t.q3 ? 'да' : 'нет'}]`); } }

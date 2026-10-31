// чтение Р2 (ПЛАН.md §3, §5): понимание слов -- AUC прогноза нерва-слова; С, СС против К; парно по мирам, Уилкоксон
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'neuron4', 'results', 'kolonia', 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f)) return null; return new Map(fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'С': L('r2_S.jsonl'), 'СС': L('r2_SS.jsonl'), 'К': L('r2_K.jsonl') };
const EV = ['еда', 'вода', 'укус', 'удар'], ST = ['голодно', 'жажда', 'опасно'];
const aucOf = (r, w) => { const x = r.words.find((q) => q.name === w); return x && x.auc !== null ? x.auc : NaN; };
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; if (!A || !B) return { s: `${a} против ${b}: нет данных` };
  const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()];
  console.log(`${k.padEnd(3)} миров ${m.size}: польза ${f(med(v.map((r) => r.comfort)), 3)}; укусов ${f(med(v.map((r) => r.bites)))}; еда+вода ${f(med(v.map((r) => r.eat)), 1)}; AUC (медианы): ` +
    [...EV, ...ST].map((w) => `${w} ${f(med(v.map((r) => aucOf(r, w))))}`).join(', ')); }
for (const k of ['С', 'СС']) { if (!C[k]) continue; const v = [...C[k].values()];
  console.log(`\n== ${k}`);
  let all1 = true; for (const w of EV) { const n = v.filter((r) => aucOf(r, w) > 0.75).length; if (n < 20) all1 = false; console.log(`1. ${w}: AUC > 0.75 в ${n} из ${v.length} -> ${n >= 20 ? 'да' : 'нет'}`); }
  console.log(`   мера 1 (все слова событий): ${all1 ? 'ДА' : 'нет'}`);
  let all2 = true; for (const w of ST) { const r = pair(k, 'К', (x) => aucOf(x, w), 1); if (!r.ok) all2 = false; console.log(`2. ${w}: ${k} против К -- ${r.s} -> ${r.ok ? 'да' : 'нет'}`); }
  console.log(`   мера 2 (все слова состояний): ${all2 ? 'ДА' : 'нет'}`);
  const r3 = pair(k, 'К', (x) => x.comfort, 1); console.log(`3. польза ${k} против К -- ${r3.s} -> ${r3.bad ? 'нет (ниже)' : 'ДА'}`); }
console.log('\n4. связь помогает (AUC слов событий, СС против С):');
for (const w of EV) { const r = pair('СС', 'С', (x) => aucOf(x, w), 1); console.log(`   ${w}: ${r.s} -> ${r.ok ? 'да' : 'нет'}`); }
console.log('\nдоп.: события, AUC слов событий у С и СС против К:');
for (const k of ['С', 'СС']) for (const w of EV) console.log(`   ${k} ${w}: ${pair(k, 'К', (x) => aucOf(x, w), 1).s}`);
for (const [key, want] of [['bites', -1], ['eat', 1]]) for (const k of ['С', 'СС']) console.log(`   ${key} ${k} против К: ${pair(k, 'К', (x) => x[key], want).s}`);

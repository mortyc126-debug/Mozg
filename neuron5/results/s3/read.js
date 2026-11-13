// чтение ступени 3 (ПЛАН.md §3): находит тело, быстро, живёт и говорит не хуже
const fs = require('fs'), path = require('path'), { wil2, med } = require('../../tools/stats');
const L = (n) => new Map(fs.readFileSync(path.join(__dirname, n), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.seed, r]));
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const C = { 'В': L('../s5b/s5b_P0.jsonl'), 'И': L('s3_I.jsonl') }, V = (k) => [...C[k].values()], sw = (r, w) => r.speech.words.find((q) => q.name === w);
const lift = (r, w) => (sw(r, w).prec !== null ? sw(r, w).prec / sw(r, w).base : NaN), named = (r, w) => (sw(r, w).named !== null ? sw(r, w).named : NaN);
const self = (r, w) => { const q = sw(r, w); return q.said - q.after > 0 ? ((q.ok - q.afterOk) / (q.said - q.after)) / q.base : NaN; }, helps = (r) => r.speech.helps[0] + r.speech.helps[1];
const pair = (a, b, fn, want) => { const A = C[a], B = C[b]; const d = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y).map((k) => fn(A.get(k)) - fn(B.get(k))).filter(Number.isFinite), t = wil2(d), md = med(d);
  return { ok: t.p < 0.01 && want * md > 0, bad: t.p < 0.01 && want * md < 0, s: `медиана разности ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)}` }; };
for (const k of Object.keys(C)) { const v = V(k), g = (fn, d) => f(med(v.map(fn)), d);
  console.log(`${k}: польза ${g((r) => r.comfort, 3)}; еда+вода ${g((r) => r.eat, 1)}; помощь ${g(helps)}; говорит ${g((r) => 100 * r.speech.talk, 0)}%; названо еды ${g((r) => named(r, 'еда'))}, питья ${g((r) => named(r, 'вода'))}; ` +
    ['голодно', 'жажда'].map((w) => `«${w}» подъём ${g((r) => lift(r, w), 1)}, сам ×${g((r) => self(r, w), 1)}`).join('; ')); }
const E = V('И').map((r) => r.explorer), ok = E.filter((e) => e.motorOk && e.mouthOk && !e.falseMouth && !e.falseMotor);
console.log(`\n1. находит тело: верно и без ложных в ${ok.length} из ${E.length} (двигатель ${E.filter((e) => e.motorOk).length}, знак +1 у ${E.filter((e) => e.sign === 1).length}, рот целиком ${E.filter((e) => e.mouthOk).length}, ложный рот ${E.filter((e) => e.falseMouth).length}, ложный двигатель ${E.filter((e) => e.falseMotor).length}) -> ${ok.length >= 22 ? 'ДА' : 'нет'}`);
const da = E.map((e) => (e.doneAt === null ? Infinity : e.doneAt)); console.log(`2. быстро: медиана круга, когда найдено всё, ${med(da)} (от ${Math.min(...da)} до ${Math.max(...da)}) -> ${med(da) <= 2000 ? 'ДА' : 'нет'}`);
const m3 = pair('И', 'В', (x) => x.comfort, 1); console.log(`3. живёт не хуже (польза И против В): ${m3.s} -> ${m3.bad ? 'нет' : 'ДА'}`);
let ok4 = true; console.log('4. говорит не хуже (И против В):');
for (const [nm, fn] of [['названо еды', (x) => named(x, 'еда')], ['названо питья', (x) => named(x, 'вода')], ['подъём «голодно»', (x) => lift(x, 'голодно')], ['подъём «жажда»', (x) => lift(x, 'жажда')], ['исполнено просьб', helps]]) {
  const r = pair('И', 'В', fn, 1); if (r.bad) ok4 = false; console.log(`   ${nm}: ${r.s}${r.bad ? ' -- ХУЖЕ' : ''}`); }
console.log(`   мера 4: ${ok4 ? 'ДА' : 'нет'}`);
console.log('\nдоп.:'); const W = ['еда', 'вода', 'укус', 'удар', 'голодно', 'жажда', 'опасно'];
for (const w of W) { const ls = V('И').map((r) => r.explorer.lines.find((l) => l.word === w)).filter(Boolean); console.log(`   нерв рта «${w}»: сильнейший довод -- своё слово в ${ls.filter((l) => l.topEvidence === w).length} из ${ls.length}; уроков (медиана) ${med(ls.map((l) => l.n))}`); }
console.log(`   подъём «сам» И против В: голодно ${pair('И', 'В', (x) => self(x, 'голодно'), 1).s}; жажда ${pair('И', 'В', (x) => self(x, 'жажда'), 1).s}`);

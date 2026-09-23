const fs = require('fs');
const L = fs.readFileSync('out/radius.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const old = new Map(fs.readFileSync('../v31/out/run.tsv', 'utf8').trim().split('\n').map((l) => { const r = l.split('\t'); return [r[0] + ' ' + r[1], l]; }));
const I = L.filter((r) => r[0] === 'И');
const bad = I.filter((r) => old.get(r[1] + ' ' + r[2]) !== r.slice(1).join('\t'));
console.log(`П3 (замер не трогает мир): совпало ${I.length - bad.length} из ${I.length} строк шага 42 до последнего знака -> ${bad.length ? 'НЕ выполнена: ' + bad.map((r) => r[1] + ' ' + r[2]).join(', ') : 'выполнена'}`);
const S = L.filter((r) => r[0] === 'С').map((r) => ({ c: r[1], seed: +r[2], T: +r[3], rH: +r[5], r0: +r[6], rL: +r[7], sH: +r[8], s0: +r[9], sL: +r[10], dg: +r[11], sh: [+r[12], +r[13], +r[14], +r[15]], bl: r[16] === 'NaN' ? Infinity : +r[16] }));
const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
for (const c of ['HOLD=0', 'HOLD=1']) {
  const A = S.filter((s) => s.c === c);
  console.log(`\n${c}: тишин ${A.length}`);
  for (const k of ['rH', 'r0', 'rL', 'sH', 's0', 'sL', 'dg']) console.log(`  ${k.padEnd(3)} медиана ${f(med(A.map((s) => s[k])))}, 10% ${f(q(A.map((s) => s[k]), 0.1))}, 90% ${f(q(A.map((s) => s[k]), 0.9))}, max ${f(Math.max(...A.map((s) => s[k])))}; доля > 1: ${f(A.filter((s) => s[k] > 1).length / A.length)}`);
}
const H1 = S.filter((s) => s.c === 'HOLD=1'), seeds = [...new Set(H1.map((s) => s.seed))].sort();
const fr = seeds.map((sd) => { const A = H1.filter((s) => s.seed === sd); return A.filter((s) => s.rH > 1).length / A.length; });
console.log(`\nА. доля тишин с r_H > 1 по сидам (HOLD=1): ${fr.map((x) => f(x, 2)).join(' ')}; медиана ${f(med(fr))} (порог 0.25) -> ${med(fr) >= 0.25 ? 'ВЫПОЛНЕНО' : 'не выполнено'}`);
const boom = (s) => s.bl > 2, nb = H1.filter(boom).length;
console.log(`Б. взорвалось ${nb} тишин из ${H1.length} (T=10: ${H1.filter((s) => s.T === 10 && boom(s)).length} из ${H1.filter((s) => s.T === 10).length}; T=30: ${H1.filter((s) => s.T === 30 && boom(s)).length} из ${H1.filter((s) => s.T === 30).length})`);
for (const [name, pr] of [['асимптотическое r_H^T > 2', (s) => Math.pow(s.rH, s.T) > 2], ['однокруговое σ_H > 2', (s) => s.sH > 2], ['(вне правила) любое из двух', (s) => Math.pow(s.rH, s.T) > 2 || s.sH > 2]]) {
  const tp = H1.filter((s) => pr(s) && boom(s)).length, tn = H1.filter((s) => !pr(s) && !boom(s)).length, acc = (tp + tn) / H1.length, rec = nb ? tp / nb : NaN;
  console.log(`   ${name}: точность ${f(acc)}, из взорвавшихся предсказано ${f(rec)} (${tp}/${nb}), ложных тревог ${H1.filter((s) => pr(s) && !boom(s)).length} -> ${name.startsWith('(') ? 'описательно' : acc >= 0.9 && rec >= 0.8 ? 'ОБЪЯСНЯЕТ' : 'не объясняет'}`);
}
const un = H1.filter((s) => s.rH > 1), vv = un.filter((s) => s.dg < 1).length / un.length;
console.log(`В. среди ${un.length} тишин с r_H > 1 у всех частей |wSelf + ws| < 1 в доле ${f(vv)} (порог 0.5) -> ${vv >= 0.5 ? 'ВЫПОЛНЕНО' : 'не выполнено'}`);
const all = S, g = all.filter((s) => s.r0 > 1).length / all.length, d = all.filter((s) => s.rL > 1).length / all.length;
console.log(`Г. доля тишин с r_0 > 1 в обоих прогонах: ${f(g)} (${all.filter((s) => s.r0 > 1).length} из ${all.length})`);
console.log(`Д. доля тишин с r_л > 1 в обоих прогонах: ${f(d)} (${all.filter((s) => s.rL > 1).length} из ${all.length}; порог 0.02) -> ${d <= 0.02 ? 'ВЫПОЛНЕНО' : 'не выполнено'}`);
const shm = [0, 1, 2, 3].map((i) => med(un.map((s) => s.sh[i])));
console.log(`ведущий вектор A_H при r_H > 1, медианы долей: канал S ${f(shm[0])}, источники 0-2 и 8 ${f(shm[1])}, смеси 3-7 ${f(shm[2])}, канал 9 ${f(shm[3])}`);

// Чтение проверки меры шага 76 (PRE76_KAL3.md §3): R_K медленного канала -- против наблюдателя на том же окне, статистика А
const fs = require('fs');
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
// t: [pre kn,kz,kk, post kn,kz,kk, preL ..., postL ...]; o = 0 -- «3 прямо», 6 -- «3 длинная тишина»
const RK = (xs, o) => { let an = 0, ad = 0, bn = 0, bd = 0; for (const t of xs) { bn += t[o + 1] - t[o]; bd += t[o + 1] - t[o + 2]; an += t[o + 4] - t[o + 3]; ad += t[o + 4] - t[o + 5]; } return (an / ad) / (bn / bd); };
function A(xs, o) { let rs = 12345; const rnd = () => { rs = (rs * 1103515245 + 12345) >>> 0; return rs / 4294967296; };
  const bt = []; for (let b = 0; b < 2000; b++) { const s = []; for (let i = 0; i < xs.length; i++) s.push(xs[Math.floor(rnd() * xs.length)]); bt.push(RK(s, o)); }
  const mb = bt.reduce((s, x) => s + x, 0) / bt.length; return [RK(xs, o), Math.sqrt(bt.reduce((s, x) => s + (x - mb) ** 2, 0) / bt.length)]; }
const out = {};
for (const c of ['К0', 'КС', 'Ю']) {
  const R = fs.readFileSync(`out/check76_${c}.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t'));
  const t = R.map((r) => r[21].split(',').map(Number));
  const H = (o, post) => t.map((x) => (x[o + 1 + 3 * post] - x[o + 3 * post]) / (x[o + 1 + 3 * post] - x[o + 2 + 3 * post]));
  out[c] = { s: A(t, 0), l: A(t, 6) };
  console.log(`${c} (сидов ${R.length}): R_K 3 прямо ${f(out[c].s[0])} ± ${f(out[c].s[1])}, 3Д ${f(out[c].l[0])} ± ${f(out[c].l[1])} | H до/после по сидам, медианы: 3 прямо ${f(med(H(0, 0)))}/${f(med(H(0, 1)))}, 3Д ${f(med(H(6, 0)))}/${f(med(H(6, 1)))}`);
}
function med(a) { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; }
const k = out['К0'], w = out['КС'];
const c1 = Math.abs(k.s[0] - 1) <= 0.05 && Math.abs(k.l[0] - 1) <= 0.05, c2 = w.s[0] < 0.9 && w.l[0] < 0.9, c3 = k.s[1] <= 0.05 && k.l[1] <= 0.05;
console.log(`\n1. К0 в пределах 1 ± 0.05: ${c1 ? 'да' : 'НЕТ'}\n2. КС ниже 0.9: ${c2 ? 'да' : 'НЕТ'}\n3. разброс в К0 не больше 0.05: ${c3 ? 'да' : 'НЕТ'}\n-> МЕРА ${c1 && c2 && c3 ? 'ГОДНА' : 'НЕ ГОДНА'}`);

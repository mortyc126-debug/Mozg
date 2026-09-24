// Чтение строки 8 шага 70 (правило PRE68_CSEARCH.md §6): доля верного знака по условиям; поиск -- доля частей Q
// с линиями и к A, и к B: ЮЛС против ЮЛ парно по сидам, точный знаковый критерий
const fs = require('fs');
const R = fs.readFileSync('out/order70.tsv', 'utf8').trim().split('\n').map((l) => l.split('\t'));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'NaN');
const rows = (c) => R.filter((r) => r[0] === c).sort((a, b) => a[1] - b[1]);
for (const c of ['Ю', 'ЮС', 'ЮЛ', 'ЮЛС']) {
  const A = rows(c);
  console.log(`${c}: сидов ${A.length}; доля верного знака ${f(med(A.map((r) => +r[2])))} (по сидам ${A.map((r) => f(+r[2], 2)).join(' ')}); предсказатель ${f(med(A.map((r) => +r[4])))}; живых ${med(A.map((r) => +r[6]))}; частей Q ${med(A.map((r) => +r[7]))}; с линиями к A и B ${f(med(A.map((r) => +r[8])))} (по сидам ${A.map((r) => f(+r[8], 2)).join(' ')}); с любой ${f(med(A.map((r) => +r[9])))}`);
}
const sign = (a, b) => { let up = 0, dn = 0; const m = new Map(b.map((r) => [r[1], r]));
  for (const r of a) { const q = m.get(r[1]); if (!q) continue; const d = +r[8] - +q[8]; if (d > 0) up++; else if (d < 0) dn++; }
  const n = up + dn; let p = 0; const C = (n, k) => { let c = 1; for (let i = 0; i < k; i++) c = c * (n - i) / (i + 1); return c; };
  for (let k = 0; k <= n; k++) if (Math.min(k, n - k) <= Math.min(up, dn)) p += C(n, k) / 2 ** n; return { up, dn, p: Math.min(1, p) }; };
const s = sign(rows('ЮЛС'), rows('ЮЛ'));
console.log(`\nпоиск: ЮЛС выше ЮЛ по доле частей Q с линиями к A и B -- выше ${s.up}, ниже ${s.dn}, p = ${f(s.p, 4)} -> ${s.up > s.dn && s.p < 0.05 ? 'РАБОТАЕТ КАК ПОИСК' : s.dn > s.up && s.p < 0.05 ? 'УВОДИТ ОТ НУЖНОГО' : 'не установлено'}`);
const dead = R.filter((r) => !(+r[6] > 0)).map((r) => r[0] + ' ' + r[1]);
const okPos = ['Ю', 'ЮС', 'ЮЛ', 'ЮЛС'].every((c) => med(rows(c).map((r) => +r[4])) >= 0.85);
console.log(`проверки меры: предсказатель >= 0.85 во всех условиях ${okPos ? 'да' : 'НЕТ'}; вымерших ${dead.length ? dead.join(', ') : 'нет'}`);
for (const c of ['ЮС', 'ЮЛС']) { const m = med(rows(c).map((r) => +r[2])); console.log(`строка 8 в ${c}: ${f(m)} -> ${m >= 0.75 ? 'ЕСТЬ (засчитывается, если вариант принят)' : 'НЕТ'}`); }

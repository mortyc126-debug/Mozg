// чтение М1 (ПЛАН_М1.md §4 с поправками §7): найденные события против правды мира, ожидание еды -- Уилкоксон против нуля
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, motorDeaths: r.summary.motorDeaths }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const E = L('m1_E.json'), KD = L('k1i_KD.json'); if (!E) { console.log('нет m1_E.json'); process.exit(); }
const label = (T) => Object.entries(T.tr).sort((a, b) => b[1] - a[1])[0];
const found = (x, what) => { const ts = x.exp.types.filter((T) => { const [l, n] = label(T); return n > 0 && l === what; }); const hit = ts.reduce((s, T) => s + T.tr[what], 0), all = ts.reduce((s, T) => s + Object.values(T.tr).reduce((a, b) => a + b, 0), 0);
  return { cover: x.exp.tot[what] ? hit / x.exp.tot[what] : NaN, prec: all ? hit / all : NaN, n: ts.length, ok: x.exp.tot[what] > 0 && hit / x.exp.tot[what] >= 0.8 && hit / all >= 0.8, ts }; };
const seeds = [...E.keys()].sort((a, b) => a - b);
for (const s of seeds) { const x = E.get(s); console.log(`мир ${s}: правда ${JSON.stringify(x.exp.tot)}; виды: ` + x.exp.types.map((T) => `${T.key}[${label(T)[1] ? label(T)[0] : 'нет во 2-й половине'} ${T.cnt}${T.alive ? '' : ', органа нет'}]`).join(' ')); }
for (const [i, what] of [[1, 'еда'], [2, 'смерть']]) { const r = seeds.map((s) => found(E.get(s), what)), ok = r.filter((q) => q.ok).length;
  console.log(`\n${i}. нашёл «${what}»: в ${ok} из ${r.length} мирах -> ${ok >= 20 ? 'ДА' : 'нет'}; покрытие -- медиана ${f(med(r.map((q) => q.cover)))}, точность -- ${f(med(r.map((q) => q.prec)))}; видов -- ${r.map((q) => q.n).join(' ')}`); }
const ant = (what) => seeds.map((s) => { const q = found(E.get(s), what); const T = q.ts.sort((a, b) => b.tr[what] - a.tr[what])[0]; return T && T.antB !== null && T.antA !== null ? T.antB - T.antA : NaN; });
{ const d = ant('еда'), t = wil2(d.filter(Number.isFinite)), pos = d.filter((x) => x > 0).length;
  console.log(`\n3. ждёт еду (до своего события минус всегда): медиана ${f(med(d), 4)}, больше 0 в ${pos} из ${d.length}; p = ${t.p.toExponential(2)} -> ${pos >= 20 && t.p < 0.01 && med(d) > 0 ? 'ДА' : 'нет'}; по мирам ${d.map((x) => f(x, 3)).join(' ')}`); }
{ const r = seeds.map((s) => found(E.get(s), 'удар')); console.log(`\nдоп.: нашёл «удар» в ${r.filter((q) => q.ok).length} из ${r.length}; покрытие ${f(med(r.map((q) => q.cover)))}, точность ${f(med(r.map((q) => q.prec)))}`); }
{ const d = ant('смерть'); console.log(`доп.: ждёт смерть: медиана ${f(med(d), 4)}, больше 0 в ${d.filter((x) => x > 0).length} из ${d.length}`); }
{ const all = seeds.flatMap((s) => E.get(s).exp.types); console.log(`доп.: органов за жизнь -- медиана на вид ${f(med(all.map((T) => T.built)), 1)}, банкротств ${f(med(all.map((T) => T.deaths)), 1)}; мелкой еды (не событие) -- медиана ${f(med(seeds.map((s) => E.get(s).exp.tot['еда-мелкая'])), 0)}`); }
if (KD) for (const key of ['deaths2', 'food']) { const d = seeds.map((s) => E.get(s)[key] - KD.get(s)[key]), t = wil2(d); console.log(`доп.: Е против КД, ${key}: медиана разности ${f(med(d), 3)}, p = ${t.p.toExponential(2)} (Е ${f(med(seeds.map((s) => E.get(s)[key])))}, КД ${f(med(seeds.map((s) => KD.get(s)[key])))})`); }

// чтение М3г (ПЛАН_М3г.md §3; Б -- из М3б, МС -- из М3в, планка -- из М3): еда и вода -- разные виды; выбор по нужде, обесценивание, еда и вода
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'readk1z.js'), 'utf8');
const wil2 = new Function(src.match(/function wil2[\s\S]*?return \{ p: erfc\(z \/ Math.SQRT2\), n, W \}; \}/)[0] + '; return wil2;')();
const L = (n) => { const f = path.join(__dirname, n); if (!fs.existsSync(f) || !fs.statSync(f).size) return null;
  return new Map(JSON.parse(fs.readFileSync(f)).res.map((r) => [r.seed, { ...r.summary.xres, motorDeaths: r.summary.motorDeaths }])); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const label = (T) => { const e = Object.entries(T.tr).sort((a, b) => b[1] - a[1])[0]; return e[1] ? e[0] : null; };
const C = { 'Б': L('m3b_B.json'), 'МС': L('m3v_M.json'), 'МГ': L('m3g_M.json'), 'П': L('m3_P.json') };
for (const [k, m] of Object.entries(C)) if (m) { const v = [...m.values()], g = (key, d) => f(med(v.map((x) => x[key])), d);
  console.log(`${k.padEnd(3)} миров ${m.size}: еда+вода ${g('eat', 1)} (еда ${g('food', 1)}, вода ${g('water', 1)}); по нужде ${g('need')}; обесценивание ${g('deval')}; смертей 2-я половина ${g('deaths2')}`); }
const M = C['МГ'];
if (M) { const s = [...M.keys()].sort((a, b) => a - b);
  const sep = s.map((k) => { const x = M.get(k).exp, ok = (what) => { const ts = x.types.filter((T) => label(T) === what), hit = ts.reduce((a, T) => a + T.tr[what], 0), own = ts.reduce((a, T) => a + T.tr[what] + (T.tr[what + '-мелкая'] || 0), 0), all = ts.reduce((a, T) => a + Object.values(T.tr).reduce((p, q) => p + q, 0), 0);
      return x.tot[what] > 0 && hit / x.tot[what] >= 0.8 && all > 0 && own / all >= 0.8; };   // поправка ПЛАН_М3в.md §5: мелкая еда (вода) -- своя для вида
    const mixed = x.types.some((T) => { const n = Object.values(T.tr).reduce((p, q) => p + q, 0); return n && T.tr['еда'] / n >= 0.2 && T.tr['вода'] / n >= 0.2; });
    return ok('еда') && ok('вода') && !mixed; });
  console.log(`\n0. еда и вода -- разные виды: в ${sep.filter(Boolean).length} из ${s.length} -> ${sep.filter(Boolean).length >= 20 ? 'ДА' : 'нет (меры 1-3 -- с оговоркой)'}`); }
const line = (a, b, key, want, lvl) => { const A = C[a], B = C[b]; if (!A || !B) return `${a} против ${b}: нет данных`;
  const s = [...A.keys()].filter((k) => B.has(k)).sort((x, y) => x - y), d = s.map((k) => A.get(k)[key] - B.get(k)[key]).filter(Number.isFinite), t = wil2(d), md = med(d), ma = med(s.map((k) => A.get(k)[key]));
  const lv = lvl === undefined ? true : (want > 0 ? ma >= lvl : ma <= lvl), ok = t.p < 0.01 && (want < 0 ? md < 0 : md > 0) && lv;
  return `${a} против ${b}, ${key}: у ${a} медиана ${f(ma)}${lvl !== undefined ? ` (уровень ${lvl})` : ''}; разность -- медиана ${f(md, 3)}, в нужную сторону в ${d.filter((x) => want * x > 0).length} из ${d.length}; p = ${t.p.toExponential(2)} -> ${ok ? 'ДА' : 'нет'}`; };
console.log('1. ' + line('МГ', 'Б', 'need', 1, 0.65));
console.log('2. ' + line('МГ', 'Б', 'deval', -1, 0.5));
console.log('3. ' + line('МГ', 'Б', 'eat', 1));
if (C['П']) { const v = [...C['П'].values()], n = med(v.map((x) => x.need)), d = med(v.map((x) => x.deval)); console.log(`проверка мер: планка -- по нужде ${f(n)} (нужно ≥ 0.65), обесценивание ${f(d)} (нужно ≤ 0.5) -> меры ${n >= 0.65 && d <= 0.5 ? 'читаются' : 'НЕ читаются'}`); }
if (M) { const s = [...M.keys()], tot = {}; for (const k of s) { const x = M.get(k).exp; for (const [key, n] of Object.entries(x.goals || {})) { const T = x.types.find((q) => q.key === key), lab = key === 'прежний' ? 'прежний' : T ? label(T) || '?' : '?'; tot[lab] = (tot[lab] || 0) + n; } }
  const all = Object.values(tot).reduce((a, b) => a + b, 0); console.log('доп.: круги второй половины по целям (все миры): ' + Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(100 * n / all).toFixed(0)}%`).join(', '));
  console.log('доп.: ' + line('МГ', 'Б', 'deaths2', -1).replace(/ -> (ДА|нет)/, '')); }
for (const [key, want] of [['need', 1], ['deval', -1], ['eat', 1], ['deaths2', -1]]) console.log('доп. против М3в: ' + line('МГ', 'МС', key, want).replace(/ -> (ДА|нет)/, ''));

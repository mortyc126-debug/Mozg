// Р1 (ПЛАН.md §2-3): мозг А10 живёт 40000 кругов; на кругах 30001-33000 по отрезкам в 100 кругов снимаются его зачатки
// (свои события, ожидания органов, тяга отдела выбора, прирост с ценностью) и правда мира (для мер; переводчику не идёт).
// Запуск: node results/r1/speak.js <сид> <папка вывода>
const path = require('path'), fs = require('fs'), R = path.join(__dirname, '..', '..');
const K = require(R + '/src/knobs'), { WorldBody } = require(R + '/src/worldbody'), { Brain } = require(R + '/src/market');
const seed = +process.argv[2], out = process.argv[3];
const cfg = K.makeConfig({ SQ: 1, RENT: 0.05, MFEAT: 6, WORLD: 'body', ROUNDS: 40000, BRAIN: 9, KWATER: 1, KSAT: 1, KTWIN: 1, KPAINEV: 1, KDEATH: 1, KDNERVE: 1, KDPEN: 30,
  KPRED: 1, KBITE: 10, MVAL: 2, MNOPE: 1, MLOAN: 1000, KEXP: 4, MEXP: 2, MAVOID: 4, MBLEND: 2, MVPSI: 1, MAWAY: 1 });
const W = new WorldBody(cfg, seed), B = new Brain(cfg, W, seed), G = B.goods;
const T0 = 30000, NW = 30, LW = 100;
let dict = null, num = null; const wins = [];
const tot = () => Object.assign({}, B.exp.tot);
let cur = null;
for (let r = 1; r <= 40000; r++) {
  if (r === T0 + 1) { // словарь: что мозг знает о своих событиях; номера и чувства -- без названий мира
    const X = B.exp, letters = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦ', nl = (k) => 'чувство ' + letters[B.exp.ks.indexOf(k) >= 0 ? B.exp.ks.indexOf(k) : k];
    num = new Map(); let i = 1;
    dict = [...X.types.values()].filter((T) => T.cnt >= 3).map((T) => { num.set(T.key, i);
      const pm = T.ps && T.ps.pN ? T.ps.pS / T.ps.pN : null, sgn = T.key[0] === '+' ? 1 : -1;
      const pr = [...(T.proto || new Map()).entries()].filter(([, c]) => c / T.pn >= 0.5).map(([j, c]) => `${nl(parseInt(j, 10))} ${j.slice(-1) === '+' ? 'растёт' : 'падает'}`);
      return `событие ${i++}: ${sgn > 0 ? 'хорошее' : 'плохое'}, цена по мозгу ${pm === null ? '?' : (pm >= 0 ? '+' : '') + pm.toFixed(1)}; было ${T.cnt} раз; в нём: ${pr.length ? pr.join(', ') : 'ничего устойчивого'}`; });
  }
  if (r > T0 && (r - T0 - 1) % LW === 0 && wins.length < NW + 1) { cur = { ev: new Map(), psi: new Map(), drive: new Map(), td: 0, dmin: 1e9, tot0: tot(), bite: 0 }; wins.push(cur); }
  B.step();
  if (!cur || r <= T0) continue;
  const X = B.exp;
  // свои события мозга: прирост счёта видов
  if (!cur.cnt0) { cur.cnt0 = new Map([...X.types.values()].map((T) => [T.key, T.cnt])); }
  // ожидания органов: среднее ψ за отрезок против среднего органа
  for (const T of X.types.values()) if (T.org && T.org.fm > 0 && num.has(T.key)) { const a = cur.psi.get(T.key) || [0, 0]; a[0] += G.val[T.good] / T.org.fm; a[1]++; cur.psi.set(T.key, a); }
  // тяга отдела выбора: вес × руль каждого предложения
  const v = [...B.vrs.values()][0];
  if (v && X.prec) { const ps = X.prec[(v.n - 1) % cfg.MVH] || []; for (const p of ps) { const w = X.pw && X.pw.get(p.key); if (!w) continue; const a = cur.drive.get(p.key) || 0; cur.drive.set(p.key, a + Math.abs((w.al + w.ga * p.ctx) * p.u)); } }
  if (v && v.ok) cur.td += v.td[B.t % cfg.H];
  cur.dmin = Math.min(cur.dmin, Math.hypot(W.x - W.pred.x, W.y - W.pred.y)); if (W.biteNow) cur.bite++;
  if ((r - T0) % LW === 0) { cur.cnt1 = new Map([...X.types.values()].map((T) => [T.key, T.cnt])); cur.tot1 = tot(); if (wins.length > NW) break; }
}
// зачатки по отрезкам
const tds = wins.slice(0, NW).map((w) => w.td).sort((a, b) => a - b), q = (p) => tds[Math.min(NW - 1, Math.floor(p * NW))];
const lines = [], truth = [];
for (let i = 0; i < NW; i++) { const w = wins[i], parts = [];
  for (const [k, c1] of w.cnt1) { const d = c1 - (w.cnt0.get(k) || 0); if (d > 0 && num.has(k)) parts.push(`было ${num.get(k)}${d > 1 ? ' ×' + d : ''}`); }
  for (const [k, [s, n]] of w.psi) { const m = s / n; if (m > 2) parts.push(`жду ${num.get(k)} сильно`); else if (m > 1.3) parts.push(`жду ${num.get(k)}`); }
  const dr = [...w.drive.entries()].sort((a, b) => b[1] - a[1])[0]; if (dr && num.has(dr[0])) parts.push(`тянет ${dr[0][0] === '+' ? 'к' : 'от'} ${num.get(dr[0])}`);
  parts.push(w.td <= q(0.2) ? 'стало намного хуже' : w.td <= q(0.4) ? 'стало хуже' : w.td >= q(0.8) ? 'стало намного лучше' : w.td >= q(0.6) ? 'стало лучше' : 'как обычно');
  lines.push(parts.join('; '));
  const good = (t0, t1) => (t1['еда'] - t0['еда']) + (t1['еда-мелкая'] - t0['еда-мелкая']) + (t1['вода'] - t0['вода']) + (t1['вода-мелкая'] - t0['вода-мелкая']);
  const nx = wins[i + 1];
  truth.push({ q1: w.dmin < 8, q2: good(w.tot0, w.tot1) > 0, q3: w.bite > 0 || w.tot1['смерть'] > w.tot0['смерть'], q4: nx && nx.tot1 ? good(nx.tot0, nx.tot1) > 0 : null }); }
// перемешанные: строки переставлены по отрезкам (свой жребий)
let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280), perm = [...Array(NW).keys()];
for (let i = NW - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
fs.mkdirSync(out, { recursive: true });
const fmt = (ls) => 'СЛОВАРЬ МОЗГА:\n' + dict.join('\n') + '\n\nЗАЧАТКИ ПО ОТРЕЗКАМ:\n' + ls.map((l, i) => `${i + 1}. ${l}`).join('\n') + '\n';
fs.writeFileSync(path.join(out, `real_${seed}.txt`), fmt(lines));
fs.writeFileSync(path.join(out, `shuf_${seed}.txt`), fmt(perm.map((j) => lines[j])));
fs.writeFileSync(path.join(out, `truth_${seed}.json`), JSON.stringify({ seed, truth, perm }));
console.log(`сид ${seed}: ${dict.length} событий в словаре; правда: опасность ${truth.filter((t) => t.q1).length}, хорошее ${truth.filter((t) => t.q2).length}, сильно плохо ${truth.filter((t) => t.q3).length}, скоро хорошее ${truth.filter((t) => t.q4).length} из ${NW}`);

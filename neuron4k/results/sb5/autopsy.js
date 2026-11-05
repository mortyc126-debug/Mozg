// Сб5 (ПЛАН.md §1): вскрытие для изобретателя. Мозг Г (Сб4) живёт до круга T; снаружи по его нервам (круги 5000..T)
// считается, какие перепады нервов (правило мозга: изменение за круг сильнее 5 обычных разбросов, разброс -- его же
// скользящая оценка c.dabs) за 1..6 кругов предшествуют началу сигнала на каналах-целях. Всё безымянно: нервы -- номера.
// Запуск: node results/sb5/autopsy.js <сид> <папка> [T=20000] -> <папка>/autopsy_<сид>.txt и targets_<сид>.json (только для мер)
const path = require('path'), fs = require('fs'), R = path.join(__dirname, '..', '..');
const K = require(R + '/src/knobs'), { WorldBody } = require(R + '/src/worldbody'), { Brain } = require(R + '/src/market'), CP = require(R + '/src/compose');
const seed = +process.argv[2], out = process.argv[3], T = +process.argv[4] || 20000, T0 = 5000, LAGS = 6;
const cfg = K.makeConfig({ SQ: 1, RENT: 0.05, MFEAT: 6, WORLD: 'body', ROUNDS: 40000, BRAIN: 9, KWATER: 1, KSAT: 1, KTWIN: 1, KPAINEV: 1, KDEATH: 1, KDNERVE: 1, KDPEN: 30,
  KPRED: 1, KBITE: 10, MVAL: 2, MNOPE: 1, MLOAN: 1000, KEXP: 4, MEXP: 2, MAVOID: 4, MBLEND: 2, MVPSI: 1, MAWAY: 1, KVOICE: 1, KVSAL: 5, KVLAG: 3, KVREP: 5, CV3: 1, PLSAL: 1 });
const W = new WorldBody(cfg, seed), B = new Brain(cfg, W, seed), G = B.goods;
const TG = ['еда', 'вода', 'укус', 'удар'].map((w) => ({ w, k: W.nerves.findIndex((nv) => nv.kind === 'слово ' + w) }));
const n = W.nerves.length, hist = [];   // по кругам: список событий-перепадов [k, dir]
const cnt = new Map(), hits = new Map(), onsets = new Map(TG.map((g) => [g.k, 0])); let rounds = 0;
const key = (k, d) => `${k}${d > 0 ? '+' : '-'}`, prevV = new Float64Array(n).fill(NaN);
for (let t = 1; t <= T; t++) {
  B.step();
  const ev = []; for (let k = 0; k < n; k++) { const c = B.ch[k], x = G.val[c.good], dx = x - prevV[k]; prevV[k] = x; if (c.dabs > 0 && Math.abs(dx) > 6.25 * c.dabs) ev.push([k, dx > 0 ? 1 : -1]); }
  if (t < T0) continue; rounds++;
  for (const [k, d] of ev) cnt.set(key(k, d), (cnt.get(key(k, d)) || 0) + 1);
  // начало сигнала на цели -- её перепад вверх; кто был за 1..6 кругов до
  for (const g of TG) if (ev.some(([k, d]) => k === g.k && d > 0)) { onsets.set(g.k, onsets.get(g.k) + 1);
    for (let L = 1; L <= LAGS; L++) { const h = hist[hist.length - L]; if (!h) continue; for (const [k, d] of h) { if (k === g.k) continue; const hk = `${g.k}|${key(k, d)}|${L}`; hits.set(hk, (hits.get(hk) || 0) + 1); } } }
  hist.push(ev); if (hist.length > LAGS) hist.shift();
}
const lines = [`ВСКРЫТИЕ МОЗГА (круги ${T0}–${T}, ${rounds} кругов). Нервы -- номера 0..${n - 1}, названий нет.`,
  `Перепад нерва -- изменение за круг сильнее 5 его обычных разбросов; «+» -- вверх, «−» -- вниз.`, ''];
for (const g of TG) {
  const on = onsets.get(g.k), base = on / rounds; lines.push(`КАНАЛ-ЦЕЛЬ: нерв ${g.k}. Начал сигнала (перепад вверх): ${on}. Мозг предсказывает их плохо.`);
  const rows = []; for (const [ek, N] of cnt) { if (N < 5 || ek.startsWith(`${g.k}+`) || ek.startsWith(`${g.k}-`)) continue;
    let best = null; for (let L = 1; L <= LAGS; L++) { const h = hits.get(`${g.k}|${ek}|${L}`) || 0, p = h / N; if (h >= 3 && (!best || p > best.p)) best = { L, h, p }; }
    if (best) rows.push({ ek, N, ...best, lift: best.p / Math.max(base, 1e-9) }); }
  rows.sort((a, b) => b.lift - a.lift);
  lines.push(`  обычная доля кругов с началом сигнала: ${base.toFixed(4)}. Перепады, после которых начало сигнала бывает чаще обычного (лучшая задержка):`);
  for (const r of rows.slice(0, 8)) lines.push(`    перепад нерва ${r.ek.slice(0, -1)} ${r.ek.slice(-1) === '+' ? '+' : '−'}: случался ${r.N} раз; через ${r.L} кр. после него начало сигнала в ${(100 * r.p).toFixed(0)}% случаев (в ${r.lift.toFixed(0)} раз чаще обычного)`);
  if (!rows.length) lines.push('    таких перепадов нет');
  // что мозг уже собрал для этого канала (безымянно)
  const own = []; for (const o of B.mem.organs) if (o.type === 'сборка' && o.client === g.k) own.push(CP.show(o.prog)); for (const p of B.ch[g.k].parts) for (const d of p.inputs) for (const id of (typeof d === 'number' ? [d] : d)) { const o = G.owner[id]; if (o && o.kind === 'память' && o.prog) own.push(CP.show(o.prog)); }
  lines.push(`  мозг уже собрал для этого канала: ${own.length ? [...new Set(own)].join('; ') : 'ничего'}`); lines.push('');
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, `autopsy_${seed}.txt`), lines.join('\n') + '\n');
fs.writeFileSync(path.join(out, `targets_${seed}.json`), JSON.stringify(Object.fromEntries(TG.map((g) => [g.w, g.k]))));
console.log(`сид ${seed}: вскрытие готово`);

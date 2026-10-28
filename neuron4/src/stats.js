'use strict';
// Замеры нейрона-4. Правда о нервах (что за нерв) берётся у мира и служит только замерам: мозг её не видит.
const { solve } = require('./linalg');

const KINDS = ['источник', 'смесь', 'глубокий', 'состояние', 'цель', 'глаз', 'двигатель', 'положение', 'пустышка', 'тайный', 'произведение', 'этаж', 'ключ', 'значение', 'пиксель', 'метка', 'знак', 'слово', 'рот', 'улыбка', 'ухо', 'вопрос'];
const WINB = new Set(['этаж', 'значение']);   // у них хвосты тяжёлые -- биты по окну ~500 кругов, как hBits нейрона-3
const hBits = (p) => (p.eW > 0 && p.yW > 0 ? Math.max(0, 0.5 * Math.log2(p.yW / p.eW)) : 0);
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? (b.length & 1 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN; };

class Meter {
  constructor(B) {
    this.B = B; this.win = []; this.cs = 0; this.cn = 0; this.d2 = 0; this.ops0 = {}; this.t0 = 0;
    this.LOG = 4000; this.log = null; this.logN = 0;   // длинный журнал нервов -- для линейного потолка бит
  }
  each() {                                  // каждый круг
    const B = this.B, W = B.world, d = W.z.val - W.g.val;
    this.cs += W.comfort() / B.cfg.CPAY; this.d2 += d * d; this.cn++;
    const n = B.ch.length;
    if (!this.log || this.log.n !== n) { this.log = { n, v: new Float64Array(this.LOG * n), u: new Float64Array(this.LOG * n) }; this.logN = 0; }
    const o = (this.logN % this.LOG) * n; for (let k = 0; k < n; k++) { this.log.v[o + k] = B.goods.val[B.ch[k].good]; this.log.u[o + k] = B.u[k]; } this.logN++;
  }
  chBits(c, kind) { let b = 0; for (const p of c.parts) b = Math.max(b, WINB.has(kind) ? hBits(p) : p.bitsAvg); return b; }
  // как statsBig нейрона-3: бит канала -- медиана частей; «понято» -- среднее долей по видам
  understood() {
    const B = this.B, W = B.world, S = W.S; if (!S) return null;
    const medBits = (k, win) => { const ps = B.ch[k].parts; return ps.length ? med(ps.map((p) => (win ? hBits(p) : p.bits))) : 0; };
    const frac = (ks, f) => (ks.length ? ks.filter(f).length / ks.length : NaN);
    // рёбра смесей: k <- t найдено, если хотя бы четверть частей канала k (не меньше одной) держит вход «нерв t» или «прогноз части канала t»
    // с долей вклада не меньше 5%
    const G = B.goods, found = new Set();
    for (const k of S.mixCh) { const ps = B.ch[k].parts, cnt = new Map();
      for (const p of ps) { const seen = new Set(); p.inputs.forEach((id, i) => { if (!p.share || p.share[i] < 0.05) return; const kind = G.kind[id];
          if (kind === 'нерв' || kind === 'прогноз') seen.add(G.nerve[id]); }); for (const t of seen) cnt.set(t, (cnt.get(t) || 0) + 1); }
      for (const [t, n] of cnt) if (n >= Math.max(1, 0.25 * ps.length)) found.add(k * S.K + t); }
    let tE = 0, hit = 0; for (const k of S.mixCh) for (const t of S.parents[k]) { tE++; if (found.has(k * S.K + t)) hit++; }
    let tp = 0; for (const key of found) { const k = Math.floor(key / S.K), t = key % S.K; if (S.parents[k].includes(t) || S.grand[k].includes(t)) tp++; }
    const u = { recall: tE ? hit / tE : NaN, prec: found.size ? tp / found.size : NaN,
      deepOK: frac(S.deepCh, (k) => medBits(k) >= 1), prodOK: frac(S.prodCh, (k) => medBits(k) >= 0.5),
      hierOK: frac(S.hierCh, (k) => medBits(k, true) >= 1.5), valOK: frac(S.valCh, (k) => medBits(k, true) >= 1.5) };
    const v = [u.recall, u.deepOK, u.prodOK, u.hierOK, u.valOK].filter(Number.isFinite); u.share = v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
    return u;
  }
  snap() {                                   // окно замера
    const B = this.B, truth = B.world.truth(), byKind = {};
    for (const c of B.ch) (byKind[truth[c.k]] = byKind[truth[c.k]] || []).push(this.chBits(c, truth[c.k]));
    const ops = {}; for (const [k, v] of Object.entries(B.led.ops)) ops[k] = (v - (this.ops0[k] || 0)) / Math.max(1, B.t - this.t0);
    this.ops0 = { ...B.led.ops }; this.t0 = B.t;
    const map = {}; for (const c of B.ch) { const k = truth[c.k]; (map[k] = map[k] || {})[c.port.st] = (map[k][c.port.st] || 0) + 1; }
    const s = { t: B.t, bits: Object.fromEntries(KINDS.map((k) => [k, byKind[k] ? med(byKind[k]) : NaN])), comfort: this.cs / this.cn, d2: this.d2 / this.cn,
      und: this.understood(), parts: B.partsAll().length, motors: B.ex.motors.length, explorer: B.ex.agent ? 1 : 0, ops, map, credit: med(B.partsAll().map((p) => p.credit)) };
    this.cs = 0; this.d2 = 0; this.cn = 0; this.win.push(s); return s;
  }
  // линейный потолок: нерв t+1 по всем нервам и командам круга t (наименьшие квадраты на журнале) -- бит
  ceiling() {
    const B = this.B, L = this.log, n = L.n, N = Math.min(this.logN, this.LOG) - 1, truth = B.world.truth(), out = {};
    if (N < 500) return out;
    const start = this.logN - N - 1, row = (i) => ((start + i) % this.LOG) * n;
    const used = []; for (let k = 0; k < n; k++) used.push(k);
    const cmd = []; for (let k = 0; k < n; k++) { let s = 0; for (let i = 0; i < N; i++) s += Math.abs(L.u[row(i) + k]); if (s > 0) cmd.push(k); }
    const m = used.length + cmd.length + 1;
    const A = new Float64Array(m * m), f = new Float64Array(m);
    for (let i = 0; i < N; i++) { const o = row(i); let j = 0; for (const k of used) f[j++] = L.v[o + k]; for (const k of cmd) f[j++] = L.u[o + k]; f[j] = 1;
      for (let a = 0; a < m; a++) for (let b = 0; b <= a; b++) A[a * m + b] += f[a] * f[b]; }
    for (let a = 0; a < m; a++) for (let b = 0; b < a; b++) A[b * m + a] = A[a * m + b];
    const per = {};
    for (let k = 0; k < n; k++) {
      const cv = new Float64Array(m); let yy = 0, sy = 0;
      for (let i = 0; i < N; i++) { const o = row(i), y = L.v[row(i + 1) + k]; let j = 0; for (const q of used) cv[j++] += L.v[o + q] * y; for (const q of cmd) cv[j++] += L.u[o + q] * y; cv[j] += y; yy += y * y; sy += y; }
      const r = solve(A, cv, m, yy, new Float64Array(m).fill(1e-6)); if (!r) continue;
      const v = (yy - sy * sy / N) / N, mse = r.sse / N;
      (per[truth[k]] = per[truth[k]] || []).push(Math.max(0, 0.5 * Math.log2(v / Math.max(mse, 1e-9))));
    }
    for (const k of KINDS) if (per[k]) out[k] = med(per[k]);
    return out;
  }
}
// Бутстреп по мирам (разбор 22.10): среднее, 95% интервал и доля повторных выборок миров, где среднее не ниже порога. Жребий
// свой и постоянный -- числа воспроизводимы. Сдача по-прежнему -- среднее против порога, заданного заранее; интервал показывает,
// сдача это или удача миров (Agarwal et al. 2021 -- PLAN.md, п. 2)
function boot(xs, thr, n = 20000) {
  const v = xs.filter(Number.isFinite); if (!v.length) return null;
  const mean = v.reduce((a, b) => a + b, 0) / v.length; let s = 0x9e3779b9;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  const B = new Float64Array(n); let up = 0;
  for (let i = 0; i < n; i++) { let t = 0; for (let j = 0; j < v.length; j++) t += v[Math.floor(rnd() * v.length)]; B[i] = t / v.length; if (B[i] >= thr) up++; }
  B.sort(); return { mean, lo: B[Math.floor(0.025 * n)], hi: B[Math.floor(0.975 * n)], pUp: up / n, n: v.length };
}
// строка для экзаменов: «95% ДИ [lo, hi]; среднее не ниже порога в N% повторных выборок»
function bootLine(xs, thr, fmt = (x) => x.toFixed(2)) {
  const b = boot(xs, thr); if (!b) return '';
  return `95% ДИ по мирам [${fmt(b.lo)}, ${fmt(b.hi)}] (бутстреп, ${b.n} миров); среднее не ниже порога ${fmt(thr)} в ${Math.round(100 * b.pUp)}% повторных выборок`;
}
module.exports = { Meter, KINDS, med, boot, bootLine };

'use strict';
// Изобретатель форм (ступень 6, results/s6/ПЛАН.md §2; INV = 1). Вне рынка; работает по запросу мозга и рождает следы
// через гиппокамп. Форма -- «и» нескольких условий «перепад x был D1..D2 кругов назад» (кирпичики врождённые: прежняя форма
// следа -- одно условие с D1 = D2; «или» соседних задержек -- окно; «и» -- два условия).
// Запрос: раз в 1000 кругов -- пара «нерв-цель k, перепад x», у которой совпадений по всем задержкам вместе много (не меньше
// 3·HMIN, z суммы > HZC), а живые следы x для k объясняют меньше половины. Предложения: все окна из двух и больше задержек
// в 1..HLAG и «и» x (на его лучшей задержке) с пятью лучшими другими перепадами перед k. Примерка на живом опыте 5000
// кругов; принята форма с наибольшим z (поправка ПЛАН.md §6), если совпадений не меньше HMIN, подъём не меньше HLIFT и
// z > HZC + sqrt(2 ln m), m -- число примерок. Принятая форма -- след гиппокампа (один изобретённый на нерв-цель сверх HPER).
const TRIAL = 5000, MAXTRIALS = 8;
class Inventor {
  constructor(B) { this.trials = []; this.cool = new Map(); this.requests = 0; this.accepted = []; this.tried = 0; }
  static fires(H, f, s, cfg) { for (const c of f) { let ok = false; for (let D = c.D1; D <= c.D2 && !ok; D++) { const q = s - D; if (q > 0 && H.log[q % cfg.H].includes(c.x)) ok = true; } if (!ok) return false; } return true; }
  // INVF >= 2: форма с «следствия ещё не было»; возвращает задержку первого условия (для риска) или -1
  static firesNT(H, f, s, cfg, nt) { const { form } = require('./hippocampus').Hippocampus; if (!form(H.log, cfg.H, f, s, nt)) return -1;
    const c = f[0]; for (let D = c.D1; D <= c.D2; D++) { const q = s - D; if (q > 0 && H.log[q % cfg.H].includes(c.x)) return D; } return -1; }
  sense(B) {
    const H = B.hippo, cfg = B.cfg, t = B.t; if (!this.trials.length) return; const now = H.log[t % cfg.H]; let ops = 0;
    const NT = cfg.INVF >= 2;
    for (const T of this.trials) { const on = now.includes(2 * T.tk + 1); for (const c of T.cands) { ops += c.f.length * 3;
      if (!NT) { if (Inventor.fires(H, c.f, t - 1, cfg)) { c.N++; if (on) c.h++; } continue; }
      const D = Inventor.firesNT(H, c.f, t - 1, cfg, T.tk); if (D < 0) continue; c.N++; if (on) c.h++; if (!c.nD) { c.nD = new Float64Array(cfg.HLAG + 1); c.hD = new Float64Array(cfg.HLAG + 1); } c.nD[D]++; if (on) c.hD[D]++; } }
    // выученный риск принятых форм уточняется и дальше
    if (cfg.INVF === 3) for (const tr of H.traces) if (tr.inv && tr.hz) { const D = Inventor.firesNT(H, tr.f, t - 1, cfg, tr.nt); if (D < 0) continue; tr.nD[D]++; if (now.includes(2 * tr.nt + 1)) tr.hD[D]++; tr.hz[D] = (tr.hD[D] + tr.base) / (tr.nD[D] + 1); }
    B.led.work(null, ops);
  }
  learn(B) {
    const H = B.hippo, cfg = B.cfg, t = B.t;
    // конец примерок
    for (const T of this.trials.filter((q) => t - q.start >= TRIAL)) { this.trials.splice(this.trials.indexOf(T), 1);
      const base = H.on[T.tk] / H.rounds, m = T.cands.length, thr = cfg.HZC + Math.sqrt(2 * Math.log(m)); let best = null;
      for (const c of T.cands) { if (c.h < cfg.HMIN || !(c.N > 0)) continue; const lift = c.h / c.N / base, z = (c.h - c.N * base) / Math.sqrt(c.N * base * (1 - base));
        const pass = cfg.INVC ? c.h / c.N - base >= 0.05 : lift >= cfg.HLIFT;
        if (pass && z > thr && (!best || z > best.z)) best = { c, lift, z }; }
      this.cool.set(T.key, t + 10000);
      if (best && !H.traces.some((q) => q.inv && q.targets.has(T.tk))) { const c = best.c;
        let hz; if (cfg.INVF === 3) { hz = new Float64Array(cfg.HLAG + 1); for (let D = 0; D <= cfg.HLAG; D++) hz[D] = (c.hD[D] + base) / (c.nD[D] + 1); }
        const tr = H.birthForm(B, c.f, T.tk, c.h / c.N - base, Math.min(c.N, cfg.HPRIOR), cfg.INVF >= 2 ? T.tk : -1, hz);
        if (hz) { tr.nD = Float64Array.from(c.nD); tr.hD = Float64Array.from(c.hD); tr.base = base; }
        this.accepted.push({ tk: T.tk, f: c.f, t, lift: +best.lift.toFixed(1), z: +best.z.toFixed(1), m }); } }
    if (t % 1000 !== 0 || t < 3000) return;
    // запросы: совпадения по всем задержкам вместе
    const agg = new Map(), top = new Map();
    for (const [key, h] of H.hit) { const x = key % 4096, q = Math.floor(key / 4096), L = q % 64, tk = Math.floor(q / 64), k2 = tk * 4096 + x;
      const a = agg.get(k2) || { tk, x, H: 0, byL: new Array(cfg.HLAG + 1).fill(0) }; a.H += h; a.byL[L] += h; agg.set(k2, a);
      const tl = top.get(tk) || []; tl.push({ x, L, h }); top.set(tk, tl); }
    B.led.work(null, H.hit.size);
    for (const a of [...agg.values()].sort((p, q) => q.H - p.H)) { if (this.trials.length >= MAXTRIALS) break;
      const key = a.tk * 4096 + a.x; if (this.trials.some((T) => T.key === key) || (this.cool.get(key) || 0) > t) continue;
      if (H.traces.some((q) => q.inv && q.targets.has(a.tk))) continue;
      const N = H.N.get(a.x) || 0, base = H.on[a.tk] / H.rounds, ex = N * cfg.HLAG * base; if (a.H < 3 * cfg.HMIN || !(ex > 0)) continue;
      if ((a.H - ex) / Math.sqrt(ex) <= cfg.HZC) continue;
      let expl = 0; for (const q of H.traces) if (!q.inv && q.x === a.x && q.targets.has(a.tk) && q.D + 1 <= cfg.HLAG) expl += a.byL[q.D + 1];
      if (expl >= a.H / 2) continue;
      // предложения
      const cands = [], bestL = a.byL.indexOf(Math.max(...a.byL.slice(1)));
      for (let L1 = 1; L1 <= cfg.HLAG; L1++) for (let L2 = L1 + 1; L2 <= cfg.HLAG; L2++) cands.push({ f: [{ x: a.x, D1: L1 - 1, D2: L2 - 1 }], N: 0, h: 0 });
      const ys = (top.get(a.tk) || []).filter((y) => y.x !== a.x && (y.x >> 1) !== a.tk).sort((p, q) => q.h - p.h).slice(0, 5);
      for (const y of ys) cands.push({ f: [{ x: a.x, D1: bestL - 1, D2: bestL - 1 }, { x: y.x, D1: y.L - 1, D2: y.L - 1 }], N: 0, h: 0 });
      this.trials.push({ key, tk: a.tk, x: a.x, start: t, cands }); this.requests++; this.tried += cands.length; }
  }
}
module.exports = { Inventor };

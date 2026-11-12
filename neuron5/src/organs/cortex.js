'use strict';
// Кора: рынок частей-предсказателей. У каждого нерва -- до PER частей; часть предсказывает свой нерв на круг вперёд
// линейно по купленным товарам шины (нервы, команды, польза, выходы органов, прогнозы других частей). Веса -- наименьшими
// квадратами по записи (fit) и малым шагом учёбы между подгонками; входы ищутся по остатку (search: связь на чётных
// кругах, проверка на нечётных; слабое доказательство копится по окнам записи). Мир платит за биты предсказания (за нервы-слова -- в SAL раз больше: врождённое
// внимание к голосу); часть платит аренду и за работу, а хозяевам входов -- долю дохода по вкладу «без одного».
// Думает часть на свои. В долгу дольше DIE кругов -- умирает; канал помнит входы лучшей из павших (записная книжка) и
// подарки гиппокампа (deliver): новичок начинает с них.
const { solve } = require('../linalg');

class Cortex {
  constructor(B) {
    const cfg = B.cfg, voice = new Set(B.world.innate.voice);
    this.ch = B.nerve.map((good, k) => ({ k, good, parts: [], slots: Array.from({ length: cfg.PER }, () => B.bus.add('прогноз', null, k, 0)),
      mean: 0, var: 1, nv: 0, note: null, gifts: [], fails: 0, next: 0, sal: voice.has(k) ? cfg.SAL : 1 }));
    this.births = 0; this.deaths = 0;
  }
  // прогноз коры для нерва k на следующий круг -- среднее его частей (для мер и для других отделов)
  forecast(k) { const c = this.ch[k]; let s = 0, n = 0; for (const p of c.parts) if (p.age >= 1) { s += p.pred; n++; } return n ? s / n : c.mean; }
  live(B, g) { const k = B.bus.kind[g]; return k === 'прогноз' || k === 'след' ? !!(B.bus.owner[g] && B.bus.owner[g].alive) : true; }
  plug(B, p, g, w, prior) { p.in.push(g); p.gen.push(B.bus.gen[g]); p.w.push(w); p.prior.push(prior); if (p.share) p.share.push(0); p.x = null; }
  unplug(p, i) { p.in.splice(i, 1); p.gen.splice(i, 1); p.w.splice(i, 1); p.prior.splice(i, 1); if (p.share) p.share.splice(i, 1); p.x = null; }

  // расчёт за прошлый прогноз: ошибка, шаг учёбы, плата мира за биты, плата входам по вкладу
  sense(B) {
    const cfg = B.cfg, bus = B.bus, led = B.led;
    for (const c of this.ch) { const v = B.obs[c.k];
      if (c.nv < 50) { c.nv++; c.mean += (v - c.mean) / c.nv; c.var += ((v - c.mean) ** 2 - c.var) / c.nv; } else { const d = v - c.mean; c.mean += 0.002 * d; c.var += 0.002 * (d * d - c.var); }
      for (const p of c.parts) { bus.val[p.slot] = p.pred; if (p.age < 1) continue;   // прогноз этого круга, сделанный кругом раньше, -- на шину
        const e = v - p.pred; p.mse += cfg.BETA * (e * e - p.mse);
        if (p.fresh) p.fresh = false;   // после подгонки или смены входов -- без шага учёбы: ошибка ещё от прежних весов
        else if (p.x) { let nx = 1; for (const x of p.x) nx += x * x; const g = cfg.LR * e / nx; for (let i = 0; i < p.w.length; i++) p.w[i] += g * p.x[i]; p.b += g; }
        p.bits = Math.max(0, 0.5 * Math.log2(Math.max(c.var, 1e-9) / Math.max(p.mse, 1e-9)));
        if (p.bits > 0) led.earn(p, cfg.PAY * p.bits * c.sal, 'мир->часть: биты');
        if (p.incLast > 0 && p.share) for (let i = 0; i < p.in.length; i++) { const o = bus.owner[p.in[i]];
          if (o && o.alive && o !== p && p.share[i] > 0 && bus.gen[p.in[i]] === p.gen[i]) led.pay(p, o, cfg.ROY * p.incLast * p.share[i], `часть->${o.kind}: вклад`); } } }
  }
  // прогноз на следующий круг по товарам этого круга
  expect(B) {
    const bus = B.bus;
    for (const c of this.ch) for (const p of c.parts) {
      for (let i = p.in.length - 1; i >= 0; i--) if (bus.gen[p.in[i]] !== p.gen[i]) this.unplug(p, i);   // место товара занято заново -- вход отпущен
      const L = p.in.length; if (!p.x || p.x.length !== L) p.x = new Float64Array(L);
      let s = p.b; for (let i = 0; i < L; i++) { const v = bus.val[p.in[i]]; p.x[i] = v; s += p.w[i] * v; }
      p.pred = s; B.led.work(p, L + 1); }
  }
  learn(B) {
    const cfg = B.cfg, rng = B.rng;
    for (const c of this.ch) {
      for (const p of c.parts) { const L = p.in.length, n = cfg.H;   // думать -- на свои: подгонка и поиск, только если часть их оплатит
        if (rng() < 1 / cfg.FITP && p.credit > cfg.PCPU * n * (L + 1) * (L + 1)) this.fit(B, p);
        if (L < cfg.LMAX && rng() < cfg.SRCH && p.credit > cfg.PCPU * cfg.NCAND * n) this.search(B, p); }
      if (c.parts.length < cfg.PER && B.t >= c.next) this.born(B, c); }
  }
  born(B, c) {
    const cfg = B.cfg, bus = B.bus, slot = c.slots.find((s) => !c.parts.some((p) => p.slot === s));
    const p = B.led.open('часть', cfg.START, { home: this, c, slot, in: [], gen: [], w: [], prior: [], share: null, ev: new Map(), b: c.mean, pred: c.mean, mse: c.var, bits: 0, x: null, fresh: true });
    bus.renew(slot, p, c.k, B.t); c.parts.push(p); this.births++;
    if (c.note) { const N = c.note; p.b = N.b; for (let j = 0; j < N.in.length; j++) if (bus.gen[N.in[j]] === N.gen[j] && this.live(B, N.in[j])) this.plug(B, p, N.in[j], N.w[j], N.prior[j]); }
    c.gifts = c.gifts.filter((g) => bus.gen[g.good] === g.gen);
    for (const g of c.gifts) if (!p.in.includes(g.good) && p.in.length < cfg.LMAX) this.plug(B, p, g.good, g.w0, { k: g.kappa, w: g.w0 });
    if (p.in.length) this.fit(B, p);
  }
  bury(B, p) {
    const c = p.c, ok = p.incAvg > B.cfg.RENT; c.parts.splice(c.parts.indexOf(p), 1); this.deaths++;
    if (!c.note || p.incAvg >= c.note.inc) c.note = { in: p.in.slice(), gen: p.gen.slice(), w: p.w.slice(), prior: p.prior.slice(), b: p.b, inc: p.incAvg };
    c.fails = ok ? 0 : c.fails + 1; c.next = B.t + 100 * 2 ** Math.min(c.fails, 7);   // канал, где никто не окупается, зовёт новичков всё реже
  }
  // подарок органа каналу k: товар good с памятью связи (вес w0 стоит kappa наблюдений) -- всем частям канала и новичкам
  deliver(B, k, good, w0, kappa) {
    const c = this.ch[k], bus = B.bus, prior = { k: kappa, w: w0 };
    c.gifts = c.gifts.filter((g) => bus.gen[g.good] === g.gen && g.good !== good); c.gifts.push({ good, gen: bus.gen[good], w0, kappa }); c.fails = 0; c.next = Math.min(c.next, B.t);
    for (const p of c.parts) { const i = p.in.indexOf(good); if (i >= 0) { p.prior[i] = prior; continue; }
      if (p.in.length >= B.cfg.LMAX) { let weak = -1, wv = Infinity; for (let j = 0; j < p.in.length; j++) { const s = p.share ? p.share[j] : 0; if (!p.prior[j] && s < wv) { wv = s; weak = j; } } if (weak < 0) continue; this.unplug(p, weak); }
      this.plug(B, p, good, w0, prior); this.fit(B, p); }
  }
  // подгонка весов по записи: нерв круга s+1 по товарам круга s; память связи -- гребень к весу w0 силой kappa наблюдений
  fit(B, p) {
    const bus = B.bus, c = p.c, L = p.in.length, t0 = bus.from([c.good, ...p.in]), t1 = B.t - 1, n = t1 - t0 + 1; if (n < 60) return false;
    const d = L + 1, A = new Float64Array(d * d), cv = new Float64Array(d), f = new Float64Array(d); let yy = 0, sy = 0; f[0] = 1;
    for (let s = t0; s <= t1; s++) { for (let i = 0; i < L; i++) f[1 + i] = bus.at(s, p.in[i]); const y = bus.at(s + 1, c.good); yy += y * y; sy += y;
      for (let a = 0; a < d; a++) { cv[a] += f[a] * y; for (let b = 0; b <= a; b++) A[a * d + b] += f[a] * f[b]; } }
    for (let a = 0; a < d; a++) for (let b = 0; b < a; b++) A[b * d + a] = A[a * d + b];
    for (let i = 0; i < L; i++) if (p.prior[i]) { const q = p.prior[i]; A[(1 + i) * d + 1 + i] += q.k; cv[1 + i] += q.k * q.w; yy += q.k * q.w * q.w; }
    const mask = new Float64Array(d).fill(1e-3); mask[0] = 0;
    const r = solve(A, cv, d, yy, mask); B.led.work(p, n * d * d + (r ? r.ops : 0)); if (!r) return false;
    p.b = r.w[0]; for (let i = 0; i < L; i++) p.w[i] = r.w[1 + i];
    // вклад «без одного»: на сколько выросла бы сумма квадратов ошибки без входа i -- доля разброса нерва
    const tot = Math.max(1e-9, yy - sy * sy / n); p.share = p.in.map((_, i) => Math.min(1, r.w[1 + i] ** 2 / Math.max(r.inv[1 + i], 1e-12) / tot));
    let weak = -1, wv = 1e-3; for (let i = 0; i < L; i++) if (!p.prior[i] && p.share[i] < wv) { wv = p.share[i]; weak = i; }
    if (weak >= 0) this.unplug(p, weak);   // вход без вклада отпускается (по одному за подгонку)
    p.fresh = true; return true;
  }
  // поиск входа: кандидаты наугад со всей шины; связь с остатком на чётных кругах, того же знака на нечётных
  search(B, p) {
    const cfg = B.cfg, bus = B.bus, c = p.c, t0 = Math.max(bus.from([c.good, ...p.in]), B.t - 256), t1 = B.t - 1, n = t1 - t0 + 1; if (n < 60) return false;
    const res = new Float64Array(n); for (let s = t0; s <= t1; s++) { let q = p.b; for (let i = 0; i < p.in.length; i++) q += p.w[i] * bus.at(s, p.in[i]); res[s - t0] = bus.at(s + 1, c.good) - q; }
    const have = new Set(p.in); have.add(p.slot); const cand = [];
    for (let j = 0; j < 4 * cfg.NCAND && cand.length < cfg.NCAND; j++) { const g = B.rng.int(bus.n); if (have.has(g) || bus.since[g] >= t0 || !this.live(B, g)) continue; have.add(g); cand.push(g); }
    const zc = Math.sqrt(2 * Math.log(Math.max(2, cand.length))) + 1.5; let best = -1, bz = 0;
    for (const g of cand) { const S = [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]];
      for (let s = t0; s <= t1; s++) { const x = bus.at(s, g), y = res[s - t0], q = S[s & 1]; q[0]++; q[1] += x; q[2] += y; q[3] += x * x; q[4] += y * y; q[5] += x * y; }
      const cr = S.map(([m, sx, sr, sxx, srr, sxr]) => { const vx = sxx - sx * sx / m, vr = srr - sr * sr / m; return vx > 1e-12 && vr > 1e-12 ? (sxr - sx * sr / m) / Math.sqrt(vx * vr) * Math.sqrt(m) : 0; });
      let z = cr[0] * cr[1] > 0 ? Math.min(Math.abs(cr[0]), Math.abs(cr[1])) : 0;
      // слабая, но верная связь (редкое слово состояния) в одном окне не видна: доказательство копится по окнам записи,
      // которые не пересекаются (z складываются: сумма над корнем из числа окон)
      const key = g * 1024 + bus.gen[g] % 1024, a = p.ev.get(key) || { s: 0, n: 0, t: -1 };
      if (t0 > a.t) { a.s += (cr[0] + cr[1]) / Math.SQRT2; a.n++; a.t = t1; p.ev.set(key, a); }
      if (a.n >= 2) z = Math.max(z, Math.abs(a.s) / Math.sqrt(a.n));
      if (z > zc && z > bz) { bz = z; best = g; } }
    B.led.work(p, cand.length * n * 2 + n * (p.in.length + 1));
    if (best < 0) return false; this.plug(B, p, best, 0, null); this.fit(B, p); return true;
  }
}
module.exports = { Cortex };

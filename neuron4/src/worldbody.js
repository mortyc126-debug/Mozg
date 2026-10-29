'use strict';
// Мир тела с влечениями (WORLD=body; программа «Колония», шаг К1 -- results/kolonia/ПЛАН_К1.md).
// Арена KA x KA со стенками; тело -- точка со скоростью KSPD, поворот KTURN tanh(u) по нерву двигателя. Одна еда и одна вода:
// взяты ближе KRF -- появляются в новом месте. Влечения: сытость E и напоённость H (0..1) убывают на KDEC за круг; еда даёт
// E + KGAIN, вода -- H + KGAIN. Нервы без меток, вперемешку: запах еды слева / справа, запах воды слева / справа, касание
// слева / справа, E, H (внутренние нервы), положение (копия своего поворота), двигатель (выходной).
// Польза (общий сигнал): C = CPAY (1 - 2(1-E)^2 - 2(1-H)^2) - KPAIN касание. Плата двигателю -- вклад этого круга: C минус
// польза без движения в этом круге (не съел, не выпил, не коснулся).
// KPLANK=1 -- планка: поворот по вшитому правилу «к запаху того, чего не хватает», команды мозга не действуют.
// KTWIN=1 -- плата двигателю против двойника, который никогда не двигался (влечения только убывают); KPAINEV=1 -- боль
// только в первом круге касания (К1б, results/kolonia/ПЛАН_К1б.md).
// KDEATH=1 -- смерть (К1ж): сытость (напоённость) до нуля -- штраф KDPEN, тело возрождается сытым в новом месте, мозг помнит;
// KDNERVE=1 -- нерв «смерть» (1 в круге смерти); 2 -- тот же нерв, всегда 0; 3 -- вспышки наугад с шансом KDRATE (К1з).
// KSAT=1 -- обесценивание: во второй половине жизни через блок по KSATL кругов мир держит E = 1 (тело накормлено извне).
const { stream } = require('./rng');

class WorldBody {
  constructor(cfg, seed) {
    this.cfg = cfg; this.seed = seed; const c = cfg;
    const r = stream(seed, 'устройство мира'); this.rn = stream(seed, 'шум мира'); this.rp = stream(seed, 'место');
    this.x = c.KA / 2; this.y = c.KA / 2; this.th = 2 * Math.PI * this.rp(); this.E = 1; this.H = 1; this.turn = 0;
    const put = () => ({ x: c.KA * this.rp(), y: c.KA * this.rp() }); this.put = put; this.food = put(); this.water = put();
    const ch = (kind) => ({ kind, val: 0 });
    this.chs = { fl: ch('запах еды слева'), fr: ch('запах еды справа'), wl: ch('запах воды слева'), wr: ch('запах воды справа'),
      tl: ch('касание слева'), tr: ch('касание справа'), e: ch('сытость'), h: ch('напоённость'), p: ch('положение'), m: ch('двигатель') };
    if (cfg.KDNERVE) this.chs.d = ch('смерть');   // К1ж: нерв «смерть» -- 1 в круге смерти
    this.nerves = Object.values(this.chs).map((x) => ({ ch: x, kind: x.kind }));
    for (let i = this.nerves.length - 1; i > 0; i--) { const j = r.int(i + 1); [this.nerves[i], this.nerves[j]] = [this.nerves[j], this.nerves[i]]; }
    this.deathNerve = this.chs.d ? this.nerves.findIndex((nv) => nv.ch === this.chs.d) : -1; this.died = 0;
    if (cfg.KDNERVE === 3) this.rd = stream(seed, 'смерть-шум');   // К1з: вспышки нерва наугад -- свой жребий, мир не трогает
    this.ds = { half: [0, 0], fearB: 0, fearBn: 0, fearA: 0, fearAn: 0, buf: [] };   // смерти по половинам жизни; прогноз смерти перед ней и всегда
    this.motorNerve = this.nerves.findIndex((nv) => nv.ch === this.chs.m); this.propNerve = this.nerves.findIndex((nv) => nv.ch === this.chs.p);
    this.plugged = true; this.t = 0; this.z = { val: 0 }; this.g = { val: 0 };   // z, g -- для общих замеров (польза меряется через comfort)
    this.C = 0; this.marg = 0; this.touch = 0; this.prevTouch = 0; this.Et = 1; this.Ht = 1;   // Et, Ht -- двойник, который никогда не двигался (KTWIN)
    this.st = { food: 0, water: 0, n: 0, byNeed: [0, 0], blk: { sat: [0, 0], norm: [0, 0] }, wall: 0, nSat: 0, nNorm: 0 };
    this.sense();
  }
  get n() { return this.nerves.length; }
  observe(out) { const c = this.cfg; for (let k = 0; k < this.nerves.length; k++) out[k] = this.nerves[k].ch.val + c.SN * this.rn.gauss(); return out; }
  util(E, H, touch) { const c = this.cfg; return c.CPAY * (1 - 2 * (1 - E) ** 2 - 2 * (1 - H) ** 2) - c.KPAIN * touch; }
  comfort() { return this.C; }
  marginal() { return this.marg; }
  sated() { const c = this.cfg; return c.KSAT && this.t > c.ROUNDS / 2 && Math.floor(this.t / c.KSATL) % 2 === 1; }
  odor(o, a) { const c = this.cfg, sx = this.x + 0.8 * Math.cos(this.th + a), sy = this.y + 0.8 * Math.sin(this.th + a); return Math.exp(-Math.hypot(sx - o.x, sy - o.y) / c.KLAM); }
  sense() {
    const S = this.chs;
    S.fl.val = 3 * this.odor(this.food, 0.6); S.fr.val = 3 * this.odor(this.food, -0.6); S.wl.val = this.cfg.KWATER ? 3 * this.odor(this.water, 0.6) : 0; S.wr.val = this.cfg.KWATER ? 3 * this.odor(this.water, -0.6) : 0;
    S.e.val = this.E; S.h.val = this.H; S.p.val = this.turn; S.m.val = 0; if (S.d) S.d.val = this.cfg.KDNERVE === 1 ? this.died : this.cfg.KDNERVE === 3 ? (this.rd() < this.cfg.KDRATE ? 1 : 0) : 0;   // К1з: 2 -- нерв молчит, 3 -- вспышки наугад
  }
  advance(u) {
    const c = this.cfg, t = ++this.t, S = this.chs;
    let cmd = u[this.motorNerve] || 0;
    if (c.KPLANK) cmd = 20 * ((1 - this.E) * (S.fl.val - S.fr.val) + (1 - this.H) * (S.wl.val - S.wr.val)) / 3;
    this.turn = Math.tanh(cmd);
    const E0 = this.E, H0 = this.H;
    // влечения убывают; сытый блок -- мир кормит тело
    this.E = Math.max(0, this.E - c.KDEC); this.H = Math.max(0, this.H - c.KDEC);
    const sat = this.sated(); if (sat) this.E = 1;
    this.Et = Math.max(0, this.Et - c.KDEC); this.Ht = Math.max(0, this.Ht - c.KDEC); if (sat) this.Et = 1;
    const Eb = this.E, Hb = this.H;   // без движения в этом круге -- только убыль
    this.th += c.KTURN * this.turn;
    let nx = this.x + c.KSPD * Math.cos(this.th), ny = this.y + c.KSPD * Math.sin(this.th), tl = 0, tr = 0;
    if (nx < 0 || nx > c.KA || ny < 0 || ny > c.KA) {   // стенка: сторона -- по тому, куда смотрит нормаль относительно курса
      const cx = Math.min(c.KA, Math.max(0, nx)), cy = Math.min(c.KA, Math.max(0, ny)), wx = nx - cx, wy = ny - cy;   // наружу
      const side = Math.cos(this.th) * wy - Math.sin(this.th) * wx; if (side > 0) tl = 1; else tr = 1; nx = cx; ny = cy; }
    this.x = nx; this.y = ny; this.touch = tl || tr ? 1 : 0;
    // потребление
    const late = t > c.ROUNDS / 2;
    const take = (o, isFood) => { if (Math.hypot(this.x - o.x, this.y - o.y) >= c.KRF) return false;
      if (late) { const need = isFood ? 1 - E0 > 1 - H0 : 1 - H0 > 1 - E0; if (isFood) this.st.food++; else this.st.water++;
        if (!sat) { this.st.byNeed[1]++; if (need) this.st.byNeed[0]++; this.st.blk.norm[isFood ? 0 : 1]++; } else this.st.blk.sat[isFood ? 0 : 1]++; }
      const q = this.put(); o.x = q.x; o.y = q.y; return true; };
    if (take(this.food, true)) this.E = Math.min(1, this.E + c.KGAIN);
    if (c.KWATER && take(this.water, false)) this.H = Math.min(1, this.H + c.KGAIN);
    if (!c.KWATER) { this.H = 1; this.Ht = 1; }   // К1е: воды нет, напоённость полная
    if (sat) this.E = 1;
    // К1ж: смерть -- сытость (или напоённость, если есть вода) дошла до нуля: штраф, тело возрождается сытым в новом месте; двойник -- так же
    let died = 0, tdied = 0;
    if (c.KDEATH) {
      if (this.E <= 0 || (c.KWATER && this.H <= 0)) { died = 1; this.ds.half[t > c.ROUNDS / 2 ? 1 : 0]++; this.E = 1; this.H = 1; this.x = c.KA * this.rp(); this.y = c.KA * this.rp(); this.th = 2 * Math.PI * this.rp(); }
      if (this.Et <= 0 || (c.KWATER && this.Ht <= 0)) { tdied = 1; this.Et = 1; this.Ht = 1; } }
    this.died = died;
    const pain = c.KPAINEV ? (this.touch && !this.prevTouch ? 1 : 0) : this.touch; this.prevTouch = this.touch;   // KPAINEV: боль -- за удар, а не за прижатость
    this.C = this.util(this.E, this.H, pain) - c.KDPEN * died; this.marg = this.C - (c.KTWIN ? this.util(this.Et, this.Ht, 0) - c.KDPEN * tdied : this.util(Eb, Hb, 0));
    if (late) { this.st.n++; this.st.wall += this.touch; if (sat) this.st.nSat++; else this.st.nNorm++; }
    S.tl.val = tl; S.tr.val = tr; this.sense();
  }
  // К1ж: страх -- средний прогноз частей канала «смерть» в 50 кругах перед смертью против остальных кругов (вторая половина жизни)
  score(B) {
    const c = this.cfg; if (this.deathNerve < 0 || this.t <= c.ROUNDS / 2) return;
    const C = B.ch[this.deathNerve]; if (!C) return; let s = 0; for (const q of C.parts) s += q.pred; const pr = C.parts.length ? s / C.parts.length : C.mean;
    const D = this.ds; if (this.died) { for (const v of D.buf) { D.fearB += v; D.fearBn++; } D.buf = []; }
    D.buf.push(pr); if (D.buf.length > 50) { const v = D.buf.shift(); D.fearA += v; D.fearAn++; }
  }
  result() {
    const s = this.st, n = Math.max(1, s.n), rf = (a) => (a[0] + a[1] ? a[0] / (a[0] + a[1]) : NaN);
    return { eat: 1000 * (s.food + s.water) / n, food: 1000 * s.food / n, water: 1000 * s.water / n, need: s.byNeed[1] ? s.byNeed[0] / s.byNeed[1] : NaN, nNeed: s.byNeed[1],
      deaths1: 1000 * this.ds.half[0] / (this.cfg.ROUNDS / 2), deaths2: 1000 * this.ds.half[1] / (this.cfg.ROUNDS / 2), fear: this.ds.fearBn && this.ds.fearAn ? (this.ds.fearB / this.ds.fearBn) / (this.ds.fearA / this.ds.fearAn) : NaN, fearB: this.ds.fearBn ? this.ds.fearB / this.ds.fearBn : NaN, fearA: this.ds.fearAn ? this.ds.fearA / this.ds.fearAn : NaN,
      fSat: rf(s.blk.sat), fNorm: rf(s.blk.norm), deval: rf(s.blk.sat) / rf(s.blk.norm), nSat: s.blk.sat[0] + s.blk.sat[1], nNorm: s.blk.norm[0] + s.blk.norm[1], wall: s.wall / n };
  }
  truth() { return this.nerves.map((nv) => nv.kind); }
}
module.exports = { WorldBody };

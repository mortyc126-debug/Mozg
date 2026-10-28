'use strict';
// Мир эпох (раунд 9, этап 4): несколько миров экзамена рядом, на своих нервах, но живёт в каждую эпоху только один.
// Остальные спят: время их не идёт, нервы молчат (ноль и шум датчика). Так у мозга копится знание, которое сейчас не нужно,
// -- проверка, сколько оно стоит на шаге и сохраняется ли, когда мир возвращается.
//   EPW -- миры по порядку (через запятую), EPL -- длина эпохи в кругах; эпохи идут по кругу
// Каждый мир берёт свои отвлекающие нервы (XND) -- и они молчат вместе с ним.
const { WorldX } = require('./worldx');
const { stream } = require('./rng');

class WorldEp {
  constructor(cfg, seed) {
    this.cfg = cfg; this.seed = seed; this.t = 0;
    this.names = String(cfg.EPW || 'факт,память,счёт,до метки').split(',');
    this.xs = this.names.map((e, i) => new WorldX({ ...cfg, EXAM: e, XND: cfg.EPXND ?? 3, ROUNDS: cfg.ROUNDS }, seed * 101 + 7 * (i + 1)));
    let off = 0; for (const w of this.xs) { w.off = off; off += w.n; } this.nAll = off;
    this.rn = stream(seed, 'эпохи'); this.obs = new Float64Array(64);
    this.plugged = false; this.motorNerve = -1; this.propNerve = -1; this.b = 0; this.z = { val: 0 }; this.g = { val: 0 }; this.uHist = new Float64Array(8); this.uPos = 0;
  }
  get n() { return this.nAll; }
  // мир этого круга; EPONLY -- живёт всегда один мир (номер): остальные молчат с рождения (мозг без чужого знания)
  get active() { return this.cfg.EPONLY !== undefined && this.cfg.EPONLY >= 0 ? this.cfg.EPONLY : Math.floor(this.t / this.cfg.EPL) % this.xs.length; }
  observe(out) {
    const a = this.active, sn = this.cfg.SN;
    for (let i = 0; i < this.xs.length; i++) { const w = this.xs[i];
      if (i === a) { w.observe(this.obs); for (let k = 0; k < w.n; k++) out[w.off + k] = this.obs[k]; }
      else for (let k = 0; k < w.n; k++) out[w.off + k] = sn * this.rn.gauss(); }
    return out;
  }
  advance(u) { const a0 = this.active; this.t++; const a = this.active; if (a !== a0) { this.xs[a].qPrev = null; } this.xs[a].advance(u); }
  score(B) { this.xs[this.active].score(B); }
  comfort() { return 0; } marginal() { return 0; }
  truth() { return this.xs.flatMap((w) => w.truth()); }
  // итог каждого мира по всем его ответам (neuron4.js WORLD=ep): мера WorldX берёт вторую половину жизни по счёту всего мира
  // (ROUNDS / 2), а часы спящего мира стоят -- поэтому меряется копией мира с ROUNDS = 0
  result() { const r = {}; this.xs.forEach((w, i) => { const all = Object.assign(Object.create(Object.getPrototypeOf(w)), w, { cfg: { ...w.cfg, ROUNDS: 0 } }); r[this.names[i]] = all.result(); }); return r; }
}
module.exports = { WorldEp };

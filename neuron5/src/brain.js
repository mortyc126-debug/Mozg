'use strict';
// Круг мозга нейрона-5 (PLAN.md §2). Мозг -- шина, книга и отделы. Каждый круг: нервы на шину -> sense (расчёт за прошлый
// круг, выходы органов этого круга) -> act (команды) -> запись круга -> expect (прогнозы на следующий круг) -> learn
// (подгонка, поиск, гипотезы) -> хозяйство (аренда, смерть в долгу) -> шаг мира. Отдел видит только шину и книгу.
const { Bus } = require('./bus');
const { Ledger } = require('./ledger');
const { stream } = require('./rng');
const { Brainstem } = require('./organs/brainstem');
const { Cortex } = require('./organs/cortex');
const { Hippocampus } = require('./organs/hippocampus');
const { Critic } = require('./organs/critic');
const { BasalGanglia } = require('./organs/bg');
const { Amygdala } = require('./organs/amygdala');
const { Speech } = require('./organs/speech');

class Brain {
  constructor(cfg, world, seed) {
    this.cfg = cfg; this.world = world; this.seed = seed; this.t = 0; this.rng = stream(seed, 'мозг');
    this.bus = new Bus(cfg.H); this.led = new Ledger(cfg);
    const n = world.n; this.n = n; this.obs = new Float64Array(n); this.u = new Float64Array(n);
    this.nerve = []; for (let k = 0; k < n; k++) this.nerve.push(this.bus.add('нерв', null, k, 0));
    this.cmd = new Array(n);                 // товар «команда» нерва -- появляется, когда кто-то впервые подал команду
    this.comfort = this.bus.add('польза', null, -1, 0);
    this.stem = new Brainstem(this); this.cortex = new Cortex(this); this.hippo = new Hippocampus(this);
    this.organs = [this.stem, this.cortex, this.hippo];
    if (cfg.BG) { this.critic = new Critic(this); this.organs.push(this.critic); if (cfg.BCTX) { this.amyg = new Amygdala(this); this.organs.push(this.amyg); } this.bg = new BasalGanglia(this); this.organs.push(this.bg); }
    if (cfg.SPEAK) { this.speech = new Speech(this); this.organs.push(this.speech); }
  }
  // команда на нерв k: уходит в мир и видна на шине (копия команды)
  drive(k, v) { if (this.cmd[k] === undefined) this.cmd[k] = this.bus.add('команда', null, k, this.t); this.u[k] = v; this.bus.val[this.cmd[k]] = v; }
  step() {
    const t = ++this.t, W = this.world, bus = this.bus;
    W.observe(this.obs); for (let k = 0; k < this.n; k++) bus.val[this.nerve[k]] = this.obs[k];
    bus.val[this.comfort] = W.comfort(); this.u.fill(0);
    for (const o of this.organs) if (o.sense) o.sense(this);
    for (const o of this.organs) if (o.act) o.act(this);
    bus.write(t);
    for (const o of this.organs) if (o.expect) o.expect(this);
    for (const o of this.organs) if (o.learn) o.learn(this);
    for (const p of this.led.settle()) p.home.bury(this, p);
    W.advance(this.u);
  }
}
module.exports = { Brain };

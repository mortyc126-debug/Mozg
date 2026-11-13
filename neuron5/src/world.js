'use strict';
// Мир нейрона-5 (PLAN.md, принцип 7): тело и язык -- один мир. Физика -- мира тела Колонии (neuron4k/src/worldbody.js):
// арена KA x KA, тело идёт с шагом KSPD и поворачивает на KTURN tanh(команда); еда и вода пахнут слева и справа
// (3 exp(-расстояние / KLAM), датчики вынесены вперёд-вбок); сытость и напоённость убывают, еда и вода их прибавляют;
// стены -- касание и боль удара; хищник бродит, гонится ближе KPR, кусает ближе 1.5 и уходит; сытость или напоённость
// в нуле -- смерть (штраф, возрождение в новом месте). Голос родителя -- нерв на слово: слова событий -- через VLAG кругов
// после события, VREP кругов подряд; слова состояний -- пока состояние держится, 0.1 за круг. Нервы перемешаны и
// читаются с шумом SN. Мозгу не сказано, какой нерв что значит; врождённая карта тела (innate) -- только стволу.
const { stream } = require('./rng');
const WORDS = ['еда', 'вода', 'укус', 'удар', 'голодно', 'жажда', 'опасно'];

class World {
  // sh -- общее для двух тел (ступень 7: еда, вода, хищник); bi -- номер тела (у второго свои жребии)
  constructor(cfg, seed, sh, bi = 0) {
    this.cfg = cfg; this.seed = seed; const c = cfg, sfx = bi ? ' ' + bi : '', r = stream(seed, 'устройство мира' + sfx);
    this.rn = stream(seed, 'шум мира' + sfx); this.rp = stream(seed, 'место' + sfx); this.rv = stream(seed, 'голос' + sfx); if (cfg.VJIT) this.rj = stream(seed, 'задержка' + sfx);
    this.t = 0; this.x = c.KA / 2; this.y = c.KA / 2; this.th = 2 * Math.PI * this.rp(); this.E = 1; this.H = 1; this.turn = 0; this.touch = 0; this.C = 0;
    if (sh) { this.sh = sh; this.x = c.KA * (0.25 + 0.5 * bi); }
    else { this.sh = this; this.rpr = stream(seed, 'хищник'); this.put = () => ({ x: c.KA * this.rp(), y: c.KA * this.rp() }); this.food = this.put(); this.water = this.put();
      this.foodLeft = c.KSERV; this.waterLeft = c.KSERV; this.pred = { x: 0, y: 0 }; this.pdir = 2 * Math.PI * this.rpr(); this.relocate(); }
    const ch = (kind) => ({ kind, val: 0 });
    this.S = { fl: ch('запах еды слева'), fr: ch('запах еды справа'), wl: ch('запах воды слева'), wr: ch('запах воды справа'), pl: ch('запах хищника слева'), pr: ch('запах хищника справа'),
      tl: ch('касание слева'), tr: ch('касание справа'), e: ch('сытость'), h: ch('напоённость'), p: ch('положение'), m: ch('двигатель') };
    if (sh) { this.S.ol = ch('запах другого слева'); this.S.or = ch('запах другого справа'); }   // ступень 7: другой -- в ощущениях
    this.voice = c.VOICE ? WORDS.map((w) => ch('слово ' + w)) : [];
    // рот, ухо и улыбка родителя (ступень 4, SPEAK): нервы рта ничего не несут (как «двигатель»), ухо -- был ли свой голос,
    // улыбка -- ответ родителя на сказанное в прошлом круге
    this.mouth = c.SPEAK ? WORDS.map((w) => ch('рот ' + w)) : []; this.ear = c.SPEAK ? ch('ухо') : null; this.smile = c.SPEAK ? ch('улыбка') : null;
    this.pvoice = sh ? WORDS.map((w) => ch('голос другого ' + w)) : [];   // что другой сказал в прошлом круге
    this.nerves = [...Object.values(this.S), ...this.voice, ...this.mouth, ...(c.SPEAK ? [this.ear, this.smile] : []), ...this.pvoice];
    for (let i = this.nerves.length - 1; i > 0; i--) { const j = r.int(i + 1); [this.nerves[i], this.nerves[j]] = [this.nerves[j], this.nerves[i]]; }
    // врождённая карта тела -- для ствола мозга (какой нерв что несёт) и внимания к голосу
    this.innate = {}; for (const [k, v] of Object.entries(this.S)) this.innate[k] = this.nerves.indexOf(v);
    this.innate.voice = this.voice.map((v) => this.nerves.indexOf(v)); if (sh) this.innate.pvoice = this.pvoice.map((v) => this.nerves.indexOf(v));
    if (c.SPEAK) { this.innate.mouth = this.mouth.map((v) => this.nerves.indexOf(v)); this.innate.smile = this.nerves.indexOf(this.smile); this.innate.ear = this.nerves.indexOf(this.ear);
      this.rs = stream(seed, 'улыбка'); this.lastEv = new Float64Array(4).fill(-1e9); this.nameAt = new Float64Array(4).fill(-1e9); this.f = new Float64Array(WORDS.length).fill(0.05);
      if (c.REQ) { this.rq = stream(seed, 'помощь'); this.lastHelp = [-1e9, -1e9]; this.helps = [0, 0]; }
      this.sp = { said: new Array(WORDS.length).fill(0), ok: new Array(WORDS.length).fill(0), tru: new Array(WORDS.length).fill(0), ev: [0, 0, 0, 0], named: [0, 0, 0, 0], talk: 0, when: [0, 0, 0, 0].map(() => [0, 0, 0, 0, 0]), lastPar: new Float64Array(WORDS.length).fill(-1e9), fresh: new Array(WORDS.length).fill(0), freshOk: new Array(WORDS.length).fill(0) }; }
    this.vq = new Uint8Array(16); this.vring = new Uint8Array(10000);
    this.ev = { ate: 0, drank: 0, bite: 0, hit: 0, died: 0 };   // что случилось в последнем шаге (правда для мер, мозгу не видна)
    this.st = { n: 0, food: 0, water: 0, bites: 0, deaths: 0, wall: 0, C: 0, eh: new Array(10).fill(0), hh: new Array(10).fill(0) };   // вторая половина жизни
    this.said = -1; if (!sh) this.sense();
  }
  get n() { return this.nerves.length; }
  truth() { return this.nerves.map((v) => v.kind); }
  observe(out) { const sn = this.cfg.SN; for (let k = 0; k < this.nerves.length; k++) out[k] = this.nerves[k].val + sn * this.rn.gauss(); return out; }
  comfort() { return this.C; }
  relocate() { const c = this.cfg, P = this.sh.pred, R = this.sh.rpr; do { P.x = c.KA * R(); P.y = c.KA * R(); } while (Math.hypot(P.x - this.x, P.y - this.y) < Math.min(10, c.KA / 2)); }
  odor(o, a, lam) { const sx = this.x + 0.8 * Math.cos(this.th + a), sy = this.y + 0.8 * Math.sin(this.th + a); return 3 * Math.exp(-Math.hypot(sx - o.x, sy - o.y) / (lam || this.cfg.KLAM)); }
  sense() { const S = this.S;
    const sh = this.sh; S.fl.val = this.odor(sh.food, 0.6); S.fr.val = this.odor(sh.food, -0.6); S.wl.val = this.odor(sh.water, 0.6); S.wr.val = this.odor(sh.water, -0.6);
    S.pl.val = this.odor(sh.pred, 0.6); S.pr.val = this.odor(sh.pred, -0.6); S.e.val = this.E; S.h.val = this.H; S.p.val = this.turn; S.m.val = 0; }
  // шаг мира по командам мозга u (по номерам нервов)
  advance(u) {
    const c = this.cfg, t = ++this.t, S = this.S, ev = this.ev, late = t > c.ROUNDS / 2; ev.ate = ev.drank = ev.bite = ev.hit = ev.died = 0;
    if (c.SPEAK) this.hear(u, t, late);
    this.turn = Math.tanh(u[this.innate.m] || 0);
    this.E = Math.max(0, this.E - c.KDEC); this.H = Math.max(0, this.H - c.KDEC);
    this.th += c.KTURN * this.turn;
    let nx = this.x + c.KSPD * Math.cos(this.th), ny = this.y + c.KSPD * Math.sin(this.th), tl = 0, tr = 0;
    if (nx < 0 || nx > c.KA || ny < 0 || ny > c.KA) {   // стена: сторона -- по тому, куда смотрит нормаль относительно курса
      const cx = Math.min(c.KA, Math.max(0, nx)), cy = Math.min(c.KA, Math.max(0, ny)), side = Math.cos(this.th) * (ny - cy) - Math.sin(this.th) * (nx - cx);
      if (side > 0) tl = 1; else tr = 1; nx = cx; ny = cy; }
    this.x = nx; this.y = ny; const touch = tl || tr ? 1 : 0;
    const near = (o) => Math.hypot(this.x - o.x, this.y - o.y) < c.KRF, sh = this.sh, gate = c.KSERV > 1;   // ступень 7: место на KSERV раз; ест и пьёт по нужде
    if (near(sh.food) && (!gate || this.E < 0.9)) { this.E = Math.min(1, this.E + c.KGAIN); if (--sh.foodLeft <= 0) { sh.food = sh.put(); sh.foodLeft = c.KSERV; } ev.ate = 1; }
    if (near(sh.water) && (!gate || this.H < 0.9)) { this.H = Math.min(1, this.H + c.KGAIN); if (--sh.waterLeft <= 0) { sh.water = sh.put(); sh.waterLeft = c.KSERV; } ev.drank = 1; }
    if (this.E <= 0 || this.H <= 0) { ev.died = 1; this.E = 1; this.H = 1; this.x = c.KA * this.rp(); this.y = c.KA * this.rp(); this.th = 2 * Math.PI * this.rp(); }
    { const P = sh.pred; if (sh === this) sh.movePred(this);   // в общем мире хищник ходит один раз за круг (World2)
      if (Math.hypot(this.x - P.x, this.y - P.y) < 1.5) { ev.bite = 1; this.relocate(); } }
    ev.hit = touch && !this.touch ? 1 : 0; this.touch = touch;   // боль -- за удар, а не за прижатость
    this.C = c.CPAY * (1 - 2 * (1 - this.E) ** 2 - 2 * (1 - this.H) ** 2) - c.KPAIN * ev.hit - c.KDPEN * ev.died - c.KBITE * ev.bite;
    if (late) { const s = this.st; s.n++; s.eh[Math.min(9, Math.floor(10 * this.E))]++; s.hh[Math.min(9, Math.floor(10 * this.H))]++; s.food += ev.ate; s.water += ev.drank; s.bites += ev.bite; s.deaths += ev.died; s.wall += touch; s.C += this.C; }
    if (c.SPEAK) { const e4 = [ev.ate, ev.drank, ev.bite, ev.hit]; for (let j = 0; j < 4; j++) if (e4[j]) { this.lastEv[j] = t; if (late) this.sp.ev[j]++; } }
    S.tl.val = tl; S.tr.val = tr; this.sense();
    if (c.VOICE) this.speak(t);
  }
  // хищник: гонится за телом b ближе KPR, иначе бродит
  movePred(b) { const c = this.cfg, P = this.pred, dx = b.x - P.x, dy = b.y - P.y, d = Math.hypot(dx, dy);
    if (d < c.KPR) { P.x += c.KPSPD * dx / Math.max(d, 1e-9); P.y += c.KPSPD * dy / Math.max(d, 1e-9); }
    else { this.pdir += this.rpr() - 0.5; P.x += 0.1 * Math.cos(this.pdir); P.y += 0.1 * Math.sin(this.pdir);
      if (P.x < 0 || P.x > c.KA || P.y < 0 || P.y > c.KA) { this.pdir += Math.PI; P.x = Math.min(c.KA, Math.max(0, P.x)); P.y = Math.min(c.KA, Math.max(0, P.y)); } } }
  // состояния, о которых говорит родитель (правда для мер)
  states() { return [this.E < this.cfg.VNEED, this.H < this.cfg.VNEED, Math.hypot(this.x - this.sh.pred.x, this.y - this.sh.pred.y) < 8]; }
  speak(t) {
    const c = this.cfg, q = this.vq, ev = this.ev, e = (ev.ate ? 1 : 0) | (ev.drank ? 2 : 0) | (ev.bite ? 4 : 0) | (ev.hit ? 8 : 0);
    let m = q[t % 16]; q[t % 16] = 0;
    if (!c.VJIT) for (let r = 0; r < c.VREP; r++) q[(t + c.VLAG + r) % 16] |= e;
    else for (let b = 0; b < 4; b++) if (e & (1 << b)) { const lag = c.VLAG + Math.floor((c.VJIT + 1) * this.rj()); for (let r = 0; r < c.VREP; r++) q[(t + lag + r) % 16] |= 1 << b; }   // ступень 6: у каждого события своя задержка
    const st = this.states(); for (let i = 0; i < 3; i++) if (this.rv() < 0.1 && st[i]) m |= 16 << i;
    // контроль: каждое слово -- из своего случайного прошлого круга (2000-9000 кругов назад): та же частота, связи с «сейчас» нет
    let out = m; if (c.VOICE === 2) { out = 0; this.vring[t % 10000] = m; if (t > 9000) for (let i = 0; i < WORDS.length; i++) out |= this.vring[(t - 2000 - Math.floor(7000 * this.rv())) % 10000] & (1 << i); }
    for (let i = 0; i < WORDS.length; i++) { this.voice[i].val = (out >> i) & 1; if (this.sp && this.voice[i].val) this.sp.lastPar[i] = t; }
  }
  // рот: сказано слово с наибольшей командой больше 0.7; правда -- событие в одном из 5 шагов до этого круга или состояние сейчас;
  // улыбка: верно -- 1 - f (f -- бегущая частота правды слова), неверно -- -0.3; SPEAK = 2 -- «верно» наугад с вероятностью f
  hear(u, t, late) {
    const W = WORDS.length, st = this.states(), tru = new Array(W), sp = this.sp;
    for (let j = 0; j < 4; j++) tru[j] = t - this.lastEv[j] <= 5;   // шаги t-5..t-1 (событие шага s записано с меткой s)
    for (let j = 0; j < 3; j++) tru[4 + j] = st[j];
    for (let i = 0; i < W; i++) { this.f[i] += 0.001 * ((tru[i] ? 1 : 0) - this.f[i]); if (late && tru[i]) sp.tru[i]++; }
    let w = -1, best = 0.7; for (let i = 0; i < W; i++) { const v = u[this.innate.mouth[i]] || 0; if (v > best) { best = v; w = i; } }
    // просьба (ступень 5): «голодно» / «жажда» при правде -- родитель приносит еду / воду; REQ = 2 -- подарок наугад с частотой REQP
    if (this.cfg.REQ === 1 && w >= 4 && w <= 5 && tru[w]) this.help(w - 4, t, late);
    if (this.cfg.REQ === 2) for (let j = 0; j < 2; j++) if (this.rq() < this.cfg.REQP) this.help(j, t, late);
    this.said = w; this.ear.val = w >= 0 ? 1 : 0; if (w < 0) { this.smile.val = 0; return; }
    const ok = this.cfg.SPEAK === 2 ? this.rs() < this.f[w] : tru[w]; this.smile.val = ok ? 1 - this.f[w] : -0.3;
    if (late) { sp.talk++; sp.said[w]++; if (tru[w]) sp.ok[w]++;
      if (w < 4 && tru[w] && this.nameAt[w] !== this.lastEv[w]) { this.nameAt[w] = this.lastEv[w]; if (this.lastEv[w] > this.cfg.ROUNDS / 2) { sp.named[w]++; sp.when[w][t - this.lastEv[w] - 1]++; } }
      // только для отчёта: «вслед» -- выбор слова мог опираться на это слово родителя (сказано в шагах t-11..t-2, услышано
      // в круге не позже t-1, по которому сделан прогноз); иначе -- «сам»
      if (t - sp.lastPar[w] >= 2 && t - sp.lastPar[w] <= 11) { sp.fresh[w]++; if (tru[w]) sp.freshOk[w]++; } }
  }
  help(j, t, late) {
    if (t - this.lastHelp[j] < 20) return; this.lastHelp[j] = t; if (late) this.helps[j]++; const A = this.cfg.KA;
    const o = { x: Math.min(A, Math.max(0, this.x + 2.5 * Math.cos(this.th))), y: Math.min(A, Math.max(0, this.y + 2.5 * Math.sin(this.th))) };
    if (j === 0) this.sh.food = o; else this.sh.water = o;
  }
  result() { const s = this.st, n = Math.max(1, s.n); return { comfort: s.C / n, eat: 1000 * (s.food + s.water) / n, food: 1000 * s.food / n, water: 1000 * s.water / n, bites: 1000 * s.bites / n, deaths: 1000 * s.deaths / n, wall: s.wall / n, needs: { E: s.eh.map((x) => +(x / n).toFixed(3)), H: s.hh.map((x) => +(x / n).toFixed(3)) },
    speech: this.sp ? { talk: this.sp.talk / n, helps: this.helps ? this.helps.map((x) => 1000 * x / n) : null, words: WORDS.map((w, i) => ({ name: w, said: this.sp.said[i], ok: this.sp.ok[i], tru: this.sp.tru[i], prec: this.sp.said[i] ? this.sp.ok[i] / this.sp.said[i] : null, base: this.sp.tru[i] / n,
      after: this.sp.fresh[i], afterOk: this.sp.freshOk[i],
      ...(i < 4 ? { events: this.sp.ev[i], named: this.sp.ev[i] ? this.sp.named[i] / this.sp.ev[i] : null, when: this.sp.when[i] } : {}) })) } : null }; }
}

// Два тела в одном мире (ступень 7, TWO): еда, вода и хищник общие; после шага каждому -- запах и голос другого
// (что другой сказал в этом шаге); «запах другого» -- со своей длиной спада KLAMS (где другой -- слышно издалека). TWO = 2 -- контроль: голос другого из его случайного прошлого (2000-9000 кругов назад).
class World2 {
  constructor(cfg, seed) {
    const c = cfg; this.cfg = cfg; this.rp = stream(seed, 'место общее'); this.rpr = stream(seed, 'хищник'); this.rx = stream(seed, 'голос другого');
    this.put = () => ({ x: c.KA * this.rp(), y: c.KA * this.rp() }); this.food = this.put(); this.water = this.put(); this.foodLeft = c.KSERV; this.waterLeft = c.KSERV;
    this.pred = { x: c.KA / 2, y: c.KA * 0.9 }; this.pdir = 2 * Math.PI * this.rpr(); this.movePred = World.prototype.movePred;
    this.b = [new World(cfg, seed, this, 0), new World(cfg, seed, this, 1)]; this.ring = [new Int8Array(10000).fill(-1), new Int8Array(10000).fill(-1)]; this.t = 0;
    this.st = { n: 0, near: 0 }; this.post();
  }
  advance(u0, u1) {
    const t = ++this.t, [A, B] = this.b; const d0 = Math.hypot(A.x - this.pred.x, A.y - this.pred.y), d1 = Math.hypot(B.x - this.pred.x, B.y - this.pred.y);
    this.movePred(d0 <= d1 ? A : B); A.advance(u0); B.advance(u1); this.post();
    if (t > this.cfg.ROUNDS / 2) { this.st.n++; if (Math.hypot(A.x - B.x, A.y - B.y) < 3) this.st.near++; }
  }
  post() {
    const c = this.cfg, t = this.t;
    for (let i = 0; i < 2; i++) { const me = this.b[i], o = this.b[1 - i]; me.sense(); me.S.ol.val = me.odor(o, 0.6, c.KLAMS); me.S.or.val = me.odor(o, -0.6, c.KLAMS);   // где другой: слышно дальше, чем пахнет еда
      this.ring[1 - i][t % 10000] = o.said; let w = o.said; if (c.TWO === 2) w = t > 9000 ? this.ring[1 - i][(t - 2000 - Math.floor(7000 * this.rx())) % 10000] : -1;
      for (let k = 0; k < WORDS.length; k++) me.pvoice[k].val = k === w ? 1 : 0; }
  }
}
module.exports = { World, World2, WORDS };

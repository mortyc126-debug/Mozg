'use strict';
// Общий мир (WORLD=one): одна жизнь, где мозгу нужны все способности сразу. Это не новый мир, а несколько миров рядом, с
// общими нервами одного мозга, общими деньгами, работой и записью:
//   мир неизвестных органов со словами (src/world.js): тело (конечность, глаз), толчки мира, родитель описывает движение,
//     свет и пользу, просит «вверх / вниз», спрашивает и слушает ответы (рот, ухо, улыбка, вопросы, свой голос);
//   миры экзамена (src/worldx.js) без своих отвлекающих нервов: перенос, антоним, сложение, память разговора, собеседник.
// Каждая способность меряется теми же мерами, что на экзамене (tools/one.js). Нервы миров экзамена идут первыми (их число не
// меняется), нервы мира органов -- после (на круге TPLUG к ним добавляются устройства), вперемешку внутри каждого.
// ONEVOC=1 -- общий словарь: «вверх» и «вниз» -- одни нервы (они идут самыми первыми) в описании движения («я / оно» + куда),
// в просьбе («давай» + куда) и в сложении («первое / второе» + куда). Родитель говорит одну фразу за раз: просьба, потом
// описание, потом свой голос мозга; сложение -- только когда в мире органов тихо.
const { World } = require('./world');
const { WorldX } = require('./worldx');
const { stream } = require('./rng');

const PARTS = ['перенос', 'антоним', 'сложение', 'память', 'собеседник'];
class WorldOne {
  constructor(cfg, seed) {
    this.cfg = cfg; this.seed = seed;
    // общий словарь (ONEVOC=1): нервы «вверх» / «вниз» -- первыми, общие для описания движения, просьбы и сложения
    this.voc = cfg.ONEVOC ? { up: { type: 'слово', name: 'вверх', val: 0 }, dn: { type: 'слово', name: 'вниз', val: 0 } } : null;
    this.vn = this.voc ? [this.voc.up, this.voc.dn] : []; if (this.voc) this.rn = stream(seed, 'общий шум');
    const only = cfg.ONEX ? String(cfg.ONEX).split(',') : PARTS;
    this.xs = only.map((e, i) => { const w = new WorldX({ ...cfg, EXAM: e, XND: 0 }, seed * 101 + 7 * (i + 1), e === 'сложение' ? this.voc : null); return w; });
    let off = this.vn.length; for (const w of this.xs) { w.off = off; off += w.n; } this.nx = off;
    this.dev = new World({ ...cfg, WORDS: cfg.ONEW }, seed, this.voc); this.dev.off = off;
    this.obsX = new Float64Array(64); this.obsD = new Float64Array(256);
  }
  get n() { return this.nx + this.dev.n; }
  get plugged() { return this.dev.plugged; }
  get motorNerve() { return this.dev.motorNerve < 0 ? -1 : this.nx + this.dev.motorNerve; }
  get propNerve() { return this.dev.propNerve < 0 ? -1 : this.nx + this.dev.propNerve; }
  get b() { return this.dev.b; } get z() { return this.dev.z; } get g() { return this.dev.g; } get uHist() { return this.dev.uHist; } get uPos() { return this.dev.uPos; }
  get t() { return this.dev.t; }
  observe(out) {
    for (let k = 0; k < this.vn.length; k++) out[k] = this.vn[k].val + this.cfg.SN * this.rn.gauss();
    for (const w of this.xs) { w.observe(this.obsX); for (let k = 0; k < w.n; k++) out[w.off + k] = this.obsX[k]; }
    if (this.obsD.length < this.dev.n) this.obsD = new Float64Array(2 * this.dev.n);
    this.dev.observe(this.obsD); for (let k = 0; k < this.dev.n; k++) out[this.nx + k] = this.obsD[k];
    return out;
  }
  advance(u) {
    if (!this.voc) { for (const w of this.xs) w.advance(); this.dev.advance(u.subarray(this.nx)); return; }
    // общий словарь: сначала говорит родитель мира органов; пока он говорит, у сложения событий нет
    this.dev.advance(u.subarray(this.nx)); for (const w of this.xs) { w.mute = !!(w.ext && this.dev.vocBusy); w.advance(); }
  }
  comfort() { return this.dev.comfort(); }
  marginal() { return this.dev.marginal(); }
  speechPay() { const s = this.dev.speechPay ? this.dev.speechPay() : null; return s ? [this.nx + s[0], s[1]] : null; }
  salience(k) { return k >= this.nx ? this.dev.salience(k - this.nx) : k < this.vn.length ? this.cfg.WSAL : 1; }   // общие слова -- слова и мира органов
  truth() { return [...this.vn.map(() => 'слово'), ...this.xs.flatMap((w) => w.truth()), ...this.dev.truth()]; }
  score(B) { for (const w of this.xs) w.score(B); if (this.cfg.ONEW) this.dev.score({ ch: B.ch.slice(this.nx), dir: this.voc ? [B.ch[0], B.ch[1]] : null }); }
  wordReport() { return this.dev.wordReport(); }
  result() { const r = {}; for (const w of this.xs) r[w.kind] = w.result(); return r; }
}
module.exports = { WorldOne };

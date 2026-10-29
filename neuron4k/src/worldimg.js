'use strict';
// Мир цифр нейрона-3 (WORLD=2 WIMG=1, правка 30) в нейроне-4. Рукописные цифры 8 x 8 (UCI, как load_digits sklearn;
// data/digits.csv): 60 нервов-пикселей (у 4 пикселей разброса нет -- выброшены, как в нейроне-3; значения стандартизованы
// по учебной части) и 10 нервов-меток: метка d в круге t -- (была ли цифра прошлого круга d, минус 0.1) / 0.3. Каждый круг --
// новая цифра из учебных наугад; последние WTEST кругов -- экзамен: цифры, которых мир не показывал, каждая один раз.
// Мера -- доля верно названных цифр на экзамене; цифру называет метка с наибольшим средним прогнозом её частей.
const fs = require('fs'), path = require('path');

let DIG = null;
function load() {
  if (DIG) return DIG;
  const txt = fs.readFileSync(path.join(__dirname, '..', 'data', 'digits.csv'), 'utf8');
  const rows = txt.split('\n').filter((l) => l && l[0] !== '#').map((l) => l.split(',').map(Number));
  const n = rows.length, tr = [], te = []; rows.forEach((r, i) => (r[65] ? te : tr).push(i));
  const mu = new Float64Array(64), sd = new Float64Array(64);
  for (const i of tr) for (let c = 0; c < 64; c++) mu[c] += rows[i][c] / tr.length;
  for (const i of tr) for (let c = 0; c < 64; c++) sd[c] += (rows[i][c] - mu[c]) ** 2 / tr.length;
  const keep = []; for (let c = 0; c < 64; c++) if (sd[c] > 0) keep.push(c);
  const np = keep.length, X = new Float64Array(n * np), y = new Int8Array(n);
  for (let i = 0; i < n; i++) { y[i] = rows[i][64]; keep.forEach((c, j) => { X[i * np + j] = (rows[i][c] - mu[c]) / Math.sqrt(sd[c]); }); }
  return (DIG = { np, X, y, train: tr, test: te });
}
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

class WorldImg {
  constructor(cfg, seed) {
    this.cfg = cfg; this.seed = seed; const D = this.D = load();
    if (cfg.WTEST > D.test.length) throw new Error(`WTEST: не больше ${D.test.length}`);
    this.rnd = mulberry((Math.imul(seed, 2654435761) + 3307) >>> 0);
    this.K = D.np + 10; this.c = new Float64Array(this.K); this.img = -1; this.prev = -1; this.examI = 0; this.exam = false; this.t = 0;
    this.nerves = []; for (let k = 0; k < this.K; k++) this.nerves.push({ k, kind: k < D.np ? 'пиксель' : 'метка' });
    this.kinds = ['пиксель', 'метка']; this.plugged = false; this.motorNerve = -1; this.propNerve = -1; this.b = 0;
    this.z = { val: 0 }; this.g = { val: 0 }; this.uHist = new Float64Array(8); this.uPos = 0;
    this.exOK = 0; this.exN = 0; this.trAcc = 0.1;
    this.advance();
  }
  get n() { return this.K; }
  observe(out) { const sn = this.cfg.SN; for (let k = 0; k < this.K; k++) out[k] = this.c[k] + sn * gauss(this.rnd); return out; }
  comfort() { return 0; }
  marginal() { return 0; }
  advance() {
    const D = this.D, np = D.np, n = new Float64Array(this.K); this.t++;
    this.pimg = this.img; this.pexam = this.exam;   // цифра, которую мозг видел в только что прошедшем круге (score -- после шага)
    if (this.img >= 0) for (let d = 0; d < 10; d++) n[np + d] = ((D.y[this.img] === d ? 1 : 0) - 0.1) / 0.3;
    this.exam = this.t > this.cfg.ROUNDS - this.cfg.WTEST;
    const i = this.exam ? D.test[this.examI++] : D.train[Math.floor(this.rnd() * D.train.length)];
    for (let k = 0; k < np; k++) n[k] = D.X[i * np + k];
    this.img = i; this.c = n;
  }
  // цифру называет метка с наибольшим средним прогнозом её частей (прогноз метки следующего круга -- о нынешней цифре)
  score(B) {
    const np = this.D.np; let best = -1, bv = -Infinity;
    for (let d = 0; d < 10; d++) { const ps = B.ch[np + d].parts; if (!ps.length) continue; let s = 0; for (const p of ps) s += p.pred; const v = s / ps.length; if (v > bv) { bv = v; best = d; } }
    if (this.pimg < 0) return;
    const ok = best === this.D.y[this.pimg] ? 1 : 0;
    if (this.pexam) { this.exOK += ok; this.exN++; } else this.trAcc += 0.005 * (ok - this.trAcc);
  }
  truth() { return this.nerves.map((x) => x.kind); }
}
module.exports = { WorldImg };

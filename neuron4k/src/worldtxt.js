'use strict';
// Мир текста нейрона-3 (WTXT, правки 31-32) в нейроне-4. Поток знаков: WTXT=1 -- пьесы Шекспира (36 знаков: буквы без
// регистра, пробел, перевод строки, 8 знаков препинания), WTXT=2 -- «Война и мир», том 1 (41 знак: 32 буквы, ё -> е,
// пробел, перевод строки, 5 знаков препинания, «латиница», «прочее»; пробелы и пустые строки схлопнуты). Нерв на знак:
// есть ли он сейчас, со средним 0 и разбросом 1 (у редких знаков разброс не ниже 0.1). Мозг не знает, что нервы -- знаки
// одного потока: это ему выяснять самому (строитель памяти находит «нервы одного выбора», src/clones.js).
// Каждый мир читает со своего места: (сид - 1) x 65537. Мера, как у нейрона-3: бит на знак -- вероятность знака из
// среднего прогноза частей его канала (обрезка до нуля, нормировка, QFLOOR -- частоты знаков), цена -- -log2 вероятности,
// данной кругом раньше; за весь поток и на последних 20%.
const fs = require('fs'), path = require('path');

const TXT = {};
function load(which) {
  if (TXT[which]) return TXT[which];
  const rd = (f) => fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8');
  let A, raw, fold;
  if (which === 1) { A = 'abcdefghijklmnopqrstuvwxyz \n,.:;\'?!-'; raw = rd('shakespeare.txt').toLowerCase(); fold = () => A.indexOf('.'); }
  else {
    A = 'абвгдежзийклмнопрстуфхцчшщъыьэюя \n,.-!?LZ';
    raw = rd('tolstoy.txt').replace(/^﻿/, '').replace(/\r\n?/g, '\n').toLowerCase().replace(/ё/g, 'е')
      .replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n+/g, '\n');
    fold = (ch) => (/[a-z]/.test(ch) ? A.indexOf('L') : A.indexOf('Z'));
  }
  const seq = new Uint8Array(raw.length); let m = 0;
  for (const ch of raw) { const i = A.indexOf(ch); seq[m++] = i >= 0 && ch !== 'L' && ch !== 'Z' ? i : fold(ch); }
  const cnt = new Float64Array(A.length); for (let i = 0; i < m; i++) cnt[seq[i]]++;
  const p = cnt.map((c) => c / m), sd = p.map((q) => Math.sqrt(Math.max(q * (1 - q), 0.01)));
  return (TXT[which] = { A, seq: seq.subarray(0, m), p, sd });
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

class WorldTxt {
  constructor(cfg, seed) {
    this.cfg = cfg; this.seed = seed; const T = this.T = load(cfg.WTXT);
    this.rnd = mulberry((Math.imul(seed, 2654435761) + 7919) >>> 0);
    this.K = T.A.length; this.off = ((seed - 1) * 65537) % T.seq.length; this.pos = 0; this.t = 0;
    this.nerves = []; for (let k = 0; k < this.K; k++) this.nerves.push({ k, kind: 'знак' });
    this.kinds = ['знак']; this.plugged = false; this.motorNerve = -1; this.propNerve = -1; this.b = 0;
    this.z = { val: 0 }; this.g = { val: 0 }; this.uHist = new Float64Array(8); this.uPos = 0;
    this.bpS = 0; this.bpN = 0; this.bpS2 = 0; this.bpN2 = 0; this.orgS2 = 0; this.orgN2 = 0; this.uniS2 = 0;
    this.sym = -1; this.c = new Float64Array(this.K);
    this.advance();
  }
  get n() { return this.K; }
  observe(out) { const sn = this.cfg.SN; for (let k = 0; k < this.K; k++) out[k] = this.c[k] + sn * gauss(this.rnd); return out; }
  comfort() { return 0; }
  marginal() { return 0; }
  advance() {
    const T = this.T; this.t++;
    const x = T.seq[(this.off + this.pos++) % T.seq.length];
    for (let k = 0; k < this.K; k++) this.c[k] = ((k === x ? 1 : 0) - T.p[k]) / T.sd[k];
    this.sym = x;
  }
  // после шага мозга: прогнозы частей были о знаке, который мир только что показал (advance -- последним в круге)
  score(B) {
    const T = this.T, K = this.K, q = new Float64Array(K); let sum = 0;
    for (let k = 0; k < K; k++) { const ps = B.ch[k].parts; let s = 0; for (const p of ps) s += p.pred; q[k] = Math.max(0, T.p[k] + (ps.length ? s / ps.length : 0) * T.sd[k]); sum += q[k]; }
    const QF = this.cfg.QFLOOR, x = this.sym;
    const qx = (1 - QF) * (sum > 0 ? q[x] / sum : T.p[x]) + QF * T.p[x], b = -Math.log2(qx);
    if (this.t <= 1) return;
    this.bpS += b; this.bpN++;
    if (this.t > 0.8 * this.cfg.ROUNDS) { this.bpS2 += b; this.bpN2++; this.uniS2 -= Math.log2(T.p[x]);
      // орган клонов сам по себе (если жив): его вероятность этого знака
      for (const [ty, f] of [['клоны', 'org'], ['контекст', 'ctx']]) { const o = B.mem && B.mem.organs.find((o) => o.type === ty);
        if (o && o.Pk && Number.isFinite(o.Pk[x])) { const P = o.Pk[x]; this[f + 'S2'] = (this[f + 'S2'] || 0) - Math.log2(Math.max(1e-9, (1 - QF) * P + QF * T.p[x])); this[f + 'N2'] = (this[f + 'N2'] || 0) + 1; } } }
  }
  truth() { return this.nerves.map((x) => x.kind); }
  text(n) { const T = this.T; let s = ''; for (let i = 0; i < n; i++) s += T.A[T.seq[(this.off + i) % T.seq.length]]; return s; }
}
module.exports = { WorldTxt, loadText: load };

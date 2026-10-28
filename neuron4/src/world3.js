'use strict';
// Мир-смесь нейрона-3 (WORLD=2 WMIX=1, правка 65) в нейроне-4: генератор схемы и шаг мира перенесены дословно, жребий схемы --
// тот же (mulberry32 от WSEED), поэтому при одном WK и WSEED схема (виды каналов, родители, задержки) совпадает с нейроном-3
// бит в бит (tools/world3_check.js). История шума своя: у нейрона-3 жребий мира делят с ним части.
// Виды каналов: src -- открытый источник (двоичный, знак держится с вероятностью 3/4), psrc -- тайный источник (AR 0.5; виден,
// но ни в одну смесь не входит), deep -- глубокий: завтра = тайный источник D кругов назад (D -- от 1 до WDMAX по логарифму),
// mix -- смесь (1-3 родителя из источников и смесей, разброс 1), prod -- произведение двух источников, hier -- этажи:
// этаж 1 -- произведения соседних листьев, выше (x + y + x y) / sqrt 3, key -- ключ (WKA уровней, новый каждый круг),
// val -- значение: завтра = словарь[ключ сегодня], словарь новый каждые WEP кругов.
// Все каналы -- нервы мозга; команд мир не слышит (выходных нервов нет), польза движений -- 0.

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss3 = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

// ручки мира-смеси при размере K -- как WMIX=1 в нейроне-3
function mixKnobs(K) {
  const r0 = (x) => Math.max(1, Math.round(x)), nS = Math.max(8, Math.round(0.12 * K));
  return { WK: K, WSRC: nS, WPROD: r0(0.06 * K), WHIER: r0(0.04 * K), WHL: 3, WKV: r0(0.03 * K), WDEEPF: +(0.12 * K / (K - nS)).toFixed(4), WDLOG: 1, WDMAX: 200, WBIN: 1, WPAR: 3, WKA: 8, WEP: 1000 };
}

function makeSchema(P, WSEED) {           // дословно makeSchema нейрона-3 (ветка большого мира без задач)
  const r = mulberry((WSEED * 7919 + 13) >>> 0), K = P.WK;
  const nS = P.WSRC || Math.max(2, Math.round(0.15 * K));
  const nD = Math.round(P.WDEEPF * (K - nS) / 2);
  const type = new Array(K).fill('mix'); for (let i = 0; i < nS; i++) type[i] = 'src';
  for (let i = nS; i < nS + nD; i++) type[i] = 'psrc';
  const rest = []; for (let i = nS + nD; i < K; i++) rest.push(i);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const deepIdx = rest.slice(0, nD).sort((a, b) => a - b); for (const i of deepIdx) type[i] = 'deep';
  for (const i of rest.slice(nD, nD + P.WPROD)) type[i] = 'prod';
  for (const i of rest.slice(nD + P.WPROD, nD + P.WPROD + P.WHIER)) type[i] = 'hier';
  const kvI = rest.slice(nD + P.WPROD + P.WHIER, nD + P.WPROD + P.WHIER + 2 * P.WKV);
  for (let i = 0; i < P.WKV; i++) { type[kvI[2 * i]] = 'key'; type[kvI[2 * i + 1]] = 'val'; }
  const parents = [], coef = [], dsrc = new Array(K).fill(-1), dD = new Array(K).fill(0), norm = new Float64Array(K).fill(1);
  const LAGS = K + P.WDMAX + 3, sp = [];
  const variance = (m) => { const by = new Map(); for (const [key, a] of m) { const s = Math.floor(key / LAGS); if (!by.has(s)) by.set(s, []); by.get(s).push([key % LAGS, a]); }
    let v = 0; for (const arr of by.values()) for (const [l1, a1] of arr) for (const [l2, a2] of arr) v += a1 * a2 * Math.pow(0.5, Math.abs(l1 - l2)); return v; };
  for (let k = 0; k < K; k++) {
    parents.push([]); coef.push([]); const m = new Map();
    if (type[k] === 'src' || type[k] === 'psrc') m.set(k * LAGS, 1);
    else if (type[k] === 'deep') { const i = deepIdx.indexOf(k), u = r(); dsrc[k] = nS + i;
      dD[k] = P.WDLOG ? (nD > 1 ? Math.round(Math.pow(P.WDMAX, i / (nD - 1))) : P.WDMAX) : 1 + Math.floor(u * P.WDMAX); m.set(dsrc[k] * LAGS + dD[k] + 1, 1); }
    else if (type[k] === 'hier') { const pool = []; for (let j = 0; j < nS; j++) pool.push(j);
      for (let i = 0; i < 2 ** P.WHL; i++) { const j = i + Math.floor(r() * (pool.length - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; parents[k].push(pool[i]); coef[k].push(1); } }
    else if (type[k] === 'val') { parents[k] = [kvI[kvI.indexOf(k) - 1]]; coef[k] = [1]; }
    else if (type[k] === 'key') { /* знак без памяти */ }
    else if (type[k] === 'prod') { const a = Math.floor(r() * nS); let b = Math.floor(r() * (nS - 1)); if (b >= a) b++; parents[k] = [a, b]; coef[k] = [1, 1]; }
    else {
      const pool = []; for (let j = 0; j < k; j++) if (type[j] === 'src' || type[j] === 'mix') pool.push(j);
      const cnt = Math.min(pool.length, 1 + Math.floor(r() * P.WPAR));
      for (let i = 0; i < cnt; i++) { const j = i + Math.floor(r() * (pool.length - i)); [pool[i], pool[j]] = [pool[j], pool[i]];
        parents[k].push(pool[i]); coef[k].push((r() < 0.5 ? -1 : 1) * (0.5 + 0.5 * r())); }
      parents[k].forEach((q, i) => { for (const [key, a] of sp[q]) { const s = Math.floor(key / LAGS), l = key % LAGS + 1; m.set(s * LAGS + l, (m.get(s * LAGS + l) || 0) + coef[k][i] * a); } });
      const v = variance(m); norm[k] = v > 1e-9 ? Math.sqrt(v) : 1;
      for (const [key, a] of m) m.set(key, a / norm[k]);
    }
    sp.push(m);
  }
  const grand = parents.map((ps) => [...new Set(ps.flatMap((q) => parents[q]))]);
  const idx = (...t) => type.map((x, i) => (t.includes(x) ? i : -1)).filter((i) => i >= 0);
  return { K, type, parents, grand, coef, norm, dsrc, dD, srcCh: idx('src', 'psrc'), mixCh: idx('mix'), deepCh: idx('deep'), prodCh: idx('prod'), hierCh: idx('hier'), keyCh: idx('key'), valCh: idx('val') };
}

const NAMES = { src: 'источник', psrc: 'тайный', deep: 'глубокий', mix: 'смесь', prod: 'произведение', hier: 'этаж', key: 'ключ', val: 'значение' };

class World3 {
  constructor(cfg, seed) {
    this.cfg = cfg; this.seed = seed;
    const P = this.P = mixKnobs(cfg.WK), S = this.S = makeSchema(P, cfg.WSEED), K = S.K;
    this.rnd = mulberry((Math.imul(seed, 2654435761) + 1013) >>> 0);   // свой жребий мира: мозг его не делит
    this.c = new Float64Array(K);
    this.hs = S.srcCh.map(() => new Array(P.WDMAX + 1).fill(0));
    this.KLEV = Array.from({ length: P.WKA }, (_, i) => (i - (P.WKA - 1) / 2) * Math.sqrt(12 / (P.WKA * P.WKA - 1)));
    this.kvs = new Int32Array(K); this.kvn = new Int32Array(K); this.kvt = 0;
    this.kvd = S.type.map((t) => (t === 'key' ? Float64Array.from({ length: P.WKA }, () => gauss3(this.rnd)) : null));
    this.nerves = S.type.map((t, k) => ({ k, kind: NAMES[t] }));
    this.plugged = false; this.motorNerve = -1; this.propNerve = -1; this.t = 0; this.b = 0;
    this.z = { val: 0 }; this.g = { val: 0 }; this.uHist = new Float64Array(8); this.uPos = 0;
    this.kinds = [...new Set(S.type.map((t) => NAMES[t]))];
  }
  get n() { return this.S.K; }
  observe(out) { const sn = this.cfg.SN; for (let k = 0; k < this.S.K; k++) out[k] = this.c[k] + sn * gauss3(this.rnd); return out; }
  comfort() { return 0; }
  marginal() { return 0; }
  advance() {                               // дословно bigStep нейрона-3 (ветка без текста, цифр и задач)
    const S = this.S, P = this.P, c = this.c, K = S.K, n = new Float64Array(K), g = () => gauss3(this.rnd); this.t++;
    for (const k of S.srcCh) n[k] = P.WBIN && S.type[k] === 'src' ? (c[k] < 0 ? -1 : 1) * (this.rnd() < 0.75 ? 1 : -1) : 0.5 * c[k] + Math.sqrt(0.75) * g();
    for (let k = 0; k < K; k++) {
      const t = S.type[k];
      if (t === 'deep') n[k] = this.hs[S.dsrc[k]][S.dD[k]];
      else if (t === 'val') n[k] = this.kvd[S.parents[k][0]][this.kvs[S.parents[k][0]]];
      else if (t === 'key') { const i = Math.floor(this.rnd() * P.WKA); this.kvn[k] = i; n[k] = this.KLEV[i]; }
      else if (t === 'hier') { let v = []; const ps = S.parents[k]; for (let i = 0; i < ps.length; i += 2) v.push(c[ps[i]] * c[ps[i + 1]]);
        while (v.length > 1) { const u = []; for (let i = 0; i < v.length; i += 2) u.push((v[i] + v[i + 1] + v[i] * v[i + 1]) / Math.sqrt(3)); v = u; } n[k] = v[0]; }
      else if (t === 'prod') n[k] = c[S.parents[k][0]] * c[S.parents[k][1]];
      else if (t === 'mix') { const ps = S.parents[k], a = S.coef[k]; let v = 0; for (let i = 0; i < ps.length; i++) v += a[i] * c[ps[i]]; n[k] = v / S.norm[k]; }
    }
    for (const s of S.srcCh) { this.hs[s].unshift(n[s]); this.hs[s].length = P.WDMAX + 1; }
    for (const k of S.keyCh) this.kvs[k] = this.kvn[k];
    if (++this.kvt % P.WEP === 0) for (const k of S.keyCh) for (let i = 0; i < P.WKA; i++) this.kvd[k][i] = gauss3(this.rnd);
    this.c = n;
  }
  truth() { return this.nerves.map((x) => x.kind); }
}
module.exports = { World3, makeSchema, mixKnobs, NAMES };

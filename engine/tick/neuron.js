#!/usr/bin/env node
'use strict';
/* ============================================================
   ЧЕРНОВОЙ НЕЙРОН -- только то, что уцелело за 21 шаг

   Обоснование каждой детали -- в NEURON.md, там же числа, которыми она
   оплачена. Здесь она исполняется.

   Выброшено всё, что не прошло измерения: налог на ошибку предсказания
   (трижды не дошёл), переворот налога, промах адреса, потеря такта,
   самозваная связь, выбор ближайших по адресу (он создал ловушку для
   безадресных -- медиана связей упала вчетверо).

   Седьмое правило исполняется здесь же: печатаются МЕДИАНЫ, а не
   средние. Среднее по кривому распределению не описывает никого.
   ============================================================ */
const { makeRNG } = require('../src/rng');

const K = 6;
const num = (n, d) => {
  const v = process.env[n];
  if (v === undefined || v.trim() === '') return d;
  const x = +v; if (Number.isNaN(x)) throw new Error(`${n}: не число`);
  return x;
};

const N        = num('N', 64);        // частей
const BUDGET   = num('BUDGET', 200);  // тактов на круг, фиксирован
const BASE     = num('BASE', 0.05);   // базовая доля при делёжке
const C_UPDATE = 1, C_READ = 0.5, C_LINK = 5;
const C_HOLD   = num('HOLD', 0.1);    // держание связи, за круг
const GRACE    = num('GRACE', 30);    // сколько кругов связь живёт в долг
const MIX0     = num('MIX0', -0.3);   // < 0 -- ОТТАЛКИВАНИЕ
const ANCHOR   = num('ANCHOR', 0.5);  // тяга к своей подписи
const EVENT    = num('EVENT', 0.01);  // как часто с частью что-то случается
const KIN      = num('KIN', 1);       // 1 похожий, -1 непохожий, 0 жребий
const KIN_S    = num('KIN_S', 4);     // сколько встречных осмотреть
const MAX_READS = 4;

const clampMix = (v) => (v < -0.98 ? -0.98 : v > 0.98 ? 0.98 : v);
const clamp01  = (v) => (v < 0.02 ? 0.02 : v > 0.98 ? 0.98 : v);

function makePart(id, rnd, parent) {
  const x = new Float64Array(K);
  for (let k = 0; k < K; k++) x[k] = parent ? parent.x[k] + (rnd() - 0.5) * 0.2 : rnd() * 2 - 1;
  const par = parent
    ? { mix: clampMix(parent.par.mix + (rnd() - 0.5) * 0.15),
        greed: clamp01(parent.par.greed + (rnd() - 0.5) * 0.15),
        urge: clamp01(parent.par.urge + (rnd() - 0.5) * 0.15) }
    : { mix: clampMix(MIX0), greed: 0.5, urge: 0.5 };
  return { id, x, prev: Float64Array.from(x), par, links: [],
    credit: 0, read: 0, readPrev: 0, steps: 0,
    mem: new Map(),                       // метки: только прибавление
    sigSum: new Float64Array(K), sigW: 0, // подпись: ТОЛЬКО свои события
  };
}

function create(seed) {
  const rnd = makeRNG(seed), col = makeRNG((seed * 15485863 + 11) >>> 0);
  const w = { rnd, col, round: 0, parts: [], nextMark: 0, dir: null, lives: [] };
  for (let i = 0; i < N; i++) w.parts.push(makePart(i, rnd, null));
  // каждой части -- по одной связи, чтобы мир не начинался с пустоты
  for (const p of w.parts) {
    const j = Math.floor(rnd() * N);
    if (j !== p.id) p.links.push({ j, debt: 0, born: 0, cost: 0 });
  }
  w.dir = new Float64Array(K);
  for (let k = 0; k < K; k++) w.dir[k] = col() * 2 - 1;
  return w;
}

const dist = (a, b) => { let s = 0; for (let k = 0; k < K; k++) s += Math.abs(a[k] - b[k]); return s / K; };
const addrOf = (w, p) => {
  if (!p.sigW) return 0;
  let a = 0; for (let k = 0; k < K; k++) a += (p.sigSum[k] / p.sigW) * w.dir[k];
  return Math.tanh(a);
};

/* СОБЫТИЕ: с частью что-то случилось. Метка своя и ни с кем не делится
   -- именно поэтому подписи у частей не стягиваются (NEURON.md §3). */
function event(w, p) {
  p.x[Math.floor(w.rnd() * K)] = w.rnd() * 2 - 1;
  const mk = w.nextMark++;
  p.mem.set(mk, 1);
  const c = new Float64Array(K);
  for (let k = 0; k < K; k++) c[k] = w.col() * 2 - 1;
  for (let k = 0; k < K; k++) p.sigSum[k] += c[k];
  p.sigW += 1;
}

function round(w) {
  const P = w.parts;
  let sum = 0; for (const p of P) sum += p.readPrev + BASE;
  for (const p of P) p.credit += BUDGET * (p.readPrev + BASE) / sum;
  for (const p of P) { p.readPrev = p.read; p.read = 0; }

  // ДОЛГ: связь переживает неудачный круг и уходит, лишь когда за неё
  // не платили GRACE кругов подряд (NEURON.md §7)
  for (const p of P) {
    if (!p.links.length) continue;
    for (const l of p.links) l.cost = C_HOLD;
    let paid = 0, keep = 0;
    for (const l of p.links) { if (paid + l.cost > p.credit) break; paid += l.cost; keep++; }
    const stay = [];
    for (let i = 0; i < p.links.length; i++) {
      const l = p.links[i];
      if (i < keep) { l.debt = 0; stay.push(l); continue; }
      l.debt += l.cost;
      if (l.debt <= GRACE * l.cost) stay.push(l); else w.lives.push(w.round - l.born);
    }
    p.links = stay; p.credit -= paid;
  }

  for (const p of P) {
    if (p.credit < C_UPDATE) continue;
    let left = p.credit - C_UPDATE;
    const cand = p.links.map((l) => P[l.j]).filter(Boolean)
      .map((o) => ({ o, nov: dist(p.x, o.x) })).sort((a, b) => b.nov - a.nov);
    const want = Math.min(MAX_READS, Math.floor(p.par.greed * MAX_READS) + 1);
    const got = [];
    for (const c of cand) {
      if (got.length >= want || left < C_READ) break;
      left -= C_READ; c.o.read++; got.push(c.o);
    }
    const nx = new Float64Array(K);
    for (let k = 0; k < K; k++) {
      let s = 0; for (const o of got) s += o.x[k];
      s = got.length ? s / got.length : p.x[k];
      const pull = p.sigW > 0 ? ANCHOR * (p.sigSum[k] / p.sigW - p.x[k]) : 0;
      nx[k] = Math.tanh((1 - Math.abs(p.par.mix)) * p.x[k] + p.par.mix * s + pull
        + 0.03 * (w.rnd() * 2 - 1));
    }
    p.prev.set(p.x); p.x.set(nx); p.credit = left; p.steps++;
    if (w.rnd() < EVENT) event(w, p);

    // СВЯЗАТЬСЯ: выбор по адресу среди случайных встречных. Нарочно НЕ
    // ближайшие по адресу: это создало ловушку для безадресных (шаг 21).
    if (p.credit >= C_LINK && w.rnd() < p.par.urge * 0.25) {
      let j;
      if (KIN === 0) j = Math.floor(w.rnd() * N);
      else {
        const mine = addrOf(w, p); let best = -1, bd = 0;
        for (let t = 0; t < KIN_S; t++) {
          const c = Math.floor(w.rnd() * N);
          const d = Math.abs(addrOf(w, P[c]) - mine);
          if (best < 0 || (KIN > 0 ? d < bd : d > bd)) { best = c; bd = d; }
        }
        j = best;
      }
      if (j !== p.id && !p.links.some((l) => l.j === j)) {
        p.links.push({ j, debt: 0, born: w.round, cost: 0 });
        p.credit -= C_LINK;
      }
    }
  }
  w.round++;
}

module.exports = { create, round, addrOf, dist, K, N };

if (require.main === module) {
  const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const cor = (a, b) => {
    const n = a.length, ma = mean(a), mb = mean(b);
    let s = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da > 0 && db > 0 ? s / Math.sqrt(da * db) : 0;
  };
  const BUILD = 6000, GAP = 5000;
  console.log('ЧЕРНОВОЙ НЕЙРОН -- проверка, что уцелевшее работает');
  console.log(`${N} частей, ${BUILD}+${GAP} кругов, отталкивание ${MIX0}, тяга ${ANCHOR}\n`);
  console.log(' сид | связей: медиана/средняя/наиб | с одной | разброс | у края | лицо  | отсчёт | родство/любые | жизнь связи');
  for (const seed of [1, 2, 3]) {
    const w = create(seed);
    for (let r = 0; r < BUILD; r++) round(w);
    const P = w.parts;
    const x0 = P.map((p) => Float64Array.from(p.x));
    w.lives.length = 0;
    for (let r = 0; r < GAP; r++) round(w);
    const deg = P.map((p) => p.links.length);
    const ad = P.map((p) => addrOf(w, p));
    let sp = 0, n2 = 0, ed = 0, en = 0, lk = 0, ln = 0, al = 0, an = 0;
    for (let i = 0; i < P.length; i++) {
      for (let j = i + 1; j < P.length; j++) { sp += dist(P[i].x, P[j].x); al += Math.abs(ad[i] - ad[j]); n2++; an++; }
      for (let k = 0; k < K; k++) { if (Math.abs(P[i].x[k]) > 0.95) ed++; en++; }
      for (const l of P[i].links) { lk += Math.abs(ad[i] - ad[l.j]); ln++; }
    }
    const a = [], b = [], c = [];
    for (let i = 0; i < P.length; i++) for (let k = 0; k < K; k++) {
      a.push(x0[i][k]); b.push(P[i].x[k]); c.push(x0[(i + 17) % P.length][k]);
    }
    console.log(`${String(seed).padStart(4)} | ${String(med(deg)).padStart(7)} /${mean(deg).toFixed(1).padStart(6)} /` +
      `${String(Math.max(...deg)).padStart(5)} | ${String(deg.filter((v) => v <= 1).length).padStart(7)} | ` +
      `${(sp / n2).toFixed(4).padStart(7)} | ${(100 * ed / en).toFixed(1).padStart(5)}% | ` +
      `${cor(a, b).toFixed(3).padStart(5)} | ${cor(a, c).toFixed(3).padStart(6)} | ` +
      `${(lk / ln).toFixed(3)}/${(al / an).toFixed(3)} | ${String(med(w.lives)).padStart(11)}`);
  }
  console.log('\nразброс -- среднее попарное расстояние состояний (при сближающем mix было бы 0.023);');
  console.log('лицо -- связь состояния части с самой собой через 5000 кругов, рядом отсчёт по чужой;');
  console.log('родство/любые -- расстояние по адресу у связанных против любых пар.');
  console.log('\nСедьмое правило: медиана напечатана рядом со средней нарочно.');
}

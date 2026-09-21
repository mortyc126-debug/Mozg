#!/usr/bin/env node
'use strict';
/* ============================================================
   НЕЙРОН-2 -- пересборка по итогам оценки чернового нейрона

   1. Читающему есть польза. Мир -- поток из 8 каналов, связанных
      причинно: три источника, остальные завтра повторяют сочетание
      других сегодня. Мир платит части за сжатие её канала: столько
      тактов, сколько бит на круг она экономит, предсказывая его.
      Чтение соседа -- покупка сведений: читающий платит прочитанному,
      и это окупается, только если сведения улучшают предсказание.
   2. Синапс живёт, пока несёт вес. Новая связь -- проба: если за
      TRIAL кругов её вес не вырос, она отмирает.
   3. Жизнь и смерть. Аренда за место каждый круг, банкрот умирает,
      богатый копирует себя в свободное место. В мире ПК копия
      берёт с собой всё, включая связи и веса. Случайный сбой может
      убить любого -- так мир не замирает. Никто не убивает бедного
      ради места -- так нет лотереи.
   4. Всё синхронно: входы -- состояния этого круга, плата за чтение
      зачисляется после круга, родитель выбирается жребием. Порядок
      номеров ни на что не влияет.
   5. Седьмое правило: медианы; возраст -- и умерших, и живых.

   Проверка: WORLD=0 node neuron2.js -- у каждой части свой поток,
   чтение не окупается никогда.
   ============================================================ */

const num = (n, d) => { const v = process.env[n]; return v === undefined || v === '' ? d : +v; };
const N = 64;
const WORLD  = num('WORLD', 1);           // 1 причинный мир, 0 проверка
const CH     = WORLD ? 8 : N;             // каналов
const ROUNDS = num('ROUNDS', 100000);
const SN     = 0.1, V = 1 + SN * SN;      // шум датчика; дисперсия того, что видит датчик
const PAY    = num('PAY', 1);             // тактов за бит сжатия
const RENT   = num('RENT', 0.4);          // аренда места за круг
const PRICE  = num('PRICE', 0.3);         // одно чтение, уходит прочитанному
const C_LINK = 1, SEARCH = 0.2;           // цена поиска связи; шанс поиска за круг при urge = 1
const TRIAL  = 20, PRUNE = 0.15;          // проба связи и порог веса
const DIE    = 50;                        // кругов в минусе до смерти
const FAULT  = num('FAULT', 1 / 3000);    // сбой: шанс смерти за круг
const BIRTH  = 60, CAP = 200, START = 200; // цена копии, потолок копилки, стартовый запас (не выше потолка!)
const BETA   = 0.02;                      // окно оценки ошибки, около 50 кругов
const PARENTS = [[], [], [], [0, 1], [1, 2], [0, 2], [3], [3, 4]]; // только для замеров

function makeRNG(seed) {                  // mulberry32: числа совпадут на любой машине
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function worldStep(w) {
  const c = w.c, n = new Float64Array(CH), g = () => gauss(w.rnd);
  if (!WORLD) { for (let k = 0; k < CH; k++) n[k] = 0.9 * c[k] + Math.sqrt(0.19) * g(); }
  else {
    // источники почти непредсказуемы сами по себе: их части живут тем, что их читают
    for (let k = 0; k < 3; k++) n[k] = 0.5 * c[k] + Math.sqrt(0.75) * g();
    n[3] = (c[0] + c[1]) / Math.SQRT2;
    n[4] = (c[1] - c[2]) / Math.SQRT2;
    n[5] = (c[0] - c[2]) / Math.SQRT2;
    n[6] = c[3];
    n[7] = c[3] - c[4];
  }
  w.c = n;
}

// гены: greed -> сколько связей держать (1..4), urge -> как часто искать, lr -> скорость учёбы
function newPart(w, slot, par) {
  const r = w.rnd;
  const g = par
    ? { greed: clamp(par.g.greed + 0.08 * gauss(r), 0, 0.999), urge: clamp(par.g.urge + 0.08 * gauss(r), 0, 1),
        lr: clamp(par.g.lr * Math.exp(0.25 * gauss(r)), 0.001, 1) }
    : { greed: r() * 0.999, urge: r(), lr: Math.exp(Math.log(0.01) + r() * Math.log(30)) };
  const p = { slot, ch: slot % CH, g, cap: 1 + Math.floor(g.greed * 4), credit: par ? BIRTH / 2 : START,
    hungry: 0, age: 0, links: [], wSelf: 0, mse: V, s: 0, x: null, xl: null, pred: 0, bits: 0,
    fromWorld: 0, fromReads: 0 };
  if (par && par.ch === p.ch) {           // копия на том же месте уносит связи и веса
    p.links = par.links.map((l) => ({ j: l.j, w: l.w, age: l.age }))
      .sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, p.cap);
    p.wSelf = par.wSelf; p.mse = par.mse;
  }
  return p;
}

function create(seed) {
  const w = { rnd: makeRNG(seed), round: 0, parts: [], c: new Float64Array(CH), births: 0,
    deaths: { bank: 0, fault: 0 }, deadAges: [] };
  for (let k = 0; k < CH; k++) w.c[k] = gauss(w.rnd);
  for (let i = 0; i < N; i++) w.parts.push(newPart(w, i, null));
  return w;
}

function kill(w, p, why) {
  w.parts[p.slot] = null; w.deaths[why]++;
  if (w.round >= ROUNDS / 2) w.deadAges.push(p.age);
  for (const q of w.parts) if (q) q.links = q.links.filter((l) => l.j !== p.slot);
}

function round(w) {
  worldStep(w);
  const P = w.parts, inc = new Float64Array(N);
  for (const p of P) if (p) p.s = w.c[p.ch] + SN * gauss(w.rnd);   // датчики

  // расчёт за прошлое предсказание: учёба (нормированный LMS) и плата мира
  for (const p of P) {
    if (!p || !p.x) continue;
    const e = p.s - p.pred;
    p.mse += BETA * (e * e - p.mse);
    let nrm = 1; for (const v of p.x) nrm += v * v;
    const k = p.g.lr * e / nrm;
    p.wSelf += k * p.x[0];
    for (let i = 0; i < p.xl.length; i++) p.xl[i].w += k * p.x[i + 1];
    p.bits = Math.max(0, 0.5 * Math.log2(V / Math.max(p.mse, 1e-6)));
    p.credit += PAY * p.bits; p.fromWorld += PAY * p.bits;
  }

  // аренда, чтение, новое предсказание; пробные связи читаются первыми
  for (const p of P) {
    if (!p) continue;
    p.credit -= RENT;
    const order = p.links.slice().sort((a, b) =>
      (b.age < TRIAL) - (a.age < TRIAL) || Math.abs(b.w) - Math.abs(a.w));
    const x = [p.s], xl = [];
    for (const l of order) {
      if (p.credit < PRICE) break;        // в долг не читают
      p.credit -= PRICE; inc[l.j] += PRICE;
      x.push(P[l.j].s); xl.push(l);
    }
    let pred = p.wSelf * p.s;
    for (let i = 0; i < xl.length; i++) pred += xl[i].w * x[i + 1];
    p.pred = pred; p.x = x; p.xl = xl;
  }
  for (let i = 0; i < N; i++) if (P[i]) { P[i].credit += inc[i]; P[i].fromReads += inc[i]; }

  // связи: отмирание пустых, поиск новых
  for (const p of P) {
    if (!p) continue;
    for (const l of p.links) l.age++;
    p.links = p.links.filter((l) => l.age < TRIAL || Math.abs(l.w) >= PRUNE);
    if (p.links.length < p.cap && p.credit >= C_LINK && w.rnd() < p.g.urge * SEARCH) {
      p.credit -= C_LINK;                 // поиск платный, даже неудачный
      const j = Math.floor(w.rnd() * N);
      if (P[j] && j !== p.slot && !p.links.some((l) => l.j === j)) p.links.push({ j, w: 0, age: 0 });
    }
    p.age++;
  }

  // смерть: банкротство или сбой
  for (const p of P) {
    if (!p) continue;
    p.hungry = p.credit < 0 ? p.hungry + 1 : 0;
    if (p.hungry > DIE) kill(w, p, 'bank');
    else if (w.rnd() < FAULT) kill(w, p, 'fault');
  }

  // потолок копилки и рождение. Расти можно только в своей нише: место в канале
  // занимает потомок богатого из того же канала. Чужой канал можно заселить,
  // лишь когда в нём не осталось никого, -- иначе богатые плодят обречённых.
  for (const p of P) if (p && p.credit > CAP) p.credit = CAP;
  const free = []; for (let i = 0; i < N; i++) if (!P[i]) free.push(i);
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(w.rnd() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
  for (const s of free) {
    const k = s % CH, rich = P.filter((p) => p && p.credit >= BIRTH);
    const same = rich.filter((p) => p.ch === k);
    const pool = same.length ? same : P.some((p) => p && p.ch === k) ? [] : rich;
    if (!pool.length) continue;
    const par = pool[Math.floor(w.rnd() * pool.length)];
    par.credit -= BIRTH; P[s] = newPart(w, s, par); w.births++;
  }
  w.round++;
}

const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);

function stats(w) {
  const A = w.parts.filter(Boolean);
  const S = A.filter((p) => WORLD && p.ch < 3), X = A.filter((p) => !WORLD || p.ch >= 3);
  let right = 0, sib = 0, all = 0;
  for (const p of X) for (const l of p.links) {
    const a = Math.abs(l.w), c = w.parts[l.j].ch; all += a;
    if (WORLD && PARENTS[p.ch].includes(c)) right += a; else if (c === p.ch) sib += a;
  }
  return { alive: A.length, births: w.births, bank: w.deaths.bank, fault: w.deaths.fault,
    deadAge: med(w.deadAges), liveAge: med(A.map((p) => p.age)),
    linksS: med(S.map((p) => p.links.length)), linksX: med(X.map((p) => p.links.length)),
    right: all ? right / all : 0, sib: all ? sib / all : 0,
    bitsS: med(S.map((p) => p.bits)), bitsX: med(X.map((p) => p.bits)),
    cap: med(A.map((p) => p.cap)), urge: med(A.map((p) => p.g.urge)), lr: med(A.map((p) => p.g.lr)),
    readShare: med(S.map((p) => p.fromReads / Math.max(1e-9, p.fromReads + p.fromWorld))),
    minus: A.filter((p) => p.credit < 0).length };
}

module.exports = { create, round, stats };

if (require.main === module) {
  const f = (v, d = 2) => (Number.isNaN(v) ? '  -' : v.toFixed(d));
  console.log(WORLD ? 'ПРИЧИННЫЙ МИР: чтение может окупаться' : 'ПРОВЕРКА: у каждой части свой поток, чтение не окупается');
  console.log(`${N} частей, ${ROUNDS} кругов. Медианы.\n`);
  for (const seed of [1, 2, 3]) {
    const w = create(seed);
    console.log(`сид ${seed}`);
    for (let r = 1; r <= ROUNDS; r++) {
      round(w);
      if ([1000, 5000, 20000, ROUNDS].includes(r)) {
        const s = stats(w);
        console.log(`  круг ${String(r).padStart(6)}: живых ${s.alive} | связей: у источников ${s.linksS}, у остальных ${s.linksX}` +
          (WORLD ? ` | вес на верных ${f(100 * s.right, 0)}%, на соседях по каналу ${f(100 * s.sib, 0)}%` : '') +
          ` | бит: источники ${f(s.bitsS)}, остальные ${f(s.bitsX)}`);
        if (r === ROUNDS) {
          console.log(`  итог: рождений ${s.births}, смертей банкрот/сбой ${s.bank}/${s.fault} | возраст умерших ${s.deadAge}, живых ${s.liveAge}` +
            ` | гены: связей ${s.cap}, urge ${f(s.urge)}, lr ${f(s.lr, 3)}` +
            (WORLD ? ` | доход источников от чтения ${f(100 * s.readShare, 0)}%` : '') + ` | в минусе ${s.minus}`);
        }
      }
    }
  }
}

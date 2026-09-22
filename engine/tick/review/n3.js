#!/usr/bin/env node
'use strict';
/* ============================================================
   НЕЙРОН-2 -- пересборка по итогам оценки чернового нейрона
   Правка 2: потомство по доходу, замер «мир платит всем поровну»,
   все постоянные настраиваются, перестановочный нуль в выводе.
   Правка 3: закон учёбы -- в генах (RULE=1).
   Правка 4: мир со связанными входами (RHO, MIX) -- проверка, выведет ли
   отбор LMS точно, когда Хебб с забыванием даёт кривые веса.

   1. Читающему есть польза. Мир -- поток из 8 каналов, связанных
      причинно: три источника, остальные завтра повторяют сочетание
      других сегодня. Мир платит части за сжатие её канала: столько
      тактов, сколько бит на круг она экономит, предсказывая его.
      Чтение соседа -- покупка сведений: читающий платит прочитанному.
   2. Синапс живёт, пока несёт вес. Новая связь -- проба: если за
      TRIAL кругов её вес не вырос, она отмирает. Связи находит УЧЁБА
      внутри одной жизни -- без размножения они находятся так же.
   3. Жизнь и смерть. Аренда за место, банкрот умирает, случайный сбой
      освобождает места. Место в канале достаётся потомку части того же
      канала; шанс пропорционален её доходу (SELECT=1), а не жребию среди
      накопивших на копию (SELECT=0). Копия уносит связи и веса.
   4. Зачем хозяйство: не находить связи, а не давать отбору их разобрать.
      Проверка: SHARE=1 -- мир делит всю плату за биты поровну на всех,
      и польза от чтения больше не достаётся читающему. SHARE_AT -- с
      какого круга: так отбор проверяется на уже собранной сети.
   5. Закон учёбы -- в генах. Вес меняется на (a*s' - b*p)*x - c*w, где x --
      вход, s' -- что потом увидел свой датчик, p -- своё предсказание, w --
      сам вес. Три местных слагаемых: Хебб с исходом, анти-Хебб со своим
      выходом, забывание. LMS -- частный случай a = b, c = 0. Основатели
      получают случайные a, b, c; найдёт ли отбор LMS сам? RULE=0 -- LMS
      задан рукой, как в правке 2.
   6. Всё синхронно, порядок номеров ни на что не влияет.
   7. Седьмое правило: медианы; возраст -- и умерших, и живых; рядом
      с долей верных связей -- перестановочный нуль.

   Все постоянные читаются из окружения, действующие печатаются в начале
   прогона: ручка не может молча не сработать. WORLD=0 -- мир без
   причинности, у каждой части свой поток.
   ============================================================ */

const num = (n, d) => {
  const v = process.env[n];
  if (v === undefined || v.trim() === '') return d;
  const x = +v; if (Number.isNaN(x)) throw new Error(`${n}: не число`);
  return x;
};
const CFG = {};
const K = (n, d) => (CFG[n] = num(n, d));
const WORLD  = K('WORLD', 1);         // 1 причинный мир, 0 у каждой части свой поток
const N      = K('N', 64);            // мест
const ROUNDS = K('ROUNDS', 100000);
const SN     = K('SN', 0.1);          // шум датчика
const PAY    = K('PAY', 1);           // тактов за бит сжатия
const RENT   = K('RENT', 0.4);        // аренда места за круг
const PRICE  = K('PRICE', 0.3);       // одно чтение, уходит прочитанному
const C_LINK = K('C_LINK', 1);        // поиск связи
const SEARCH = K('SEARCH', 0.2);      // шанс поиска за круг при urge = 1
const TRIAL  = K('TRIAL', 20);        // проба связи, кругов
const PRUNE  = K('PRUNE', 0.15);      // порог веса после пробы
const DIE    = K('DIE', 50);          // кругов в минусе до смерти
const FAULT  = K('FAULT', 1 / 3000);  // сбой: шанс смерти за круг
const BIRTH  = K('BIRTH', 60);        // цена копии; потомок получает половину
const CAP    = K('CAP', 200);         // потолок копилки
const START  = K('START', 200);       // стартовый запас основателей
const BETA   = K('BETA', 0.02);       // окно оценки ошибки, около 50 кругов
const GAIN   = K('GAIN', 0.01);       // окно оценки дохода, около 100 кругов
const SELECT = K('SELECT', 1);        // 1 потомство по доходу, 0 жребий среди накопивших
const SHARE  = K('SHARE', 0);         // 1 мир делит плату за биты поровну на всех
const SHARE_AT = K('SHARE_AT', 0);    // с какого круга делить поровну (чтобы сеть успела собраться)
const RULE   = K('RULE', 1);          // 1 закон учёбы в генах, 0 LMS задан рукой
const WMAX   = K('WMAX', 8);          // предел силы синапса
const RHO    = K('RHO', 0);           // связь источников между собой (0 -- независимы)
const MIX    = K('MIX', 1);           // вес второго родителя в смесях (1 -- поровну)
const CH = WORLD ? 8 : N, V = 1 + SN * SN;
// делители, чтобы у каждого канала дисперсия была 1 при любых RHO и MIX
const K3 = Math.sqrt(1 + MIX * MIX + 2 * MIX * RHO), K4 = Math.sqrt(1 + MIX * MIX - 2 * MIX * RHO);
const C34 = (RHO - MIX * RHO + MIX - MIX * MIX * RHO) / (K3 * K4);          // связь каналов 3 и 4
const K7 = RHO === 0 && MIX === 1 ? 1 : Math.sqrt(1 + MIX * MIX - 2 * MIX * C34); // 1 -- старый мир точно
if (START > CAP) throw new Error('START выше CAP: запас сгорит в первый же круг');
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
const clampW = (v) => (v > WMAX ? WMAX : v < -WMAX ? -WMAX : v);

function worldStep(w) {
  const c = w.c, n = new Float64Array(CH), g = () => gauss(w.rnd);
  if (!WORLD) { for (let k = 0; k < CH; k++) n[k] = 0.9 * c[k] + Math.sqrt(0.19) * g(); }
  else {
    // источники почти непредсказуемы сами по себе: их части живут тем, что их читают
    // RHO > 0: у источников общая составляющая, и входы смесей связаны между собой;
    // MIX != 1: смесь не вдоль общей оси входов, и Хебб с забыванием её не подстроит
    const gc = RHO ? g() : 0;
    for (let k = 0; k < 3; k++)
      n[k] = 0.5 * c[k] + Math.sqrt(0.75) * (RHO ? Math.sqrt(RHO) * gc + Math.sqrt(1 - RHO) * g() : g());
    n[3] = (c[0] + MIX * c[1]) / K3;
    n[4] = (c[1] - MIX * c[2]) / K4;
    n[5] = (c[0] - MIX * c[2]) / K4;
    n[6] = c[3];
    n[7] = (c[3] - MIX * c[4]) / K7;
  }
  w.c = n;
}

// гены: greed -> сколько связей держать (1..4), urge -> как часто искать;
// закон учёбы: a, b, c (RULE=1) или скорость lr при заданном LMS (RULE=0)
function newPart(w, slot, par) {
  const r = w.rnd, mut = (v) => clamp(v * Math.exp(0.2 * gauss(r)), 1e-4, 2);
  let g;
  if (par) {
    g = { greed: clamp(par.g.greed + 0.08 * gauss(r), 0, 0.999), urge: clamp(par.g.urge + 0.08 * gauss(r), 0, 1) };
    if (RULE) { g.a = mut(par.g.a); g.b = mut(par.g.b); g.c = mut(par.g.c); }
    else g.lr = clamp(par.g.lr * Math.exp(0.25 * gauss(r)), 0.001, 1);
  } else {
    g = { greed: r() * 0.999, urge: r() };
    if (RULE) { g.a = 0.001 + 0.3 * r(); g.b = 0.001 + 0.3 * r(); g.c = 0.001 + 0.3 * r(); }
    else g.lr = Math.exp(Math.log(0.01) + r() * Math.log(30));
  }
  const p = { slot, ch: slot % CH, g, cap: 1 + Math.floor(g.greed * 4), credit: par ? BIRTH / 2 : START,
    hungry: 0, age: 0, links: [], wSelf: 0, mse: V, s: 0, x: null, xl: null, pred: 0, bits: 0,
    c0: 0, gain: 0, fromWorld: 0, fromReads: 0 };
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

function pickByGain(pool, r) {            // шанс пропорционален доходу
  let sum = 0; for (const p of pool) sum += p.gain;
  let t = r() * sum;
  for (const p of pool) { t -= p.gain; if (t <= 0) return p; }
  return pool[pool.length - 1];
}

function round(w) {
  worldStep(w);
  const P = w.parts, inc = new Float64Array(N);
  for (const p of P) if (p) { p.c0 = p.credit; p.s = w.c[p.ch] + SN * gauss(w.rnd); }

  // расчёт за прошлое предсказание: учёба (нормированный LMS) и плата мира
  let bank = 0, alive = 0;
  for (const p of P) {
    if (!p) continue;
    alive++;
    if (!p.x) { p.bits = 0; continue; }
    const e = p.s - p.pred;
    p.mse += BETA * (e * e - p.mse);
    let nrm = 1; for (const v of p.x) nrm += v * v;
    if (RULE) {                           // (a*s' - b*p)*x - c*w, нормировано входом
      const { a, b, c } = p.g, hs = a * p.s - b * p.pred;
      p.wSelf = clampW(p.wSelf + (hs * p.x[0] - c * p.wSelf) / nrm);
      for (let i = 0; i < p.xl.length; i++) { const l = p.xl[i]; l.w = clampW(l.w + (hs * p.x[i + 1] - c * l.w) / nrm); }
    } else {                              // LMS рукой
      const k = p.g.lr * e / nrm;
      p.wSelf += k * p.x[0];
      for (let i = 0; i < p.xl.length; i++) p.xl[i].w += k * p.x[i + 1];
    }
    p.bits = Math.max(0, 0.5 * Math.log2(V / Math.max(p.mse, 1e-6)));
    bank += PAY * p.bits;
  }
  const shared = SHARE && w.round >= SHARE_AT;
  for (const p of P) {
    if (!p) continue;
    const pay = shared ? bank / alive : PAY * p.bits;
    p.credit += pay; p.fromWorld += pay;
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
    p.gain += GAIN * (p.credit - p.c0 - p.gain);   // доход за круг, сглаженный
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
  // занимает потомок части того же канала. Чужой канал можно заселить, лишь когда
  // в нём не осталось никого, -- иначе богатые плодят обречённых.
  for (const p of P) if (p && p.credit > CAP) p.credit = CAP;
  const free = []; for (let i = 0; i < N; i++) if (!P[i]) free.push(i);
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(w.rnd() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
  const ok = (p) => p && p.credit >= BIRTH && (!SELECT || p.gain > 0);
  for (const s of free) {
    const k = s % CH;
    let pool = P.filter((p) => ok(p) && p.ch === k);
    if (!pool.length && !P.some((p) => p && p.ch === k)) pool = P.filter(ok);
    if (!pool.length) continue;
    const par = SELECT ? pickByGain(pool, w.rnd) : pool[Math.floor(w.rnd() * pool.length)];
    par.credit -= BIRTH; P[s] = newPart(w, s, par); w.births++;
  }
  w.round++;
}

const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);

// перестановочный нуль: все перестановки родительских списков каналов 3..7, кроме настоящей
const PERMS = (() => {
  const idx = [3, 4, 5, 6, 7], out = [];
  const rec = (a, rest) => { if (!rest.length) { out.push(a); return; }
    rest.forEach((v, i) => rec([...a, v], rest.filter((_, j) => j !== i))); };
  rec([], idx);
  return out.filter((a) => a.some((v, i) => v !== idx[i]));
})();

function stats(w) {
  const A = w.parts.filter(Boolean);
  const S = A.filter((p) => WORLD && p.ch < 3), X = A.filter((p) => !WORLD || p.ch >= 3);
  const L = []; for (const p of X) for (const l of p.links) L.push([p.ch, w.parts[l.j].ch, Math.abs(l.w)]);
  const share = (par) => { let r = 0, a = 0; for (const [c, t, v] of L) { a += v; if (par(c).includes(t)) r += v; } return a ? r / a : NaN; };
  const right = WORLD ? share((c) => PARENTS[c]) : NaN;
  const nul = WORLD ? PERMS.reduce((s, a) => s + share((c) => PARENTS[a[c - 3]]), 0) / PERMS.length : NaN;
  const byCount = WORLD && L.length ? L.filter(([c, t]) => PARENTS[c].includes(t)).length / L.length : NaN;
  return { alive: A.length, births: w.births, bank: w.deaths.bank, fault: w.deaths.fault,
    deadAge: med(w.deadAges), liveAge: med(A.map((p) => p.age)),
    linksS: med(S.map((p) => p.links.length)), linksX: med(X.map((p) => p.links.length)),
    right, nul, byCount, bitsS: med(S.map((p) => p.bits)), bitsX: med(X.map((p) => p.bits)),
    cap: med(A.map((p) => p.cap)), urge: med(A.map((p) => p.g.urge)), lr: RULE ? NaN : med(A.map((p) => p.g.lr)),
    ba: RULE ? med(A.map((p) => p.g.b / p.g.a)) : NaN, ca: RULE ? med(A.map((p) => p.g.c / p.g.a)) : NaN,
    a: RULE ? med(A.map((p) => p.g.a)) : NaN,
    lms: RULE && A.length ? A.filter((p) => p.g.b / p.g.a > 0.8 && p.g.b / p.g.a < 1.25 && p.g.c / p.g.a < 0.1).length / A.length : NaN,
    readShare: med(S.map((p) => p.fromReads / Math.max(1e-9, p.fromReads + p.fromWorld))),
    minus: A.filter((p) => p.credit < 0).length };
}

module.exports = { create, round, stats, CFG };

if (require.main === module) {
  const f = (v, d = 2) => (Number.isNaN(v) ? '-' : v.toFixed(d));
  const pc = (v) => (Number.isNaN(v) ? '-' : `${(100 * v).toFixed(0)}%`);
  console.log((WORLD ? 'ПРИЧИННЫЙ МИР' : 'ПРОВЕРКА: у каждой части свой поток') +
    ` | плата: ${SHARE ? `ПОРОВНУ на всех с круга ${SHARE_AT}` : 'каждому за его биты'} | потомство: ${SELECT ? 'по доходу' : 'жребий среди накопивших'} | закон учёбы: ${RULE ? 'в генах' : 'LMS рукой'}`);
  console.log('постоянные: ' + Object.entries(CFG).map(([k, v]) => `${k}=${+v.toPrecision(4)}`).join(' ') + '\n');
  for (const seed of [1, 2, 3]) {
    const w = create(seed);
    console.log(`сид ${seed}`);
    for (let r = 1; r <= ROUNDS; r++) {
      round(w);
      if ([1000, 20000, 50000, ROUNDS].includes(r)) {
        const s = stats(w);
        console.log(`  круг ${String(r).padStart(6)}: живых ${s.alive} | связей: у источников ${s.linksS}, у остальных ${s.linksX}` +
          (WORLD ? ` | вес на верных ${pc(s.right)} (нуль ${pc(s.nul)}), по счёту ${pc(s.byCount)}` : '') +
          ` | бит: источники ${f(s.bitsS)}, остальные ${f(s.bitsX)}` +
          (RULE ? ` | закон: b/a ${f(s.ba)}, c/a ${f(s.ca)}, a ${f(s.a, 3)}, похожих на LMS ${pc(s.lms)}` : ''));
        if (r === ROUNDS) console.log(`  итог: рождений ${s.births}, смертей банкрот/сбой ${s.bank}/${s.fault} | возраст умерших ${s.deadAge}, живых ${s.liveAge}` +
          ` | гены: связей ${s.cap}, urge ${f(s.urge)}` + (RULE ? '' : `, lr ${f(s.lr, 3)}`) +
          (WORLD ? ` | доход источников от чтения ${pc(s.readShare)}` : '') + ` | в минусе ${s.minus}`);
      }
    }
  }
}

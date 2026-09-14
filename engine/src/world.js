'use strict';
/* ============================================================
   ЯДРО ДВИЖКА
   Здесь нет ни одной сущности выше агента. Есть среда с полями,
   агенты с состоянием, правила из генома и физика. Всё остальное —
   следствие, которое можно только измерить снаружи.
   ============================================================ */
const { makeRNG } = require('./rng');
const GEN = require('./genome');
const { NF, NSEC, NIN, IN_NB, IN_ENERGY, IN_EXC, IN_GENE } = GEN;

const sig = (x) => 1 / (1 + Math.exp(-x));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ---------- среда ------------------------------------------- */
const GX = 56, GY = 44, CS = 9;
const WW = GX * CS, WH = GY * CS;

const FIELD = [
  { alpha: 0.20, sub: 3, decay: 0.0550 },   // 0
  { alpha: 0.20, sub: 3, decay: 0.0550 },   // 1
  { alpha: 0.16, sub: 1, decay: 0.1500 },   // 2 — короткого радиуса
  { alpha: 0.22, sub: 4, decay: 0.0035 },   // 3 — пополняется средой
  { alpha: 0.24, sub: 3, decay: 0.2200 },   // 4 — внешнее воздействие, быстро гаснет
  { alpha: 0.00, sub: 0, decay: 0.0000 },   // 5 — неподвижный градиент среды
];
const KS = [1.0, 1.0, 0.6, 1.0, 0.5, null]; // насыщение при считывании; null — прямое чтение

/* ---------- агент ------------------------------------------- */
const R = 3.6, D0 = 2 * R;
const RL = D0 * 1.5;        // базовая дальность связи
const LINK_TH = 0.35;       // порог склонности к образованию связи
const SENS_TH = 0.15;       // порог перевода поля в возбуждение

/* ---------- возбуждение и пластичность ----------------------- */
const W0 = 0.42, WMIN = 0.10, WDEC = 0.008, LR = 0.20;
const THF = 0.50, LEAK = 0.85, REFRACT = 5;
const ADAPT = 0.80, ADEC = 0.940, WSUM = 2.40;

/* ---------- настраиваемые параметры ---------------------------
   Значения по умолчанию совпадают с прежними жёсткими константами,
   поэтому поведение без явной настройки не меняется. Вынесены наружу,
   чтобы экспериментатор мог отключать защиту популяции и глушить
   отдельные механизмы, не трогая ядро. */
const DEFAULTS = {
  resourceTarget: 1.5,      // к какому уровню подтягивается поле ресурса
  resourceRegen: 0.15,      // скорость этого подтягивания за шаг
  uptake: 0.040,            // предельная скорость поглощения ресурса агентом
  uptakeK: 0.4,             // полунасыщение поглощения
  energyYield: 1.6,         // перевод ресурса в энергию
  energyCost: 0.020,        // базовый расход за шаг
  expressionCost: 0.006,    // расход на единицу экспрессии каждого гена
  energyCap: 3,             // потолок запаса
  divisionEnergy: 2.0,      // порог деления
  divisionCrowd: 7,         // максимум соседей, при котором деление возможно
  divisionRate: 0.010,      // базовая вероятность деления за шаг
  deathThreshold: 0,        // энергия, ниже которой агент погибает
  minPopulation: 40,        // искусственная защита от вымирания; 0 — отключить
  maxCells: 560,            // предел популяции
  gradient: 1.0,            // амплитуда неподвижного градиента среды; 0 — среда однородна
  plasticity: 1.0,          // множитель скорости изменения весов связей; 0 — память выключена
  adhesionScale: 1.0,       // общий множитель силы сцепления
  polarity: 0.0,            // сила действия локальной асимметрии окружения; 0 — механизм выключен
  align: 0.0,               // вес направлений соседей при обновлении ориентации; 0 — механизм выключен
  alignSelf: 1.0,           // вес собственной локальной асимметрии
  alignRate: 0.10,          // скорость поворота ориентации за шаг
  twoPoint: false,          // агент как две связанные точки: у него появляется форма
  bodyLength: 3.6,          // расстояние между точками агента (только при twoPoint)
  bodyStiff: 0.55,          // жёсткость связи между точками
  bodyRadius: 0.72,         // радиус точки в долях R
  linkEnabled: true,        // разрешён ли рост связей вообще
  /* закреплённый контакт: память о том, кто чьим соседом был.
     Обычное сцепление действует между ЛЮБЫМИ оказавшимися рядом агентами,
     поэтому под нагрузкой соседи просто меняются местами и локальное
     сокращение рассасывается. Закреплённый контакт сохраняется между
     конкретной парой и сопротивляется как растяжению, так и сжатию,
     пока не разорвётся. Равновесная длина у каждого контакта СВОЯ и
     запоминается в момент образования: закреплённый контакт сохраняет
     СЛОЖИВШЕЕСЯ расстояние, а не навязывает общее. Первая версия тянула
     всех к постоянной D0 и тем СТЯГИВАЛА ткань (соседей 6.7 -> 9.1,
     сохранность падала до 52%) -- дефект, обнаруженный побочным
     показателем. junction = 0 -- механизм выключен полностью:
     ни одна строка ниже не исполняется и ни одного случайного числа
     не тратится, поэтому поведение побитово совпадает с прежним. */
  junction: 0,              // жёсткость закреплённого контакта; 0 -- выключено
  junctionBreak: 1.9,       // разрыв при растяжении сверх этой доли D0
  junctionMax: 6,           // предел закреплённых контактов на агента
};

function newCell(x, y, rnd, nGenes) {
  return {
    x, y, vx: 0, vy: 0,
    e: new Float64Array(nGenes),
    energy: 1.4 + rnd() * 0.2,
    adh: 0.45, mot: 0.30, div: 0, link: 0, reach: 0, pol: 0,
    ax: 0, ay: 0, amag: 0,        // вектор локальной асимметрии окружения
    qx: 0, qy: 0,                 // собственная ориентация агента (при включённом согласовании)
    // тело агента: две точки. Используются только при params.twoPoint
    p1x: x, p1y: y, p1vx: 0, p1vy: 0, r1: 1,
    p2x: x, p2y: y, p2vx: 0, p2vy: 0, r2: 1,
    sens: new Float64Array(NF),
    nb: 0, links: [], jn: new Map(),
    v: 0, u: 0, ad: 0, inp: 0, fired: -9999,
    dead: false,
  };
}

/* развести точки агента вокруг его центра в случайном направлении */
function spawnBody(w, c, rnd) {
  const L = w.p.bodyLength, a = rnd() * Math.PI * 2;
  const hx = Math.cos(a) * L / 2, hy = Math.sin(a) * L / 2;
  c.p1x = c.x - hx; c.p1y = c.y - hy;
  c.p2x = c.x + hx; c.p2y = c.y + hy;
}

function createWorld(opt = {}) {
  const seed = opt.seed || 12345;
  const rnd = makeRNG(seed);
  const genome = opt.genome || GEN.ancestral();
  const w = {
    t: 0, rnd, seed, genome,
    GX, GY, CS, WW, WH, R, NF, nGenes: genome.nGenes,
    f: [], tmp: new Float32Array(GX * GY),
    cells: [],
    theta: rnd() * Math.PI * 2,
    p: Object.assign({}, DEFAULTS, opt.params || {}),
    maxCells: 0,   // заполняется ниже из параметров
    links: 0, firedNow: 0, lastStim: null,
  };
  w.maxCells = opt.maxCells || w.p.maxCells;
  w.two = !!w.p.twoPoint;
  for (let i = 0; i < NF; i++) w.f.push(new Float32Array(GX * GY));

  // неподвижный градиент среды: направление случайно и агентам не сообщается
  const ux = Math.cos(w.theta), uy = Math.sin(w.theta), half = 95;
  for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
    const px = (x + 0.5) * CS - WW / 2, py = (y + 0.5) * CS - WH / 2;
    w.f[5][y * GX + x] = clamp(0.5 + 0.5 * w.p.gradient * (px * ux + py * uy) / half, 0, 1);
  }

  // стартовая конфигурация одинаковых агентов: плотный комок либо тонкий слой.
  // Это начальное условие, а не механизм: правила для обоих случаев одни и те же.
  const cx = WW / 2, cy = WH / 2;
  if (opt.init === 'layer') {
    const per = opt.layerLength || 60, rows = opt.layerRows || 1;
    const stepX = D0 * 0.92, stepY = D0 * 0.90;
    for (let r = 0; r < rows; r++) for (let k = 0; k < per; k++) {
      w.cells.push(newCell(
        cx + (k - (per - 1) / 2) * stepX + (rnd() - 0.5) * 0.4,
        cy + (r - (rows - 1) / 2) * stepY + (rnd() - 0.5) * 0.4, rnd, genome.nGenes));
    }
    if (w.two) for (const c of w.cells) spawnBody(w, c, rnd);
    return w;
  }
  const n0 = opt.n0 || 80;
  let placed = 0;
  outer:
  for (let r = 0; placed < n0; r++) {
    const cnt = r === 0 ? 1 : Math.floor(2 * Math.PI * r);
    for (let k = 0; k < cnt; k++) {
      const a = (k / cnt) * Math.PI * 2;
      w.cells.push(newCell(
        cx + Math.cos(a) * r * D0 * 0.92 + (rnd() - 0.5),
        cy + Math.sin(a) * r * D0 * 0.92 + (rnd() - 0.5), rnd, genome.nGenes));
      if (++placed >= n0) break outer;
    }
  }
  if (w.two) for (const c of w.cells) spawnBody(w, c, rnd);
  return w;
}

/* ---------- поля --------------------------------------------- */
function stepFields(w) {
  const Fr = w.f[3], P = w.p;
  for (let i = 0; i < Fr.length; i++) Fr[i] += P.resourceRegen * (P.resourceTarget - Fr[i]);
  for (let fi = 0; fi < NF; fi++) {
    const FP = FIELD[fi];
    if (!FP.sub && !FP.decay) continue;                 // неподвижное поле не трогаем
    const F = w.f[fi], tmp = w.tmp;
    for (let s = 0; s < FP.sub; s++) {
      for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
        const i = y * GX + x;
        const l = F[y * GX + (x > 0 ? x - 1 : x)];
        const r = F[y * GX + (x < GX - 1 ? x + 1 : x)];
        const u = F[(y > 0 ? y - 1 : y) * GX + x];
        const d = F[(y < GY - 1 ? y + 1 : y) * GX + x];
        tmp[i] = F[i] + FP.alpha * (l + r + u + d - 4 * F[i]);
      }
      F.set(tmp);
    }
    const k = 1 - FP.decay;
    if (FP.decay) for (let i = 0; i < F.length; i++) F[i] *= k;
  }
}

const gidx = (x, y) => clamp((x / CS) | 0, 0, GX - 1) + clamp((y / CS) | 0, 0, GY - 1) * GX;

/* ---------- пространственный хеш ----------------------------- */
function buildHash(w) {
  const HS = D0 * 1.6;
  const hx = Math.ceil(WW / HS), hy = Math.ceil(WH / HS);
  if (!w._bins || w._bins.length !== hx * hy) {
    w._bins = new Array(hx * hy);
    for (let i = 0; i < w._bins.length; i++) w._bins[i] = [];
  }
  const bins = w._bins;
  for (let i = 0; i < bins.length; i++) bins[i].length = 0;
  for (const c of w.cells) {
    bins[clamp((c.x / HS) | 0, 0, hx - 1) + clamp((c.y / HS) | 0, 0, hy - 1) * hx].push(c);
  }
  return { bins, hx, hy, HS };
}
function forNeighbors(H, c, rad, fn) {
  const cx = clamp((c.x / H.HS) | 0, 0, H.hx - 1), cy = clamp((c.y / H.HS) | 0, 0, H.hy - 1);
  const span = Math.ceil(rad / H.HS);
  for (let y = Math.max(0, cy - span); y <= Math.min(H.hy - 1, cy + span); y++)
    for (let x = Math.max(0, cx - span); x <= Math.min(H.hx - 1, cx + span); x++) {
      const b = H.bins[y * H.hx + x];
      for (let k = 0; k < b.length; k++) if (b[k] !== c) fn(b[k]);
    }
}

/* ---------- шаг ---------------------------------------------- */
function step(w) {
  w.t++;
  stepFields(w);
  const H = buildHash(w);
  const G = w.genome, NGx = G.nGenes;
  const inp = new Float64Array(NIN + 1);
  const RN = D0 * 1.35, RA = D0 * 1.55;
  const newborns = [];

  for (const c of w.cells) {
    let nb = 0, sx = 0, sy = 0;
    forNeighbors(H, c, RN, (o) => {
      const dx = o.x - c.x, dy = o.y - c.y, d2 = dx * dx + dy * dy;
      if (d2 >= RN * RN) return;
      nb++;
      const d = Math.sqrt(d2) || 1e-6;
      sx += dx / d; sy += dy / d;
    });
    c.nb = nb;
    // локальная асимметрия: куда соседей меньше. Никакой информации о мире, кроме
    // расположения ближайших соседей, агент при этом не получает.
    if (nb > 0) {
      const mx2 = -sx / nb, my2 = -sy / nb, mag = Math.hypot(mx2, my2);
      c.amag = Math.min(1, mag);
      if (mag > 1e-6) { c.ax = mx2 / mag; c.ay = my2 / mag; } else { c.ax = 0; c.ay = 0; }
    } else { c.ax = 0; c.ay = 0; c.amag = 0; }

    const gi = gidx(c.x, c.y);
    for (let f = 0; f < NF; f++) {
      const v = w.f[f][gi];
      inp[f] = KS[f] === null ? clamp(v, 0, 1) : v / (v + KS[f]);
    }
    inp[IN_NB] = Math.min(nb, 8) / 8;
    inp[IN_ENERGY] = clamp(c.energy / 3, 0, 1);
    inp[IN_EXC] = c.v;
    for (let g = 0; g < NGx; g++) inp[IN_GENE + g] = c.e[g];
    inp[NIN] = 1;

    for (let g = 0; g < NGx; g++) {
      let a = 0, r = 0;
      const A = G.act[g], Rp = G.rep[g];
      for (let i = 0; i <= NIN; i++) { a += A[i] * inp[i]; r += Rp[i] * inp[i]; }
      c.e[g] += (sig(a) * (1 - sig(r)) - c.e[g]) * G.rate;
    }

    // эффекторы: свойства агента — сумма вкладов экспрессии
    let adh = 0.45, mot = 0.30, dc = 0, link = 0, reach = 0, pol = 0;
    c.sens.fill(0);
    for (let g = 0; g < NGx; g++) {
      const e = c.e[g];
      if (e < 0.02) continue;
      const E = G.eff[g];
      adh += E.adh * e; mot += E.mot * e; dc += E.div * e;
      link += E.link * e; reach += E.reach * e; pol += E.pol * e;
      for (let f = 0; f < NSEC; f++) if (E.sec[f]) w.f[f][gi] += E.sec[f] * e;
      for (let f = 0; f < NF; f++) if (E.sens[f]) c.sens[f] += E.sens[f] * e;
    }
    c.adh = Math.max(0.05, adh); c.mot = Math.max(0, mot);
    c.div = dc; c.link = link; c.reach = reach; c.pol = pol;

    // перевод внешних полей в возбуждение
    let s = 0;
    for (let f = 0; f < NF; f++) if (c.sens[f]) s += c.sens[f] * inp[f];
    if (s > SENS_TH && w.t - c.fired > REFRACT) { c.v = 1; c.fired = w.t; }

    // обмен веществ
    const P = w.p;
    const res = w.f[3][gi];
    const up = Math.min(res, P.uptake * (res / (res + P.uptakeK)));
    w.f[3][gi] = res - up;
    let cost = P.energyCost;
    for (let g = 0; g < NGx; g++) cost += P.expressionCost * c.e[g];
    c.energy = Math.min(P.energyCap, c.energy + up * P.energyYield - cost);

    // деление
    if (c.energy > P.divisionEnergy && nb < P.divisionCrowd &&
        w.cells.length + newborns.length < w.maxCells &&
        w.rnd() < P.divisionRate * (1 - clamp(c.div / 2, 0, 0.95))) {
      const a = w.rnd() * Math.PI * 2;
      const d = newCell(c.x + Math.cos(a) * R * 0.6, c.y + Math.sin(a) * R * 0.6, w.rnd, NGx);
      d.e.set(c.e);
      for (let g = 0; g < NGx; g++) d.e[g] = clamp(d.e[g] + (w.rnd() - 0.5) * 0.02, 0, 1);
      c.energy *= 0.5; d.energy = c.energy;
      if (w.two) spawnBody(w, d, w.rnd);
      newborns.push(d);
    }
  }
  for (const d of newborns) w.cells.push(d);

  // физика
  const H2 = buildHash(w);
  updateOrientation(w, H2);
  updateJunctions(w, H2);
  if (w.two) { physicsTwoPoint(w, H2); }
  else physicsPoint(w, H2);

  const minPop = w.p.minPopulation;
  if (w.cells.length > minPop) {
    const alive = [];
    for (const c of w.cells) { if (c.energy > w.p.deathThreshold) alive.push(c); else c.dead = true; }
    if (alive.length > minPop) w.cells = alive; else for (const c of w.cells) c.dead = false;
  }

  if (w.t % 4 === 0 && w.p.linkEnabled) updateLinks(w, H2);
  propagate(w);
  return w;
}

/* ---------- ориентация агента --------------------------------
   Агент хранит собственное направление. Оно подтягивается к двум вещам:
   к своей локальной асимметрии плотности и к направлениям ближайших соседей.
   Больше ни к чему: ни координат, ни направления к центру или краю,
   ни «верха» агенту не сообщается. Обновление синхронное, чтобы порядок
   обхода агентов не создавал скрытого преимущества.  */
function updateOrientation(w, H) {
  const kn = w.p.align, ks = w.p.alignSelf, rate = w.p.alignRate;
  if (kn <= 0) {                       // согласование выключено: ориентация равна локальной асимметрии
    for (const c of w.cells) { c.qx = c.ax; c.qy = c.ay; }
    return;
  }
  const RNq = D0 * 1.35;
  const nx = new Float64Array(w.cells.length), ny = new Float64Array(w.cells.length);
  w.cells.forEach((c, i) => {
    let sx = 0, sy = 0, n = 0;
    forNeighbors(H, c, RNq, (o) => {
      const dx = o.x - c.x, dy = o.y - c.y;
      if (dx * dx + dy * dy > RNq * RNq) return;
      sx += o.qx; sy += o.qy; n++;
    });
    if (n) { sx /= n; sy /= n; }
    let tx = ks * c.ax * c.amag + kn * sx, ty = ks * c.ay * c.amag + kn * sy;
    const L = Math.hypot(tx, ty);
    if (L > 1e-9) { tx /= L; ty /= L; } else { tx = c.qx; ty = c.qy; }
    let ux = c.qx + (tx - c.qx) * rate, uy = c.qy + (ty - c.qy) * rate;
    const L2 = Math.hypot(ux, uy);
    if (L2 > 1e-9) { ux /= L2; uy /= L2; }
    nx[i] = ux; ny[i] = uy;
  });
  w.cells.forEach((c, i) => { c.qx = nx[i]; c.qy = ny[i]; });
}

/* ---------- физика ------------------------------------------- 
   Две реализации агента. Точечный агент — прежний: один центр, одно
   равновесное расстояние, формы нет. Двухточечный — две связанные точки,
   у него появляется протяжённость, а значит и возможность деформироваться. */

function physicsPoint(w, H) {
  const RA2 = D0 * 1.55;
  for (const c of w.cells) {
    let fx = 0, fy = 0;
    forNeighbors(H, c, RA2, (o) => {
      const dx = o.x - c.x, dy = o.y - c.y, d2 = dx * dx + dy * dy;
      if (d2 < 1e-6 || d2 > RA2 * RA2) return;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      // локальная асимметрия сдвигает равновесное расстояние с одной стороны
      const k = w.p.polarity * c.pol * c.amag;
      const de = k ? D0 * (1 - 0.5 * k * (nx * c.qx + ny * c.qy)) : D0;
      if (d < de) { const f = 0.9 * (de - d); fx -= nx * f; fy -= ny * f; }
      else { const f = Math.sqrt(c.adh * o.adh) * 0.10 * w.p.adhesionScale * (RA2 - d); fx += nx * f; fy += ny * f; }
    });
    const jf = junctionForce(w, c);
    fx += jf.fx; fy += jf.fy;
    fx += (w.rnd() - 0.5) * c.mot * 0.9;
    fy += (w.rnd() - 0.5) * c.mot * 0.9;
    c.vx = (c.vx + fx) * 0.60; c.vy = (c.vy + fy) * 0.60;
  }
  for (const c of w.cells) {
    c.x = clamp(c.x + c.vx, R, WW - R);
    c.y = clamp(c.y + c.vy, R, WH - R);
  }
}

/* радиусы двух точек агента. Локальная асимметрия делает одну точку меньше,
   другую больше: суммарный размер сохраняется, форма — нет. Это и есть
   деформация, невозможная для точечного агента. */
function bodyRadii(w, c) {
  const rp = R * w.p.bodyRadius;
  const k = w.p.polarity * c.pol * c.amag;
  if (!k) { c.r1 = rp; c.r2 = rp; return; }
  const ux = c.p2x - c.p1x, uy = c.p2y - c.p1y;
  const L = Math.hypot(ux, uy) || 1;
  const proj = (ux / L) * c.qx + (uy / L) * c.qy;   // какая точка смотрит по ориентации агента
  const s = 0.5 * k * proj;
  c.r1 = rp * (1 + s); c.r2 = rp * (1 - s);
}

function physicsTwoPoint(w, H) {
  const L0 = w.p.bodyLength, ks = w.p.bodyStiff, adhS = w.p.adhesionScale;
  for (const c of w.cells) bodyRadii(w, c);
  const reach = D0 * 1.55 + L0;
  for (const c of w.cells) {
    let f1x = 0, f1y = 0, f2x = 0, f2y = 0;
    forNeighbors(H, c, reach, (o) => {
      const pts = [[c.p1x, c.p1y, c.r1, 1], [c.p2x, c.p2y, c.r2, 2]];
      const opts = [[o.p1x, o.p1y, o.r1], [o.p2x, o.p2y, o.r2]];
      for (const [px, py, pr, idx] of pts) for (const [qx, qy, qr] of opts) {
        const dx = qx - px, dy = qy - py, d2 = dx * dx + dy * dy;
        const eq = pr + qr, far = eq * 1.55;
        if (d2 < 1e-6 || d2 > far * far) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        let fx, fy;
        if (d < eq) { const f = 0.9 * (eq - d); fx = -nx * f; fy = -ny * f; }
        else { const f = Math.sqrt(c.adh * o.adh) * 0.10 * adhS * (far - d); fx = nx * f; fy = ny * f; }
        if (idx === 1) { f1x += fx; f1y += fy; } else { f2x += fx; f2y += fy; }
      }
    });
    // связь между точками агента: она и удерживает протяжённость
    const ux = c.p2x - c.p1x, uy = c.p2y - c.p1y;
    const L = Math.hypot(ux, uy) || 1e-6;
    const stretch = ks * (L - L0);
    f1x += (ux / L) * stretch; f1y += (uy / L) * stretch;
    f2x -= (ux / L) * stretch; f2y -= (uy / L) * stretch;

    const jf2 = junctionForce(w, c);
    f1x += jf2.fx * 0.5; f1y += jf2.fy * 0.5;
    f2x += jf2.fx * 0.5; f2y += jf2.fy * 0.5;

    const nz = c.mot * 0.45;
    f1x += (w.rnd() - 0.5) * nz; f1y += (w.rnd() - 0.5) * nz;
    f2x += (w.rnd() - 0.5) * nz; f2y += (w.rnd() - 0.5) * nz;

    c.p1vx = (c.p1vx + f1x) * 0.60; c.p1vy = (c.p1vy + f1y) * 0.60;
    c.p2vx = (c.p2vx + f2x) * 0.60; c.p2vy = (c.p2vy + f2y) * 0.60;
  }
  for (const c of w.cells) {
    c.p1x = clamp(c.p1x + c.p1vx, R, WW - R); c.p1y = clamp(c.p1y + c.p1vy, R, WH - R);
    c.p2x = clamp(c.p2x + c.p2vx, R, WW - R); c.p2y = clamp(c.p2y + c.p2vy, R, WH - R);
    const nx2 = (c.p1x + c.p2x) / 2, ny2 = (c.p1y + c.p2y) / 2;
    c.vx = nx2 - c.x; c.vy = ny2 - c.y;
    c.x = nx2; c.y = ny2;
  }
}

/* ---------- закреплённые контакты ---------------------------- */
/* Формирование ДЕТЕРМИНИРОВАННОЕ: случайные числа не тратятся, иначе
   поток RNG сдвинулся бы и сравнение с выключенным механизмом перестало
   быть сравнением одного и того же прогона. */
function updateJunctions(w, H) {
  if (!w.p.junction) return;
  const RNj = D0 * 1.35, mx = w.p.junctionMax, br = w.p.junctionBreak;
  // 1. разрыв: мёртвый партнёр или растяжение сверх порога ОТ СВОЕЙ длины
  for (const c of w.cells) {
    if (c.jn.size === 0) continue;
    for (const [o, rest] of Array.from(c.jn)) {
      const dx = o.x - c.x, dy = o.y - c.y;
      const lim = rest * br;
      if (o.dead || dx * dx + dy * dy > lim * lim) { c.jn.delete(o); o.jn.delete(c); }
    }
  }
  // 2. образование: соседи в пределах RNj, у обоих есть свободное место.
  //    Равновесная длина = расстояние В МОМЕНТ ОБРАЗОВАНИЯ.
  for (const c of w.cells) {
    if (c.jn.size >= mx) continue;
    forNeighbors(H, c, RNj, (o) => {
      if (c.jn.size >= mx || o.jn.size >= mx || o === c || c.jn.has(o)) return;
      const dx = o.x - c.x, dy = o.y - c.y, d2 = dx * dx + dy * dy;
      if (d2 < RNj * RNj) {
        const rest = Math.sqrt(d2) || D0;
        c.jn.set(o, rest); o.jn.set(c, rest);
      }
    });
  }
}

/* сила закреплённого контакта: пружина к равновесному расстоянию D0.
   Сопротивляется и растяжению, и сжатию -- в отличие от сцепления,
   которое только притягивает. Возвращает {fx, fy} для агента c. */
function junctionForce(w, c) {
  let fx = 0, fy = 0;
  if (!w.p.junction || c.jn.size === 0) return { fx, fy };
  const k = w.p.junction;
  for (const [o, rest] of c.jn) {
    const dx = o.x - c.x, dy = o.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;
    const f = k * (d - rest);        // >0 растянут относительно СВОЕЙ длины
    fx += (dx / d) * f; fy += (dy / d) * f;
  }
  return { fx, fy };
}

/* ---------- связи -------------------------------------------- */
const other = (l, c) => (l.a === c ? l.b : l.a);

function updateLinks(w, H) {
  const all = new Set();
  for (const c of w.cells) for (const l of c.links) all.add(l);
  const live = new Set();
  for (const l of all) {
    const a = l.a, b = l.b;
    if (a.dead || b.dead || a.link <= LINK_TH * 0.7 || b.link <= LINK_TH * 0.7) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const lim = RL * 1.4 * (1 + Math.max(a.reach, b.reach));
    if (dx * dx + dy * dy > lim * lim) continue;
    l.w += (WMIN - l.w) * WDEC;
    if (l.w <= WMIN + 0.004 && w.t - l.used > 700) continue;
    live.add(l);
  }
  for (const c of w.cells) if (c.links.length) c.links = c.links.filter((l) => live.has(l));

  for (const c of w.cells) {
    const cap = 3 + (c.reach > 0.5 ? 1 : 0);
    if (c.link < LINK_TH || c.links.length >= cap) continue;
    const reach = RL * (1 + c.reach);
    let best = null, bd = 1e9;
    forNeighbors(H, c, reach, (o) => {
      if (o.dead || o.link < LINK_TH || o.links.length >= cap) return;
      for (const l of c.links) if (other(l, c) === o) return;
      const dx = o.x - c.x, dy = o.y - c.y, d2 = dx * dx + dy * dy;
      if (d2 < reach * reach && d2 < bd) { bd = d2; best = o; }
    });
    if (best) { const l = { a: c, b: best, w: W0, used: w.t }; c.links.push(l); best.links.push(l); }
  }

  // конкуренция: суммарный вес входов клетки ограничен
  for (const c of w.cells) {
    if (c.links.length < 2) continue;
    let sum = 0; for (const l of c.links) sum += l.w;
    if (sum > WSUM) { const k = WSUM / sum; for (const l of c.links) l.w *= k; }
  }
  let n = 0; for (const c of w.cells) n += c.links.length;
  w.links = n / 2;
}

/* ---------- возбуждение и память ----------------------------- */
function propagate(w) {
  const plast = w.p.plasticity;
  for (const c of w.cells) c.inp = 0;
  for (const c of w.cells) if (c.fired === w.t - 1) for (const l of c.links) other(l, c).inp += l.w;

  const fire = [];
  for (const c of w.cells) {
    c.u = c.u * LEAK + c.inp;
    c.ad *= ADEC;
    if (c.u > THF + ADAPT * c.ad && w.t - c.fired > REFRACT) fire.push(c);
    if (c.v > 0) { c.v *= 0.80; if (c.v < 0.05) c.v = 0; }
  }
  const fired = new Set(fire);
  for (const c of fire) {
    c.v = 1; c.fired = w.t; c.u = 0; c.ad += 1;
    for (const l of c.links) if (other(l, c).fired === w.t - 1) { l.w += LR * plast * (1 - l.w); l.used = w.t; }
  }
  // подпороговое усиление: без него путь не может возникнуть там, где его ещё нет
  for (const c of w.cells) {
    if (fired.has(c) || c.u < THF * 0.45) continue;
    for (const l of c.links) if (other(l, c).fired === w.t - 1) { l.w += LR * 0.30 * plast * (1 - l.w); l.used = w.t; }
  }
  w.firedNow = fire.length;
}

/* ---------- внешнее воздействие ------------------------------ */
function stimulate(w, x, y, amp = 2.2, rad = 2) {
  const gx = clamp((x / CS) | 0, 0, GX - 1), gy = clamp((y / CS) | 0, 0, GY - 1);
  for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    const px = gx + dx, py = gy + dy;
    if (px < 0 || py < 0 || px >= GX || py >= GY) continue;
    const d = Math.hypot(dx, dy);
    if (d <= rad) w.f[4][py * GX + px] += amp * (1 - d / (rad + 1));
  }
  w.lastStim = { t: w.t, x, y };
  return w.lastStim;
}

function components(w) {
  const seen = new Set(), out = [];
  for (const c of w.cells) {
    if (seen.has(c) || !c.links.length) continue;
    const q = [c], comp = []; seen.add(c);
    while (q.length) {
      const x = q.pop(); comp.push(x);
      for (const l of x.links) { const o = other(l, x); if (!o.dead && !seen.has(o)) { seen.add(o); q.push(o); } }
    }
    out.push(comp);
  }
  out.sort((a, b) => b.length - a.length);
  return out;
}

module.exports = {
  createWorld, step, stimulate, components, other, buildHash, forNeighbors, DEFAULTS, updateJunctions, spawnBody, bodyRadii, newCell, updateOrientation,
  GX, GY, CS, WW, WH, R, D0, NF, KS, gidx,
};

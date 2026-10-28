#!/usr/bin/env node
'use strict';
/* ============================================================
   НЕЙРОН-2 -- пересборка по итогам оценки чернового нейрона
   Правка 2: потомство по доходу, замер «мир платит всем поровну»,
   все постоянные настраиваются, перестановочный нуль в выводе.
   Правка 3: закон учёбы -- в генах (RULE=1).
   Правка 4: мир со связанными входами (RHO, MIX) -- проверка, выведет ли
   отбор LMS точно, когда Хебб с забыванием даёт кривые веса.
   Правка 5: выход части -- её вычисление. У части два товара: сырой датчик
   и свой прогноз; покупатель выбирает сам. Ген числа связей выброшен.
   Правка 6: мир с прошлым глубже любого канала (DEEP). Отдельный источник 8
   и канал 9, который завтра повторяет источник 8, каким тот был DEEP кругов
   назад. Ни один датчик этого прошлого не видит: донести его может только сеть.
   Правка 7: сигнал на продажу (SIGNAL=1). Третий товар части -- сигнал, который
   учится не на её задаче, а на ошибках покупателей: каждый покупатель возвращает
   продавцу свою ошибку, умноженную на вес связи. Рыночный аналог обратного
   распространения; так часть может стать передатчиком, если за это платят.
   Сигнал нормирован по своей силе и ограничен (как частота разрядов у нейрона),
   а связь живёт, пока заметен её ВКЛАД (вес на силу входа), а не голый вес:
   иначе крошечный сигнал с огромным шумным весом держал место зря.
   Связь ради сигнала держится, только пока сигнал покупают.
   Правка 8: проба не портит прогноз (TRY=1). Пробная связь читается и учится
   на остатке ошибки, но в оплачиваемый прогноз входит, лишь когда докажет
   пользу. Иначе каждая проба впрыскивала шум в прогноз, мир платил меньше,
   бедные переставали искать -- и с тремя товарами миры вымирали на старте.
   Правка 9: подсказка соседей (IMIT). С тремя товарами и десятью каналами
   вслепую родителей ищут слишком долго: непроводные беднеют и мрут, заселенцы
   с 30 тактами не успевают найти никого, а богатые платят за них снова и снова,
   пока не разорятся, -- так вымер мир глубины 2. Теперь часть поиска копирует
   проверенную связь соседа по каналу: кто у кого покупает -- открыто.
   Пробовалось и выброшено: закрывать канал для заселения после неудачи на
   удваивающийся срок. Каналы не могли пополниться, мельчали, и из 12 миров
   вымерли 11.
   Правка 10: замена павшего продавца (REPLACE). Передатчик глубины 2 жил на
   одной нитке: бедный источник 8 -> часть-передатчик -> канал 9. Когда этот
   источник умирал, рвалась вся цепочка, и собрать её заново было почти
   невозможно. Теперь проверенная связь с датчиком или прогнозом при смерти
   продавца переходит к другому продавцу того же товара в том же канале: такие
   товары равноценны. Сигнал у каждой части свой, поэтому сигнал соседа павшего
   продавца по каналу (часто родни) берётся на пробу, а не сразу.
   Правка 11: спрос направляет предложение. Нужды канала 9 глубины 2 никто не
   видел: его части бедны и не могли даже попробовать чужой сигнал, а продавцы
   не знали, что их покупатели несчастны. Теперь проба бесплатна, как образец
   товара (FREE_TRY), а продавец, чьи покупатели сильно ошибаются, чаще ищет
   новые входы для своего сигнала (DEMAND).
   Правка 12: кредит на проверенное (DEBT). Передатчик собирался во всех мирах,
   но стоило ему раз порваться, бедный канал 9 уже не мог заплатить за чтение
   даже найденного заново -- и цепочка гибла. Теперь проверенную связь можно
   читать в долг до DEBT тактов; смерть по-прежнему через DIE кругов в минусе.
   Правка 13: запасные передатчики (KIN). Передатчик глубины 2 -- одна часть со
   своим особым сигналом; она гибнет, и цепочка с ней. Теперь потомок передатчика
   наследует не только его входы и сигнал, но и память о спросе, и держит входы
   сигнала, пока спрос не забыт (память растёт быстро, а гаснет медленно). Когда
   продавец сигнала погибает, покупатель получает на пробу не случайного соседа,
   а того, чей сигнал собран из тех же входов, -- обычно его потомка, и получает его
   связь сразу проверенной: пересадка не должна стоить покупателю двадцати кругов.

   1. Читающему есть польза. Мир -- поток из 8 каналов, связанных
      причинно: три источника, остальные завтра повторяют сочетание
      других сегодня. Мир платит части за сжатие её канала: столько
      тактов, сколько бит на круг она экономит, предсказывая его.
      Чтение соседа -- покупка сведений: читающий платит прочитанному.
      Товаров два: сырой датчик и прогноз, сделанный в прошлом круге, --
      сигнал идёт с задержкой в круг, как по аксону. Цепочка прогнозов
      может нести прошлое дальше, чем его держит любой датчик.
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
const DEEP   = K('DEEP', 0);          // 0 нет; 1, 2 -- глубина прошлого для канала 9
const N      = K('N', WORLD && DEEP ? 80 : 64);   // мест (по 8 на канал)
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
const SELPOW = K('SELPOW', 1);        // насколько круто шанс потомства растёт с доходом
const SHARE  = K('SHARE', 0);         // 1 мир делит плату за биты поровну на всех
const SHARE_AT = K('SHARE_AT', 0);    // с какого круга делить поровну (чтобы сеть успела собраться)
const RULE   = K('RULE', 0);          // 1 закон учёбы в генах, 0 LMS рукой. По умолчанию рукой: на 24 сидах
                                      // генный закон давал 1.88 бита против 2.89 и 4 вымирания из 24 против 0.
                                      // При этом отбор закон НЕ игнорирует: пустой отсчёт (жребий и мутация
                                      // без мира, отбора и смерти) даёт 1.4% похожих на LMS, а мир держит
                                      // 7-41%. Обогащает банкротство, а не выбор родителя: удалённость от
                                      // LMS связана с потомством на 0.00
const MUT    = K('MUT', 1);           // множитель мутации генов закона (0 -- закон не меняется)
const SEED_RULE = K('SEED_RULE', 0);  // > 0: основатели начинают с LMS (a = b = SEED_RULE, c ~ 0)
const WMAX   = K('WMAX', 8);          // предел силы синапса
const RHO    = K('RHO', 0);           // связь источников между собой (0 -- независимы)
const MIX    = K('MIX', 1);           // вес второго родителя в смесях (1 -- поровну)
const SIGNAL = K('SIGNAL', 1);        // 1 у части есть сигнал на продажу, обучаемый ошибками покупателей
const ZLR    = K('ZLR', 0.05);        // скорость учёбы сигнала
const TRY    = K('TRY', 1);           // 1 пробная связь не входит в оплачиваемый прогноз
const IMIT   = K('IMIT', 0.5);        // доля поисков по подсказке соседей по каналу
const REPLACE = K('REPLACE', 1);      // 1 проверенная связь переходит к равноценному продавцу
const FREE_TRY = K('FREE_TRY', 1);    // 1 пробное чтение бесплатно, как образец
const DEMAND = K('DEMAND', 0.2);      // добавочный поиск продавца, когда его покупатели ошибаются
const DEBT   = K('DEBT', 20);         // сколько можно задолжать за чтение проверенных связей
const KIN    = K('KIN', 1);           // 1 запасные передатчики: наследуемый спрос и замена родичем
const LMAX   = K('LMAX', 4);          // физический предел связей у части (не ген; при 8 генный закон вымирал чаще)
const CH = WORLD ? (DEEP ? 10 : 8) : N, V = 1 + SN * SN;
// делители, чтобы у каждого канала дисперсия была 1 при любых RHO и MIX
const K3 = Math.sqrt(1 + MIX * MIX + 2 * MIX * RHO), K4 = Math.sqrt(1 + MIX * MIX - 2 * MIX * RHO);
const C34 = (RHO - MIX * RHO + MIX - MIX * MIX * RHO) / (K3 * K4);          // связь каналов 3 и 4
const K7 = RHO === 0 && MIX === 1 ? 1 : Math.sqrt(1 + MIX * MIX - 2 * MIX * C34); // 1 -- старый мир точно
if (START > CAP) throw new Error('START выше CAP: запас сгорит в первый же круг');
const PARENTS = [[], [], [], [0, 1], [1, 2], [0, 2], [3], [3, 4]]; // только для замеров
// вчерашний прогноз несёт вчерашнее: для него верны и родители, и родители родителей
const GRAND = PARENTS.map((ps) => [...new Set(ps.flatMap((q) => PARENTS[q]))]);

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
    if (DEEP) {                           // источник 8 и канал 9: c9(t+1) = c8(t - DEEP)
      n[8] = 0.5 * c[8] + Math.sqrt(0.75) * g();
      n[9] = w.h8[DEEP];
      w.h8.unshift(n[8]); w.h8.length = DEEP + 1;
    }
  }
  w.c = n;
}

// гены: urge -> как часто искать связи; закон учёбы: a, b, c (RULE=1)
// или скорость lr при заданном LMS (RULE=0). Сколько связей держать, решает цена.
function newPart(w, slot, par) {
  const r = w.rnd, mut = (v) => clamp(v * Math.exp(MUT * 0.2 * gauss(r)), 1e-4, 2);
  let g;
  if (par) {
    g = { urge: clamp(par.g.urge + 0.08 * gauss(r), 0, 1) };
    if (RULE) { g.a = mut(par.g.a); g.b = mut(par.g.b); g.c = mut(par.g.c); }
    else g.lr = clamp(par.g.lr * Math.exp(0.25 * gauss(r)), 0.001, 1);
  } else {
    g = { urge: r() };
    if (RULE) {                         // жребий тянется всегда, чтобы поток чисел не разошёлся
      const ra = 0.001 + 0.3 * r(), rb = 0.001 + 0.3 * r(), rc = 0.001 + 0.3 * r();
      if (SEED_RULE > 0) { g.a = SEED_RULE; g.b = SEED_RULE; g.c = 0.001; } else { g.a = ra; g.b = rb; g.c = rc; }
    }
    else g.lr = Math.exp(Math.log(0.01) + r() * Math.log(30));
  }
  const p = { slot, ch: slot % CH, g, credit: par ? BIRTH / 2 : START,
    hungry: 0, age: 0, links: [], wSelf: 0, mse: V, s: 0, x: null, xl: null, pred: 0, outP: 0, bits: 0,
    uSelf: SIGNAL ? 0.05 * gauss(r) : 0, z: 0, zOut: 0, xOld: null, xlOld: null, zv: 0.01, zb: 0,
    cz: 0, zz: 0, cp: 0, pp: 0,          // только для замеров: связь товаров с нужным каналу 9 прошлым
    dem: 0,                               // сглаженная сумма квадратов ошибок покупателей сигнала
    c0: 0, gain: 0, fromWorld: 0, fromReads: 0 };
  if (par && par.ch === p.ch) {           // копия на том же месте уносит связи и веса
    p.links = par.links.map((l) => ({ j: l.j, k: l.k, w: l.w, u: l.u, r2: l.r2, age: l.age }));
    p.wSelf = par.wSelf; p.mse = par.mse; p.uSelf = par.uSelf;
    if (KIN) { p.zb = par.zb; p.zv = par.zv; }   // потомок помнит спрос на сигнал родителя
  }
  return p;
}

function create(seed) {
  const w = { rnd: makeRNG(seed), round: 0, parts: [], c: new Float64Array(CH), births: 0,
    deaths: { bank: 0, fault: 0 }, deadAges: [], h8: new Array(DEEP + 1).fill(0),
    pruned: [0, 0, 0], lost: [0, 0, 0], colon: 0 };  // сколько связей каждого товара отмерло и сколько потеряно со смертью продавца
  for (let k = 0; k < CH; k++) w.c[k] = gauss(w.rnd);
  for (let i = 0; i < N; i++) w.parts.push(newPart(w, i, null));
  return w;
}

function kill(w, p, why) {
  w.parts[p.slot] = null; w.deaths[why]++;
  if (w.round >= ROUNDS / 2) w.deadAges.push(p.age);
  const kin = REPLACE ? w.parts.filter((q) => q && q.ch === p.ch) : [];   // равноценные продавцы
  // из чего собран сигнал: входы по (канал, товар) с их весами -- чтобы найти родича с тем же сигналом
  const prof = (o) => { const m = new Map([['self', Math.abs(o.uSelf)]]);
    for (const l of o.links) { const t = w.parts[l.j]; if (t) { const key = t.ch + ':' + l.k; m.set(key, (m.get(key) || 0) + Math.abs(l.u)); } }
    return m; };
  const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (const [k, v] of a) { na += v * v; d += v * (b.get(k) || 0); }
    for (const v of b.values()) nb += v * v; return na && nb ? d / Math.sqrt(na * nb) : 0; };
  const pp = KIN ? prof(p) : null;
  for (const q of w.parts) {
    if (!q) continue;
    const gone = [];
    q.links = q.links.filter((l) => { if (l.j !== p.slot) return true; l.dead = true; w.lost[l.k]++; gone.push(l); return false; });
    for (const l of gone) {               // проверенная связь -- к другому продавцу того же канала
      if (!REPLACE || l.age < TRIAL) continue;
      const c = kin.filter((o) => o !== q && !q.links.some((m) => m.j === o.slot && m.k === l.k));
      // датчик и прогноз равноценны -- связь переходит проверенной; сигнал у каждой части свой,
      // поэтому сигнал соседа по каналу (часто родни с похожим сигналом) берётся на пробу
      if (!c.length) continue;
      let pick = null;
      if (KIN && l.k === 2) {              // сигнал: родич с тем же составом сигнала, если такой есть
        let best = 0.5; for (const o of c) { const v = cos(pp, prof(o)); if (v > best) { best = v; pick = o; } }
      }
      const asKin = !!pick;                // родич с тем же сигналом -- товар равноценен, проба не нужна
      if (l.k === 2) { if (asKin) w.kinPick = (w.kinPick || 0) + 1; else w.kinMiss = (w.kinMiss || 0) + 1; }
      if (!pick) pick = c[Math.floor(w.rnd() * c.length)];
      q.links.push({ j: pick.slot, k: l.k, w: l.w, u: l.u, r2: l.r2, age: l.k === 2 && !asKin ? 0 : l.age });
    }
  }
}

function pickByGain(pool, r) {            // шанс растёт с доходом; SELPOW -- насколько круто
  const wt = (p) => (SELPOW === 1 ? p.gain : Math.pow(p.gain, SELPOW));
  let sum = 0; for (const p of pool) sum += wt(p);
  let t = r() * sum;
  for (const p of pool) { t -= wt(p); if (t <= 0) return p; }
  return pool[pool.length - 1];
}

function round(w) {
  worldStep(w);
  const P = w.parts, inc = new Float64Array(N);
  // датчики; прогноз прошлого круга выставляется на продажу до того, как его перезапишут
  for (const p of P) if (p) { p.c0 = p.credit; p.s = w.c[p.ch] + SN * gauss(w.rnd); p.outP = p.pred; p.zOut = p.z; }
  if (DEEP) {                             // замер: насколько выставленные товары несут c8(t - DEEP)
    const tau = w.h8[DEEP];
    for (const p of P) if (p) {
      p.cz += 0.01 * (p.zOut * tau - p.cz); p.zz += 0.01 * (p.zOut * p.zOut - p.zz);
      p.cp += 0.01 * (p.outP * tau - p.cp); p.pp += 0.01 * (p.outP * p.outP - p.pp);
    }
  }

  // расчёт за прошлое предсказание: учёба (нормированный LMS) и плата мира
  let bank = 0, alive = 0;
  const fb = SIGNAL ? new Float64Array(N) : null, dm = DEMAND ? new Float64Array(N) : null;
  for (const p of P) {
    if (!p) continue;
    alive++;
    if (!p.x) { p.bits = 0; continue; }
    const e = p.s - p.pred;
    if (SIGNAL) for (const l of p.xl) if (l.k === 2 && !l.dead) {   // ошибка обратно продавцу
      fb[l.j] += e * l.w; if (DEMAND) dm[l.j] += e * e;
    }
    p.mse += BETA * (e * e - p.mse);
    let nrm = 1; for (let i = 0; i < p.x.length; i++) if (i === 0 || !p.xt[i - 1]) nrm += p.x[i] * p.x[i];
    if (RULE) {                           // (a*s' - b*p)*x - c*w, нормировано входом
      const { a, b, c } = p.g, hs = a * p.s - b * p.pred;
      p.wSelf = clampW(p.wSelf + (hs * p.x[0] - c * p.wSelf) / nrm);
      for (let i = 0; i < p.xl.length; i++) {
        const l = p.xl[i], xi = p.x[i + 1];
        l.w = clampW(l.w + (hs * xi - c * l.w) / (p.xt[i] ? 1 + xi * xi : nrm));
      }
    } else {                              // LMS рукой; проба учится на остатке ошибки
      const k = p.g.lr * e / nrm;
      p.wSelf = clampW(p.wSelf + k * p.x[0]);
      for (let i = 0; i < p.xl.length; i++) {
        const l = p.xl[i], xi = p.x[i + 1];
        l.w = clampW(l.w + (p.xt[i] ? p.g.lr * e * xi / (1 + xi * xi) : k * xi));
      }
    }
    p.bits = Math.max(0, 0.5 * Math.log2(V / Math.max(p.mse, 1e-6)));
    bank += PAY * p.bits;
  }
  if (DEMAND) for (const p of P) if (p) p.dem += 0.02 * (dm[p.slot] - p.dem);
  if (SIGNAL) for (const p of P) {       // продавцы учат сигнал на ошибках покупателей
    if (!p || !p.xOld || !fb[p.slot]) continue;
    let n2 = 1; for (const v of p.xOld) n2 += v * v;
    const k = ZLR * fb[p.slot] / (n2 * Math.sqrt(p.zv + 1e-9));   // сигнал нормирован: градиент идёт через делитель
    p.uSelf = clampW(p.uSelf + k * p.xOld[0]);
    for (let i = 0; i < p.xlOld.length; i++) { const l = p.xlOld[i]; l.u = clampW(l.u + k * p.xOld[i + 1]); }
  }
  const shared = SHARE && w.round >= SHARE_AT;
  for (const p of P) {
    if (!p) continue;
    const pay = shared ? bank / alive : PAY * p.bits;
    p.credit += pay; p.fromWorld += pay;
  }

  // аренда, чтение, новое предсказание; пробные связи читаются первыми
  const zr = SIGNAL ? new Float64Array(N) : null;   // сколько раз купили сигнал части
  for (const p of P) {
    if (!p) continue;
    p.credit -= RENT;
    const order = p.links.slice().sort((a, b) =>
      (b.age < TRIAL) - (a.age < TRIAL) || Math.abs(b.w) - Math.abs(a.w));
    const x = [p.s], xl = [], xt = [];
    for (const l of order) {
      if (!(FREE_TRY > 0 && l.age < TRIAL)) {   // проба -- бесплатный образец, остальное за плату
        if (p.credit < PRICE - DEBT) break;   // в долг -- не глубже DEBT
        p.credit -= PRICE; inc[l.j] += PRICE;
      }
      const v = l.k === 2 ? P[l.j].zOut : l.k ? P[l.j].outP : P[l.j].s;
      x.push(v); xl.push(l); xt.push(TRY > 0 && l.age < TRIAL);
      if (SIGNAL) { l.r2 += 0.05 * (v * v - l.r2); if (l.k === 2) zr[l.j]++; }
    }
    let pred = p.wSelf * p.s;           // проба в оплачиваемый прогноз не входит
    for (let i = 0; i < xl.length; i++) if (!xt[i]) pred += xl[i].w * x[i + 1];
    if (SIGNAL) {                          // сигнал: смесь входов, нормированная по силе и ограниченная
      let z = p.uSelf * p.s; for (let i = 0; i < xl.length; i++) z += xl[i].u * x[i + 1];
      p.zv += 0.01 * (z * z - p.zv); p.z = clamp(z / Math.sqrt(p.zv + 1e-9), -4, 4);
    }
    p.xOld = p.x; p.xlOld = p.xl; p.pred = pred; p.x = x; p.xl = xl; p.xt = xt;
  }
  for (let i = 0; i < N; i++) if (P[i]) {
    P[i].credit += inc[i]; P[i].fromReads += inc[i];
    if (SIGNAL) P[i].zb += (KIN ? (zr[i] > P[i].zb ? 0.2 : 0.002) : 0.02) * (zr[i] - P[i].zb);   // спрос: быстро растёт, медленно гаснет
  }

  // связи: отмирание пустых, поиск новых
  for (const p of P) {
    if (!p) continue;
    for (const l of p.links) l.age++;
    p.links = p.links.filter((l) => {    // связь живёт, пока несёт вес -- для прогноза или для сигнала
      const keep = l.age < TRIAL || (SIGNAL
        ? Math.abs(l.w) * Math.sqrt(l.r2) >= PRUNE ||                       // вклад в свой прогноз
          (p.zb > 0.3 && Math.abs(l.u) * Math.sqrt(l.r2 / p.zv) >= PRUNE)  // вклад в сигнал, пока его покупают
        : Math.abs(l.w) >= PRUNE);
      if (!keep) { l.dead = true; if (l.age >= TRIAL) w.pruned[l.k]++; } return keep; });
    if (p.links.length < LMAX && p.credit >= C_LINK && w.rnd() < p.g.urge * SEARCH) {
      p.credit -= C_LINK;                 // поиск платный, даже неудачный
      let j, k, hint = null;
      if (IMIT > 0 && w.rnd() < IMIT) {   // подсказка: проверенная связь соседа по каналу
        const sibs = P.filter((q) => q && q !== p && q.ch === p.ch && q.links.some((l) => l.age >= TRIAL));
        if (sibs.length) {
          const q = sibs[Math.floor(w.rnd() * sibs.length)], good = q.links.filter((l) => l.age >= TRIAL);
          hint = good[Math.floor(w.rnd() * good.length)];
        }
      }
      if (hint) { j = hint.j; k = hint.k; }
      else {
        j = Math.floor(w.rnd() * N); const q = w.rnd();   // товар: 0 датчик, 1 прогноз, 2 сигнал
        k = SIGNAL ? (q < 1 / 3 ? 0 : q < 2 / 3 ? 1 : 2) : (q < 0.5 ? 0 : 1);
      }
      if (P[j] && j !== p.slot && !p.links.some((l) => l.j === j && l.k === k))
        p.links.push({ j, k, w: 0, u: SIGNAL ? 0.05 * gauss(w.rnd) : 0, r2: 1, age: 0 });
    }
    if (DEMAND && p.links.length < LMAX && p.credit >= C_LINK && w.rnd() < DEMAND * Math.min(1, p.dem)) {
      p.credit -= C_LINK;                 // покупатели недовольны -- продавец ищет новый вход для сигнала
      const j = Math.floor(w.rnd() * N), q = w.rnd(), k = q < 1 / 3 ? 0 : q < 2 / 3 ? 1 : 2;
      if (P[j] && j !== p.slot && !p.links.some((l) => l.j === j && l.k === k))
        p.links.push({ j, k, w: 0, u: 0.05 * gauss(w.rnd), r2: 1, age: 0 });
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
  // занимает потомок богатой части того же канала. Чужой может заселить канал,
  // только когда своих богатых нет, а канал заполнен меньше чем наполовину:
  // иначе один бедный выживший запирал канал навсегда (так вымер канал 9 при
  // DEEP=1 и распустился целый мир при DEEP=2), а заселять всё подряд нельзя --
  // богатые плодят обречённых.
  for (const p of P) if (p && p.credit > CAP) p.credit = CAP;
  const free = []; for (let i = 0; i < N; i++) if (!P[i]) free.push(i);
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(w.rnd() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
  const ok = (p) => p && p.credit >= BIRTH && (!SELECT || p.gain > 0);
  for (const s of free) {
    const k = s % CH;
    let pool = P.filter((p) => ok(p) && p.ch === k);
    if (!pool.length && 2 * P.filter((p) => p && p.ch === k).length < Math.ceil(N / CH)) pool = P.filter(ok);
    if (!pool.length) continue;
    const par = SELECT ? pickByGain(pool, w.rnd) : pool[Math.floor(w.rnd() * pool.length)];
    par.credit -= BIRTH; P[s] = newPart(w, s, par); w.births++;
    if (par.ch !== k) w.colon++;          // заселение чужого канала
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
  const S = A.filter((p) => WORLD && (p.ch < 3 || p.ch === 8)), X = A.filter((p) => !WORLD || (p.ch >= 3 && p.ch <= 7));
  const D9 = A.filter((p) => WORLD && DEEP && p.ch === 9);
  let f8 = 0, a9 = 0;
  // носитель прошлого: часть, чей выставленный прогноз или сигнал связан с нужным каналу 9
  // прошлым (r^2 >= 0.25). Передатчик -- любая устоявшаяся связь канала 9 с таким товаром,
  // каким бы путём он ни собрался.
  const carZ = (q) => q.zz > 1e-9 && q.cz * q.cz / q.zz >= 0.25, carP = (q) => q.pp > 1e-9 && q.cp * q.cp / q.pp >= 0.25;
  const carriers = DEEP ? A.filter((q) => q.ch !== 9 && (carZ(q) || carP(q))) : [];
  let z9 = 0, relay = 0;
  for (const p of D9) {
    let has = false;
    for (const l of p.links) {
      const v = Math.abs(l.w); a9 += v;
      if (l.k === 1 && w.parts[l.j].ch === 8) f8 += v;
      if (l.k === 2) z9 += v;
      const q = w.parts[l.j];
      if (l.age >= TRIAL && v * Math.sqrt(l.r2 || 1) >= PRUNE && ((l.k === 2 && carZ(q)) || (l.k === 1 && carP(q)))) has = true;
    }
    if (has) relay++;
  }
  const carCh = new Array(CH).fill(0); for (const q of carriers) carCh[q.ch]++;
  const L = []; for (const p of X) for (const l of p.links) L.push([p.ch, w.parts[l.j].ch, Math.abs(l.w), l.k]);
  let wp = 0, wz = 0, wa = 0; for (const [, , v, k] of L) { wa += v; if (k === 1) wp += v; if (k === 2) wz += v; }
  const L2 = L.filter((e) => e[3] < 2);   // верность меряется по датчикам и прогнозам; сигнал может нести что угодно
  // верная связь: датчик настоящего родителя или прогноз родителя либо деда
  const good = (tab) => ([c, t, , k]) => tab(c)[0].includes(t) || (k === 1 && tab(c)[1].includes(t));
  const share = (ok) => { let r = 0, a = 0; for (const e of L2) { a += e[2]; if (ok(e)) r += e[2]; } return a ? r / a : NaN; };
  const truth = (c) => [PARENTS[c], GRAND[c]];
  const right = WORLD ? share(good(truth)) : NaN;
  const nul = WORLD ? PERMS.reduce((s, a) => s + share(good((c) => [PARENTS[a[c - 3]], GRAND[a[c - 3]]])), 0) / PERMS.length : NaN;
  const byCount = WORLD && L2.length ? L2.filter(good(truth)).length / L2.length : NaN;
  return { alive: A.length, births: w.births, bank: w.deaths.bank, fault: w.deaths.fault,
    deadAge: med(w.deadAges), liveAge: med(A.map((p) => p.age)),
    linksS: med(S.map((p) => p.links.length)), linksX: med(X.map((p) => p.links.length)),
    right, nul, byCount, bitsS: med(S.map((p) => p.bits)), bitsX: med(X.map((p) => p.bits)),
    pShare: wa ? wp / wa : NaN, zShare: wa ? wz / wa : NaN, bits9: med(D9.map((p) => p.bits)), f8: a9 ? f8 / a9 : NaN,
    z9: a9 ? z9 / a9 : NaN, relay: D9.length ? relay / D9.length : NaN, n9: D9.length,
    carriers: carriers.length, carCh: carCh.map((v, i) => (v ? `${i}:${v}` : '')).filter(Boolean).join(' '), urge: med(A.map((p) => p.g.urge)), lr: RULE ? NaN : med(A.map((p) => p.g.lr)),
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
  const SEEDS = (process.env.SEEDS || '1,2,3').split(',').map(Number);
  for (const seed of SEEDS) {
    const w = create(seed);
    console.log(`сид ${seed}`);
    for (let r = 1; r <= ROUNDS; r++) {
      round(w);
      if ([1000, 20000, 50000, ROUNDS].includes(r)) {
        const s = stats(w);
        console.log(`  круг ${String(r).padStart(6)}: живых ${s.alive} | связей: у источников ${s.linksS}, у остальных ${s.linksX}` +
          (WORLD ? ` | вес на верных ${pc(s.right)} (нуль ${pc(s.nul)}), по счёту ${pc(s.byCount)}` : '') +
          ` | на прогнозах ${pc(s.pShare)}` + (SIGNAL ? `, на сигналах ${pc(s.zShare)}` : '') + ` веса` +
          ` | бит: источники ${f(s.bitsS)}, остальные ${f(s.bitsX)}` +
          (DEEP ? ` | КАНАЛ 9 (глубина ${DEEP}): частей ${s.n9}, бит ${f(s.bits9)}, на прогнозах источника 8 ${pc(s.f8)} веса` +
            (SIGNAL ? `, на сигналах ${pc(s.z9)}, с передатчиком ${pc(s.relay)} частей; носителей прошлого ${s.carriers}` +
              (s.carriers ? ` (каналы ${s.carCh})` : '') : '') : '') +
          (RULE ? ` | закон: b/a ${f(s.ba)}, c/a ${f(s.ca)}, a ${f(s.a, 3)}, похожих на LMS ${pc(s.lms)}` : ''));
        if (r === ROUNDS) console.log(`  итог: рождений ${s.births}, смертей банкрот/сбой ${s.bank}/${s.fault} | возраст умерших ${s.deadAge}, живых ${s.liveAge}` +
          ` | гены: urge ${f(s.urge)}` + (RULE ? '' : `, lr ${f(s.lr, 3)}`) +
          (WORLD ? ` | доход источников от чтения ${pc(s.readShare)}` : '') + ` | в минусе ${s.minus}`);
      }
    }
  }
}

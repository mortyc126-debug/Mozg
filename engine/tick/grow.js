#!/usr/bin/env node
'use strict';
/* ============================================================
   ЗАЧАТОК НА БЮДЖЕТЕ ТАКТОВ -- ЧЕРНОВИК

   Не опыт. Правил чтения не объявлено, вердиктов не будет, числа --
   описание того, что вышло, а не установленный факт.

   ЗАМЫСЕЛ. Всё стоит тактов, а такты идут ТОМУ, КОГО ЧИТАЮТ.

   Никакой цели никто не назначает. Но чтение стоит читающему, значит
   читать кого попало накладно; а кого читают -- тот получает такты и
   может больше делать. Так появляется внутренняя валюта, не завезённая
   извне: внимание.

   ЧТО ЗДЕСЬ ЦИФРОВОГО, А НЕ БИОЛОГИЧЕСКОГО:
     * бюджет ФИКСИРОВАН, а частей становится больше -- рост сам себя
       ограничивает, тесноту создавать не надо;
     * адреса без расстояния: связаться можно с кем угодно;
     * память бесплатна, а ЧТЕНИЕ стоит -- поэтому забывание есть выбор,
       а не поломка;
     * правила -- данные: у части свои числа, и потомок наследует их с
       отклонением;
     * кто не платит -- ЗАМИРАЕТ, а не гибнет.

   ---------- ПРАВКА ВТОРОГО ЧЕРНОВИКА ----------

   Первый черновик уткнулся в два ограничения, которые внёс я, а не
   дефицит такта. Оба сняты, и оба -- параметрами, чтобы прежний мир
   воспроизводился ПОБИТОВО (см. identity.js).

   1. ПОТОЛОК НАСЕЛЕНИЯ СНЯТ. `CAP` по умолчанию бесконечен. Росту
      теперь противостоит только бюджет: чем больше частей, тем меньше
      тактов на каждую, тем труднее накопить 20 на деление. Где мир
      остановится -- его дело, а не моё. Осталась лишь АВАРИЙНАЯ черта
      `SAFETY`: она не правило мира, а защита от того, чтобы прогон не
      съел машину, и если её коснулись -- это печатается отдельной
      строкой, потому что тогда число частей сказано мной, а не миром.

   2. ДЕРЖАНИЕ СВЯЗИ СТАЛО ПЛАТНЫМ. Раньше платили только за заведение
      связи, и граф лишь густел -- внимание ничего не отсекало. Теперь
      каждая связь стоит `C_HOLD` тактов ЗА КРУГ, и платят все, включая
      замерших: держать -- значит платить.

      ЧТО ДЕЛАТЬ, ЕСЛИ НЕЧЕМ ПЛАТИТЬ. Здесь я обязан был выбрать
      правило, и выбрал самое внутреннее из доступных: часть держит те
      связи, которыми САМА ПОЛЬЗУЕТСЯ. У каждой связи есть счётчик
      `used`: +1, когда часть действительно прочла этого соседа, и
      затухание `USED_DECAY` каждый круг. Не хватает кредита -- связи
      отбрасываются с конца, начиная с наименее используемой.

      Ничьего мнения, кроме собственного, часть при этом не
      спрашивает, и никакой пользы никто не оценивает: `used` -- это
      только факт чтения, а читает часть по новизне.

      ПОБОЧНОЕ СЛЕДСТВИЕ, НАЗВАННОЕ ЗАРАНЕЕ: плата за держание -- это
      утечка, и она бьёт по бедным сильнее, чем по богатым. Так что
      она работает и как отсечение связей, и как усиление неравенства.
      Разделить эти два действия внутри одного прогона нельзя, и я не
      буду делать вид, что можно.

   ЦЕНЫ (взяты с потолка, это черновик):
     обновиться      1
     прочесть одного 0.5
     связаться       5
     держать связь   0.1 за круг   <- новое
     разделиться     20
   ============================================================ */
const { makeRNG } = require('../src/rng');

const K = 6;                       // длина состояния части
const BUDGET = 200;                // тактов на круг, ФИКСИРОВАН
const C_UPDATE = 1, C_READ = 0.5, C_LINK = 5, C_DIVIDE = 20;
/* Число из окружения. Пустая строка -- это НЕ ноль: "CAP=" в оболочке
   задаёт переменную пустой, и наивное +'' давало 0, то есть потолок
   населения в ноль частей, и мир молча не рождал ничего. Пустое
   значение считается незаданным, а неразбираемое -- ошибкой, а не
   тихим NaN. */
const num = (name, dflt) => {
  const v = process.env[name];
  if (v === undefined || v.trim() === '') return dflt;
  const x = +v;
  if (Number.isNaN(x)) throw new Error(`${name}: не число -- "${v}"`);
  return x;
};

const BASE_SHARE = num('BASE', 0.5);   // базовая доля при делёжке
const C_HOLD = num('HOLD', 0.1);       // плата за держание связи, за круг
const USED_DECAY = num('DECAY', 0.98); // затухание памяти о пользовании связью
const CAP = num('CAP', Infinity);      // потолок населения; по умолчанию СНЯТ
const SAFETY = num('SAFETY', 20000);   // аварийная черта, не правило мира
const TAX = num('TAX', 0);         // налог на расхождение; 0 -- как было
const LEARN = num('LEARN', 0.1);   // скорость, с какой ожидание идёт к прочитанному
const W = num('W', 20);            // окно для меры «внутри жизни связи»
const HEAD = num('HEAD', 20);      // сколько первых прочтений помнить порознь
/* ПЕРЕВЁРНУТОЕ правило: держать дорого ХОРОШО предсказанную связь, а
   плохо предсказанную -- дёшево. Нужно не само по себе, а как
   вмешательство: если однородность мира берётся из того, что налог
   оставляет предсказуемых соседей, то при перевороте знак обязан
   перемениться. EREF -- удвоенная измеренная медиана ошибки, взята
   так, чтобы СРЕДНЯЯ цена осталась прежней, а порядок перевернулся:
   иначе сравнивалась бы дороговизна, а не направление правила. */
/* ОТСРОЧКА. Плата за держание была устроена как аренда, вносимая
   целиком или никак: не хватило кредита В ЭТОМ КРУГЕ -- связи нет.
   Доход части колеблется, и шаг 8 показал, чем это кончилось: граф
   переписывается каждые 70-80 кругов, ни одна связь из двадцати пяти
   тысяч не доживает до тысячи, и отбирать по чему бы то ни было
   попросту нечего.

   Я называл замирание цифровой роскошью -- «кто не платит, замирает, а
   не гибнет», -- но применил это к частям и не применил к связям.
   GRACE -- та же роскошь для связи: неоплаченное копится ДОЛГОМ, и
   связь сбрасывается, лишь когда долг перевалит за GRACE её цен, то
   есть когда за неё не платили GRACE кругов подряд. Уплата долг
   обнуляет.

   При GRACE = 0 исполняется прежняя ветка, слово в слово, и мир обязан
   совпасть побитово. */
/* ============ СБОИ: МИР, КОТОРЫЙ НЕ БЕЗУПРЕЧЕН ============

   До сих пор эта среда была стерильной: адреса точны, память
   нерушима, такт не теряется, связь заводится только за плату. Это
   МОЙ выбор, а не свойство цифрового, и он ничем не обоснован: живого
   мозга в стерильности не бывает, а эталона, с которым сверяться, у
   нас нет вовсе.

   Здесь вводятся четыре сбоя. Все ЦИФРОВЫЕ по природе -- это отказы
   ровно тех даровых благ, на которых стояла среда:

     MISS  -- ПРОМАХ АДРЕСА. Читаешь не того, кого выбрал. Адрес без
              расстояния был даровым; теперь он неточен.
     ROT   -- ПОРЧА ЗАПИСИ. Одна координата состояния испортилась.
              Память была бесплатной и нерушимой; теперь нерушимой нет.
     SLIP  -- ПОТЕРЯ ТАКТА. Начисление за круг пропало целиком.
              Бухгалтерия была точной; теперь нет.
     GHOST -- САМОЗВАНАЯ СВЯЗЬ. Связь завелась сама, без платы.
              Проводка была подконтрольной; теперь нет.

   FAULT -- общая ручка: задаёт все четыре разом, если не заданы
   порознь. При FAULT = 0 не тратится ни одного случайного числа, и
   мир обязан совпасть с прежним ПОБИТОВО -- иначе нельзя будет
   сказать, что изменилось именно от сбоев.

   Никакого вердикта об их пользе здесь нет и быть не может: что
   делают сбои -- неизвестно никому, и это и есть причина смотреть.
   ============================================================ */
const FAULT = num('FAULT', 0);
const MISS = num('MISS', FAULT);
const ROT = num('ROT', FAULT);
const SLIP = num('SLIP', FAULT);
const GHOST = num('GHOST', FAULT);
/* До какого круга приходит порча записи. Дальше мир живёт сам:
   всё остальное идёт как шло, но впрыска различий больше нет. Ровно
   тот же приём, что stimulus_until в ядре Python-линии. Бесконечность
   -- как было, поэтому тождество цело. */
const ROT_UNTIL = num('ROT_UNTIL', Infinity);
const ANY_FAULT = MISS > 0 || ROT > 0 || SLIP > 0 || GHOST > 0;

const GRACE = num('GRACE', 0);
const INVERT = num('INVERT', 0);
const EREF = num('EREF', 0.0406);
const MAX_READS = 4;               // сколько соседей часть осилит за круг

function makePart(id, rnd, parent) {
  const x = new Float64Array(K);
  for (let k = 0; k < K; k++) x[k] = parent ? parent.x[k] + (rnd() - 0.5) * 0.2 : rnd() * 2 - 1;
  // правила части -- данные: наследуются с отклонением
  const par = parent
    ? { mix: clamp01(parent.par.mix + (rnd() - 0.5) * 0.15),
        greed: clamp01(parent.par.greed + (rnd() - 0.5) * 0.15),
        urge: clamp01(parent.par.urge + (rnd() - 0.5) * 0.15) }
    : { mix: 0.3, greed: 0.5, urge: 0.5 };
  return { id, x, prev: Float64Array.from(x), par, links: [], credit: 0,
    read: 0, readPrev: 0, steps: 0, frozen: 0, born: 0, kids: 0, dropped: 0 };
}
const clamp01 = (v) => (v < 0.02 ? 0.02 : v > 0.98 ? 0.98 : v);

/* Связь. При TAX = 0 всё, что ниже ожидания, не заводится вовсе и не
   считается: мир обязан совпасть с прежним побитово.

   `e` -- ОЖИДАНИЕ: каким часть считает состояние соседа. Заводится
   равным собственному состоянию: самое дешёвое предположение, а не
   подсказка. Запись бесплатна -- память в цифре бесплатна; платно
   только чтение, уже оплаченное отдельно.

   Учёт для меры «внутри жизни связи»: первые W расхождений и последние
   W (кольцом). Рядом -- ДВИЖЕНИЕ соседа в тот же миг: если расхождение
   упало вместе с движением, упало не предсказание, а мир замер. */
function makeLink(j, p, w) {
  const l = { j, used: 0, born: w ? w.round : 0, debt: 0 };
  if (TAX > 0) {
    l.e = Float64Array.from(p.x);
    l.err = 0; l.errPay = 0; l.cost = 0;
    l.nr = 0;
    /* первые HEAD расхождений порознь, а не суммой: в первой постановке
       хранилась только сумма по первым W, и всё научение оказалось
       ВНУТРИ окна -- мера не могла его увидеть (шаг 6). */
    l.head = new Float64Array(HEAD); l.headMov = new Float64Array(HEAD);
    l.fSum = 0; l.fMov = 0;
    l.lBuf = new Float64Array(W); l.lMov = new Float64Array(W); l.lPos = 0;
  }
  return l;
}

/* одно прочтение: расхождение, память о нём, движение ожидания к факту */
function observe(l, o) {
  let m = 0;
  for (let k = 0; k < K; k++) m += Math.abs(l.e[k] - o.x[k]);
  m /= K;
  let mov = 0;
  for (let k = 0; k < K; k++) mov += Math.abs(o.x[k] - o.prev[k]);
  mov /= K;
  l.err = 0.9 * l.err + 0.1 * m;
  if (l.nr < W) { l.fSum += m; l.fMov += mov; }
  if (l.nr < HEAD) { l.head[l.nr] = m; l.headMov[l.nr] = mov; }
  l.lBuf[l.lPos] = m; l.lMov[l.lPos] = mov; l.lPos = (l.lPos + 1) % W;
  l.nr++;
  for (let k = 0; k < K; k++) l.e[k] += LEARN * (o.x[k] - l.e[k]);
}

function createSeed(seed, shuffle) {
  const rnd = makeRNG(seed);
  const w = { rnd, round: 0, parts: [], nextId: 0, log: [],
    dropsLast: 0, dropsTotal: 0, hitSafety: false,
    shuffle: !!shuffle, aux: makeRNG((seed * 7919 + 13) >>> 0),
    /* Наблюдение, и только: ни одно из этих чисел не участвует в ходе
       мира, не расходует случайных чисел и не создаёт развилок. Поэтому
       тождество при TAX = 0 обязано устоять -- и проверяется. */
    stat: null,
    faults: { miss: 0, rot: 0, slip: 0, ghost: 0 } };
  w.parts.push(makePart(w.nextId++, rnd, null));
  return w;
}

/* Начать вести счёт (обнуляет накопленное). Опыт включает его на той
   части прогона, которую меряет, чтобы разогрев не попадал в числа. */
function watch(w) {
  w.stat = { readDist: 0, readN: 0, lifeSum: 0, lifeN: 0, madeN: 0 };
}

/* сколько прожила сброшенная связь */
function noteDrops(w, p, from) {
  if (!w.stat) return;
  for (let i = from; i < p.links.length; i++) {
    w.stat.lifeSum += w.round - p.links[i].born;
    w.stat.lifeN++;
  }
}

/* плата за держание связей. Возвращает, сколько связей отброшено.
   При C_HOLD <= 0 не делает НИЧЕГО -- даже не трогает порядок связей,
   иначе тождество с первым черновиком сломалось бы на сложении чисел
   с плавающей точкой в другом порядке. */
function upkeep(w, p) {
  if (!(C_HOLD > 0) || p.links.length === 0) return 0;
  if (TAX > 0) return upkeepTaxed(w, p);
  // самые используемые -- вперёд; отбрасываем с конца
  p.links.sort((a, b) => (b.used - a.used) || (a.j - b.j));
  const afford = Math.floor(p.credit / C_HOLD);
  let dropped = 0;
  if (afford < p.links.length) {
    dropped = p.links.length - afford;
    noteDrops(w, p, afford);
    p.links.length = afford;
    p.dropped += dropped;
  }
  p.credit -= p.links.length * C_HOLD;
  for (const l of p.links) l.used *= USED_DECAY;
  return dropped;
}

/* Держание связи стоит HOLD * (1 + TAX * err): плохо предсказанная связь
   дорога, предсказуемая дёшева. Не хватает кредита -- сбрасываются
   самые дорогие. Отдельной веткой от беспошлинного случая нарочно: там
   плата считалась одним умножением, здесь -- сложением по связям, и это
   разные числа с плавающей точкой. Смешав их, я потерял бы побитовое
   тождество при TAX = 0, то есть возможность сказать, что изменилось
   именно от налога. */
function upkeepTaxed(w, p) {
  for (const l of p.links) l.cost = C_HOLD * (1 + TAX * l.errPay);
  p.links.sort((a, b) => (a.cost - b.cost) || (b.used - a.used) || (a.j - b.j));
  let paid = 0, keep = 0;
  for (const l of p.links) {
    if (paid + l.cost > p.credit) break;
    paid += l.cost; keep++;
  }
  let dropped;
  if (!(GRACE > 0)) {
    dropped = p.links.length - keep;
    if (dropped > 0) { noteDrops(w, p, keep); p.links.length = keep; p.dropped += dropped; }
  } else {
    // оплаченные -- долг долой; неоплаченные -- долг растёт; гибнут лишь
    // те, за кого не платили GRACE кругов подряд. Порядок связей при
    // этом сохраняется: выживший не переставляется.
    const stay = [];
    for (let i = 0; i < p.links.length; i++) {
      const l = p.links[i];
      if (i < keep) { l.debt = 0; stay.push(l); continue; }
      l.debt += l.cost;
      if (l.debt <= GRACE * l.cost) stay.push(l);
      else {
        if (w.stat) { w.stat.lifeSum += w.round - l.born; w.stat.lifeN++; }
        p.dropped++;
      }
    }
    dropped = p.links.length - stay.length;
    p.links = stay;
  }
  p.credit -= paid;
  for (const l of p.links) l.used *= USED_DECAY;
  return dropped;
}

/* ПУСТОЙ ОТСЧЁТ. Те же значения ошибки, разложенные по ДРУГИМ связям:
   распределение издержек то же, а связь с тем, что действительно плохо
   предсказано, разорвана. Решение «что сбросить» становится
   неосведомлённым. Числа для перестановки берутся из ОТДЕЛЬНОГО потока,
   чтобы собственный поток мира остался нетронутым и миры были сравнимы
   (иначе мерилась бы разная случайность, а не разное правило). */
function assignErrForPay(w) {
  if (!(TAX > 0)) return;
  const all = [];
  for (const p of w.parts) for (const l of p.links) all.push(l);
  const put = INVERT > 0 ? (v) => (EREF - v > 0 ? EREF - v : 0) : (v) => v;
  if (!w.shuffle) { for (const l of all) l.errPay = put(l.err); return; }
  const v = all.map((l) => l.err);
  for (let i = v.length - 1; i > 0; i--) {
    const j = Math.floor(w.aux() * (i + 1));
    const t = v[i]; v[i] = v[j]; v[j] = t;
  }
  for (let i = 0; i < all.length; i++) all[i].errPay = put(v[i]);
}

function round(w) {
  const P = w.parts;

  // 1) начисление: доля пропорциональна тому, сколько тебя читали
  let sum = 0;
  for (const p of P) sum += p.readPrev + BASE_SHARE;
  for (const p of P) {
    const share = BUDGET * (p.readPrev + BASE_SHARE) / sum;
    // СБОЙ: такт потерян -- начисление за этот круг не дошло
    if (SLIP > 0 && w.rnd() < SLIP) { w.faults.slip++; continue; }
    p.credit += share;
  }
  for (const p of P) { p.readPrev = p.read; p.read = 0; }

  // 1-бис) плата за держание связей -- со всех, включая замерших
  assignErrForPay(w);
  let drops = 0;
  for (const p of P) drops += upkeep(w, p);
  w.dropsLast = drops;
  w.dropsTotal += drops;

  // 2) действия. Порядок фиксирован; состояния читаются по ходу.
  const newborns = [];
  for (const p of P) {
    if (p.credit < C_UPDATE) { p.frozen++; continue; }

    // кого читать: из своих связей, по новизне -- насколько чужое
    // состояние непохоже на собственное. Мера внутренняя, цели не знает.
    let budgetLeft = p.credit - C_UPDATE;
    const cand = p.links
      .map((l) => ({ l, o: w.parts[l.j] }))
      .filter((c) => c.o)
      .map((c) => ({ l: c.l, o: c.o, novelty: dist(p.x, c.o.x) }))
      .sort((a, b) => b.novelty - a.novelty);
    const wantReads = Math.min(MAX_READS, Math.floor(p.par.greed * MAX_READS) + 1);
    const got = [];
    for (const c of cand) {
      if (got.length >= wantReads || budgetLeft < C_READ) break;
      budgetLeft -= C_READ;
      let o = c.o;
      // СБОЙ: промах адреса -- прочтён не тот, кого выбрали
      if (MISS > 0 && w.rnd() < MISS) {
        const j = Math.floor(w.rnd() * P.length);
        if (P[j] && j !== p.id) { o = P[j]; w.faults.miss++; }
      }
      c.o = o;
      c.o.read++;                       // прочитанный зарабатывает
      c.l.used += 1;                    // связью воспользовались
      if (TAX > 0) observe(c.l, c.o);   // чем ожидание разошлось с фактом
      if (w.stat) { w.stat.readDist += c.novelty; w.stat.readN++; }
      got.push(c.o);
    }

    // 3) обновление: смесь себя и прочитанного
    const nx = new Float64Array(K);
    for (let k = 0; k < K; k++) {
      let s = 0;
      for (const o of got) s += o.x[k];
      s = got.length ? s / got.length : p.x[k];
      nx[k] = Math.tanh((1 - p.par.mix) * p.x[k] + p.par.mix * s + 0.03 * (w.rnd() * 2 - 1));
    }
    p.prev.set(p.x);
    p.x.set(nx);
    // СБОЙ: порча записи -- одна координата состояния испортилась
    if (ROT > 0 && w.round < ROT_UNTIL && w.rnd() < ROT) {
      p.x[Math.floor(w.rnd() * K)] = w.rnd() * 2 - 1;
      w.faults.rot++;
    }
    p.credit = budgetLeft;
    p.steps++;

    // 4) связаться -- адрес без расстояния, с кем угодно
    if (p.credit >= C_LINK && w.rnd() < p.par.urge * 0.25) {
      const j = Math.floor(w.rnd() * P.length);
      if (j !== p.id && !p.links.some((l) => l.j === j)) {
        p.links.push(makeLink(j, p, w));
        p.credit -= C_LINK;
        if (w.stat) w.stat.madeN++;
      }
    }
    // СБОЙ: самозваная связь -- завелась сама, без платы
    if (GHOST > 0 && w.rnd() < GHOST) {
      const j = Math.floor(w.rnd() * P.length);
      if (j !== p.id && !p.links.some((l) => l.j === j)) {
        p.links.push(makeLink(j, p, w));
        w.faults.ghost++;
      }
    }
    // 5) разделиться. Потолка населения нет: удерживает только бюджет.
    if (p.credit >= C_DIVIDE && P.length + newborns.length < CAP
        && P.length + newborns.length < SAFETY
        && w.rnd() < p.par.urge * 0.5) {
      p.credit -= C_DIVIDE;
      const kid = makePart(w.nextId, w.rnd, p);
      kid.born = w.round;
      kid.links.push(makeLink(p.id, kid, w));
      newborns.push(kid);
      p.links.push(makeLink(w.nextId, p, w));
      p.kids++;
      w.nextId++;
    }
  }
  for (const k of newborns) w.parts.push(k);
  if (w.parts.length >= SAFETY) w.hitSafety = true;
  w.round++;
}

function dist(a, b) {
  let s = 0;
  for (let k = 0; k < K; k++) s += Math.abs(a[k] - b[k]);
  return s / K;
}

function run(seed, rounds, every, shuffle) {
  const w = createSeed(seed, shuffle);
  const step = every || 200;
  for (let r = 0; r < rounds; r++) {
    round(w);
    if (r % step === step - 1) w.log.push(snapshot(w));
  }
  return w;
}

function snapshot(w) {
  const P = w.parts;
  const reads = P.map((p) => p.readPrev).sort((a, b) => b - a);
  const total = reads.reduce((a, b) => a + b, 0) || 1;
  const top10 = reads.slice(0, Math.max(1, Math.round(P.length * 0.1)))
    .reduce((a, b) => a + b, 0) / total;
  const mixes = P.map((p) => p.par.mix);
  const mm = mixes.reduce((a, b) => a + b, 0) / P.length;
  const spread = Math.sqrt(mixes.reduce((a, b) => a + (b - mm) ** 2, 0) / P.length);
  const deg = P.map((p) => p.links.length);
  return {
    round: w.round, n: P.length,
    читают_верхние10: top10,
    разброс_правил: spread,
    связей_на_часть: deg.reduce((a, b) => a + b, 0) / P.length,
    наиб_читаемый: reads[0] || 0,
    читаемых: P.filter((p) => p.readPrev > 0).length,
    сброшено_за_круг: w.dropsLast,
    сброшено_всего: w.dropsTotal,
  };
}

module.exports = { createSeed, round, run, snapshot, dist, watch,
  BUDGET, CAP, C_HOLD, BASE_SHARE, TAX, LEARN, W, HEAD, K, INVERT, GRACE, FAULT, ANY_FAULT, ROT_UNTIL };

if (require.main === module) {
  const rounds = +(process.argv[2] || 2000);
  console.log('ЗАЧАТОК НА БЮДЖЕТЕ ТАКТОВ -- ЧЕРНОВИК, редакция вторая');
  console.log(`бюджет ${BUDGET} тактов на круг (фиксирован), начинаем с одной части`);
  console.log(`цены: обновиться ${C_UPDATE}, прочесть ${C_READ}, связаться ${C_LINK}, ` +
    `держать связь ${C_HOLD} за круг, разделиться ${C_DIVIDE}`);
  console.log(`базовая доля ${BASE_SHARE}, потолок населения ` +
    `${CAP === Infinity ? 'СНЯТ' : CAP} (аварийная черта ${SAFETY})\n`);
  for (const seed of [1, 2, 3]) {
    const w = run(seed, rounds);
    console.log(`--- сид ${seed} ---`);
    console.log(' круг | частей | верх.10% | разброс правил | связей | наиб.чит | читаемых | сброс/круг');
    for (const s of w.log)
      console.log(`${String(s.round).padStart(5)} | ${String(s.n).padStart(6)} | ` +
        `${(s.читают_верхние10 * 100).toFixed(1).padStart(7)}% | ${s.разброс_правил.toFixed(4).padStart(14)} | ` +
        `${s.связей_на_часть.toFixed(2).padStart(6)} | ${String(s.наиб_читаемый).padStart(8)} | ` +
        `${String(s.читаемых).padStart(8)} | ${String(s.сброшено_за_круг).padStart(10)}`);
    if (w.hitSafety)
      console.log('  ВНИМАНИЕ: коснулись аварийной черты -- число частей сказано мной, а не миром');
  }
}

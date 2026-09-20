#!/usr/bin/env node
'use strict';
/* ИСТОЧНИК НАПРАВЛЕНИЯ: СЛЕДУЕТ ЛИ СТОРОНА ПРОГИБА ЗА ГРАДИЕНТОМ СРЕДЫ

   Установлено: сторона прогиба слоя решается за первые 25 шагов из 1400
   и не задаётся ничем из проверенного -- ни градиентом (при прежних
   правилах), ни знаком локальной асимметрии, ни кривизной стартового
   ряда, ни поздним шумом. Направление этапа 13 пришлось прочесть как
   раннюю потерю симметрии, а не как морфогенез.

   Причина, по которой градиент не мог сработать, геометрическая и
   измерена. Агент сравнивает поле у себя с полем у соседей, поэтому
   восстановить он способен лишь ту составляющую градиента, вдоль
   которой у него ЕСТЬ соседи. У прямой ОДНОРЯДНОЙ цепи соседи лежат
   вдоль ряда, а гнётся она поперёк, и поперечная составляющая ей
   невидима: восстанавливается 1.6% от истинной (2.7e-4 при доле 0.69).
   У ДВУРЯДНОГО пласта соседи есть и поперёк -- восстанавливается 90%.
   Вопрос "куда гнётся однорядный слой" был плохо поставлен: внешнего
   ответа на него нет в принципе.

   Отсюда добавление: агент читает направление возрастания поля тем же
   локальным сравнением и подтягивает к нему свою ориентацию (параметр
   gradAlign; при 0 движок ведёт себя побитово как прежде -- проверено
   на 6 сверках, включая конфигурацию с align > 0). Ориентация уже
   участвует в физике через модуляцию равновесного расстояния, поэтому
   новых путей влияния не появляется: меняется только то, ЧЕМ задана
   ориентация.

   Ветки:
     OFF  -- gradAlign 0: прежнее поведение;
     ON   -- gradAlign 1: ориентация читает поле;
     РОВНО -- gradAlign 1 при АМПЛИТУДЕ ПОЛЯ 0: среда однородна, разности
       с соседями строго нулевые, поэтому ориентация получает ту же
       память и ту же динамику, но БЕЗ сведений о поле. Это контроль,
       отделяющий чтение поля от самого факта появления памяти;
     ОБРАТНО -- gradAlign 1 при амплитуде поля -1: поле то же по силе, но
       возрастает в противоположную сторону, тогда как опора отсчёта
       (cos theta, sin theta) не меняется. Это ПРИЧИННАЯ проверка: если
       сторону задаёт поле, знак обязан перевернуться на тех же сидах.
       Сравнение ПАРНОЕ, сид к сиду.

   Знак прогиба читается относительно направления градиента (cos theta,
   sin theta) -- оно известно, неподвижно и своё у каждого сида. Сиды, у
   которых поперечная составляющая градиента мала (|perp| < 0.1),
   исключаются: у них опора вырождена. Порог объявлен заранее, число
   исключённых сообщается.

   ПРАВИЛО ЧТЕНИЯ, объявлено до запуска:
     * на ДВУРЯДНОМ пласте ON должен дать согласие с градиентом не ниже
       5/6 читаемых сидов, ПРИ ТОМ ЧТО OFF и РОВНО остаются на случайном
       уровне (не выше 2/3). Выполнено -- источник направления получен:
       сторона следует за внешним полем, а не за шумом;
     * ОДНОРЯДНЫЙ слой предсказан ОТРИЦАТЕЛЬНО: там ON не должен дать
       согласия, потому что поперечная составляющая ему невидима. Если
       согласие всё же появится, геометрическое объяснение неверно, и
       записывать надо это, а не удачу;
     * СОГЛАСИЕ СЧИТАЕТСЯ В ОБЕ СТОРОНЫ. Какой знак отвечает "по полю", а
       какой "против", заранее не известно: в этом проекте словесное
       предсказание знака уже один раз оказалось неверным при верном
       наблюдении. Поэтому читается СОГЛАСОВАННОСТЬ (доля большинства,
       в какую бы сторону оно ни смотрело), а направление устанавливается
       не рассуждением, а веткой ОБРАТНО;
     * целостность обязательна: при отношении прогиб/остаток ниже
       единицы знак не читается вовсе -- это облако, а не дуга.

   Запуск: node experiment/grad_source.js [сиды] [толщины]
*/
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const STEPS = 1400, STRENGTH = 0.35, GENES = [0, 1];
const BASE = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808,
              11, 23, 42, 314, 271, 1618, 65, 128, 999, 1234, 4096, 7];
const SEEDS = (process.argv[2] || BASE.join(',')).split(',').map(Number);
const ROWS = (process.argv[3] || '2').split(',').map(Number);
const PERP_MIN = 0.1;

function fit(cells, refx, refy) {
  const n = cells.length;
  let mx = 0, my = 0;
  for (const c of cells) { mx += c.x / n; my += c.y / n; }
  let sxx = 0, syy = 0, sxy = 0;
  for (const c of cells) { const dx = c.x - mx, dy = c.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  sxx /= n; syy /= n; sxy /= n;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
  let ux = sxy, uy = l1 - sxx;
  const nl = Math.hypot(ux, uy) || 1; ux /= nl; uy /= nl;
  let vx = -uy, vy = ux;
  const perp = refx * vx + refy * vy;           // поперечная доля опоры
  if (perp < 0) { vx = -vx; vy = -vy; }
  const P = cells.map((c) => {
    const dx = c.x - mx, dy = c.y - my;
    return [dx * ux + dy * uy, dx * vx + dy * vy];
  });
  let S0 = n, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0;
  for (const [u, v] of P) {
    const u2 = u * u;
    S1 += u; S2 += u2; S3 += u2 * u; S4 += u2 * u2;
    T0 += v; T1 += u * v; T2 += u2 * v;
  }
  const M = [[S4, S3, S2], [S3, S2, S1], [S2, S1, S0]], Y = [T2, T1, T0];
  for (let i = 0; i < 3; i++) {
    let pi = i;
    for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[pi][i])) pi = r;
    if (Math.abs(M[pi][i]) < 1e-12) return { a: 0, sag: 0, rms: 0, perp };
    [M[i], M[pi]] = [M[pi], M[i]]; [Y[i], Y[pi]] = [Y[pi], Y[i]];
    for (let r = 0; r < 3; r++) {
      if (r === i) continue;
      const f2 = M[r][i] / M[i][i];
      for (let k = i; k < 3; k++) M[r][k] -= f2 * M[i][k];
      Y[r] -= f2 * Y[i];
    }
  }
  const a = Y[0] / M[0][0], b = Y[1] / M[1][1], c0 = Y[2] / M[2][2];
  let umin = Infinity, umax = -Infinity, ss = 0;
  for (const [u, v] of P) {
    if (u < umin) umin = u;
    if (u > umax) umax = u;
    const d = v - (a * u * u + b * u + c0); ss += d * d;
  }
  const L = umax - umin;
  return { a, sag: Math.abs(a) * L * L / 4, rms: Math.sqrt(ss / n), perp: Math.abs(perp) };
}

function run(seed, rows, gradAlign, amp) {
  const per = 60, n0 = per * rows;
  const g = ancestral();
  for (const gi of GENES) g.eff[gi].pol = 1;
  const w = createWorld({
    seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
    params: { polarity: STRENGTH, maxCells: n0, gradient: amp,
              junctionAdhesion: 1, junction: 0.1, gradAlign },
  });
  for (let i = 0; i < STEPS; i++) step(w);
  const gx = Math.cos(w.theta), gy = Math.sin(w.theta);
  let nb = 0;
  for (const c of w.cells) nb += c.nb;
  return Object.assign(fit(w.cells, gx, gy), { nb: nb / w.cells.length });
}

for (const rows of ROWS) {
  const branches = [['OFF    ', 0, 1.0], ['ON     ', 1, 1.0], ['РОВНО  ', 1, 0.0], ['ОБРАТНО', 1, -1.0]];
  console.log(`\n=== слой ${rows}, ${SEEDS.length} сидов ===`);
  console.log('  ветка     большинство в одну сторону   читаемых   прогиб/остаток   соседей');
  const signs = {};
  for (const [name, ga, amp] of branches) {
    let plus = 0, read = 0, ratio = 0, nb = 0, skipped = 0;
    signs[name.trim()] = {};
    for (const seed of SEEDS) {
      const r = run(seed, rows, ga, amp);
      nb += r.nb;
      if (amp !== 0 && r.perp < PERP_MIN) { skipped++; continue; }
      read++;
      ratio += r.rms > 0 ? r.sag / r.rms : 0;
      signs[name.trim()][seed] = Math.sign(r.a);
      if (r.a > 0) plus++;
    }
    const rr = read ? ratio / read : 0;
    const maj = Math.max(plus, read - plus);
    console.log(`  ${name}   ${String(maj).padStart(2)} из ${String(read).padStart(2)} (порог ${Math.ceil(read * 5 / 6)}), ${plus >= read - plus ? 'ПО опоре' : 'ПРОТИВ опоры'}   исключено ${skipped}   ${rr.toFixed(2)} ${rr > 1 ? '(дуга)  ' : '(облако)'}   ${(nb / SEEDS.length).toFixed(2)}`);
  }
  // парное сравнение ON и ОБРАТНО: обязан ли знак перевернуться
  const a = signs['ON'], b = signs['ОБРАТНО'];
  let pair = 0, flip = 0;
  for (const seed of SEEDS) {
    if (!a || !b || !(seed in a) || !(seed in b)) continue;
    pair++;
    if (a[seed] !== b[seed]) flip++;
  }
  console.log(`  ПРИЧИННАЯ ПРОВЕРКА: при развороте поля знак перевернулся на ${flip} из ${pair} парных сидов (порог ${Math.ceil(pair * 5 / 6)})`);
}

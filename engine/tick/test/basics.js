#!/usr/bin/env node
'use strict';
/* ============================================================
   ПРОВЕРКИ СРЕДЫ, ГДЕ ДЕФИЦИТЕН ТАКТ

   Внутренние: о самой работе, а не о похожести на что-либо. Пять
   требований, и пятое -- пустой отсчёт для третьего, без которого оно
   ничего не значит.

     1. КРЕДИТ СОХРАНЯЕТСЯ. За круг раздаётся ровно бюджет -- не больше
        и не меньше. Иначе дефицит ненастоящий.
     2. ЗАМИРАНИЕ НЕ ПОРТИТ. Часть, не получившая такта, сохраняется
        ПОБИТОВО. Замирание обязано быть паузой, а не поломкой.
     3. ТОЖДЕСТВО ПРИ РАВНОМ ДЕЛЕЖЕ. При бюджете = числу частей и дележе
        поровну каждая часть идёт ровно раз за круг, и мир обязан
        совпасть с обычным одновременным прогоном, написанным отдельно.
     4. ДЕТЕРМИНИЗМ. Тот же сид -- тот же мир, побитово.
     5. НЕРАВНЫЙ ДЕЛЕЖ РАСХОДИТСЯ С РАВНЫМ. Иначе тождество из п.3
        доказывает лишь то, что дележ ни на что не влияет, и вся среда
        пуста. Это пустой отсчёт (ошибка №49).
   ============================================================ */
const { createTickWorld, run, round, EARN, fingerprint, updatePart } = require('../world');

let fails = 0;
const check = (name, ok, note) => {
  console.log(`${ok ? ' ok  ' : 'ПРОВАЛ'} ${name}${note ? '  ' + note : ''}`);
  if (!ok) fails++;
};
const states = (w) => w.parts.map((p) => Array.from(p.x).join(',')).join(';');

for (const seed of [1, 7, 42]) {
  const mk = (opt) => createTickWorld(Object.assign({ n: 64, deg: 3, seed }, opt));

  // 1) кредит сохраняется
  const R = 30;
  const a = mk({ budget: 64 });
  run(a, R, 'изменчивость');
  const want = 64 * R;
  check(`сид ${seed}: за ${R} кругов роздано ровно бюджет x кругов`,
    Math.abs(a.given - want) < 1e-9 * want, `роздано ${a.given.toFixed(6)} против ${want}`);

  // 2) замирание не портит: при скудном бюджете кто-то обязан замереть
  const b = mk({ budget: 8 });
  const before = new Map();
  for (const p of b.parts) before.set(p.i, Array.from(p.x).join(','));
  round(b, EARN['изменчивость']);
  let frozenSeen = 0, spoiled = 0;
  for (const p of b.parts) {
    if (p.frozen === 1) {
      frozenSeen++;
      if (Array.from(p.x).join(',') !== before.get(p.i)) spoiled++;
    }
  }
  check(`сид ${seed}: замершие части сохранены побитово`,
    frozenSeen > 0 && spoiled === 0, `замерло ${frozenSeen}, испорчено ${spoiled}`);

  // 3) тождество при равном дележе против отдельно написанного прогона
  const c = mk({ budget: 64 });
  run(c, R, 'поровну');
  const d = mk({ budget: 64 });
  for (let r = 0; r < R; r++) for (const p of d.parts) updatePart(d, p);
  const everyOnce = c.parts.every((p) => p.steps === R && p.frozen === 0);
  check(`сид ${seed}: при дележе поровну мир равен обычному прогону`,
    everyOnce && states(c) === states(d),
    everyOnce ? '' : 'не все части шли ровно раз за круг');

  // 4) детерминизм
  const e = mk({ budget: 40 }); run(e, R, 'устойчивость');
  const f = mk({ budget: 40 }); run(f, R, 'устойчивость');
  check(`сид ${seed}: тот же сид даёт тот же мир`, fingerprint(e) === fingerprint(f));

  // 5) неравный дележ расходится с равным -- пустой отсчёт для п.3
  const g = mk({ budget: 64 }); run(g, R, 'изменчивость');
  check(`сид ${seed}: неравный дележ уводит мир от равного`,
    states(g) !== states(c));

  // 6) СМЕШАННЫЙ круг: одни идут, другие стоят, и стоящие сохранены.
  //    Проверка п.2 этого не испытывала: при скудном бюджете в первом
  //    круге замирают ВСЕ, кредит ещё не накоплен. Здесь мир сперва
  //    раскручивается, и ищется круг, где есть и те, и другие.
  const h = mk({ budget: 24 });
  let mixedRound = -1, spoiledMixed = 0, ran = 0, stood = 0;
  for (let r = 0; r < 60 && mixedRound < 0; r++) {
    const snap = new Map(h.parts.map((p) => [p.i, Array.from(p.x).join(',')]));
    const fz = new Map(h.parts.map((p) => [p.i, p.frozen]));
    const st = new Map(h.parts.map((p) => [p.i, p.steps]));
    round(h, EARN['изменчивость']);
    ran = h.parts.filter((p) => p.steps > st.get(p.i)).length;
    stood = h.parts.filter((p) => p.frozen > fz.get(p.i)).length;
    if (ran > 0 && stood > 0) {
      mixedRound = r;
      for (const p of h.parts)
        if (p.frozen > fz.get(p.i) && Array.from(p.x).join(',') !== snap.get(p.i)) spoiledMixed++;
    }
  }
  check(`сид ${seed}: в смешанном круге стоящие сохранены, идущие идут`,
    mixedRound >= 0 && spoiledMixed === 0,
    mixedRound >= 0 ? `круг ${mixedRound}: шло ${ran}, стояло ${stood}, испорчено ${spoiledMixed}`
      : 'смешанного круга не нашлось за 60 кругов');
}

console.log(fails ? `\nпровалено проверок: ${fails}` : '\nвсе проверки пройдены');
process.exit(fails ? 1 : 0);

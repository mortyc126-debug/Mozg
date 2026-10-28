'use strict';
/* ============================================================
   ТОЧНОЕ РАЗДВОЕНИЕ МИРА

   Того, что здесь делается, не может ни одна живая ткань: мир копируется
   целиком и дальше два экземпляра идут независимо. Это не приём измерения
   и не уловка -- это то, что цифровая среда даёт даром, а вещество не
   даёт никак.

   Копируется ВСЁ, от чего зависит следующий шаг:
     позиция генератора    -- иначе копии разойдутся на первом же шаге;
     поля среды            -- шесть Float32Array;
     агенты                -- числа и два Float64Array (экспрессия, слух);
     связи                 -- объект связи общий у двух агентов, и это
                              общее владение в копии обязано сохраниться;
     закреплённые контакты -- Map, ключами в которой лежат сами агенты;
     геном и параметры     -- геном копируется, потому что он изменяем.

   ПРОВЕРКА ЭТОГО КОДА -- в test/clone_identity.js, и она внутренняя:
   копия, прогнанная N шагов, обязана совпасть с оригиналом ПОБИТОВО по
   всему наблюдаемому состоянию, и при этом быть от него независимой.
   Если это не так, всё построенное сверху недействительно.
   ============================================================ */
const { makeRNG } = require('./rng');
/* Клон генома берётся ГОТОВЫЙ из genome.js, а не пишется заново. Своя
   копия этой функции у меня потеряла поле `rate`, и мир разошёлся на
   первом же шаге: в поле появился NaN. Ровно урок №34 Python-ведомости --
   мера (или здесь механизм), размноженная по файлам, расходится между
   ними незаметно. */
const { clone: cloneGenome } = require('./genome');

const CELL_NUM = [
  'x', 'y', 'vx', 'vy', 'energy', 'adh', 'mot', 'div', 'link', 'reach', 'pol',
  'ax', 'ay', 'amag', 'qx', 'qy',
  'p1x', 'p1y', 'p1vx', 'p1vy', 'r1', 'p2x', 'p2y', 'p2vx', 'p2vy', 'r2',
  'nb', 'v', 'u', 'ad', 'inp', 'fired',
];

function cloneWorld(w) {
  const rnd = makeRNG(1);
  rnd.setState(w.rnd.getState());

  const out = {
    t: w.t, rnd, seed: w.seed, genome: cloneGenome(w.genome),
    GX: w.GX, GY: w.GY, CS: w.CS, WW: w.WW, WH: w.WH, R: w.R,
    NF: w.NF, nGenes: w.nGenes,
    f: w.f.map((a) => Float32Array.from(a)),
    tmp: Float32Array.from(w.tmp),
    cells: [],
    theta: w.theta,
    p: Object.assign({}, w.p),
    maxCells: w.maxCells, two: w.two,
    links: w.links, firedNow: w.firedNow,
    lastStim: w.lastStim ? Object.assign({}, w.lastStim) : w.lastStim,
  };

  // 1) агенты без ссылок
  const map = new Map();
  for (const c of w.cells) {
    const n = { e: Float64Array.from(c.e), sens: Float64Array.from(c.sens),
      links: [], jn: new Map(), dead: c.dead };
    for (const k of CELL_NUM) n[k] = c[k];
    map.set(c, n);
    out.cells.push(n);
  }

  // 2) связи: по одному объекту на связь, общий у обоих концов
  const seen = new Map();
  for (const c of w.cells) {
    const n = map.get(c);
    for (const l of c.links) {
      let nl = seen.get(l);
      if (!nl) {
        nl = { a: map.get(l.a), b: map.get(l.b), w: l.w, used: l.used };
        seen.set(l, nl);
      }
      n.links.push(nl);
    }
  }

  // 3) закреплённые контакты: ключи -- агенты, значит их надо перевести
  for (const c of w.cells) {
    const n = map.get(c);
    for (const [o, rest] of c.jn) {
      const no = map.get(o);
      if (no) n.jn.set(no, rest);
    }
  }

  return out;
}

/* Отпечаток полного наблюдаемого состояния -- для сверок. Строка, а не
   число: совпадение обязано быть точным, а не «похожим». */
function fingerprint(w) {
  const parts = [`t=${w.t}`, `rng=${w.rnd.getState()}`, `n=${w.cells.length}`];
  for (const f of w.f) { let s = 0; for (let i = 0; i < f.length; i++) s += f[i] * (i + 1); parts.push(s.toString()); }
  for (const c of w.cells) {
    parts.push(CELL_NUM.map((k) => c[k]).join(','));
    parts.push(Array.from(c.e).join(',') + '|' + Array.from(c.sens).join(','));
    parts.push(c.links.map((l) => l.w.toString() + ':' + l.used).join(';'));
    parts.push(String(c.jn.size));
  }
  return parts.join('\n');
}

module.exports = { cloneWorld, cloneGenome, fingerprint };

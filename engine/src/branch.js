'use strict';
/* ============================================================
   ВЕТВЛЕНИЕ: ПРОЖИТЬ НЕСКОЛЬКО БУДУЩИХ И ОСТАВИТЬ ОДНО

   Вещество живёт один раз. Цифровая среда позволяет иначе: мир
   раздваивается точно (src/clone.js), каждая копия проживает свой
   отрезок, одна остаётся, прочие выбрасываются. Это поиск во времени, и
   он здесь бесплатен.

   УСТРОЙСТВО ОДНОГО ЭПИЗОДА:
     1. мир копируется n раз;
     2. ветвь 0 продолжает поток случайных чисел родителя НЕТРОНУТЫМ,
        ветви 1..n-1 получают производные потоки -- поэтому будущие
        расходятся;
     3. каждая ветвь идёт horizon шагов;
     4. правило выбора называет одну; она становится новым настоящим,
        остальные исчезают.

   ПОЧЕМУ ВЕТВЬ 0 НЕ ТРОГАЕТСЯ. При n = 1 ветвление обязано быть
   ПОБИТОВО неотличимо от обычного прогона той же длины. Иначе всё,
   что меряется поверх, будет про машинерию, а не про мир. Это тождество
   при нуле, и оно проверяется в test/branch_identity.js, а не
   предполагается.

   ПРАВИЛО ВЫБОРА -- НАШЕ, И ЭТО НАДО ГОВОРИТЬ ПРЯМО. Никакое правило не
   растёт из среды само; любое мы назначаем. Честно можно лишь: назвать
   его явно, сделать простым и СНАЧАЛА проверить, отличается ли выбор по
   правилу от выбора жребием. Если не отличается -- вся постройка мертва,
   сколько правил ни придумывай.

   Правило получает (ветвь, состояние до ветвления) и возвращает число;
   выбирается наибольшее. Ни одно из них не знает ни задачи, ни цели.
   ============================================================ */
const { cloneWorld } = require('./clone');
const { step } = require('./world');

const DERIVE = 0x9e3779b9;      // производная позиция потока для ветвей 1..n-1

/* один эпизод: n будущих, одно остаётся */
function episode(w, { n, horizon, pick, stepFn = step }) {
  const base = cloneWorld(w);                   // снимок "до" для правил
  const kids = [];
  for (let k = 0; k < n; k++) {
    const c = cloneWorld(w);
    if (k > 0) c.rnd.setState((w.rnd.getState() ^ (DERIVE * k)) >>> 0);
    for (let i = 0; i < horizon; i++) stepFn(c);
    kids.push(c);
  }
  let best = 0, bestScore = -Infinity;
  const scores = [];
  for (let k = 0; k < n; k++) {
    const s = pick(kids[k], base, k);
    scores.push(s);
    if (s > bestScore) { bestScore = s; best = k; }
  }
  return { kept: kids[best], keptIndex: best, scores, kids };
}

/* прогон с ветвлением: episodes эпизодов подряд */
function branchRun(w, { n, horizon, episodes, pick, stepFn = step }) {
  let cur = w;
  const log = [];
  for (let e = 0; e < episodes; e++) {
    const r = episode(cur, { n, horizon, pick, stepFn });
    log.push({ episode: e, keptIndex: r.keptIndex, scores: r.scores });
    cur = r.kept;
  }
  return { world: cur, log };
}

/* --- правила выбора. Все внутренние: считаются из самого мира и не
   знают ни задачи, ни цели. Ни одно не "верное" -- они кандидаты. --- */

/* расстояние ветви от состояния до ветвления: по положениям агентов */
function drift(kid, base) {
  const m = Math.min(kid.cells.length, base.cells.length);
  if (!m) return 0;
  let s = 0;
  for (let i = 0; i < m; i++) {
    const a = kid.cells[i], b = base.cells[i];
    s += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return s / m;
}

const RULES = {
  // жребий: пустой отсчёт, с которым сравнивается всё остальное
  жребий: (rndPick) => (kid, base, k) => rndPick(k),
  // ветвь, ушедшая от прежнего себя дальше всех
  дальше: () => (kid, base) => drift(kid, base),
  // ветвь, оставшаяся ближе всех к прежнему себе
  ближе: () => (kid, base) => -drift(kid, base),
  // ветвь, в которой произошло больше событий
  деятельнее: () => (kid) => {
    let n = 0;
    for (const c of kid.cells) if (c.fired > kid.t - 200) n++;
    return n;
  },
};

module.exports = { episode, branchRun, RULES, drift, DERIVE };

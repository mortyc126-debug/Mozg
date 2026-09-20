'use strict';
/* ============================================================
   СРЕДА, ГДЕ ДЕФИЦИТЕН ТАКТ

   Замысел. В цифровой среде память бесплатна, расстояние бесплатно,
   копирование бесплатно. Конечно ровно одно -- ВЫЧИСЛЕНИЕ. Значит и
   дефицит надо строить там, где он настоящий, а не изображать голод,
   которого нет.

   У мира есть общий бюджет тактов на круг. Части зарабатывают такты по
   объявленному правилу и тратят их на собственные обновления. Кто не
   заработал -- ЗАМИРАЕТ. Не гибнет: замороженная часть сохраняется
   целиком и может продолжить. Гибель уничтожает запись и делает
   сравнение невозможным; замирание -- цифровая роскошь, у вещества её
   нет.

   ЧАСТИ СВЯЗАНЫ. Иначе это не мир, а N независимых счётчиков, и дележ
   ничего не решает. Каждая часть читает состояния соседей по разрежённому
   графу; замершая часть перестаёт меняться, но продолжает быть ВИДИМОЙ
   соседям -- она не исчезает, она стоит.

   ЧЕГО ЗДЕСЬ НАРОЧНО НЕТ. Ни клеток, ни химии, ни механики, ни
   пластичности. Если расслоение скоростей появится, оно обязано
   появиться из дефицита, а не из унаследованной машинерии.

   ПРАВИЛА НАЧИСЛЕНИЯ -- НАШИ, И ИХ ДВА ПРОТИВОПОЛОЖНЫХ. Как ни поверни,
   правило придумываем мы. Самое скромное, что можно сделать, -- взять
   два противоположных и сделать их сравнение самим опытом:
     изменчивость -- начислять тем, чьё состояние менялось сильнее;
     устойчивость -- начислять тем, чьё состояние менялось слабее;
     жребий       -- пустой отсчёт.

   ПЕРЕНОС ОСТАТКА. Кредит дробный: часть исполняет floor(credit)
   обновлений, дробь остаётся. Поэтому слабо зарабатывающая часть не
   исключена навсегда -- она просто идёт МЕДЛЕННЕЕ. Расслоение здесь
   означает устойчивую разницу СКОРОСТЕЙ, а не вечное отлучение.
   ============================================================ */
const { makeRNG } = require('../src/rng');

const K = 8;                 // длина состояния части

function createTickWorld(opt = {}) {
  const n = opt.n || 64;
  const deg = opt.deg || 3;
  const budget = opt.budget !== undefined ? opt.budget : n;   // тактов на круг
  const rnd = makeRNG(opt.seed || 1);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const x = new Float64Array(K);
    for (let k = 0; k < K; k++) x[k] = rnd() * 2 - 1;
    parts.push({
      i, x, prev: Float64Array.from(x),
      credit: 0, steps: 0, rounds: 0, frozen: 0,
      nb: [], delta: 0,
    });
  }
  // разрежённый граф: каждой части deg соседей, выбранных один раз
  for (const p of parts) {
    while (p.nb.length < deg) {
      const j = Math.floor(rnd() * n);
      if (j !== p.i && !p.nb.includes(j)) p.nb.push(j);
    }
  }
  return {
    n, deg, budget, rnd, parts, round: 0,
    mix: opt.mix !== undefined ? opt.mix : 0.25,
    noise: opt.noise !== undefined ? opt.noise : 0.02,
    given: 0,                        // сколько кредита роздано всего
  };
}

/* одно обновление одной части: смесь себя, соседей и шума */
function updatePart(w, p) {
  const nx = new Float64Array(K);
  for (let k = 0; k < K; k++) {
    let s = 0;
    for (const j of p.nb) s += w.parts[j].x[k];
    s /= p.nb.length;
    nx[k] = Math.tanh((1 - w.mix) * p.x[k] + w.mix * s + w.noise * (w.rnd() * 2 - 1));
  }
  p.prev.set(p.x);
  p.x.set(nx);
  p.steps++;
}

/* насколько часть изменилась за последнее своё обновление */
function delta(p) {
  let s = 0;
  for (let k = 0; k < K; k++) s += Math.abs(p.x[k] - p.prev[k]);
  return s / K;
}

/* --- правила начисления. Возвращают вес части; веса нормируются. --- */
const EARN = {
  изменчивость: (p) => p.delta + 1e-9,
  устойчивость: (p) => 1 / (p.delta + 1e-3),
  жребий: (p, w) => w.rnd(),
  поровну: () => 1,
};

/* один круг: раздать бюджет, затем исполнить оплаченное */
function round(w, earn) {
  let sum = 0;
  const wts = w.parts.map((p) => { const v = earn(p, w); sum += v; return v; });
  if (!(sum > 0)) { for (let i = 0; i < w.n; i++) wts[i] = 1; sum = w.n; }
  for (let i = 0; i < w.n; i++) {
    w.parts[i].credit += w.budget * wts[i] / sum;
    w.given += w.budget * wts[i] / sum;
  }
  // исполнение: порядок фиксирован, состояния соседей читаются по ходу
  for (const p of w.parts) {
    const take = Math.floor(p.credit);
    if (take <= 0) { p.frozen++; p.rounds++; continue; }
    for (let s = 0; s < take; s++) updatePart(w, p);
    p.credit -= take;
    p.delta = delta(p);
    p.rounds++;
  }
  w.round++;
}

function run(w, rounds, earnName) {
  const earn = EARN[earnName];
  if (!earn) throw new Error(`нет правила начисления: ${earnName}`);
  for (let r = 0; r < rounds; r++) round(w, earn);
  return w;
}

/* отпечаток состояния -- для сверок */
function fingerprint(w) {
  const out = [`round=${w.round}`, `given=${w.given.toFixed(9)}`];
  for (const p of w.parts)
    out.push(`${p.i}:${Array.from(p.x).map((v) => v.toFixed(12)).join(',')}` +
      `|${p.steps}|${p.frozen}|${p.credit.toFixed(9)}`);
  return out.join('\n');
}

/* скорость части: обновлений на круг */
const speed = (p) => (p.rounds ? p.steps / p.rounds : 0);

module.exports = { createTickWorld, run, round, EARN, fingerprint, speed, updatePart, K };

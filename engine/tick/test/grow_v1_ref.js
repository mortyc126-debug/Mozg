#!/usr/bin/env node
'use strict';
/* ЭТАЛОН -- НЕ ПРАВИТЬ, НЕ УДАЛЯТЬ.
   Первая редакция grow.js, дословно из коммита 2665d1d. Нужна только
   для test/grow_identity.js: тождество при нуле сверяется с реальным
   прежним кодом, а не с пересказом его поведения. Изменена одна строка
   -- путь к rng, потому что файл лежит на уровень глубже. */
/* ============================================================
   ЗАЧАТОК НА БЮДЖЕТЕ ТАКТОВ -- ЧЕРНОВИК

   Не опыт. Правил чтения не объявлено, вердиктов не будет, числа ниже --
   описание того, что вышло, а не установленный факт. Сделано по просьбе:
   посмотреть, что вырастет, не доводя среду до ума.

   ЗАМЫСЕЛ. Всё стоит тактов, а такты идут ТОМУ, КОГО ЧИТАЮТ.

   Никакой цели никто не назначает. Но чтение стоит читающему, значит
   читать кого попало накладно; а кого читают -- тот получает такты и
   может больше делать. Так появляется внутренняя валюта, не завезённая
   извне: внимание.

   ЧТО ЗДЕСЬ ЦИФРОВОГО, А НЕ БИОЛОГИЧЕСКОГО:
     * бюджет ФИКСИРОВАН, а частей становится больше -- рост сам себя
       ограничивает, тесноту создавать не надо;
     * адреса без расстояния: связаться можно с кем угодно, даром;
     * память бесплатна, а ЧТЕНИЕ стоит -- поэтому забывание есть выбор,
       а не поломка;
     * правила -- данные: у части свои числа, и потомок наследует их с
       отклонением;
     * кто не платит -- ЗАМИРАЕТ, а не гибнет.

   ЦЕНЫ (взяты с потолка, это черновик):
     обновиться      1
     прочесть одного 0.5
     связаться       5
     разделиться     20
   ============================================================ */
const { makeRNG } = require('../../src/rng');

const K = 6;                       // длина состояния части
const BUDGET = 200;                // тактов на круг, ФИКСИРОВАН
const C_UPDATE = 1, C_READ = 0.5, C_LINK = 5, C_DIVIDE = 20;
const BASE_SHARE = process.env.BASE !== undefined ? +process.env.BASE : 0.5;
const MAX_PARTS = 400;
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
  return { id, x, par, links: [], credit: 0, read: 0, readPrev: 0,
    steps: 0, frozen: 0, born: 0, kids: 0 };
}
const clamp01 = (v) => (v < 0.02 ? 0.02 : v > 0.98 ? 0.98 : v);

function createSeed(seed) {
  const rnd = makeRNG(seed);
  const w = { rnd, round: 0, parts: [], nextId: 0, log: [] };
  w.parts.push(makePart(w.nextId++, rnd, null));
  return w;
}

function round(w) {
  const P = w.parts;

  // 1) начисление: доля пропорциональна тому, сколько тебя читали
  let sum = 0;
  for (const p of P) sum += p.readPrev + BASE_SHARE;
  for (const p of P) p.credit += BUDGET * (p.readPrev + BASE_SHARE) / sum;
  for (const p of P) { p.readPrev = p.read; p.read = 0; }

  // 2) действия. Порядок фиксирован; состояния читаются по ходу.
  const newborns = [];
  for (const p of P) {
    if (p.credit < C_UPDATE) { p.frozen++; continue; }

    // кого читать: из своих связей, по новизне -- насколько чужое
    // состояние непохоже на собственное. Мера внутренняя, цели не знает.
    let budgetLeft = p.credit - C_UPDATE;
    const cand = p.links
      .map((i) => w.parts[i])
      .filter(Boolean)
      .map((o) => ({ o, novelty: dist(p.x, o.x) }))
      .sort((a, b) => b.novelty - a.novelty);
    const wantReads = Math.min(MAX_READS, Math.floor(p.par.greed * MAX_READS) + 1);
    const got = [];
    for (const c of cand) {
      if (got.length >= wantReads || budgetLeft < C_READ) break;
      budgetLeft -= C_READ;
      c.o.read++;                       // прочитанный зарабатывает
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
    p.x.set(nx);
    p.credit = budgetLeft;
    p.steps++;

    // 4) связаться -- адрес без расстояния, с кем угодно
    if (p.credit >= C_LINK && w.rnd() < p.par.urge * 0.25) {
      const j = Math.floor(w.rnd() * P.length);
      if (j !== p.id && !p.links.includes(j)) { p.links.push(j); p.credit -= C_LINK; }
    }
    // 5) разделиться
    if (p.credit >= C_DIVIDE && P.length + newborns.length < MAX_PARTS
        && w.rnd() < p.par.urge * 0.5) {
      p.credit -= C_DIVIDE;
      const kid = makePart(w.nextId, w.rnd, p);
      kid.born = w.round;
      kid.links.push(p.id);
      newborns.push(kid);
      p.links.push(w.nextId);
      p.kids++;
      w.nextId++;
    }
  }
  for (const k of newborns) w.parts.push(k);
  w.round++;
}

function dist(a, b) {
  let s = 0;
  for (let k = 0; k < K; k++) s += Math.abs(a[k] - b[k]);
  return s / K;
}

function run(seed, rounds) {
  const w = createSeed(seed);
  for (let r = 0; r < rounds; r++) {
    round(w);
    if (r % 200 === 199) w.log.push(snapshot(w));
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
  const frozen = P.filter((p) => p.frozen > 0 && p.steps === 0).length;
  const deg = P.map((p) => p.links.length);
  return {
    round: w.round, n: P.length,
    читают_верхние10: top10,
    разброс_правил: spread,
    немые: frozen,
    связей_на_часть: deg.reduce((a, b) => a + b, 0) / P.length,
    наиб_читаемый: reads[0] || 0,
  };
}

module.exports = { createSeed, round, run, snapshot, BUDGET, MAX_PARTS };

if (require.main === module) {
  const rounds = +(process.argv[2] || 2000);
  console.log('ЗАЧАТОК НА БЮДЖЕТЕ ТАКТОВ -- ЧЕРНОВИК');
  console.log(`бюджет ${BUDGET} тактов на круг (фиксирован), начинаем с одной части`);
  console.log(`цены: обновиться ${C_UPDATE}, прочесть ${C_READ}, связаться ${C_LINK}, разделиться ${C_DIVIDE}\n`);
  for (const seed of [1, 2, 3]) {
    const w = run(seed, rounds);
    console.log(`--- сид ${seed} ---`);
    console.log(' круг | частей | верх.10% чтений | разброс правил | связей | наиб.читаемый | немых');
    for (const s of w.log)
      console.log(`${String(s.round).padStart(5)} | ${String(s.n).padStart(6)} | ` +
        `${(s.читают_верхние10 * 100).toFixed(1).padStart(14)}% | ${s.разброс_правил.toFixed(4).padStart(14)} | ` +
        `${s.связей_на_часть.toFixed(2).padStart(6)} | ${String(s.наиб_читаемый).padStart(13)} | ${String(s.немые).padStart(5)}`);
  }
}

'use strict';
/* ============================================================
   ГЕНОМ
   В движке нет ни одного гена с ролью. Ген — это правило:
     target = sigmoid(act·in) * (1 - sigmoid(rep·in))
   плюс вектор эффекторов: во что экспрессия этого гена превращается.
   Все роли ("сигнал", "связь", "чувствительность") — это ненулевые
   числа в эффекторах, а не сущности кода.
   ============================================================ */

const NF = 6;      // полей среды: 0..2 секретируемые, 3 ресурс, 4 внешний стимул, 5 неподвижный градиент
const NSEC = 3;    // сколько из них агент может выделять
const G = 6;       // генов в геноме

/* раскладка входов регуляторной сети */
const IN_FIELD = 0;              // 0..NF-1
const IN_NB = NF;                // плотность окружения
const IN_ENERGY = NF + 1;        // запас энергии
const IN_EXC = NF + 2;           // собственное возбуждение
const IN_GENE = NF + 3;          // NF+3 .. NF+2+G — собственная экспрессия
const NIN = NF + 3 + G;          // индекс смещения (bias)
const VLEN = NIN + 1;

function row(pairs, bias) {
  const v = new Float64Array(VLEN);
  for (const [i, x] of pairs) v[i] = x;
  v[NIN] = bias;
  return v;
}

function emptyEffector() {
  return {
    sec: new Float64Array(NSEC),   // выделение в поля
    sens: new Float64Array(NF),    // перевод поля в возбуждение
    adh: 0,                        // вклад в липкость
    mot: 0,                        // вклад в подвижность
    div: 0,                        // вклад в стоимость деления
    link: 0,                       // склонность образовывать связь
    reach: 0,                      // прибавка к дальности связи
    pol: 0,                        // использование локальной асимметрии окружения
  };
}

/* --- исходный геном. Подобран вручную: это демонстратор, а не результат отбора.
   Ниже нет ни одного имени роли — только веса. --- */
function ancestral() {
  const eff = [];
  for (let i = 0; i < G; i++) eff.push(emptyEffector());
  eff[0].sec[0] = 0.16;
  eff[1].sec[1] = 0.16;
  eff[2].adh = 0.15; eff[2].mot = 0.10; eff[2].div = 0.25;
  eff[3].sec[2] = 0.10; eff[3].adh = 2.60; eff[3].mot = -0.18; eff[3].div = 0.85;
  eff[4].adh = 0.30; eff[4].div = 0.50; eff[4].link = 1.00;
  eff[5].adh = 0.50; eff[5].mot = -0.05; eff[5].div = 0.60; eff[5].sens[4] = 1.00; eff[5].reach = 2.20;

  return {
    nGenes: G,
    rate: 0.045,
    act: [
      row([[5, 12], [9, 0.6]], -6.0),
      row([[5, -12], [10, 0.6]], 5.7),
      row([[0, 20]], -13.2),
      row([[11, 7.0], [12, 1.0]], -4.2),
      row([[2, 7], [12, 2.5], [14, 7.0]], -4.2),
      row([[0, 14], [1, 14], [14, 2.0]], -14.5),
    ],
    rep: [
      row([], -8),
      row([[0, 6]], -4.6),
      row([[1, -20]], 9.6),
      row([], -8),
      row([], -8),
      row([[6, 24], [11, 10], [12, 10]], -17),
    ],
    eff,
  };
}

function clone(g) {
  return {
    nGenes: g.nGenes,
    rate: g.rate,
    act: g.act.map((v) => Float64Array.from(v)),
    rep: g.rep.map((v) => Float64Array.from(v)),
    eff: g.eff.map((e) => ({
      sec: Float64Array.from(e.sec), sens: Float64Array.from(e.sens),
      adh: e.adh, mot: e.mot, div: e.div, link: e.link, reach: e.reach, pol: e.pol,
    })),
  };
}

/* --- мутация: случайное изменение правил, без оглядки на итоговую форму --- */
function mutate(g0, rnd, opt = {}) {
  const g = clone(g0);
  const pW = opt.pWeight !== undefined ? opt.pWeight : 0.06;   // доля изменяемых весов
  const sW = opt.sWeight !== undefined ? opt.sWeight : 2.2;    // разброс изменения веса
  const pE = opt.pEff !== undefined ? opt.pEff : 0.10;         // доля изменяемых эффекторов
  const pKO = opt.pKO !== undefined ? opt.pKO : 0.05;          // выключение гена целиком

  for (let i = 0; i < g.nGenes; i++) {
    for (const v of [g.act[i], g.rep[i]]) {
      for (let k = 0; k < VLEN; k++) if (rnd() < pW) v[k] += rnd.normal() * sW;
    }
    const e = g.eff[i];
    for (let k = 0; k < NSEC; k++) if (rnd() < pE) e.sec[k] = Math.max(0, e.sec[k] + rnd.normal() * 0.10);
    for (let k = 0; k < NF; k++) if (rnd() < pE) e.sens[k] = Math.max(0, e.sens[k] + rnd.normal() * 0.5);
    if (rnd() < pE) e.adh = Math.max(0, e.adh + rnd.normal() * 0.8);
    if (rnd() < pE) e.mot = e.mot + rnd.normal() * 0.12;
    if (rnd() < pE) e.div = Math.max(0, e.div + rnd.normal() * 0.35);
    if (rnd() < pE) e.link = Math.max(0, e.link + rnd.normal() * 0.6);
    if (rnd() < pE) e.reach = Math.max(0, e.reach + rnd.normal() * 1.2);
    if (rnd() < pE) e.pol = Math.max(0, e.pol + rnd.normal() * 0.4);
    if (rnd() < pKO) g.act[i][NIN] -= 20;            // ген замолкает
  }
  if (rnd() < 0.15) g.rate = Math.max(0.005, g.rate + rnd.normal() * 0.015);
  return g;
}

/* --- полностью случайный геном: контроль для сравнения с мутантами --- */
function randomGenome(rnd) {
  const g = ancestral();
  for (let i = 0; i < g.nGenes; i++) {
    for (const v of [g.act[i], g.rep[i]]) {
      for (let k = 0; k < VLEN; k++) v[k] = rnd() < 0.20 ? rnd.normal() * 8 : 0;
      v[NIN] = rnd.normal() * 6;
    }
    const e = g.eff[i];
    for (let k = 0; k < NSEC; k++) e.sec[k] = rnd() < 0.3 ? rnd() * 0.2 : 0;
    for (let k = 0; k < NF; k++) e.sens[k] = rnd() < 0.2 ? rnd() * 1.5 : 0;
    e.adh = rnd() < 0.5 ? rnd() * 2.5 : 0;
    e.mot = rnd() < 0.4 ? (rnd() - 0.5) * 0.4 : 0;
    e.div = rnd() < 0.5 ? rnd() : 0;
    e.link = rnd() < 0.4 ? rnd() * 1.5 : 0;
    e.reach = rnd() < 0.3 ? rnd() * 3 : 0;
    e.pol = rnd() < 0.3 ? rnd() : 0;
  }
  return g;
}

module.exports = {
  NF, NSEC, G, NIN, VLEN, IN_FIELD, IN_NB, IN_ENERGY, IN_EXC, IN_GENE,
  row, ancestral, clone, mutate, randomGenome,
};

#!/usr/bin/env node
'use strict';
/* СЛОЙ В ТОЙ КОНФИГУРАЦИИ, ДЛЯ КОТОРОЙ ПИСАЛОСЬ ОБЪЯСНЕНИЕ ЗНАКА

   Объяснение направления изгиба в этапе 13 построено на bodyRadii:
   локальная асимметрия делает одну точку агента крупнее другой, полоса
   становится толще со стороны -q, биметалл гнётся к тонкой стороне,
   то есть к +q. Объяснение подтверждено сконструированным тестом
   test/bend_sign.js из 8 проверок, и тест верен.

   Но bodyRadii вызывается только из physicsTwoPoint, то есть при
   twoPoint = true, а НИ ОДИН прогон со слоем этого не задавал: ни
   layer.js этапа 5, ни layer_elastic.js, ни grad_ref.js, ни
   q_intervene.js. Проверено прямо: в конфигурации слоя two = false,
   вторая точка агента вырождена (p1 и p2 совпадают до последнего
   разряда), формы у него нет. Работала модуляция равновесного
   расстояния в physicsPoint. Объяснение относилось к невыполнявшемуся
   коду.

   Здесь вопрос о направлении задаётся ТАМ, ГДЕ ОБЪЯСНЕНИЕ ПРИМЕНИМО:
   слой с twoPoint = true и align = 1, то есть у агента есть форма, а у
   ориентации -- память (как в прогонах с пластом, этапы 8-12).

   Ветки те же, что в q_intervene.js, вмешательство удерживаемое (через
   w.onOrient, между обновлением ориентации и физикой):
     A -- без вмешательства;
     B -- разворот q на 180 с шага 50;
     C -- то же с шага 1350 (контроль специфичности);
     D -- поворот q на 90 с шага 50.

   ПРАВИЛО ЧТЕНИЯ, объявлено до запуска. Объяснение через bodyRadii
   предсказывает изгиб К +q, поэтому:
     * согласованность знака относительно собственного q должна быть
       не ниже 5/6 (20 из 24, 10 из 12);
     * разворот q должен ПЕРЕВОРАЧИВАТЬ сторону не реже 5/6, и при этом
       поздний контроль C -- не чаще 1/6;
     * превышение доли переворотов B над веткой D должно быть не менее
       0.4 (D -- возмущение сопоставимой силы, знак не переворачивающее).
   Выполнено всё три -- объяснение верно в своей конфигурации, и тогда
   расхождение этапа 13 объясняется целиком выбором конфигурации.
   Не выполнено хотя бы одно -- объяснение не работает и там, и его
   надо снимать не как "применённое не к тому прогону", а как неверное.

   ЦЕЛОСТНОСТЬ ОБЯЗАТЕЛЬНА К ПРОВЕРКЕ: если слой в этой конфигурации
   рассыпается, знак прогиба мерить не на чем. Выводится среднее число
   соседей и отношение прогиб/остаток; при отношении ниже единицы
   результат не читается вовсе -- это облако, а не дуга.

   Запуск: node experiment/layer_two.js [сиды] [толщины]
*/
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const STEPS = 1400, STRENGTH = 0.35, GENES = [0, 1];
const EARLY = 50, LATE = 1350;
const ALL = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808];
const SEEDS = (process.argv[2] || ALL.join(',')).split(',').map(Number);
const ROWS = (process.argv[3] || '1').split(',').map(Number);

/* подгонка параболы относительно опоры refx,refy.
   Возвращает коэффициент (знак -- сторона, модуль -- величина), прогиб и
   остаток подгонки: у дуги агенты лежат НА кривой, у облака нет. */
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
  if (refx * vx + refy * vy < 0) { vx = -vx; vy = -vy; }
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
    if (Math.abs(M[pi][i]) < 1e-12) return { a: 0, sag: 0, rms: 0 };
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
  return { a, sag: Math.abs(a) * L * L / 4, rms: Math.sqrt(ss / n), len: L };
}

function meanQ(cells) {
  let ax = 0, ay = 0;
  for (const c of cells) { ax += c.qx; ay += c.qy; }
  const al = Math.hypot(ax, ay) || 1;
  return [ax / al, ay / al];
}

function meanNb(cells) {
  let s = 0;
  for (const c of cells) s += c.nb;
  return s / cells.length;
}

/* mode: null | 'flip' | 'rot'; вмешательство удерживается с шага from */
function run(seed, rows, mode, from) {
  const per = 60, n0 = per * rows;
  const g = ancestral();
  for (const gi of GENES) g.eff[gi].pol = 1;
  const w = createWorld({
    seed, genome: g, init: 'layer', layerLength: per, layerRows: rows,
    params: { polarity: STRENGTH, maxCells: n0, gradient: 1.0,
              junctionAdhesion: 1, junction: 0.1,
              twoPoint: true, align: 1, alignSelf: 1, alignRate: 0.10 },
  });
  if (w.two !== true) throw new Error('конфигурация не двухточечная');
  if (mode) w.onOrient = (ww) => {
    if (ww.t < from) return;
    if (mode === 'flip') for (const c of ww.cells) { c.qx = -c.qx; c.qy = -c.qy; }
    else for (const c of ww.cells) { const t = c.qx; c.qx = -c.qy; c.qy = t; }
  };
  for (let i = 0; i < STEPS; i++) step(w);
  const [qx, qy] = meanQ(w.cells);
  const gx = Math.cos(w.theta), gy = Math.sin(w.theta);
  return {
    qx, qy,
    byQ: fit(w.cells, qx, qy).a,          // знак относительно СОБСТВЕННОГО q
    lab: fit(w.cells, gx, gy),            // в неподвижной рамке: сравнение веток
    nb: meanNb(w.cells),
  };
}

for (const rows of ROWS) {
  let byQ = 0, flipB = 0, flipC = 0, flipD = 0, sameB = 0, nOk = 0;
  let nbA = 0, ratio = 0, mA = 0, mB = 0, mD = 0;
  const lines = [];
  for (const seed of SEEDS) {
    const A = run(seed, rows, null, 0);
    const B = run(seed, rows, 'flip', EARLY);
    const C = run(seed, rows, 'flip', LATE);
    const D = run(seed, rows, 'rot', EARLY);
    if (A.byQ > 0) byQ++;
    if (B.lab.a === A.lab.a) sameB++;
    const fB = Math.sign(B.lab.a) !== Math.sign(A.lab.a);
    const fC = Math.sign(C.lab.a) !== Math.sign(A.lab.a);
    const fD = Math.sign(D.lab.a) !== Math.sign(A.lab.a);
    if (fB) flipB++;
    if (fC) flipC++;
    if (fD) flipD++;
    nbA += A.nb; ratio += A.lab.rms > 0 ? A.lab.sag / A.lab.rms : 0;
    mA += Math.abs(A.lab.a); mB += Math.abs(B.lab.a); mD += Math.abs(D.lab.a);
    nOk++;
    lines.push(`  сид ${String(seed).padStart(4)}  к +q ${A.byQ > 0 ? 'да ' : 'нет'}  прогиб/остаток ${(A.lab.rms > 0 ? A.lab.sag / A.lab.rms : 0).toFixed(2).padStart(5)}  соседей ${A.nb.toFixed(2)}   B ${fB ? 'перевернулся' : '   тот же   '}  C ${fC ? 'перевернулся' : '   тот же   '}  D ${fD ? 'перевернулся' : '   тот же   '}`);
  }
  console.log(`\n=== слой ${rows}, ДВУХТОЧЕЧНЫЙ агент, align = 1, ${nOk} сидов ===`);
  for (const l of lines) console.log(l);
  console.log(`  целостность: соседей в среднем ${(nbA / nOk).toFixed(2)};  прогиб/остаток ${(ratio / nOk).toFixed(2)} ${ratio / nOk > 1 ? '(дуга)' : '(ОБЛАКО -- знак не читается)'}`);
  console.log(`  сидов, где B совпал с A ТОЧНО (признак неработающего вмешательства): ${sameB} из ${nOk}`);
  console.log(`  изгиб в сторону +q: ${byQ} из ${nOk}   (порог 5/6 = ${Math.ceil(nOk * 5 / 6)})`);
  console.log(`  средний |прогиб|: A ${(mA / nOk).toExponential(3)}   B ${(mB / nOk).toExponential(3)}   D ${(mD / nOk).toExponential(3)}`);
  console.log(`  знак перевернулся: B ${flipB} из ${nOk} (доля ${(flipB / nOk).toFixed(2)});  C ${flipC} из ${nOk};  D ${flipD} из ${nOk} (доля ${(flipD / nOk).toFixed(2)});  превышение B над D ${((flipB - flipD) / nOk).toFixed(2)} (порог 0.40)`);
}

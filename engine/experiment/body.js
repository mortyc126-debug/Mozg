#!/usr/bin/env node
'use strict';
/* ============================================================
   ЭТАП B: изолированная механика агента
   Проверяется не ткань, а сам примитив. Три вопроса:
     B1 — сохраняет ли двухточечный агент свою протяжённость;
     B2 — меняет ли он форму при асимметричном окружении;
     B3 — остаётся ли он симметричным при симметричном окружении.
   Для сравнения та же расстановка проигрывается точечным агентом.
   ============================================================ */
const W = require('../src/world');
const { ancestral } = require('../src/genome');

/* геном для механического теста: один ген, включён всегда, ничего не делает,
   кроме того что даёт агенту использовать локальную асимметрию */
function mechGenome(pol) {
  const g = ancestral();
  for (let i = 0; i < g.nGenes; i++) {
    g.act[i].fill(0); g.rep[i].fill(0);
    g.act[i][g.act[i].length - 1] = i === 0 ? 10 : -10;   // ген 0 всегда включён, прочие молчат
    g.rep[i][g.rep[i].length - 1] = -10;
    const e = g.eff[i];
    e.sec.fill(0); e.sens.fill(0);
    e.adh = 0; e.mot = 0; e.div = 0; e.link = 0; e.reach = 0; e.pol = 0;
  }
  g.eff[0].pol = pol;
  g.rate = 0.5;
  return g;
}

function makeWorld(two, pol, layout) {
  const w = W.createWorld({
    seed: 5, genome: mechGenome(pol),
    params: {
      twoPoint: two, polarity: pol ? 0.35 : 0,
      maxCells: 400, minPopulation: 0, divisionRate: 0, resourceRegen: 0.15,
    },
  });
  w.cells = [];
  for (const [x, y] of layout) {
    const c = W.newCell(x, y, w.rnd, w.nGenes);
    if (two) W.spawnBody(w, c, w.rnd);
    w.cells.push(c);
  }
  return w;
}

const bodyLen = (c) => Math.hypot(c.p2x - c.p1x, c.p2y - c.p1y);
const cx = W.WW / 2, cy = W.WH / 2, D = 7.2;

/* --- B1: одиночный агент --- */
{
  const w = makeWorld(true, 0, [[cx, cy]]);
  const l0 = bodyLen(w.cells[0]);
  for (let i = 0; i < 500; i++) W.step(w);
  const l1 = bodyLen(w.cells[0]);
  const drift = Math.hypot(w.cells[0].x - cx, w.cells[0].y - cy);
  console.log(`B1 одиночный агент: длина тела ${l0.toFixed(2)} → ${l1.toFixed(2)} ` +
    `(отклонение ${(100 * Math.abs(l1 - l0) / l0).toFixed(1)}%), смещение центра ${drift.toFixed(2)}`);
}

/* --- B2: соседи только с одной стороны --- */
{
  const layout = [[cx, cy]];
  for (let k = -2; k <= 2; k++) layout.push([cx + k * D, cy + D]);          // ряд снизу
  for (let k = -2; k <= 2; k++) layout.push([cx + k * D, cy + 2 * D]);
  for (const [name, two, pol] of [['точечный', false, 1], ['двухточечный без полярности', true, 0], ['двухточечный', true, 1]]) {
    const w = makeWorld(two, pol, layout);
    const c = w.cells[0];
    const x0 = c.x, y0 = c.y;
    for (let i = 0; i < 400; i++) W.step(w);
    const drift = Math.hypot(c.x - x0, c.y - y0);
    const shape = two ? `радиусы ${c.r1.toFixed(2)} / ${c.r2.toFixed(2)} (разница ${(100 * Math.abs(c.r1 - c.r2) / ((c.r1 + c.r2) / 2)).toFixed(0)}%), длина тела ${bodyLen(c).toFixed(2)}` : 'формы нет';
    console.log(`B2 ${name.padEnd(28)}: асимметрия ${c.amag.toFixed(2)}, смещение ${drift.toFixed(2)}, ${shape}`);
  }
}

/* --- B3: соседи со всех сторон --- */
{
  const layout = [[cx, cy]];
  for (let a = 0; a < 6; a++) layout.push([cx + Math.cos(a / 6 * 2 * Math.PI) * D, cy + Math.sin(a / 6 * 2 * Math.PI) * D]);
  for (const [name, two, pol] of [['точечный', false, 1], ['двухточечный', true, 1]]) {
    const w = makeWorld(two, pol, layout);
    const c = w.cells[0];
    const x0 = c.x, y0 = c.y;
    for (let i = 0; i < 400; i++) W.step(w);
    const drift = Math.hypot(c.x - x0, c.y - y0);
    const shape = two ? `разница радиусов ${(100 * Math.abs(c.r1 - c.r2) / ((c.r1 + c.r2) / 2)).toFixed(0)}%` : 'формы нет';
    console.log(`B3 ${name.padEnd(28)}: асимметрия ${c.amag.toFixed(2)}, смещение ${drift.toFixed(2)}, ${shape}`);
  }
}

#!/usr/bin/env node
'use strict';
/* ============================================================
   ЭКСПЕРИМЕНТ: деформация, ограниченная одним состоянием
   Новых механизмов нет. Используется то, что эффектор pol принадлежит гену,
   а не миру: деформироваться может лишь носитель определённого состояния.

   Проверяется не наличие кривизны, а её пространственная привязка:
     внутри участка   — деформация;
     на его границе   — наибольший перепад деформации;
     вне участка      — деформация заметно меньше;
   и совпадает ли положение наибольшей кривизны границы ткани
   с положением границы участка.

   Запуск: node experiment/patch.js [ген|-] [сиды]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { createWorld, step } = require('../src/world');
const { ancestral } = require('../src/genome');

const ALL = [5, 77, 2024, 9, 101, 202, 303, 404, 505, 606, 707, 808];
const GENE = process.argv[2] === '-' ? null : +(process.argv[2] || 5);
const SEEDS = (process.argv[3] || ALL.join(',')).split(',').map(Number);
const NB = 36, STEP = 360 / NB;

function analyse(w, gene) {
  const surf = w.cells.filter((c) => c.nb <= 5);
  let cx = 0, cy = 0;
  for (const c of w.cells) { cx += c.x / w.cells.length; cy += c.y / w.cells.length; }
  const bins = Array.from({ length: NB }, () => ({ r: [], e: [], d: [] }));
  for (const c of surf) {
    const a = Math.atan2(c.y - cy, c.x - cx) + Math.PI;
    const i = Math.min(NB - 1, Math.floor(a / (2 * Math.PI) * NB));
    bins[i].r.push(Math.hypot(c.x - cx, c.y - cy));
    bins[i].e.push(gene === null ? 0 : c.e[gene]);
    bins[i].d.push(Math.abs(c.r1 - c.r2) / ((c.r1 + c.r2) / 2 || 1));
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const R = bins.map((b) => mean(b.r)), E = bins.map((b) => mean(b.e)), D = bins.map((b) => mean(b.d));
  // пустые сектора заполняем соседями по кругу
  for (let k = 0; k < NB; k++) {
    if (R[k] !== null) continue;
    let a = k, b = k;
    while (R[(a + NB - 1) % NB] === null) a--;
    while (R[(b + 1) % NB] === null) b++;
    R[k] = (R[(a + NB - 1) % NB] + R[(b + 1) % NB]) / 2;
    E[k] = (E[(a + NB - 1) % NB] + E[(b + 1) % NB]) / 2;
    D[k] = (D[(a + NB - 1) % NB] + D[(b + 1) % NB]) / 2;
  }
  // кривизна границы: вторая круговая разность радиуса. Отрицательная — вдавливание
  const K = R.map((_, i) => R[(i + NB - 1) % NB] + R[(i + 1) % NB] - 2 * R[i]);
  // границы участка: сектора, где экспрессия переходит через 0.5
  const edges = [];
  for (let i = 0; i < NB; i++) {
    const a = E[i], b = E[(i + 1) % NB];
    if ((a - 0.5) * (b - 0.5) < 0) edges.push(i);
  }
  const zone = (i) => {
    let dist = NB;
    for (const e of edges) dist = Math.min(dist, Math.min(Math.abs(i - e), NB - Math.abs(i - e)));
    if (dist <= 1) return 'граница';
    return E[i] > 0.5 ? 'внутри' : 'снаружи';
  };
  const by = { 'внутри': [], 'граница': [], 'снаружи': [] };
  const byK = { 'внутри': [], 'граница': [], 'снаружи': [] };
  for (let i = 0; i < NB; i++) { by[zone(i)].push(D[i]); byK[zone(i)].push(Math.abs(K[i])); }
  // где кривизна наибольшая по модулю и далеко ли это от границы участка
  let bi = 0;
  for (let i = 1; i < NB; i++) if (Math.abs(K[i]) > Math.abs(K[bi])) bi = i;
  let distToEdge = null;
  if (edges.length) {
    distToEdge = NB;
    for (const e of edges) distToEdge = Math.min(distToEdge, Math.min(Math.abs(bi - e), NB - Math.abs(bi - e)));
    distToEdge *= STEP;
  }
  // ожидание при случайном положении: среднее расстояние до ближайшей из edges.length границ
  const expected = edges.length ? 360 / (4 * edges.length) : null;
  return { by, byK, edges: edges.length, distToEdge, expected, K, E, D };
}

const OUT = path.join(__dirname, '..', 'results', 'patch.jsonl');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
console.log(GENE === null ? 'условие: baseline, деформации нет\n' : `условие: деформация только у носителей гена ${GENE}\n`);
const rows = [];
for (const seed of SEEDS) {
  const g = ancestral();
  if (GENE !== null) g.eff[GENE].pol = 1;
  const w = createWorld({
    seed, genome: g,
    params: { twoPoint: true, align: 1, alignSelf: 1, alignRate: 0.10, polarity: GENE === null ? 0 : 0.35 },
  });
  for (let i = 0; i < 1400; i++) step(w);
  const a = analyse(w, GENE === null ? 0 : GENE);
  const mn = (x) => (x.length ? x.reduce((p, q) => p + q, 0) / x.length : 0);
  const rec = {
    seed, gene: GENE, edges: a.edges,
    dIn: mn(a.by['внутри']), dEdge: mn(a.by['граница']), dOut: mn(a.by['снаружи']),
    kIn: mn(a.byK['внутри']), kEdge: mn(a.byK['граница']), kOut: mn(a.byK['снаружи']),
    dist: a.distToEdge, expected: a.expected,
  };
  rows.push(rec);
  fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
  console.log(`сид ${String(seed).padStart(4)} | границ участка ${rec.edges} | деформация внутри ${(100 * rec.dIn).toFixed(0)}% ` +
    `граница ${(100 * rec.dEdge).toFixed(0)}% снаружи ${(100 * rec.dOut).toFixed(0)}% | ` +
    `перепад радиуса внутри ${rec.kIn.toFixed(2)} граница ${rec.kEdge.toFixed(2)} снаружи ${rec.kOut.toFixed(2)} | ` +
    `до границы участка ${rec.dist === null ? '—' : rec.dist.toFixed(0) + '°'} (случайно ожидалось ${rec.expected === null ? '—' : rec.expected.toFixed(0) + '°'})`);
}
const mn = (f) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
console.log('\nсреднее по', rows.length, 'сидам:');
console.log(`  деформация:      внутри ${(100 * mn((r) => r.dIn)).toFixed(0)}% | граница ${(100 * mn((r) => r.dEdge)).toFixed(0)}% | снаружи ${(100 * mn((r) => r.dOut)).toFixed(0)}%`);
console.log(`  перепад радиуса: внутри ${mn((r) => r.kIn).toFixed(2)} | граница ${mn((r) => r.kEdge).toFixed(2)} | снаружи ${mn((r) => r.kOut).toFixed(2)}`);
const ok = rows.filter((r) => r.dist !== null);
if (ok.length) {
  const d = ok.reduce((s, r) => s + r.dist, 0) / ok.length;
  const e = ok.reduce((s, r) => s + r.expected, 0) / ok.length;
  const near = ok.filter((r) => r.dist <= r.expected).length;
  console.log(`  наибольшая кривизна отстоит от границы участка на ${d.toFixed(0)}° при случайном ожидании ${e.toFixed(0)}°; ближе ожидания у ${near} из ${ok.length} сидов`);
}

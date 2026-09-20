#!/usr/bin/env node
'use strict';
/* ============================================================
   ЭКСПЕРИМЕНТ: выключение механизмов
   Проверка причинности. Для каждой стадии развития должен найтись
   механизм, без которого она исчезает. Если стадия сохраняется
   при выключении механизма — механизм не был её причиной.

   Выключения делаются двумя способами:
     - через геном (обнуление эффектора) — механизм есть, но не используется;
     - через параметры мира — механизм выключен в ядре.
   Ядро при этом не меняется.

   Запуск: node experiment/knockout.js [условия через запятую] [сиды]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { createWorld, step } = require('../src/world');
const { measure } = require('../src/measure');
const { ancestral } = require('../src/genome');
const { sites, plasticity } = require('../src/probe');
const { pickDomain } = require('../src/classify');

const STEPS = 1400;

const CONDITIONS = {
  baseline: { desc: 'ничего не выключено' },
  'без градиента': { desc: 'среда однородна: field 5 плоское', params: { gradient: 0 } },
  'без секреции': {
    desc: 'гены 0 и 1 больше не выделяют вещества',
    gene: (g) => { g.eff[0].sec[0] = 0; g.eff[1].sec[1] = 0; },
  },
  'без адгезии': {
    desc: 'ген 3 не повышает липкость',
    gene: (g) => { g.eff[3].adh = 0; },
  },
  'без связей': {
    desc: 'ни у одного гена нет склонности к связям',
    gene: (g) => { for (const e of g.eff) e.link = 0; },
  },
  'без чувствительности': {
    desc: 'ни один ген не переводит поле в возбуждение',
    gene: (g) => { for (const e of g.eff) e.sens.fill(0); },
  },
  'без дальности': {
    desc: 'ген 5 не удлиняет связь',
    gene: (g) => { g.eff[5].reach = 0; },
  },
  'без пластичности': {
    desc: 'веса связей не меняются от активности',
    params: { plasticity: 0 },
  },
};

const conds = (process.argv[2] || Object.keys(CONDITIONS).join(',')).split(',');
const SEEDS = (process.argv[3] || '5,77,2024,9').split(',').map(Number);
const OUT = path.join(__dirname, '..', 'results', 'knockout.jsonl');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

for (const name of conds) {
  const C = CONDITIONS[name];
  if (!C) { console.error('нет такого условия:', name); continue; }
  for (const seed of SEEDS) {
    const g = ancestral();
    if (C.gene) C.gene(g);
    const w = createWorld({ seed, genome: g, params: C.params || {} });
    for (let i = 0; i < STEPS; i++) step(w);
    const m = measure(w);
    const d = pickDomain(m);
    const s = sites(w)[0];
    const exc = s && m.n >= 60 ? plasticity(w, s, 6, 130) : null;
    const rec = {
      condition: name, desc: C.desc, seed,
      population: m.n, states: m.types.length, anisotropy: +m.anis.toFixed(3),
      elongation: d ? +d.elong.toFixed(2) : null,
      inner: d ? +d.inner.toFixed(2) : null,
      domain: d ? d.n : 0,
      compMax: m.net.compMax, links: m.net.links,
      before: exc ? exc.before : null, after: exc ? exc.after : null,
    };
    fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
    console.log(`${name.padEnd(22)} сид ${String(seed).padStart(4)} | агентов ${rec.population} | ` +
      `состояний ${rec.states} | анизотропия ${rec.anisotropy} | вытянутость ${rec.elongation} | ` +
      `внутри ${rec.inner} | сеть ${rec.compMax} | отклик ${rec.before}→${rec.after}`);
  }
}

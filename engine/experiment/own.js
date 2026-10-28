#!/usr/bin/env node
'use strict';
/* ============================================================
   ЖИВЁТ ЛИ ТКАНЬ СВОИМ -- узкий вопрос, свежие сиды

   ОТКУДА. Третья редакция меры (band2.js) показала: полоса между
   молчанием и припадком существует и заселена, 11 живых среди 200
   свежих при пороге 5. Но правило спрашивало только "есть ли активность,
   не молчание и не припадок". Оно НЕ спрашивало, откуда она берётся, и
   среди живых оказались ткани, которым ощущение не нужно вовсе (эхо по
   связям), и ткани, живущие внешним градиентом. Узкое утверждение
   "живёт СВОИМ" по тому прогону дало двоих при пороге 5, то есть
   осталось неразрешённым. Здесь оно спрашивается прямо.

   ЧТО ЗНАЧИТ "СВОИМ". Агенты выделяют в поля 0-2 и кто-то эти поля
   слышит: "выделяю -> слышу своё -> возбуждаюсь". Петля замкнута на
   самой ткани, мир в ней не участвует.

   ПЕТЛЯ ОБЯЗАНА РВАТЬСЯ С ОБОИХ КОНЦОВ -- в этом главное отличие от
   прошлой проверки, которая трогала только слух:

     ГЛУХОТА -- обнуляем sens[0..2]: ткань перестаёт слышать своё поле;
     НЕМОТА  -- обнуляем sec[0..2]: ткань перестаёт его выделять, слух цел.

   Если активность держится петлёй, она обязана погаснуть И в глухоте, И
   в немоте. Если гаснет только от глухоты -- ткань слышит в полях 0-2
   что-то не своё, и петли нет.

   Оба вмешательства делаются ПОСЛЕ роста и не трогают мир: ни поля, ни
   обмен веществ, ни развитие не задеты.

   КОНТРОЛЬ НА ГРУБОСТЬ ВМЕШАТЕЛЬСТВА. Отдельно глушится градиент (поле
   5) -- такой же по величине канал, но ВНЕШНИЙ. Если активность падает
   и от него, значит гаснет от всякой потери входа, а не от разрыва
   петли, и вывод не выносится.

   ПРАВИЛО ЧТЕНИЯ, ОБЪЯВЛЕНО ДО ЗАПУСКА. Падением считается снижение
   доли выстреливших НИЖЕ ПОЛОВИНЫ от "как есть". Для каждой живой ткани:

     ЖИВЁТ СВОИМ   -- глухота роняет И немота роняет И градиент НЕ роняет;
     ЭХО ПО СВЯЗЯМ -- полная глухота НЕ роняет;
     ЖИВЁТ ЧУЖИМ   -- роняет градиент или ресурс, а глухота к своим -- нет;
     НЕ РАЗДЕЛЕНО  -- всё остальное, и это честный исход, не отход.

   ВЕРДИКТ:
     * ПОКАЗАНО, если живущих своим не менее 5;
     * НЕ ПОКАЗАНО, если ни одной;
     * НЕ РАЗРЕШЕНО, если 1-4.
   ПРОВЕРКА СПЕЦИФИЧНОСТИ, тоже заранее: среди живых обязаны найтись и
   такие, что полной глухоты не замечают. Если вмешательство гасит ВСЕХ,
   оно слишком грубое, и вердикт не выносится ни в какую сторону.

   СИДЫ 9500-10099 -- свежие, с прежними (9000-9099) и с band2
   (9200-9399) не пересекаются.

   Запуск: node experiment/own.js <от> <сколько>
   ============================================================ */
const fs = require('fs');
const { createWorld, step } = require('../src/world');
const { ancestral, mutate } = require('../src/genome');
const { makeRNG } = require('../src/rng');

const GROW = 1600, WATCH = 2000, BIN = 20, WSEED = 5, REFRACT = 5;
const TIERS = [0.03, 0.06, 0.12, 0.20];
const PER_CAP = Math.floor(WATCH / (REFRACT + 1));
const MIN_SHARE = 0.05, MAX_PER = 0.50, MIN_ST = 0.10, MAX_ST = 0.90;
const DROP = 0.5;

const FROM = +(process.argv[2] || 500);
const COUNT = +(process.argv[3] || 150);

function jac(sets, N, rnd) {
  const rand = sets.map((s) => {
    const r = new Set();
    while (r.size < s.size) r.add(Math.floor(rnd() * N));
    return r;
  });
  const inter = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n; };
  let obs = 0, nul = 0, pairs = 0;
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
    const iO = inter(sets[i], sets[j]), uO = sets[i].size + sets[j].size - iO;
    const iR = inter(rand[i], rand[j]), uR = rand[i].size + rand[j].size - iR;
    if (uO === 0 || uR === 0) continue;
    obs += 1 - iO / uO; nul += 1 - iR / uR; pairs++;
  }
  if (!pairs || nul === 0) return { obs: NaN, nul: NaN, structure: NaN };
  return { obs: obs / pairs, nul: nul / pairs, structure: 1 - (obs / pairs) / (nul / pairs) };
}

/* mode: null | {deaf:[поля]} | {mute:true} */
function watch(genome, mode) {
  const w = createWorld({ seed: WSEED, genome });
  for (let i = 0; i < GROW; i++) step(w);
  if (mode && mode.deaf) for (const e of w.genome.eff) for (const f of mode.deaf) e.sens[f] = 0;
  if (mode && mode.mute) for (const e of w.genome.eff) for (let f = 0; f < 3; f++) e.sec[f] = 0;
  const idx = new Map(w.cells.map((c, k) => [c, k]));
  const N = w.cells.length;
  const sets = []; let cur = new Set(), spikes = 0;
  for (let i = 0; i < WATCH; i++) {
    step(w);
    for (const c of w.cells) if (c.fired === w.t && idx.has(c)) { cur.add(idx.get(c)); spikes++; }
    if ((i + 1) % BIN === 0) { sets.push(cur); cur = new Set(); }
  }
  const lit = new Set();
  for (const s of sets) for (const x of s) lit.add(x);
  const j = jac(sets, N, makeRNG(4242));
  return {
    n: N, spikes, share: N ? lit.size / N : 0,
    per: lit.size ? (spikes / lit.size) / PER_CAP : 0,
    obs: j.obs, nul: j.nul, structure: j.structure,
  };
}

function alive(r) {
  return r.share >= MIN_SHARE && r.per < MAX_PER
    && r.structure >= MIN_ST && r.structure <= MAX_ST;
}

const base = ancestral();
const out = [];
for (let k = 0; k < COUNT; k++) {
  const i = FROM + k;
  const tier = TIERS[i % 4];
  const mk = () => mutate(base, makeRNG(9000 + i), { pWeight: tier, pEff: tier });
  const asis = watch(mk(), null);
  if (!alive(asis)) { out.push({ i, tier, alive: false, asis }); continue; }

  const deafOwn = watch(mk(), { deaf: [0, 1, 2] });
  const mute = watch(mk(), { mute: true });
  const deafGrad = watch(mk(), { deaf: [5] });
  const deafRes = watch(mk(), { deaf: [3] });
  const deafAll = watch(mk(), { deaf: [0, 1, 2, 3, 4, 5] });
  const f = (x) => (asis.share ? x.share / asis.share : 1);
  const rOwn = f(deafOwn), rMute = f(mute), rGrad = f(deafGrad),
    rRes = f(deafRes), rAll = f(deafAll);

  let cls;
  if (rAll >= DROP) cls = 'ЭХО ПО СВЯЗЯМ';
  else if (rOwn < DROP && rMute < DROP && rGrad >= DROP) cls = 'ЖИВЁТ СВОИМ';
  else if ((rGrad < DROP || rRes < DROP) && rOwn >= DROP) cls = 'ЖИВЁТ ЧУЖИМ';
  else cls = 'НЕ РАЗДЕЛЕНО';

  out.push({ i, tier, alive: true, asis, rOwn, rMute, rGrad, rRes, rAll, cls });
  console.log(`${String(i).padStart(5)} | живая ${(asis.share * 100).toFixed(0)}% ` +
    `нагр ${(asis.per * 100).toFixed(0)}% | глух ${rOwn.toFixed(2)} нем ${rMute.toFixed(2)} ` +
    `град ${rGrad.toFixed(2)} рес ${rRes.toFixed(2)} всё ${rAll.toFixed(2)} | ${cls}`);
}

fs.mkdirSync('results', { recursive: true });
fs.writeFileSync(`results/own_${FROM}.jsonl`, out.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`часть ${FROM}..${FROM + COUNT - 1} готова: живых ${out.filter((r) => r.alive).length} из ${COUNT}`);

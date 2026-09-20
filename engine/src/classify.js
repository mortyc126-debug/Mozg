'use strict';
/* ============================================================
   КЛАССИФИКАЦИЯ
   Описываем то, что видно: сколько устойчивых состояний, какой формы
   их области, как устроена сеть, отвечает ли она на воздействие.
   Ни одна метка не содержит функционального имени.
   ============================================================ */

function pickDomain(m) {
  // самая выраженная по форме группа: сначала по вытянутости, при равенстве по размеру
  let best = null;
  for (const t of m.types) {
    if (t.n < 12) continue;
    if (!best || t.elong > best.elong + 0.2) best = t;
  }
  return best;
}

function labels(m, pl) {
  const out = [];
  if (m.n < 60) return ['популяция не удержалась'];
  out.push(m.types.length <= 1 ? 'состояние однородное'
    : m.types.length === 2 ? 'два устойчивых состояния'
    : `состояний: ${m.types.length}`);

  const d = pickDomain(m);
  if (d) {
    const form = d.elong >= 3 ? 'вытянутая область'
      : d.hollow >= 0.8 && d.elong < 2 ? 'кольцевая область'
      : d.elong >= 1.8 ? 'овальная область' : 'компактная область';
    out.push(`${form} (${d.n} агентов, длина/ширина ${d.elong.toFixed(1)}, ` +
      `${d.inner > 0.7 ? 'внутри ткани' : d.inner > 0.35 ? 'частично внутри' : 'у поверхности'})`);
  }

  const net = m.net;
  out.push(net.compMax < 10 ? 'связной сети нет'
    : net.compMax < 30 ? `сеть фрагментирована (${net.comps} групп, крупнейшая ${net.compMax})`
    : `единая сеть ${net.compMax} агентов${net.bigShape && net.bigShape.elong >= 3 ? ', вытянута' : ''}`);

  if (pl) {
    out.push(pl.before < 3 ? 'на воздействие не отвечает'
      : pl.gain >= 2 && pl.after - pl.before >= 5 ? `отклик растёт от повторов (${pl.before} → ${pl.after})`
      : `отклик устойчивый (${pl.before} → ${pl.after})`);
  }
  return out;
}

/* короткий ключ исхода — для подсчёта повторяемости */
function key(m, pl) {
  if (m.n < 60) return 'нет ткани';
  const d = pickDomain(m);
  const form = !d ? 'без области'
    : d.elong >= 3 ? 'вытянутая'
    : d.hollow >= 0.8 && d.elong < 2 ? 'кольцевая'
    : d.elong >= 1.8 ? 'овальная' : 'компактная';
  const net = m.net.compMax < 10 ? 'без сети' : m.net.compMax < 30 ? 'сеть дробная' : 'сеть единая';
  const resp = !pl ? '—' : pl.before < 3 ? 'не отвечает'
    : (pl.gain >= 2 && pl.after - pl.before >= 5) ? 'обучается' : 'отвечает';
  return `${m.types.length} сост. | ${form} | ${net} | ${resp}`;
}

function features(m, pl) {
  const d = pickDomain(m) || { elong: 0, inner: 0, hollow: 0, n: 0 };
  return [
    m.n / 560,
    Math.min(4, m.types.length) / 4,
    Math.min(6, d.elong) / 6,
    d.inner,
    d.hollow,
    d.n / 200,
    Math.min(200, m.net.compMax) / 200,
    Math.min(3, m.net.degree) / 3,
    m.anis,
    pl ? Math.min(60, pl.before) / 60 : 0,
    pl ? Math.min(4, pl.gain === Infinity ? 4 : pl.gain) / 4 : 0,
  ];
}

/* k-средних без библиотек: группировка исходов по признакам */
function kmeans(vectors, k, rnd, iters = 60) {
  if (!vectors.length) return { assign: [], centers: [] };
  const dim = vectors[0].length;
  const centers = [];
  for (let i = 0; i < k; i++) centers.push(vectors[(rnd() * vectors.length) | 0].slice());
  const assign = new Array(vectors.length).fill(0);
  for (let it = 0; it < iters; it++) {
    let moved = false;
    vectors.forEach((v, i) => {
      let bi = 0, bd = Infinity;
      centers.forEach((c, ci) => {
        let d = 0;
        for (let j = 0; j < dim; j++) { const t = v[j] - c[j]; d += t * t; }
        if (d < bd) { bd = d; bi = ci; }
      });
      if (assign[i] !== bi) { assign[i] = bi; moved = true; }
    });
    const sum = centers.map(() => new Array(dim).fill(0)), cnt = centers.map(() => 0);
    vectors.forEach((v, i) => { cnt[assign[i]]++; for (let j = 0; j < dim; j++) sum[assign[i]][j] += v[j]; });
    centers.forEach((c, ci) => { if (cnt[ci]) for (let j = 0; j < dim; j++) c[j] = sum[ci][j] / cnt[ci]; });
    if (!moved && it > 2) break;
  }
  return { assign, centers };
}

module.exports = { labels, key, features, kmeans, pickDomain };

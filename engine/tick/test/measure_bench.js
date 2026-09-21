#!/usr/bin/env node
'use strict';
/* ============================================================
   СТЕНД ДЛЯ МЕР

   Шестое правило, введённое после шага 18: МЕРУ ИСПЫТЫВАЙ НА ЗАВЕДОМО
   ПУСТЫХ ЧИСЛАХ ПРЕЖДЕ, ЧЕМ ПРИМЕНЯТЬ К МИРУ.

   Пятнадцать раз за сессию негодным оказывался прибор, а не мир, и все
   пять последних поломок находились за пять минут ПОСЛЕ прогона --
   значит нашлись бы за те же пять минут ДО.

   Здесь мера получает числа, в которых устройства НЕТ ПО ПОСТРОЕНИЮ:
   адреса случайны, круги случайны, будущее не зависит от прошлого.
   Годная мера обязана показать около нуля. Что покажет больше --
   читает собственную арифметику, а не мир.

   В стенде нарочно оставлена СЛОМАННАЯ мера из шага 18: стенд обязан
   её поймать, иначе он сам ничего не стоит.
   ============================================================ */
const N = 64, TRIALS = 400;
let rs = 1234567;
const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };

function cor(a, b) {
  const n = a.length;
  if (n < 3) return NaN;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let s = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da > 0 && db > 0 ? s / Math.sqrt(da * db) : 0;
}

/* пустые числа: адреса ни от чего не зависят, круги ни на что не влияют */
function emptyWorld() {
  const a0 = [], a1 = [], circle = [];
  for (let i = 0; i < N; i++) {
    a0.push(rnd() * 2 - 1);
    a1.push(a0[i] * 0.9 + (rnd() * 2 - 1) * 0.2);   // ходит само по себе
    const c = new Set();
    while (c.size < 10) { const j = Math.floor(rnd() * N); if (j !== i) c.add(j); }
    circle.push([...c]);
  }
  return { a0, a1, circle };
}

/* --- мера 1: СЛОМАННАЯ, из шага 18 --- */
function mFollow(w) {
  const pull = [], d = [];
  for (let i = 0; i < N; i++) {
    pull.push(w.circle[i].reduce((s, j) => s + w.a0[j], 0) / w.circle[i].length - w.a0[i]);
    d.push(w.a1[i] - w.a0[i]);
  }
  return cor(pull, d);
}

/* --- мера 2: та же, но общий член убран: зов берётся БЕЗ своего адреса,
   а сдвиг считается от общего среднего, а не от себя --- */
function mFollowFixed(w) {
  const gm = w.a0.reduce((x, y) => x + y, 0) / N;
  const pull = [], d = [];
  for (let i = 0; i < N; i++) {
    pull.push(w.circle[i].reduce((s, j) => s + w.a0[j], 0) / w.circle[i].length - gm);
    d.push(w.a1[i] - gm);
  }
  return cor(pull, d);
}

/* --- мера 3: родство связей против родства любых пар (шаг 17) --- */
function mKin(w) {
  let lk = 0, ln = 0, al = 0, an = 0;
  for (let i = 0; i < N; i++) {
    for (const j of w.circle[i]) { lk += Math.abs(w.a0[i] - w.a0[j]); ln++; }
    for (let j = i + 1; j < N; j++) { al += Math.abs(w.a0[i] - w.a0[j]); an++; }
  }
  return (lk / ln) / (al / an) - 1;
}

/* --- мера 4: держится ли круг (шаг 18) -- на пустых числах круги
   независимы, значит совпадение обязано быть случайным --- */
function mKeep(w) {
  let keep = 0;
  for (let i = 0; i < N; i++) {
    const now = new Set();
    while (now.size < 10) { const j = Math.floor(rnd() * N); if (j !== i) now.add(j); }
    let inter = 0;
    for (const j of w.circle[i]) if (now.has(j)) inter++;
    keep += inter / (w.circle[i].length + now.size - inter);
  }
  return keep / N;
}

const measures = [
  ['мера шага 18: «идёт за кругом»', mFollow, 0.05, 'ждём около нуля'],
  ['та же, с убранным общим членом', mFollowFixed, 0.05, 'ждём около нуля'],
  ['мера шага 17: родство связей', mKin, 0.05, 'ждём около нуля'],
  ['мера шага 18: круг держится', mKeep, 0.30, 'ждём около 10/118 = 0.09 -- это случайное совпадение двух десяток из 64'],
];

console.log('СТЕНД ДЛЯ МЕР: числа без всякого устройства, ' + TRIALS + ' жеребьёвок\n');
let bad = 0;
for (const [name, fn, tol, note] of measures) {
  let s = 0;
  for (let t = 0; t < TRIALS; t++) s += fn(emptyWorld());
  const v = s / TRIALS;
  const ok = Math.abs(v) <= tol;
  console.log(`${ok ? ' ГОДНА ' : 'НЕГОДНА'} ${name.padEnd(34)} на пустых числах: ${v.toFixed(4)}   (${note})`);
  if (!ok) bad++;
}
console.log(`\nнегодных мер: ${bad}`);
console.log('Стенд обязан был поймать меру шага 18 -- если он её пропустил, он сам ничего не стоит.');
process.exit(0);

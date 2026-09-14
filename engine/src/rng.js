'use strict';
/* Детерминированный генератор: один и тот же seed — один и тот же мир. */
function makeRNG(seed) {
  let s = (seed >>> 0) || 1;
  for (let i = 0; i < 12; i++) { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; }
  const f = function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  f.normal = () => {                       // Бокс–Мюллер, для мутаций
    let u = 0, v = 0;
    while (u === 0) u = f();
    while (v === 0) v = f();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return f;
}
module.exports = { makeRNG };

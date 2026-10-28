'use strict';
// Жребий. У мира и у мозга -- свои потоки: варианты мозга не меняют историю шума мира, и сравнение вариантов на одном сиде
// парное (отличаются только последствия решений мозга).
function makeRNG(seed) {                   // xoshiro128** на 32-битных словах; seed -- любое целое
  let s = [0x9e3779b9 ^ seed, 0x243f6a88 + Math.imul(seed, 0x85ebca6b), 0xb7e15162 ^ Math.imul(seed, 0xc2b2ae35), 0x12345678 + seed];
  const rotl = (x, k) => (x << k) | (x >>> (32 - k));
  const next = () => {
    const r = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0, t = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 11);
    return r / 4294967296;
  };
  for (let i = 0; i < 16; i++) next();
  let spare = null;
  const rnd = () => next();
  rnd.gauss = () => {
    if (spare !== null) { const v = spare; spare = null; return v; }
    let u = 0, v = 0; while (u === 0) u = next(); v = next();
    const m = Math.sqrt(-2 * Math.log(u)); spare = m * Math.sin(2 * Math.PI * v); return m * Math.cos(2 * Math.PI * v);
  };
  rnd.int = (n) => Math.floor(next() * n);
  rnd.sign = () => (next() < 0.5 ? -1 : 1);
  return rnd;
}
// независимый поток по сиду и имени
const stream = (seed, name) => { let h = 2166136261; for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return makeRNG((h ^ Math.imul(seed, 2654435761)) | 0); };
module.exports = { makeRNG, stream };

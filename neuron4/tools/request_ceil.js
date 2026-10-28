// потолок опыта «просьба» (мир слов, WORDS=8): лучшая близорукая политика, знающая всё (усиление, цель, просьбу). node tools/request_ceil.js
let s = 7; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const ZA = 0.8, CPAY = 3, RQPAY = 3, GT = 200, b = 1;
let z = 0, g = 0, d = 0, left = 0, n = 0, dot = 0, moved = 0, agree = 0;
for (let t = 0; t < 2e6; t++) {
  const dir = d, target = g + dir * RQPAY / CPAY, u = (target - ZA * z) / b, ws = b * u;
  const kick = rnd() < 0.05 ? (rnd() < 0.5 ? -1 : 1) * 2 * (0.75 + 0.5 * rnd()) : 0;
  z = ZA * z + ws + Math.sqrt(1 - ZA * ZA) * gauss() + kick; if (rnd() < 1 / GT) g = gauss();
  if (dir) { n++; dot += dir * ws; if (Math.abs(ws) > 0.3) { moved++; if (Math.sign(ws) === dir) agree++; } }
  if (left > 0) left--; else if (rnd() < 0.05) { d = rnd() < 0.5 ? -1 : 1; left = 4; } if (left === 0) d = 0;
}
console.log('близорукий потолок: сдвиг', (dot / n).toFixed(2), 'в сторону просьбы', (100 * agree / moved).toFixed(0) + '%', 'двигал', (100 * moved / n).toFixed(0) + '%');

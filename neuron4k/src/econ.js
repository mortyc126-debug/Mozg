'use strict';
// Энергетическая экономика и мотор с опережением (нейрон Колонии, опыт Э1 -- results/e1/ПЛАН.md).
// MANT=1: мотор (запись, руль, сигнатура) видит не нерв x_k, а прогноз канала -- среднее прогнозов его частей (что мозг ждёт
// от нерва); нет частей -- сам нерв. Вклад части p канала k в команду руля: du = a_k (x̂_k - x̂_k без p); кредит части копится,
// если её толчок -- в сторону сделанной команды: cr <- CRDEC cr + max(0, du знак(u)).
// KECON=1: после детства (KCHILD кругов) мир не платит за биты, мотору и органам ожидания; деньги мозга -- только из еды:
// в круг, когда тело съело или выпило (прирост пользы >= 0.1), мир платит KFOODM. Раздача: MSH -- мотору, остальное -- частям,
// KSEL=1 -- по кредиту (кредиты -- в ноль), KSEL=0 -- поровну.
const CRDEC = 0.98, MSH = 0.3;

const grown = (B) => B.cfg.KECON && B.t > B.cfg.KCHILD;   // детство кончилось -- деньги только из еды
const live = (c) => c.parts.filter((p) => p.age >= 1);
// прогноз канала по товару его нерва (для записи и руля мотора)
function xhat(B, id) {
  const G = B.goods; if (!B.cfg.MANT || G.kind[id] !== 'нерв') return G.val[id];
  const ps = live(B.ch[G.nerve[id]]); if (!ps.length) return G.val[id]; let s = 0; for (const p of ps) s += p.pred; return s / ps.length;
}
// кредит частям за команду u, собранную по весам a над товарами ids с средними mu
function credit(B, ids, a, u) {
  const G = B.goods, sg = Math.sign(u); if (!sg) return;
  for (let k = 0; k < ids.length; k++) { if (!a[k] || G.kind[ids[k]] !== 'нерв') continue; const ps = live(B.ch[G.nerve[ids[k]]]), n = ps.length; if (!n) continue;
    let s = 0; for (const p of ps) s += p.pred; const mean = s / n;
    for (const p of ps) { const without = n > 1 ? (s - p.pred) / (n - 1) : G.val[ids[k]], du = a[k] * (mean - without);
      p.cr = (p.cr || 0) * CRDEC ** (B.t - (p.crT ?? B.t)); p.crT = B.t; p.cr += Math.max(0, du * sg); } }
}
// раздача еды: в круг приёма пищи или воды
function meal(B) {
  const cfg = B.cfg, W = B.world; if (!grown(B)) return;
  const meals = (W.ateNow >= 0.1 ? 1 : 0) + (W.drankNow >= 0.1 ? 1 : 0); if (!meals) return;
  const M = cfg.KFOODM * meals, led = B.led, m = B.ex.motors.find((q) => q.alive && q.port.k === W.motorNerve);
  const ps = []; for (const c of B.ch) for (const p of c.parts) if (p.alive) ps.push(p);
  for (const p of ps) { p.cr = (p.cr || 0) * CRDEC ** (B.t - (p.crT ?? B.t)); p.crT = B.t; }
  let toParts = m ? (1 - MSH) * M : M; if (m) led.earn('world', m, MSH * M, 'мир->мотор: еда');
  const tot = ps.reduce((s, p) => s + (cfg.KSEL ? p.cr : 1), 0);
  if (!(tot > 0)) { if (m) led.earn('world', m, toParts, 'мир->мотор: еда'); toParts = 0; }
  else for (const p of ps) { const a = toParts * (cfg.KSEL ? p.cr : 1) / tot; if (a > 0) led.earn('world', p, a, 'мир->часть: еда'); if (cfg.KSEL) p.cr = 0; }
  B.econ = B.econ || { food: 0, meals: 0 }; B.econ.food += M; B.econ.meals += meals;
}
module.exports = { grown, xhat, credit, meal };

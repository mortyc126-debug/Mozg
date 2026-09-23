// Проверка меры строки 0 (PRE62_H30.md): старая мера (20 циклов по 200 кругов, два повтора) против новой (100 циклов по 100 кругов, половины).
const M = require('./neuron2.js');
const seed = +process.argv[2], C = M.CFG, SCH = M.SCH;
const w = M.create(seed);
for (let r = 1; r <= 60000; r++) M.round(w);
let ks = (seed * 2654435761) >>> 0;
const krnd = () => { ks = (ks + 0x6D2B79F5) >>> 0; let t = ks; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const kg = () => Math.sqrt(-2 * Math.log(krnd() + 1e-12)) * Math.cos(2 * Math.PI * krnd());
const R = C.SSIG * C.SSIG + C.SN * C.SN, rho = C.SRHO;
let m = 0, P = 1, sensed = false;
function kal() { if (sensed) { const y = w.c[SCH] + C.SN * kg(); const K = P / (P + R); m += K * (y - m); P *= 1 - K; } const kp = rho * m; m = kp; P = rho * rho * P + (1 - rho * rho); return kp; }
const life = () => { const kp = kal(); M.round(w); sensed = true; return kp; };
const silent = () => { kal(); M.worldStep(w); M.pauseRound(w); sensed = false; };
const Sp = () => w.parts.filter((p) => p && p.ch === SCH);
for (let r = 1; r <= 1000; r++) life();
const acc = () => ({ net: 0, nul: 0, kal: 0 });
const add = (a, preds, kp, L) => { for (const x of preds) { a.net += (x - L) ** 2; a.nul += L * L; a.kal += (kp - L) ** 2; } };
const H = (a) => (a.nul - a.net) / (a.nul - a.kal);
const sum = (a, b) => ({ net: a.net + b.net, nul: a.nul + b.nul, kal: a.kal + b.kal });
function cycles(n, gap, T, accs) {   // accs[i] получает цикл i (массив аккумуляторов по номеру цикла)
  for (let c = 0; c < n; c++) {
    for (let r = 1; r <= gap; r++) life();
    for (let k = 1; k <= T; k++) silent();
    const pr = Sp().map((p) => p.pred), kp = life(); add(accs(c), pr, kp, w.L);
  }
}
const out = [seed];
for (const T of [10, 30]) { const r1 = acc(), r2 = acc(); cycles(20, 200, T, () => r1); cycles(20, 200, T, () => r2); out.push(H(r1).toFixed(4), H(r2).toFixed(4), H(sum(r1, r2)).toFixed(4)); }
for (const T of [10, 30]) { const h1 = acc(), h2 = acc(); cycles(100, 100, T, (c) => (c < 50 ? h1 : h2)); out.push(H(h1).toFixed(4), H(h2).toFixed(4), H(sum(h1, h2)).toFixed(4)); }
console.log(out.join('\t'));

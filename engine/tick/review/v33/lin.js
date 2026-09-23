// Матрица одного круга тишины (pauseRound) без ограничения сигнала, её радиус и наибольшее сингулярное число.
// режим 'H' -- с подстановкой ожидания (HOLD=1), '0' -- без неё, 'L' -- личная: ожидание только в свои прогноз и сигнал.
function build(w, C, mode) {
  const A = w.parts.filter(Boolean), n = 2 * A.length, row = new Map();
  A.forEach((p, k) => row.set(p.slot, k));
  const M = new Float64Array(n * n), own = mode === '0' ? 0 : 1, buy = mode === 'H' || mode === 'C' ? 1 : 0;
  A.forEach((p, k) => {
    const ip = 2 * k, iz = 2 * k + 1, nz = 1 / Math.sqrt(p.zv + 1e-9);
    const g = own * p.wSelf + (C.SELFREC ? p.ws : 0);
    M[ip * n + ip] += mode === 'C' ? Math.min(0.99, Math.max(-0.99, g)) : g;   // 'C' -- как 'H', но с пределом 0.99 на части
    if (C.SIGNAL) M[iz * n + ip] += own * p.uSelf * nz;
    for (const l of p.links) {
      if (!row.has(l.j)) continue;
      const j = row.get(l.j), col = l.k === 2 ? 2 * j + 1 : 2 * j, g = l.k === 0 ? buy : 1;
      if (!(C.TRY > 0 && l.age < C.TRIAL)) M[ip * n + col] += g * l.w;
      if (C.SIGNAL) M[iz * n + col] += g * l.u * nz;
    }
  });
  return { M, n, parts: A };
}
const mv = (M, n, v) => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0; const b = i * n; for (let j = 0; j < n; j++) s += M[b + j] * v[j]; o[i] = s; } return o; };
const mtv = (M, n, v) => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { const vi = v[i]; if (!vi) continue; const b = i * n; for (let j = 0; j < n; j++) o[j] += M[b + j] * vi; } return o; };
const nrm = (v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
function start(n) { let s = 12345; const v = new Float64Array(n); for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; v[i] = s / 4294967296 - 0.5; } return v; }
// радиус: средний логарифм роста за круги 201-400; заодно доля квадрата ведущего вектора по строкам (последние 50 кругов)
function radius({ M, n }) {
  let v = start(n), L = 0; const sh = new Float64Array(n);
  for (let k = 1; k <= 400; k++) {
    v = mv(M, n, v); const a = nrm(v); if (!(a > 0)) return { r: 0, sh };
    if (k > 200) L += Math.log(a);
    for (let i = 0; i < n; i++) v[i] /= a;
    if (k > 350) for (let i = 0; i < n; i++) sh[i] += v[i] * v[i] / 50;
  }
  return { r: Math.exp(L / 200), sh };
}
function sigma({ M, n }) {
  let v = start(n), s = 0;
  for (let k = 1; k <= 400; k++) { v = mtv(M, n, mv(M, n, v)); const a = nrm(v); if (!(a > 0)) return 0; s = a; for (let i = 0; i < n; i++) v[i] /= a; }
  return Math.sqrt(s);
}
// точный метод (поправка к предрегистрации): LAPACK через numpy
const { spawnSync } = require('child_process'), path = require('path');
function eig(mats) {
  const n = mats[0].n, head = Buffer.alloc(16); head.writeBigInt64LE(BigInt(n), 0); head.writeBigInt64LE(BigInt(mats.length), 8);
  const body = Buffer.concat(mats.map((m) => Buffer.from(m.M.buffer, m.M.byteOffset, m.M.byteLength)));
  const r = spawnSync('python3', [path.join(__dirname, 'eig.py')], { input: Buffer.concat([head, body]), maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(r.stderr.toString());
  return JSON.parse(r.stdout.toString());
}
module.exports = { build, radius, sigma, mv, eig };

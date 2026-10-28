// Планки для мира текста (как tools/text_planks.py нейрона-3): на тех же кусках, что читают миры (с (сид - 1) x 65537,
// ROUNDS знаков), -- сжатие gzip, bzip2, xz (бит на знак, весь кусок и последние 20% как разность сжатия всего и первых 80%),
// частоты знаков, лучший счёт контекста одной длины (онлайн, сглаживание Виттена -- Белла) и граф клонов сам по себе
// (без мозга, учёба по всему архиву -- то, что орган сделал бы без платы за работу).
//   node tools/text_planks.js [WTXT=1] [SEEDS=1-4] [ROUNDS=100000] [CLONES=1]
const { execFileSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const { loadText } = require('../src/worldtxt');
const arg = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const W = +(arg.WTXT || 1), N = +(arg.ROUNDS || 100000), seeds = (arg.SEEDS || '1-4').split(',').flatMap((s) => { const m = s.match(/^(\d+)-(\d+)$/); return m ? Array.from({ length: m[2] - m[1] + 1 }, (_, i) => +m[1] + i) : [+s]; });
const T = loadText(W), A = T.A.length;
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length & 1 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
const bytesOf = (cmd, args, buf) => execFileSync(cmd, args, { input: buf, maxBuffer: 1 << 28 }).length;
// счёт контекста длины L, онлайн, Виттен -- Белл с отступлением к более коротким (до частот)
function ctxBits(seq, Lmax) {
  const tabs = Array.from({ length: Lmax + 1 }, () => new Map()); let tot = 0, tot2 = 0; const n = seq.length;
  for (let i = 0; i < n; i++) { const x = seq[i];
    let p = 1 / A;
    for (let L = 0; L <= Lmax && L <= i; L++) { let key = 0; for (let j = i - L; j < i; j++) key = key * 64 + seq[j];
      const e = tabs[L].get(key); if (!e) continue; const nn = e.n, u = e.c.size, cx = e.c.get(x) || 0; p = (cx + u * p) / (nn + u); }
    const b = -Math.log2(p); tot += b; if (i >= 0.8 * n) tot2 += b;
    for (let L = 0; L <= Lmax && L <= i; L++) { let key = 0; for (let j = i - L; j < i; j++) key = key * 64 + seq[j];
      let e = tabs[L].get(key); if (!e) { e = { n: 0, c: new Map() }; tabs[L].set(key, e); } e.n++; e.c.set(x, (e.c.get(x) || 0) + 1); } }
  return [tot / n, tot2 / (n - Math.ceil(0.8 * n))];
}
// граф клонов без мозга: знаки прямо из текста, учёба раз в 1 000 знаков по всему архиву (без платы за работу)
const CLm = require('../src/clones');
function cloneBits(seq, C = 16, EMEV = 1000) {
  let rs = 12345; const rng = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
  const cfg = { H: 512, CLC: C, CARCH: seq.length, CEMEV: EMEV, CEMI0: 8, CBETA: 1, CGAM: 0.1, CCRED: 0, CEMW: 0, CEMG: 0, CEMK: 3, CONL: 0, CPAYS: 0, PCPU: 0 };
  const vals = new Float64Array(A), hist = new Uint8Array(seq.length + 2);
  const G = { val: vals, at: (tt, g) => (hist[tt] === g ? 1 : 0), add: () => 0 };
  const B = { cfg, goods: G, t: 0, rng, ch: Array.from({ length: A }, (_, k) => ({ k, good: k })),
    led: { open: (kind, from, amt, extra) => ({ kind, credit: 0, ...extra }), work: () => {} }, mem: { agent: {}, organs: [], built: 0, keys: new Set(), log: [] } };
  const g = { ks: [...Array(A).keys()], lo: new Array(A).fill(0), hi: new Array(A).fill(1), mid: new Array(A).fill(0.5), frac: 1 };
  let o = null, tot = 0, tot2 = 0, n = 0, n2 = 0; const N = seq.length;
  for (let t = 1; t <= N; t++) { const x = seq[t - 1]; hist[t] = x; vals.fill(0); vals[x] = 1; B.t = t;
    if (o) { const b = -Math.log2(0.98 * o.Pc[x] + 0.02 * T.p[x]); tot += b; n++; if (t > 0.8 * N) { tot2 += b; n2++; } CLm.cloneStep(B, o); }
    else if (t === 512) o = CLm.buildClones(B, g, 1); }
  return [tot / n, tot2 / n2];
}
const rows = { gzip: [], bzip2: [], xz: [], 'частоты': [], 'контекст 1-2': [], 'контекст 1-3': [], 'контекст 1-4': [], 'контекст 1-5': [], 'граф клонов': [] };
const rows2 = {}; for (const k in rows) rows2[k] = [];
for (const s of seeds) {
  const off = ((s - 1) * 65537) % T.seq.length, seq = new Uint8Array(N); for (let i = 0; i < N; i++) seq[i] = T.seq[(off + i) % T.seq.length];
  const txt = Buffer.from(Array.from(seq, (c) => T.A[c]).join(''), 'utf8'), cut = Buffer.from(Array.from(seq.subarray(0, Math.floor(0.8 * N)), (c) => T.A[c]).join(''), 'utf8');
  for (const [k, cmd, a] of [['gzip', 'gzip', ['-9c']], ['bzip2', 'bzip2', ['-9c']], ['xz', 'xz', ['-9ec']]]) { const all = bytesOf(cmd, a, txt), part = bytesOf(cmd, a, cut); rows[k].push(8 * all / N); rows2[k].push(8 * (all - part) / (N - Math.floor(0.8 * N))); }
  const cnt = new Float64Array(A).fill(0.5); let cn = 0.5 * A, u = 0, u2 = 0; for (let i = 0; i < N; i++) { const b = -Math.log2(cnt[seq[i]] / cn); u += b; if (i >= 0.8 * N) u2 += b; cnt[seq[i]]++; cn++; }
  rows['частоты'].push(u / N); rows2['частоты'].push(u2 / (N - Math.ceil(0.8 * N)));
  for (const L of [2, 3, 4, 5]) { const [a, b] = ctxBits(seq, L); rows[`контекст 1-${L}`].push(a); rows2[`контекст 1-${L}`].push(b); }
  if (arg.CLONES !== '0') { const [a, b] = cloneBits(seq); rows['граф клонов'].push(a); rows2['граф клонов'].push(b); }
}
console.log(`  планки: ${W === 1 ? 'Шекспир' : 'Толстой'}, ${N} знаков, миры ${seeds.join(',')} -- бит на знак (весь кусок / последние 20%), медиана миров`);
for (const k in rows) if (rows[k].length) console.log(`    ${k.padEnd(14)} ${med(rows[k]).toFixed(2)} / ${med(rows2[k]).toFixed(2)}     по мирам: ${rows[k].map((x) => x.toFixed(2)).join(' ')} / ${rows2[k].map((x) => x.toFixed(2)).join(' ')}`);

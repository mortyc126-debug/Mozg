// вскрытие цепочки: отделы A, B, C и входы частей B и C в ключевые моменты
// вскрытие (раунд 3): node tools/diag_chain.js SEED=1 S=4 [ручки]
const R = require('path').join(__dirname, '..');
const K = require(R + '/src/knobs'), { WorldX } = require(R + '/src/worldx'), { Brain } = require(R + '/src/market');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')).map(([k, v]) => [k, isNaN(+v) ? v : +v]));
const seed = args.SEED || 1; delete args.SEED; const S = args.S || 1; delete args.S;
const BRAIN = { SQ: 1, RENT: 0.05, MFEAT: 6, CHOOSE: 1, CIMIT: 1, CWATCH: 80, CPROD: 4, CFEAT: 8 };
const E = { CONC: 1, SCHEMA: 1, MLONG: 1, WMEM: 1, MPLAN: 1, WMEMN: 8, CKEEP: 200, ESAVG: 1, MSRCH: 16, PDROP: 1, ESUP: 5, PPROD: 1, ATTN: 3, CMERGE: 1, MCONC: 1, SURP: 1, CPHR: 1, KEEPW: 1, FILL: 1, PARA: 1, MTD: 0.9 };
const cfg = K.makeConfig({ ...BRAIN, ...E, ...args, WORLD: 'exam', EXAM: 'цепочка', XND: Math.round(12 * S + 6 * (S - 1)) });
const W = new WorldX(cfg, seed), B = new Brain(cfg, W, seed), G = B.goods;
const idx = { A: W.idx(W.A), B: W.idx(W.Bv), C: W.idx(W.C) }, nm = {}; for (const [k, v] of Object.entries(idx)) nm[v] = k;
const name = (id) => { if (Array.isArray(id)) return '[' + id.map(name).join('*') + ']'; const kd = G.kind[id], nv = G.nerve[id];
  const who = nm[nv] !== undefined ? nm[nv] : 'n' + nv; if (kd === 'нерв') return who; if (kd === 'ожидание') return who + '~'; if (kd === 'прогноз') { const o = G.owner[id]; return 'pr(' + (o && o.ch ? (nm[o.ch.k] || 'n' + o.ch.k) : '?') + ')'; } return kd + ':' + who; };
const dump = (tag) => { const r = B.reg ? Object.entries(idx).map(([k, v]) => `${k}:отд${B.reg[v]}`).join(' ') : 'отделов нет';
  const st = B.stage ? [...B.stage].map((k) => nm[k] || 'n' + k).join(',') : '';
  console.log(`--- ${tag} t=${B.t} ${r} сцена[${st}]` + (B.reg && B.regMem ? ' отд(C)=' + (B.regMem.get(B.reg[idx.C]) || []).map((k) => nm[k] || 'n' + k).join(',') : ''));
  for (const k of ['B', 'C']) { const c = B.ch[idx[k]]; for (const p of c.parts) console.log(`   ${k} часть: ${p.inputs.map((d, i) => name(d) + '=' + (p.w[i] ?? NaN).toFixed(2)).join(' ')}  b=${p.b.toFixed(2)}`); } };
let test = [], ref = [];
let hooked = false;
for (let r = 1; r <= cfg.ROUNDS; r++) { B.step(); W.score(B);
  if (process.env.HOOK && !hooked && B.ch[idx.B].keep) { hooked = true; const m = B.ch[idx.B].keep; console.log('A~ key g' + B.ch[idx.A].fg + ', C~ key g' + B.ch[idx.C].fg + ', A key g' + B.ch[idx.A].good);
    m.delete = function (k) { if (k === 'g' + B.ch[idx.A].fg) console.log('known A', B.evc.known.has(B.ch[idx.A].good), 'mid', B.evc.mids.get(B.ch[idx.A].good), 'owner', G.owner[B.ch[idx.A].fg] && G.owner[B.ch[idx.A].fg].k, 'kind', G.kind[B.ch[idx.A].fg], 'onCount', B.onCount(B.ch[idx.A].fg, B.t - 511, B.t - 1)); console.log('keep.delete', k, 't=' + B.t, new Error().stack.split('\n').slice(2, 5).join(' | ')); return Map.prototype.delete.call(this, k); }; }
  if ([7900, 8100, 10000, 12000, 15900, 16100, 16500, 18000].includes(r) || (process.env.FINE && r >= 10000 && r <= 12000 && r % 100 === 0)) { dump(''); const c = B.ch[idx.B]; console.log('   keep B: ' + (c.keep ? [...c.keep.values()].map((e) => name(e.d) + '=' + e.w.toFixed(2)).join(' ') : '-') + ' | части: ' + c.parts.map((p) => `возр${p.age} gw[${p.gw ? [...p.gw.keys()].join(',') : ''}] спит${p.dormant ? 1 : 0} деньги${(p.cash ?? p.money ?? NaN).toFixed ? (p.cash ?? p.money ?? 0).toFixed(1) : ''}`).join('; ')); }
}
console.log(JSON.stringify(W.result())); { const S = W.st, b = S.base.reduce((x, y) => x + y, 0) / S.base.length; console.log("пробы:", S.test.map((x) => (x - b).toFixed(2)).join(" ")); }

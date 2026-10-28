// вскрытие плана в мире «ключ»: цель плана, нервы модели, ценность, удачи по отрезкам
// вскрытие (раунд 3): node tools/diag_key.js SEED=1 S=4 [ручки]
const R = require('path').join(__dirname, '..');
const K = require(R + '/src/knobs'), { WorldX } = require(R + '/src/worldx'), { Brain } = require(R + '/src/market');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')).map(([k, v]) => [k, isNaN(+v) ? v : +v]));
const seed = args.SEED || 1; delete args.SEED; const S = args.S || 1; delete args.S; const EVERY = args.EVERY || 2000; delete args.EVERY;
const BRAIN = { SQ: 1, RENT: 0.05, MFEAT: 6, CHOOSE: 1, CIMIT: 1, CWATCH: 80, CPROD: 4, CFEAT: 8 };
const E = { CONC: 1, SCHEMA: 1, MLONG: 1, WMEM: 1, MPLAN: 1, WMEMN: 8, CKEEP: 200, ESAVG: 1, MSRCH: 16, PDROP: 1, ESUP: 5, PPROD: 1, ATTN: 3, CMERGE: 1, MCONC: 1, SURP: 1, CPHR: 1, KEEPW: 1, FILL: 1, PARA: 1, MTD: 0.9 };
const cfg = K.makeConfig({ ...BRAIN, ...E, ...args, WORLD: 'exam', EXAM: 'ключ', XND: Math.round(12 * S + 6 * (S - 1)) });
const W = new WorldX(cfg, seed), B = new Brain(cfg, W, seed), G = B.goods;
const idx = { мотор: W.idx(W.mot), эхо: W.idx(W.echo), где: W.idx(W.pos), ключ: W.idx(W.key) }, nm = {}; for (const [k, v] of Object.entries(idx)) nm[v] = k;
const name = (id) => { if (Array.isArray(id)) return '[' + id.map(name).join('*') + ']'; const kd = G.kind[id], nv = G.nerve[id]; const who = nm[nv] !== undefined ? nm[nv] : 'n' + nv;
  return kd === 'нерв' ? who : kd === 'ожидание' ? who + '~' : kd + ':' + who; };
let ep0 = 0, ok0 = 0;
for (let r = 1; r <= cfg.ROUNDS; r++) { B.step(); W.score(B);
  if (r % EVERY === 0) { const st = W.st, dEp = st.ep - ep0, dOk = st.ok - ok0; ep0 = st.ep; ok0 = st.ok;
    console.log(`t=${r} попыток ${dEp} удачных ${dOk} | моторов ${B.ex.motors.length}`);
    for (const m of B.ex.motors) { const pl = m.pl; if (!pl) { console.log(`  мотор нерва ${nm[m.port.k] || m.port.k}: плана нет`); continue; }
      const V = pl.V ? Array.from(pl.V).map((x) => x.toFixed(2)).join(',') : '-';
      console.log(`  мотор нерва ${nm[m.port.k] || m.port.k}: цель ${pl.j >= 0 ? nm[pl.j] || 'n' + pl.j : '-'} lag ${pl.lag} ok ${pl.ok} режим ${m.arb ? m.arb.mode : '-'} S=[${pl.S.map(name).join(' ')}] V=[${V}] lo/hi ${pl.lo?.toFixed(2)}/${pl.hi?.toFixed(2)} корзин ${pl.nov ? pl.nov.size : 0} кредит ${m.credit.toFixed(1)} доход ${m.incAvg.toFixed(2)} аренда ${(m.rentAvg ?? 0).toFixed(2)} eff=[${(B.ch[m.port.k].port.eff || []).map((e) => (nm[e.j] || 'n' + e.j) + '/' + e.lag).join(' ')}]`); } } }
console.log(B.ex.log.filter((l) => /мотор|план/.test(l)).slice(0, 40).join('\n')); console.log(JSON.stringify(W.result()));

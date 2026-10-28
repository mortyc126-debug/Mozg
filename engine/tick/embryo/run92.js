// Опыт шага 92 (PRE92_MIX6.md): чистый доход на добытчика за круг отдельно у мест с нечётным (обучаемый взгляд) и чётным (часы) номером в канале
const M = require('./neuron2.js');
const seed = +process.argv[2], cond = process.argv[3], C = M.CFG;
const w = M.create(seed); for (let r = 1; r <= C.ROUNDS; r++) M.round(w);
const S = w.fs, CH = C.N / 8, odd = (s) => Math.floor(s / CH) % 2 === 1;
const grp = (f) => { let food = 0, acts = 0, looks = 0, occ = 0;
  for (const s of Object.keys(S.occ).map(Number).filter(f)) { food += S.sF[s] || 0; acts += S.sA[s] || 0; looks += S.sL[s] || 0; occ += S.occ[s]; }
  return { net: occ ? (food - C.ACT * acts - C.LOOK * looks) / occ : NaN, lpa: acts ? looks / acts : NaN }; };
const o = grp(odd), e = grp((s) => !odd(s)), n = (v) => (Number.isFinite(v) ? v.toFixed(4) : 'NaN');
console.log([cond, seed, n(o.net), n(e.net), n(o.net - e.net), n(o.lpa), n(e.lpa)].join('\t'));

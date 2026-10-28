// Детектор висячих номеров по всем настройкам check.js, 2 мира, 6000 кругов, по 2 процесса сразу
//   node aba_all.js КОРЕНЬ_ПРОЕКТА ВЫХОД.jsonl
const { execFile } = require('child_process'), fs = require('fs'), path = require('path');
const ROOT = process.argv[2], OUT = process.argv[3];
const src = fs.readFileSync(path.join(ROOT, 'tools/check.js'), 'utf8');
const CASES = eval(src.match(/const CASES = (\[[\s\S]*?\]);/)[1]);
const jobs = []; for (const c of CASES) for (const s of [1, 2]) jobs.push([c, s]);
let next = 0; const res = [];
const run = () => { if (next >= jobs.length) return Promise.resolve(); const [c, s] = jobs[next++];
  return new Promise((ok) => execFile('node', [path.join(__dirname, 'aba2.js'), ROOT, `SEED=${s}`, 'ROUNDS=6000', ...c.split(' ').filter(Boolean)], { maxBuffer: 1 << 26 }, (e, out, err) => {
    const line = e ? JSON.stringify({ seed: s, error: String(err).slice(0, 300) }) : out.trim().split('\n').pop(); res.push({ c: c || '(по умолчанию)', ...JSON.parse(line) }); fs.appendFileSync(OUT, JSON.stringify(res[res.length - 1]) + '\n'); ok(); })).then(run); };
fs.writeFileSync(OUT, '');
Promise.all([run(), run()]).then(() => console.log('готово', res.length));

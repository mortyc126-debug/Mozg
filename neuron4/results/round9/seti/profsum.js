const p = JSON.parse(require('fs').readFileSync(process.argv[2]));
const self = new Map(), byId = new Map(p.nodes.map((n) => [n.id, n]));
const dt = p.timeDeltas; const cnt = new Map(); p.samples.forEach((id, i) => cnt.set(id, (cnt.get(id) || 0) + (dt[i] || 0)));
let tot = 0; for (const [id, t] of cnt) { const n = byId.get(id), cf = n.callFrame, k = `${cf.functionName || '(anon)'} ${cf.url.split('/').slice(-1)[0]}:${cf.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + t); tot += t; }
const files = new Map(); for (const [k, t] of self) { const f = k.split(' ')[1].split(':')[0]; files.set(f, (files.get(f) || 0) + t); }
console.log('по файлам:', [...files].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([f, t]) => `${f} ${(100 * t / tot).toFixed(0)}%`).join(', '));
console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, t]) => `${(100 * t / tot).toFixed(1)}% ${k}`).join('\n'));

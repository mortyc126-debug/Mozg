// Картинка опыта «неизвестный орган»: польза движений по окнам 250 кругов (медиана 8 миров) у мозга, у мозга с пересадкой
// (знак, нервы местами), у вшитого потолка и у мозга без исследователя.
//   node tools/dev_draw.js ПАПКА_ПРОГОНОВ results/devices/devices.svg
const fs = require('fs'), path = require('path');
const dir = process.argv[2] || 'results/devices/runs_lag1', outFile = process.argv[3] || 'results/devices/devices.svg';
const load = (id) => JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8')).res;
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? (b.length & 1 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN; };
const series = (id) => { const R = load(id), T = R[0].snaps.map((s) => s.t); return T.map((t, i) => [t, med(R.map((r) => r.snaps[i].comfort))]); };
const W = 1000, H = 440, x0 = 70, x1 = 780, y0 = 70, y1 = 360, T0 = 2000, T1 = 20000, V0 = -1.0, V1 = 1.0;
const X = (t) => x0 + (t - T0) / (T1 - T0) * (x1 - x0), Y = (v) => y1 - (Math.max(V0, Math.min(V1, v)) - V0) / (V1 - V0) * (y1 - y0);
const ink = { p: '#0b0b0b', s: '#52514e', m: '#8a8984', grid: '#e8e7e2', bg: '#fcfcfb' };
const L = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, -apple-system, Segoe UI, sans-serif">`,
  `<rect width="${W}" height="${H}" fill="${ink.bg}"/>`,
  `<text x="20" y="28" font-size="16" font-weight="600" fill="${ink.p}">Неизвестный орган: мозг сам выясняет, что делает новый нерв, и учится им пользоваться</text>`,
  `<text x="20" y="47" font-size="11.5" fill="${ink.s}">польза движений C = 3 (2 − (z−g)²) / 2 за круг, окна по 250 кругов, медиана 8 миров; конечность подключена на круге 4 000, пересадка — на 12 000</text>`];
for (let v = -1.0; v <= 1.0001; v += 0.5) L.push(`<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="${ink.grid}"/><text x="${x0 - 8}" y="${Y(v) + 4}" font-size="10.5" text-anchor="end" fill="${ink.m}">${v.toFixed(1)}</text>`);
for (let t = 2000; t <= 20000; t += 2000) L.push(`<text x="${X(t)}" y="${y1 + 18}" font-size="10.5" text-anchor="middle" fill="${ink.m}">${t / 1000}k</text>`);
L.push(`<text x="${(x0 + x1) / 2}" y="${y1 + 36}" font-size="11" text-anchor="middle" fill="${ink.s}">круг</text>`);
for (const [t, txt] of [[4000, 'подключение'], [12000, 'пересадка']]) L.push(`<line x1="${X(t)}" x2="${X(t)}" y1="${y0}" y2="${y1}" stroke="${ink.m}" stroke-dasharray="3,3"/><text x="${X(t) + 4}" y="${y0 + 10}" font-size="10.5" fill="${ink.s}">${txt}</text>`);
const path_ = (pts) => pts.filter(([t]) => t >= T0).map(([t, v], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
const S = [['D', 'вшитый потолок', '#8a8984', '5,4'], ['B', 'без исследователя', '#b4b2a9', '2,3'], ['F', 'пересадка: нервы местами', '#1baf7a', ''],
  ['E', 'пересадка: знак обратный', '#eb6834', ''], ['C', 'мозг', '#2a78d6', '']];
const ends = [];
for (const [id, name, col, dash] of S) { const pts = series(id); L.push(`<path d="${path_(pts)}" fill="none" stroke="${col}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/>`);
  ends.push({ y: Y(pts[pts.length - 1][1]), name, col }); }
ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;   // подписи не налезают
for (const e of ends) L.push(`<circle cx="${x1 + 8}" cy="${e.y - 4}" r="4" fill="${e.col}"/><text x="${x1 + 16}" y="${e.y}" font-size="11" fill="${ink.p}">${e.name}</text>`);
L.push(`<text x="${x0}" y="${H - 14}" font-size="10.5" fill="${ink.m}">до круга 4 000 выходного нерва нет: все варианты, кроме потолка, — одна линия (польза без управления)</text>`, '</svg>');
fs.writeFileSync(outFile, L.join('\n')); console.log('нарисовано:', outFile);

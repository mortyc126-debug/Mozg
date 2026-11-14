'use strict';
// Навигатор (ступень 9, results/s9/ПЛАН.md §2; NAV). Вне рынка. Врождённое -- машинерия: счёт своего пути (мозг знает
// свою команду поворота: направление += KTURN · tanh(команда); шаг KSPD, если в шаге не было касания), сетка карты 1 x 1,
// поиск кратчайшего пути по сетке в обход клеток-стен (неизвестные клетки проходимы). Выученное -- содержимое карты:
// стены (клетка впереди, когда тело её коснулось) и места еды и воды (где тело было, когда сытость или напоённость резко
// выросла -- над сглаженным уровнем, два круга подряд); место, у которого нужда не утоляется 10 кругов, забывается. Смерть (польза резко падает -- штраф смерти; укус даёт меньше) -- тело перенесено: карта начинается заново. Выход -- два товара «план»:
// поворот к следующей клетке пути к еде и к воде, сила -- по голоду и жажде (как рефлексы ствола). Верить ли им,
// решают базальные ганглии (вес начинает с NAL0). NAV = 2 -- контроль: карта без стен (путь -- прямо к месту).
const NAMES = ['к еде по карте', 'к воде по карте'];
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
class Navigator {
  constructor(B) { this.I = B.world.innate; this.names = NAMES; this.props = NAMES.map((nm) => B.bus.add('план', null, nm, 0)); this.on = false; this.resets = 0; this.forgot = 0; this.reset(); }
  reset() { this.px = 0; this.py = 0; this.hd = 0; this.walls = new Set(); this.place = [null, null]; this.cmd = null; this.lev = [NaN, NaN]; this.cand = [null, null]; this.miss = [0, 0]; this.path = [null, null]; this.pathAt = [-1e9, -1e9]; this.cell = null; }
  key(x, y) { return Math.round(x) * 4096 + Math.round(y); }
  sense(B) {
    const c = B.cfg, o = B.obs, I = this.I;
    if (!this.on) { if (B.map.done && B.map.m !== null) { this.on = true; this.reset(); } else return; }
    const e = o[I.e], h = o[I.h];
    if (this.cmd !== null) { this.hd = wrap(this.hd + c.KTURN * Math.tanh(this.cmd));
      if (o[I.tl] > 0.5 || o[I.tr] > 0.5) { if (c.NAV === 1) this.walls.add(this.key(this.px + Math.cos(this.hd), this.py + Math.sin(this.hd))); }
      else { this.px += c.KSPD * Math.cos(this.hd); this.py += c.KSPD * Math.sin(this.hd); } }
    if (B.bus.val[B.comfort] < -18) { this.reset(); this.resets++; return; }   // смерть (польза падает на штраф смерти): тело перенесено
    // еда или глоток: подъём нужды над сглаженным уровнем больше 0.35 -- два круга подряд (шум чтения -- 0.1)
    const lv = [e, h]; for (let j = 0; j < 2; j++) { const L = this.lev[j];
      if (L !== L) { this.lev[j] = lv[j]; continue; }
      if (lv[j] - L > 0.35) { if (this.cand[j]) { this.place[j] = this.cand[j]; this.cand[j] = null; this.lev[j] = lv[j]; this.miss[j] = 0; } else this.cand[j] = [this.px, this.py]; }
      else { this.cand[j] = null; this.lev[j] += 0.3 * (lv[j] - L); }
      // место не оправдалось: тело рядом, нужда есть, а утоления нет 10 кругов -- забыть
      const P = this.place[j]; if (P && lv[j] < 0.7 && Math.hypot(P[0] - this.px, P[1] - this.py) < 1) { if (++this.miss[j] >= 10) { this.place[j] = null; this.miss[j] = 0; this.forgot++; } } }
    B.led.work(null, 20);
  }
  // кратчайший путь по сетке (8 соседей, без срезания углов у стен) от своей клетки до места; вернуть точку на 2 клетки вперёд
  plan(B, goal) {
    const sx = Math.round(this.px), sy = Math.round(this.py), gx = Math.round(goal[0]), gy = Math.round(goal[1]);
    if (sx === gx && sy === gy) return goal;
    const x0 = Math.min(sx, gx) - 12, x1 = Math.max(sx, gx) + 12, y0 = Math.min(sy, gy) - 12, y1 = Math.max(sy, gy) + 12, Wd = x1 - x0 + 1, Hd = y1 - y0 + 1;
    const prev = new Int32Array(Wd * Hd).fill(-1), q = new Int32Array(Wd * Hd); let qh = 0, qt = 0; const idx = (x, y) => (x - x0) * Hd + (y - y0), wall = (x, y) => this.walls.has(x * 4096 + y);
    const s0 = idx(sx, sy), g0 = idx(gx, gy); prev[s0] = s0; q[qt++] = s0; let ops = 0;
    while (qh < qt && prev[g0] < 0) { const cur = q[qh++], cx = Math.floor(cur / Hd) + x0, cy = (cur % Hd) + y0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; ops++;
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || wall(nx, ny)) continue; if (dx && dy && (wall(cx + dx, cy) || wall(cx, cy + dy))) continue;
        const ni = idx(nx, ny); if (prev[ni] >= 0) continue; prev[ni] = cur; q[qt++] = ni; } }
    B.led.work(null, ops);
    if (prev[g0] < 0) return goal;   // пути нет -- прямо
    const cells = []; for (let cur = g0; cur !== s0; cur = prev[cur]) cells.push(cur); cells.reverse();
    const w = cells[Math.min(1, cells.length - 1)]; return [Math.floor(w / Hd) + x0, (w % Hd) + y0];
  }
  act(B) {
    const c = B.cfg, o = B.obs, I = this.I, v = B.bus.val; v[this.props[0]] = 0; v[this.props[1]] = 0; if (!this.on) return;
    const need = [1 - o[I.e], 1 - o[I.h]], cell = this.key(this.px, this.py);
    for (let j = 0; j < 2; j++) { const P = this.place[j]; if (!P) continue;
      if (cell !== this.cell || B.t - this.pathAt[j] >= 5 || !this.path[j]) { this.path[j] = this.plan(B, P); this.pathAt[j] = B.t; }
      const wp = this.path[j], d = wrap(Math.atan2(wp[1] - this.py, wp[0] - this.px) - this.hd); v[this.props[j]] = c.GF * need[j] * Math.tanh(2 * d); }
    this.cell = cell;
  }
  learn(B) { if (this.on) this.cmd = B.u[B.map.m] || 0; }
}
module.exports = { Navigator };

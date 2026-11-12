'use strict';
// Гиппокамп (PLAN.md, принцип 4; Сб2-Сб6 нейрона-4). Три дела:
// 1. Яркие миги -- перепады: нерв за круг изменился сильнее HZ своих средних |изменений| (5 обычных разбросов), вверх или вниз.
// 2. Счёт отложенных следствий: для начала сигнала каждого нерва (перепад вверх) -- какие перепады других нервов были за
//    1..HLAG кругов до него. Счёт копится всю жизнь.
// 3. Гипотезы: если после перепада x начало сигнала нерва k бывает много чаще обычного (совпадений не меньше HMIN, подъём
//    не меньше HLIFT, z больше HZC), рождается орган-след «x был D кругов назад» (D = L - 1: выход -- за круг до начала
//    сигнала). След выставляет товар на шину и дарит его частям нерва k с памятью связи: вес из счёта стоит столько
//    наблюдений, сколько их видел гиппокамп (в окне записи коры редкое событие -- два-три раза). Живёт след на плату
//    частей по вкладу; никому не нужен -- разоряется, и та же гипотеза ждёт всё дольше.
const EMPTY = [];
class Hippocampus {
  constructor(B) {
    const n = B.n; this.prev = new Float64Array(n).fill(NaN); this.dabs = new Float64Array(n); this.N = new Map(); this.on = new Float64Array(n); this.hit = new Map(); this.rounds = 0;
    this.log = new Array(B.cfg.H).fill(EMPTY);   // перепады последних H кругов (для выхода следов и их записи задним числом)
    this.traces = []; this.free = []; this.wait = new Map(); this.born = 0; this.dead = 0;
  }
  fired(B, tr, s) { const q = s - tr.D; return q > 0 && this.log[q % B.cfg.H].includes(tr.x) ? 1 : 0; }
  sense(B) {
    const cfg = B.cfg, t = B.t, ev = [];
    for (let k = 0; k < B.n; k++) { const x = B.obs[k], p = this.prev[k]; this.prev[k] = x; if (p !== p) continue;
      const d = x - p, a = Math.abs(d); if (t > 1000 && a > cfg.HZ * this.dabs[k]) ev.push(2 * k + (d > 0 ? 1 : 0));
      this.dabs[k] += (a - this.dabs[k]) / Math.min(t, 1000); }
    this.log[t % cfg.H] = ev.length ? ev : EMPTY;
    if (t > 1000) { this.rounds++;
      for (const e of ev) { this.N.set(e, (this.N.get(e) || 0) + 1); if (!(e & 1)) continue; const tk = e >> 1; this.on[tk]++;
        for (let L = 1; L <= cfg.HLAG; L++) for (const x of this.log[(t - L) % cfg.H]) if (x >> 1 !== tk) { const key = (tk * 64 + L) * 4096 + x; this.hit.set(key, (this.hit.get(key) || 0) + 1); } } }
    for (const tr of this.traces) { B.bus.val[tr.good] = this.fired(B, tr, t); B.led.work(tr, 1); }
    B.led.work(null, B.n + 4 * ev.length);
  }
  learn(B) {
    const cfg = B.cfg, t = B.t; if (t % 100 !== 0 || t < 2000) return;
    const best = new Map();   // (нерв-цель, перепад) -> лучшая задержка
    for (const [key, h] of this.hit) { if (h < cfg.HMIN) continue; const x = key % 4096, q = Math.floor(key / 4096), L = q % 64, tk = Math.floor(q / 64), N = this.N.get(x) || 0; if (N < cfg.HMIN) continue;
      const base = this.on[tk] / this.rounds, lift = h / N / base; if (lift < cfg.HLIFT) continue;
      const z = (h - N * base) / Math.sqrt(N * base * (1 - base)); if (!(z > cfg.HZC)) continue;
      const kk = tk * 4096 + x, b = best.get(kk); if (!b || lift > b.lift) best.set(kk, { tk, x, L, lift, w0: h / N - base, N }); }
    B.led.work(null, this.hit.size);
    for (const b of [...best.values()].sort((a, c) => c.lift - a.lift)) { const D = b.L - 1, name = `${b.x}@${D}`;
      let tr = this.traces.find((q) => q.x === b.x && q.D === D); if (tr && tr.targets.has(b.tk)) continue;
      if (this.traces.filter((q) => q.targets.has(b.tk)).length >= cfg.HPER) continue;
      if (!tr) { const w = this.wait.get(name); if (w && t < w.next) continue; tr = this.birth(B, b.x, D, name); }
      tr.targets.add(b.tk); B.cortex.deliver(B, b.tk, tr.good, b.w0, Math.min(b.N, cfg.HPRIOR)); }
  }
  birth(B, x, D, name) {
    const cfg = B.cfg, bus = B.bus, t = B.t, tr = B.led.open('след', cfg.HCRED, { home: this, x, D, name, targets: new Set(), good: -1 });
    if (this.free.length) { tr.good = this.free.pop(); bus.renew(tr.good, tr, name, t); } else tr.good = bus.add('след', tr, name, t);
    // запись задним числом: гиппокамп помнит перепады последних H кругов -- кора сразу видит след на своей записи
    const s0 = Math.max(1, t - cfg.H + 1 + D); for (let s = s0; s <= t; s++) bus.rec[(s % cfg.H) * bus.cap + tr.good] = this.fired(B, tr, s);
    bus.since[tr.good] = s0 - 1; bus.val[tr.good] = this.fired(B, tr, t); B.led.work(tr, cfg.H);
    this.traces.push(tr); this.born++; return tr;
  }
  bury(B, tr) {
    this.traces.splice(this.traces.indexOf(tr), 1); this.free.push(tr.good); B.bus.renew(tr.good, null, 'пусто', B.t); this.dead++;
    const w = this.wait.get(tr.name) || { fails: 0 }; w.fails++; w.next = B.t + 2000 * 2 ** Math.min(w.fails, 4); this.wait.set(tr.name, w);
  }
}
module.exports = { Hippocampus };

'use strict';
// Товары и запись (NEURON4.md, п. 3.10 -- один протокол товара). Товар -- одна запись одного вида: вид, владелец, нерв,
// значение в этом круге и ряд на записи. Виды:
//   нерв     -- что принёс нерв в этом круге; владелец -- канал нерва (роялти -- его частям)
//   прогноз  -- прогноз части, сделанный в прошлом круге (сигнал с задержкой в круг, как по аксону); владелец -- часть
//   команда  -- что послано по нерву в этом круге; владелец -- кто послал (исследователь или моторный орган)
//   польза   -- плата мира за движения в этом круге (общий сигнал, как дофамин); владелец -- мир
// Запись -- кольцо H кругов: ряд круга t -- значения всех товаров в круге t. Место павшего товара отдаётся новому, поэтому
// у товара есть круг рождения (since): ряды до него -- чужие и не читаются.

class Goods {
  constructor(H, cap = 128) {
    this.H = H; this.cap = 0; this.n = 0; this.free = []; this.kind = []; this.owner = []; this.nerve = [];
    this.grow(cap);
  }
  grow(cap) {
    const old = this;
    const val = new Float64Array(cap), alive = new Uint8Array(cap), since = new Int32Array(cap), rec = new Float64Array(this.H * cap);
    if (this.cap) { val.set(old.val); alive.set(old.alive); since.set(old.since);
      for (let r = 0; r < this.H; r++) rec.set(old.rec.subarray(r * old.cap, r * old.cap + old.cap), r * cap); }
    Object.assign(this, { val, alive, since, rec, cap });
  }
  add(kind, owner, nerve, t) {
    const reused = this.free.length > 0;
    let id = reused ? this.free.pop() : this.n++;
    if (id >= this.cap) this.grow(this.cap * 2);
    if (reused && this.onReuse) this.onReuse(id, this.kind[id], this.nerve[id], kind, nerve);   // прежний вид и нерв номера -- ещё в массивах
    this.kind[id] = kind; this.owner[id] = owner; this.nerve[id] = nerve; this.alive[id] = 1; this.since[id] = t; this.val[id] = 0;
    return id;
  }
  // номер павшего товара отдаётся следующему новому (free). Когда номер переходит к товару другого смысла, все, кто его держит,
  // должны его забыть: onReuse (src/market.js, forget) вычищает его из органов; к новому прогнозу того же нерва -- нет: это тот же сигнал (разбор 22.10, results/razbor/ИТОГ.md)
  kill(id) { if (!this.alive[id]) return; this.alive[id] = 0; this.owner[id] = null; this.free.push(id); }
  write(t) { const o = (t % this.H) * this.cap; this.rec.set(this.val.subarray(0, this.n), o); }
  at(t, id) { return this.rec[(t % this.H) * this.cap + id]; }
  row(t) { return (t % this.H) * this.cap; }
}
module.exports = { Goods };

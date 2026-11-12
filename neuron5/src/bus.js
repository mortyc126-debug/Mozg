'use strict';
// Шина (PLAN.md, принцип 1): товары -- всё, что органы выставляют и покупают. У товара -- вид, хозяин (кому платить за вклад;
// у нервов хозяина нет), значение этого круга и запись на H кругов. Место товара может быть занято заново (новая часть на
// месте павшей, новый след): поколение места растёт, и покупатель, помнящий старое поколение, отпускает вход.
class Bus {
  constructor(H) { this.H = H; this.cap = 64; this.n = 0; this.kind = []; this.owner = []; this.name = []; this.since = []; this.gen = [];
    this.val = new Float64Array(this.cap); this.rec = new Float32Array(H * this.cap); this.t = 0; }
  add(kind, owner, name, t) {
    if (this.n === this.cap) { const cap = 2 * this.cap, rec = new Float32Array(this.H * cap), val = new Float64Array(cap);
      for (let r = 0; r < this.H; r++) rec.set(this.rec.subarray(r * this.cap, r * this.cap + this.n), r * cap);
      val.set(this.val); this.rec = rec; this.val = val; this.cap = cap; }
    const id = this.n++; this.kind[id] = kind; this.owner[id] = owner; this.name[id] = name; this.since[id] = t; this.gen[id] = 0; return id;
  }
  // место занято заново: прежние покупатели отпускают вход (поколение), запись до t не годится
  renew(id, owner, name, t) { this.owner[id] = owner; this.name[id] = name; this.since[id] = t; this.gen[id]++; this.val[id] = 0; }
  write(t) { this.t = t; this.rec.set(this.val.subarray(0, this.n), (t % this.H) * this.cap); }
  at(t, id) { return this.rec[(t % this.H) * this.cap + id]; }
  // первый круг записи, годный для всех товаров ids (и не старше записи)
  from(ids) { let t0 = Math.max(1, this.t - this.H + 1); for (const id of ids) t0 = Math.max(t0, this.since[id] + 1); return t0; }
}
module.exports = { Bus };

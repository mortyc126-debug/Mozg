'use strict';
// Книга денег и работы (NEURON4.md, п. 3.1). Деньги ходят только переводом между счетами: у каждого участника рынка
// свой счёт (кредит), и есть три внешних счёта -- «мир» (платит за биты и за пользу движений), «железо» (берёт аренду
// и цену движения) и «банк» (даёт кредит пришельцам, берёт налог сверх CAP, половину цены рождения и остаток павших).
// Сумма всех счетов всегда ноль: деньги не рождаются и не пропадают молча. Работа записывается на того, кто её заказал.

class Ledger {
  constructor(cfg) {
    this.cfg = cfg;
    this.ext = { world: 0, hardware: 0, bank: 0 };
    this.flow = Object.create(null);         // итоги переводов по статьям: 'мир->часть: биты' и т. п.
    this.parts = new Map();                  // id -> участник (живые)
    this.nextId = 1;
    this.closed = 0;                         // сумма счетов павших (должна быть 0: остаток уходит банку)
    this.ops = Object.create(null);          // работа по видам участников
    this.opsTotal = 0;
  }
  // новый участник: кредит -- от того, кто его заводит (банк или родитель)
  open(kind, from, amount, extra = {}) {
    const p = Object.assign({ id: this.nextId++, kind, credit: 0, alive: true, opsRound: 0, opsAvg: 0, mem: 0, hungry: 0, age: 0, inc: 0, incAvg: 0 }, extra);
    this.parts.set(p.id, p);
    if (amount) this.move(from, p, amount, `${this.nm(from)}->${kind}: запас`);
    return p;
  }
  nm(a) { return typeof a === 'string' ? a : a.kind; }
  bal(a) { return typeof a === 'string' ? this.ext[a] : a.credit; }
  move(from, to, amount, what) {
    if (!(amount === amount) || !Number.isFinite(amount)) throw new Error(`перевод не числом: ${what} ${amount}`);
    if (amount === 0) return;
    if (typeof from === 'string') this.ext[from] -= amount; else from.credit -= amount;
    if (typeof to === 'string') this.ext[to] += amount; else { to.credit += amount; }
    this.flow[what] = (this.flow[what] || 0) + amount;
  }
  // доход участника за круг -- для роялти и для «окупается ли»
  earn(from, to, amount, what) { this.move(from, to, amount, what); if (typeof to !== 'string') to.inc += amount; }
  close(p) {                                  // смерть: остаток (и долг) -- банку
    if (!p.alive) return;
    if (p.owe > 0) { this.move(p, 'hardware', this.cfg.PCPU * p.owe, `${p.kind}->железо: аренда`); p.owe = 0; }   // неоплаченная работа -- тоже долг
    this.move(p, 'bank', p.credit, `${p.kind}->банк: остаток павшего`);
    p.alive = false; this.parts.delete(p.id); this.closed += p.credit;
  }
  work(p, n) { p.opsRound += n; this.opsTotal += n; this.ops[p.kind] = (this.ops[p.kind] || 0) + n; }
  // аренда за круг: место + память + работа (средняя за WCPU кругов, чтобы редкая большая работа не разоряла в один круг,
  // но и не терялась: каждая операция оплачена ровно один раз -- сглаживание переносит её на следующие круги)
  rent(p, base) {
    const c = this.cfg; p.owe = (p.owe || 0) + p.opsRound; p.opsRound = 0;
    const cpu = Math.min(p.owe, Math.max(p.owe / c.WCPU, 1)); p.owe -= cpu; p.opsAvg += (cpu - p.opsAvg) / Math.min(p.age + 1, c.WCPU);
    const r = base + c.PMEM * p.mem + c.PCPU * cpu;
    this.move(p, 'hardware', r, `${p.kind}->железо: аренда`); return r;
  }
  // проверка: сумма всех счетов -- ноль
  check() {
    let s = this.ext.world + this.ext.hardware + this.ext.bank;
    for (const p of this.parts.values()) s += p.credit;
    const scale = Math.abs(this.ext.world) + Math.abs(this.ext.hardware) + Math.abs(this.ext.bank) + 1;
    if (Math.abs(s) > 1e-6 * scale) throw new Error(`деньги не сходятся: сумма счетов ${s}`);
    return s;
  }
}
module.exports = { Ledger };

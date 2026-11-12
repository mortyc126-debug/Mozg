'use strict';
// Книга денег и работы (PLAN.md, принцип 2). Участник -- любой, у кого есть счёт: часть коры, след гиппокампа. Деньги
// приходят от мира (плата за предсказание) и банка (кредит новичка), уходят в аренду и за работу; между участниками --
// плата по вкладу. Сумма всех потоков сходится: flow -- по назначениям.
class Ledger {
  constructor(cfg) { this.cfg = cfg; this.all = new Set(); this.flow = {}; this.ops = 0; this.nid = 0; }
  note(why, x) { this.flow[why] = (this.flow[why] || 0) + x; }
  open(kind, credit, o) { const p = Object.assign(o, { id: this.nid++, kind, credit, alive: true, hungry: 0, inc: 0, incLast: 0, incAvg: 0, ops: 0, age: 0 });
    this.all.add(p); this.note(`банк->${kind}: кредит`, credit); return p; }
  earn(p, x, why) { p.credit += x; p.inc += x; this.note(why, x); }
  pay(from, to, x, why) { from.credit -= x; to.credit += x; to.inc += x; this.note(why, x); }
  work(p, ops) { this.ops += ops; if (p) p.ops += ops; }
  close(p) { p.alive = false; this.all.delete(p); this.note(`${p.kind}->банк: остаток`, p.credit); }
  // конец круга: аренда и работа; кто в долгу дольше DIE кругов -- умирает (возвращает список павших)
  settle() {
    const c = this.cfg, dead = [];
    for (const p of this.all) { const due = c.RENT + c.PCPU * p.ops; p.credit -= due; this.note(`${p.kind}->железо: аренда и работа`, due);
      p.incLast = p.inc; p.incAvg += 0.01 * (p.inc - p.incAvg); p.inc = 0; p.ops = 0; p.age++;
      p.hungry = p.credit < 0 ? p.hungry + 1 : 0; if (p.hungry > c.DIE) dead.push(p); }
    for (const p of dead) this.close(p);
    return dead;
  }
}
module.exports = { Ledger };

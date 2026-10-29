'use strict';
// Мозг нейрона-4: рынок частей над нервами. У каждого нерва -- канал: до PER частей, которые предсказывают, что нерв
// принесёт в следующем круге. Часть покупает товары (нервы, команды, прогнозы других частей), ставит веса подгонкой по
// записи (наименьшие квадраты), ищет новые входы по остатку на записи (выбор по чётным кругам, проверка на нечётных),
// получает от мира плату за биты и платит долю дохода входам -- по тому, насколько хуже стал бы её прогноз без каждого
// входа (вклад «без одного», NEURON4.md п. 3.3). Аренда -- за место, память и работу (src/ledger.js). Знание «кого
// читать» принадлежит каналу: павшая часть оставляет каналу свой набор входов (записная книжка), новичок начинает с него.
// Думать часть может только на свои (THINKB, правка 36 нейрона-3): подгонка и поиск -- если она оплатит их сверх долга за
// прошлую работу. Как часто думать, решает сама (SADAPT, FADAPT): удачный поиск и подгонка, улучшившая ошибку, -- чаще.
const { Ledger } = require('./ledger');
const { Goods } = require('./goods');
const { solve } = require('./linalg');
const { stream } = require('./rng');
const EX = require('./explorer');
const MEM = require('./memory');
const CC = require('./concepts');
const FEAR = require('./fear');

// Вход части -- товар (номер) или признак-произведение: набор нервов-листьев (массив номеров по возрастанию), значение --
// их произведение (правки 27-28 нейрона-3: произведения -- только из нервов; этаж любой высоты -- тот же признак с большим
// числом листьев, а «признак из признаков» -- объединение двух наборов).
const isProd = (d) => typeof d !== 'number';
const leavesOf = (d) => (isProd(d) ? d : [d]);
const keyOf = (d) => (isProd(d) ? 'p' + d.join(',') : 'g' + d);
const clamp16 = (v) => (v > 16 ? 16 : v < -16 ? -16 : v);
function valNow(G, d) { if (!isProd(d)) return G.val[d]; let v = 1; for (const id of d) v *= G.val[id]; return clamp16(v); }
function valAt(G, t, d) { const o = G.row(t); if (!isProd(d)) return G.rec[o + d]; let v = 1; for (const id of d) v *= G.rec[o + id]; return clamp16(v); }

class Brain {
  constructor(cfg, world, seed) {
    this.cfg = cfg; this.world = world; this.seed = seed; this.t = 0;
    this.rng = stream(seed, 'мозг');
    this.led = new Ledger(cfg);
    this.goods = new Goods(cfg.H);
    this.ch = [];                           // каналы по нервам
    this.obs = new Float64Array(64); this.u = new Float64Array(64); this.drv = [];   // команды этого круга и кто их подал
    this.drvHist = [];                      // кто двигал каждый нерв в прошлые круги (для платы мира за пользу)
    this.comfortGood = this.goods.add('польза', 'world', -1, 0);
    // номер павшего товара переходит к новому. К новому прогнозу того же нерва -- это продолжение того же сигнала (знание принадлежит
    // каналу): ссылки остаются. К товару другого смысла -- все забывают номер (forget)
    this.goods.onReuse = (id, k0, n0, k1, n1) => { if (!(k0 === 'прогноз' && k1 === 'прогноз' && n0 === n1)) this.forget(id); };
    this.ex = EX.init(this); MEM.init(this); CC.init(this);
    this.stat = { births: 0, imm: 0, deaths: 0, deathsByKind: {} };
  }
  // ---------------------------------------------------------------- нервы и каналы
  syncNerves() {                            // мир мог подключить новые нервы
    const n = this.world.n;
    if (this.obs.length < n) { const o = new Float64Array(2 * n); o.set(this.obs); this.obs = o; const u = new Float64Array(2 * n); u.set(this.u); this.u = u; }
    let grew = false; const kinds = this.cfg.REG && this.ch.length < n ? this.world.truth() : null;
    while (this.ch.length < n) {
      const k = this.ch.length, c = { k, good: this.goods.add('нерв', null, k, this.t), parts: [], note: null, fails: 0, mean: 0, var: 1, nv: 0, cmd: -1 };
      this.goods.owner[c.good] = c; this.ch.push(c); EX.newNerve(this, c); grew = true;
      if (kinds) this.regAdd(k, kinds[k]);
    }
    if (grew && this.t > 0) for (const c of this.ch) c.fails = 0;   // новый орган -- повод пересмотреть всё: пришельцы снова приходят во все каналы
  }
  // ---------------------------------------------------------------- круг мозга
  step() {
    const cfg = this.cfg, led = this.led, G = this.goods, W = this.world, t = ++this.t;
    this.syncNerves();
    if (cfg.REGA && t >= 2 * cfg.H && t % 2000 === 0) this.regroup();
    if ((cfg.REG || cfg.REGA) && cfg.STAGE && t % 500 === 0 && t >= cfg.H) this.stageUpdate();
    if (cfg.SLEEP && t > cfg.H && t % cfg.SLEEP === 0) this.sleep();
    const n = this.ch.length, obs = W.observe(this.obs);
    // 1. нервы этого круга
    for (const c of this.ch) { const v = obs[c.k]; G.val[c.good] = v;
      if (c.nv < 50) { c.nv++; c.mean += (v - c.mean) / c.nv; c.var += ((v - c.mean) ** 2 - c.var) / c.nv; }
      else { const d = v - c.mean; c.mean += 0.002 * d; c.var += 0.002 * (d * d - c.var); }
      // HIB (раунд 9): спячка канала. Канал, который 100 кругов почти не меняется (быстрый разброс меньше 2% от разброса
      // в его живые времена), засыпает: его части не считают, не учатся и не платят аренды, строитель его не смотрит, органы,
      // которые служат только ему, тоже спят. Знание держится, а стоит ничего. Просыпается в первом круге, где нерв ушёл от
      // своего тихого значения больше чем на половину живого разброса
      // HIB=2 (разбор 22.10): у HIB=1 порог «быстрый разброс меньше 2% живого» ниже шума чтения: у нерва 0/1 живой разброс не
      // больше 0.26, 2% от него -- 0.005, а шум чтения (SN = 0.1) -- 0.01, и слова не засыпают никогда (в мире эпох спали только
      // отвлекающие источники). HIB=2 меряет размахом: amp -- самый большой отход нерва от тихого значения в живые времена (у слова
      // ~1, шум -- 3-4 разброса шума). Тихий круг -- нерв и средний прогноз его частей ближе 0.35 amp к тихому значению; 100 тихих
      // кругов подряд -- сон. Спящие части не учатся, не ищут и не платят аренды, но прогноз считают (это дёшево): канал
      // просыпается, когда нерв или его прогноз отходит больше чем на 0.5 amp -- так входы будят канал, которого спросили
      if (cfg.HIB === 2) { const q0 = c.qm ?? v, dq = v - q0; let s = 0, np = 0; for (const p of c.parts) if (p.age >= 1) { s += p.pred; np++; } const dp = np ? s / np - q0 : 0;
        if (!c.asleep) { c.qm = q0 + 0.05 * dq; c.amp = Math.max(Math.abs(dq), (c.amp ?? Math.abs(dq)) * (1 - 1e-4)); }
        const A = c.amp || 0;
        if (c.asleep) { if (Math.abs(dq) > 0.5 * A || Math.abs(dp) > 0.5 * A) { c.asleep = false; c.quietN = 0; this.stat.wakes = (this.stat.wakes || 0) + 1; } }
        else { c.quietN = A > 0 && Math.abs(dq) < 0.35 * A && Math.abs(dp) < 0.35 * A ? (c.quietN || 0) + 1 : 0; if (c.quietN >= 100 && t > cfg.H) { c.asleep = true; this.stat.sleeps = (this.stat.sleeps || 0) + 1; } } }
      else if (cfg.HIB) { const dq = v - (c.qm ?? v); c.qm = (c.qm ?? v) + 0.05 * dq; c.qv = (c.qv ?? 0) + 0.05 * (dq * dq - (c.qv ?? 0)); c.vhi = Math.max(c.var, (c.vhi ?? c.var) * (1 - 1e-4));
        if (c.asleep) { if (dq * dq > 0.25 * c.vhi) { c.asleep = false; c.quietN = 0; this.stat.wakes = (this.stat.wakes || 0) + 1; } }
        else { c.quietN = c.qv < 0.02 * c.vhi ? (c.quietN || 0) + 1 : 0; if (c.quietN >= 100 && t > cfg.H) { c.asleep = true; this.stat.sleeps = (this.stat.sleeps || 0) + 1; } } } }
    // KEEPW: вспомнить по подсказке -- зазвучало слово, о котором канал помнит связь, а у его частей её нет: связь
    // возвращается к частям со старым весом сразу, до прогноза (часть, которая долго не подгонялась, иначе её не вспомнит)
    if (cfg.KEEPW && this.evc) for (const c of this.ch) { if (!c.keep || !c.keep.size) continue;
      for (const [k, e] of c.keep) { if (!this.aliveIn(e.d)) continue; let on = true;
        for (const id of leavesOf(e.d)) { const nid = G.kind[id] === 'ожидание' && G.owner[id] ? G.owner[id].good : id; if (!this.evc.known.has(nid)) continue; if (!(G.val[id] > (this.evc.mids.get(nid) ?? 0.5))) { on = false; break; } }
        if (!on) continue;
        if (!c.parts.length) { const p = this.newPart(c, 'bank', cfg.START, null); this.stat.imm++; this.inherit(p); p.dormant = false; continue; }   // частей нет -- память приводит свою
        for (const p of c.parts) { if (p.inputs.length >= cfg.LMAX || p.inputs.some((d) => keyOf(d) === k)) continue;
          if (p.w.length !== p.inputs.length) continue; p.inputs.push(e.d); p.w = Float64Array.from([...p.w, e.w]); (p.gw = p.gw || new Map()).set(k, e.w); p.x = null; p.dormant = false; this.memOf(p); led.work(p, p.inputs.length); } } }
    if (cfg.KFEAR) FEAR.step(this);   // орган страха (Колония К1к): прогноз смерти заранее, доход за страх
    // 2. расчёт за прошлый прогноз: учёба между подгонками и плата мира за биты
    for (const c of this.ch) for (const p of c.parts) {
      if (p.age < 1 || c.asleep) continue;
      const e = obs[c.k] - p.pred;
      p.mse += cfg.BETA * (e * e - p.mse);
      { const y = obs[c.k] - c.mean; p.eW = 0.998 * (p.eW || 0) + e * e; p.yW = 0.998 * (p.yW || 0) + y * y; }   // биты по окну ~500 кругов (как hBits нейрона-3)
      if (p.x && p.x.length === p.w.length) {   // после подгонки или смены входов -- без шага учёбы в этом круге
        let nx = 1; for (let i = 0; i < p.x.length; i++) nx += p.x[i] * p.x[i];
        // LRADAPT: шаг учёбы -- тоже когда окупается: прогноз с учёбой сверяется с прогнозом весов последней подгонки
        // (без учёбы); учёба лучше больше чем на 1% -- шаг x1.5, нет -- x0.7 (в тексте шаг 0.05 портил редкие знаки)
        const lr = cfg.LRADAPT ? (p.lr ?? cfg.LR) : cfg.LR;
        if (cfg.LRADAPT && p.fw && p.fw.length === p.x.length) { let same = p.fwIn.length === p.inputs.length; for (let i = 0; same && i < p.inputs.length; i++) same = p.fwIn[i] === p.inputs[i];
          if (same) { let sf = p.fb; for (let i = 0; i < p.x.length; i++) sf += p.fw[i] * p.x[i]; const ef = obs[c.k] - sf; p.eF = (p.eF || 0) + ef * ef; p.eL = (p.eL || 0) + e * e; p.nLR = (p.nLR || 0) + 1;
            if (p.nLR >= 100) { p.lr = Math.min(4 * cfg.LR, Math.max(cfg.LR / 64, lr * (p.eL < 0.99 * p.eF ? 1.5 : 0.7))); p.eF = 0; p.eL = 0; p.nLR = 0; }
            led.work(p, p.x.length); } }
        const k = lr * e / nx; for (let i = 0; i < p.x.length; i++) p.w[i] += k * p.x[i]; p.b += k;
        const sh = p.sh;                    // тень: те же входы с весами до подгонки и той же учёбой -- «что было бы без неё»
        if (sh) { let same = sh.inputs.length === p.inputs.length; for (let i = 0; same && i < p.inputs.length; i++) same = sh.inputs[i] === p.inputs[i];
          if (!same) p.sh = null;
          else { let so = sh.b; for (let i = 0; i < p.x.length; i++) so += sh.w[i] * p.x[i]; const eo = obs[c.k] - so;
            sh.eO += eo * eo; sh.eN += e * e; sh.n++; const ko = cfg.LR * eo / nx; for (let i = 0; i < p.x.length; i++) sh.w[i] += ko * p.x[i]; sh.b += ko;
            led.work(p, 3 * p.x.length); } } }
      p.bits = Math.max(0, 0.5 * Math.log2(Math.max(c.var, 1e-9) / Math.max(p.mse, 1e-9)));
      p.bitsAvg += 0.01 * (p.bits - p.bitsAvg);
      if (p.bits > 0) led.earn('world', p, cfg.PAY * p.bits * (W.salience ? W.salience(c.k) : 1), 'мир->часть: биты');
    }
    // 3. польза движений -- общий сигнал; плата мира -- вклад команды, сдвинувшей z, тому, кто её подал DLAG кругов назад
    const C = W.comfort(); G.val[this.comfortGood] = C;
    if (W.plugged) { const h = this.drvHist[cfg.DLAG - 1], who = h && h[W.motorNerve];
      if (who && who.alive) led.earn('world', who, W.marginal(), `мир->${who.kind}: польза движений`); }
    { const sp = W.speechPay ? W.speechPay() : null, h = this.drvHist[0];   // сказанное слово: ответ родителя -- тому, кто говорил
      if (sp && h && h[sp[0]] && h[sp[0]].alive) { h[sp[0]].lastPay = sp[1]; h[sp[0]].lastPayT = this.t; }
      if (sp && h && h[sp[0]] && h[sp[0]].alive && sp[1]) { if (sp[1] > 0) led.earn('world', h[sp[0]], sp[1], `мир->${h[sp[0]].kind}: ответ родителя`); else led.move(h[sp[0]], 'world', -sp[1], `${h[sp[0]].kind}->мир: ответ родителя`); } }
    // MPAY: плата нескольким органам -- каждому за его действие прошлого круга (у органа выбора -- в его архив, как ответ родителя)
    if (cfg.MPAY && W.speechPays) { const L = W.speechPays(), h = this.drvHist[0];
      const paid = new Set();   // нервы -- любые из тех, что действие могло двигать; каждому органу -- один раз
      if (L && h) for (const [k, amt] of L) { const d = h[k]; if (!d || !d.alive || paid.has(d)) continue; paid.add(d); d.lastPay = amt; d.lastPayT = this.t;
        if (amt > 0) led.earn('world', d, amt, `мир->${d.kind}: плата за действие`); else if (amt < 0) led.move(d, 'world', -amt, `${d.kind}->мир: плата за действие`); } }
    // 4. роялти за прошлый круг: доля дохода -- входам по вкладу
    for (const p of led.parts.values()) if (p.payTo && p.incLast > 0) this.royalty(p);
    // 5. команды этого круга: исследователь (лепет) и моторные органы
    this.u.fill(0); this.drv = new Array(n).fill(null);
    EX.decide(this);
    for (let k = 0; k < n; k++) if (this.drv[k]) { const c = this.ch[k];
      if (c.cmd < 0) { c.cmd = G.add('команда', null, k, t); }
      G.owner[c.cmd] = this.drv[k]; led.move(this.drv[k], 'hardware', cfg.EDRV * this.u[k] * this.u[k], `${this.drv[k].kind}->железо: движение`); }
    for (const c of this.ch) if (c.cmd >= 0) { G.val[c.cmd] = this.u[c.k]; if (!this.drv[c.k]) G.owner[c.cmd] = null; }
    this.drvHist.unshift(this.drv); if (this.drvHist.length > 8) this.drvHist.length = 8;
    // 6. прогнозы прошлого круга -- на продажу; запись круга
    for (const c of this.ch) for (const p of c.parts) G.val[p.good] = p.pred;
    // SURP: неожиданность каждого нерва -- квадрат расхождения с тем, чего ждали его части (сигнал ошибки прогноза: «оно»
    // -- сдвиг, которого мозг не ждал; своё движение он ждёт по своей команде)
    if (cfg.SURP) for (const c of this.ch) { if (c.sg === undefined) { c.sg = G.add('неожиданность', c, c.k, t); c.sgAvg = 0; }
      let pr = 0, np = 0; for (const p of c.parts) if (p.age >= 1) { pr += p.pred; np++; } const e = obs[c.k] - (np ? pr / np : c.mean), v = Math.min(16, e * e);
      G.val[c.sg] = v; c.sgAvg += 0.01 * (v - c.sgAvg); }
    // FILL: восприятие, дополненное ожиданием -- у слова-события товар «было или ждал» = max(пришло, прогноз частей). Части
    // других каналов, которые берут его, ждут следствия и тогда, когда причина не наступила, а только ожидалась: после A
    // (за которым бывало B) ждут того, что бывает после B. Так две выученные связи складываются в вывод
    if (cfg.FILL) { const w = this.evRefresh(); for (const c of this.ch) { if (!this.evc.known.has(c.good)) continue;
      if (c.fg === undefined) { c.fg = G.add('ожидание', c, c.k, t); }
      let pr = 0, np = 0; for (const p of c.parts) if (p.age >= 1) { pr += p.pred; np++; } G.val[c.fg] = Math.max(obs[c.k], np ? pr / np : 0); }
      if (w && this.ch.length) { const c0 = this.ch.find((q) => q.parts.length); if (c0) led.work(c0.parts[0], w); } }
    MEM.sell(this);                         // товары органов памяти этого круга
    if (cfg.CONC) CC.sell(this);            // и понятий
    G.write(t);
    if (cfg.PLONG) this.lrecPush(t);
    // 7. новые прогнозы
    for (const c of this.ch) for (const p of c.parts) { if (c.asleep && cfg.HIB !== 2) { p.pred = c.qm; continue; } this.predict(p); }
    // 8. думать: подгонка и поиск частей; анализ исследователя; подгонка моторных органов
    // думать -- на свои (правка 36 нейрона-3): подгонка и поиск -- только если часть оплатит их сверх долга за прошлую работу;
    // без этого части меток в мире цифр копили долг за работу в миллионы операций и разорялись при 1.5 бита дохода
    const net = (p) => p.credit - cfg.PCPU * ((p.owe || 0) + p.opsRound);
    const LP = cfg.PROD ? cfg.PSAMP * (cfg.PSAMP - 1) / 2 : 0;
    for (const c of this.ch) for (const p of c.parts) {
      if (c.asleep) continue;
      if (cfg.THINKB) { const L = p.inputs.length, fitC = cfg.PCPU * cfg.H * (L + 2) * (L + 2), srcC = cfg.PCPU * cfg.SWIN * 3 * (cfg.NCAND + LP + 3 * L);
        // THINKB=3: кредитная линия по доходу -- думать в долг можно, пока долг меньше заработка за TCRED кругов; часть, которая
        // ещё не зарабатывает аренду, ищет свободно (её убыток ограничен смертью, а без поиска она не найдёт признака никогда)
        if (cfg.THINKB === 3) { const ok = p.incAvg < cfg.RENT || net(p) > -cfg.TCRED * p.incAvg; p.canFit = ok; p.canSrc = ok; }
        else { const nw = net(p); p.canFit = nw > (cfg.THINKB === 2 ? 0 : fitC); p.canSrc = nw > (cfg.THINKB === 2 ? 0 : srcC); } } else { p.canFit = true; p.canSrc = true; }
      if (p.canFit && this.rng() < (cfg.FADAPT ? p.frate : 1 / cfg.FITP)) {
        // подгонка тоже -- когда окупается: прошлая подгонка сверяется с тенью (веса до неё с той же учёбой) на кругах после
        // неё; выигрыш в битах за эти круги, по плате мира, больше цены подгонки -- чаще, нет -- реже. Сверка с ошибкой прошлой
        // подгонки на другой записи нечестна: на шумной записи «улучшение» выпадает почти в половине раз, и частота ползла к
        // потолку (цифры: части с 16 входами платили за подгонку больше дохода и разорялись -- метки без частей, экзамен 86%)
        if (cfg.FADAPT === 2) { const sh = p.sh;
          if (sh && sh.n >= 10) { const gain = cfg.PAY * 0.5 * Math.log2(Math.max(sh.eO, 1e-12) / Math.max(sh.eN, 1e-12)) * sh.n;
            p.frate = Math.min(2 / cfg.FITP, Math.max(1 / (8 * cfg.FITP), p.frate * (gain > sh.cost ? 1.5 : 0.8))); }
          p.sh = { inputs: p.inputs.slice(), w: Float64Array.from(p.w), b: p.b, eO: 0, eN: 0, n: 0, cost: 0 }; }
        const o0 = p.opsRound, e0 = p.fitMse; this.fit(p); if (p.sh) p.sh.cost = cfg.PCPU * (p.opsRound - o0);
        if (cfg.FADAPT === 1) p.frate = Math.min(2 / cfg.FITP, Math.max(1 / (8 * cfg.FITP), p.frate * (e0 !== undefined && p.fitMse < 0.99 * e0 ? 1.5 : 0.8))); }
      if (p.canSrc && p.inputs.length < cfg.LMAX && this.rng() < (cfg.SADAPT ? p.srate : cfg.SRCH)) {   // думать, когда окупается (правка 58 нейрона-3)
        const n0 = p.inputs.length, found = this.search(p);   // SADAPT=2: нашёл вход -- успех, даже если подгонка потом отпустила другой
        if (cfg.SADAPT) p.srate = Math.min(2 * cfg.SRCH, Math.max(cfg.SRCH / 16, p.srate * ((cfg.SADAPT === 2 ? found : p.inputs.length > n0) ? 1.5 : 0.8))); }
    }
    EX.think(this); MEM.think(this); CC.think(this); if (cfg.FILL && this.t % cfg.CSCAN === 100) this.fillThrough();
    // 9. хозяйство: аренда, налог, смерть, рождение
    this.economy();
    if (cfg.CHECKM) led.check();
    // 10. мир делает шаг по командам этого круга
    W.advance(this.u);
  }
  // ---------------------------------------------------------------- часть
  newPart(c, from, amount, src) {
    const cfg = this.cfg, p = this.led.open('часть', from, amount, { ch: c, inputs: [], w: new Float64Array(0), b: c.mean, pred: c.mean, mse: c.var, bits: 0, bitsAvg: 0,
      x: null, share: null, payTo: true, incLast: 0, born: this.t, mem: 4 });
    p.good = this.goods.add('прогноз', p, c.k, this.t);
    p.srate = src && src.srate ? src.srate : cfg.SRCH;   // частота поиска -- от родителя (урок правки 59)
    p.frate = src && src.frate ? src.frate : 1 / cfg.FITP;
    p.lr = src && src.lr !== undefined ? src.lr : cfg.LR;
    if (src) { p.inputs = src.inputs.slice(); p.w = Float64Array.from(src.w); p.b = src.b; p.mse = src.mse; p.share = src.share ? Float64Array.from(src.share) : null; }
    c.parts.push(p); this.memOf(p);
    return p;
  }
  memOf(p) { let m = 4; for (const d of p.inputs) m += 2 + leavesOf(d).length; p.mem = m; }
  predict(p) {
    const G = this.goods; let s = p.b, ops = 1; const L = p.inputs.length;
    if (!p.x || p.x.length !== L) p.x = new Float64Array(L);
    for (let i = 0; i < L; i++) { const d = p.inputs[i], v = valNow(G, d); p.x[i] = v; s += p.w[i] * v; ops += isProd(d) ? d.length : 1; }
    p.pred = s; this.led.work(p, ops);
  }
  // ряды записи, годные для пары «товары круга t -> нерв круга t+1»: после рождения всех входов
  window(ds) {
    const G = this.goods, T = this.t; let t0 = Math.max(1, T - this.cfg.H + 1);
    for (const d of ds) for (const id of leavesOf(d)) t0 = Math.max(t0, G.since[id] + 1);
    return [t0, T - 1];                     // включительно; цель -- ряд t+1 <= T
  }
  // насколько канал не понят: лучшая ошибка частей против разброса (1 -- никто ничего не объяснил)
  unexpl(c) { let e = 1; for (const p of c.parts) if (p.age > 50) e = Math.min(e, p.mse / Math.max(c.var, 1e-9)); return e; }
  // карта мира: нервы от самых непредсказуемых -- раз в 100 кругов
  // вес нерва -- непонятость x (1 + спрос / средний спрос), как карта правки 66 нейрона-3: источники непредсказуемы и их покупают
  // многие, а сами произведения и ключи непредсказуемы, но их не покупает никто
  unexplMap() {
    if (!this._map || this.t - this._mapT >= 100) {
      const dem = new Map(); let tot = 0;
      for (const c of this.ch) for (const p of c.parts) for (const d of p.inputs) for (const id of leavesOf(d)) if (this.goods.kind[id] === 'нерв') { dem.set(id, (dem.get(id) || 0) + 1); tot++; }
      const avg = tot / Math.max(1, this.ch.length) || 1;
      this._map = this.ch.map((c) => [c.good, this.unexpl(c) * (1 + (dem.get(c.good) || 0) / avg)]).sort((a, b) => b[1] - a[1]).map((x) => x[0]); this._mapT = this.t; }
    return this._map; }
  aliveIn(d) { const G = this.goods; return leavesOf(d).every((id) => G.alive[id]); }
  fit(p, depth = 0) {
    if (this.cfg.KEEPW && depth === 0 && p.ch.keep) this.inherit(p);   // часть сверяется с тем, что канал помнит о молчащих словах
    const cfg = this.cfg, G = this.goods, c = p.ch, L = p.inputs.length, m = L + 1;
    const [t0, t1] = this.window([c.good, ...p.inputs]); const nr = t1 - t0 + 1;
    if (nr < 40) return;
    // ESUP: сочетание слов, которое на записи звучало вместе меньше ESUP раз, отпускается (src/concepts.js, support)
    if (cfg.ESUP && depth === 0) { const ev = new Map(); let ops = 0;
      const sil = cfg.KEEPW ? new Set((this.silentIdx(p, t0, t1) || []).map((i) => keyOf(p.inputs[i]))) : null;
      const keep = p.inputs.map((d) => { if (!isProd(d) || (sil && sil.has(keyOf(d)))) return true; const s = CC.support(this, d, t0, t1, ev); ops += s.ops; return s.n >= cfg.ESUP; });
      this.led.work(p, ops);
      if (keep.includes(false)) { if (c.keep && this.evc) p.inputs.forEach((d, i) => { if (!keep[i] && this.onCount(d, t0, t1) >= 15) c.keep.delete(keyOf(d)); }); p.inputs = p.inputs.filter((_, i) => keep[i]); p.w = Float64Array.from(p.w.filter((_, i) => keep[i])); this.memOf(p); return this.fit(p, 1); } }
    const A = new Float64Array(m * m), cv = new Float64Array(m), f = new Float64Array(m); let yy = 0, sy = 0;
    for (let t = t0; t <= t1; t++) {
      for (let i = 0; i < L; i++) f[i] = valAt(G, t, p.inputs[i]); f[L] = 1;
      const y = G.at(t + 1, c.good); yy += y * y; sy += y;
      for (let i = 0; i < m; i++) { cv[i] += f[i] * y; for (let j = 0; j <= i; j++) A[i * m + j] += f[i] * f[j]; }
    }
    for (let i = 0; i < m; i++) for (let j = 0; j < i; j++) A[j * m + i] = A[i * m + j];
    const mask = new Float64Array(m); for (let i = 0; i < L; i++) mask[i] = cfg.RIDGE;
    const frozenK = cfg.KEEPW ? this.silentIdx(p, t0, t1) : null;
    // HIB=2: и вход, который на всей записи стоит (выход органа памяти, понятие, прогноз спящей части), не переучивается и не
    // отпускается: постоянный вход ничего не говорит ни за, ни против связи. Без этого знание о мире, который замолчал, стирала не
    // аренда, а подгонка: на тихой записи выход органа -- 0, вход «ничего не даёт», часть его отпускает, и орган остаётся без
    // читателя (разбор 22.10, мир эпох: у каналов ответа «памяти» к возврату не оставалось ни одного входа)
    let frozen = frozenK; if (cfg.HIB === 2) { const q = this.quietIdx(p, t0, t1); if (q) frozen = [...new Set([...(frozenK || []), ...q])].sort((a, b) => a - b); }
    // KPRIOR: память связи -- не только вес, но и опора. Связь, которую канал помнит (KEEPW), подгоняется не на одной записи, а
    // вместе с тем, на чём выучена: n кругов, когда слово звучало и связь держалась, -- как n старых наблюдений «x = 1, y = w».
    // Только если те круги уже ушли из записи (иначе они посчитаны дважды). Так пять раз «A без B» после сотен «A, потом B»
    // ослабляют связь на долю, а не стирают её
    if (cfg.KPRIOR && c.keep && c.keep.size) { const fz = new Set(frozen || []);
      for (let i = 0; i < L; i++) { if (fz.has(i)) continue; const e = c.keep.get(keyOf(p.inputs[i])); if (!e || !(e.n > 0) || !(e.t < t0)) continue;
        A[i * m + i] += e.n; cv[i] += e.n * e.w; yy += e.n * e.w * e.w; } }
    // KEEPW: вход, чьё слово на записи молчит (было и ушло: A, пока идёт доля, где его нет), не переучивается на шуме и не
    // отпускается -- вес держится, пока слово не зазвучит снова. Забывать то, что просто давно не встречалось, -- не учиться
    // замороженный вес -- тот, что был, пока слово звучало часто (15+ раз на записи): на последних редких разах подгонка шумна
    if (frozen && p.gw) for (const i of frozen) { const g = p.gw.get(keyOf(p.inputs[i])); if (g !== undefined) p.w[i] = g; }
    let r;
    if (frozen) {   // подгонка остальных входов на остатке после замороженных (их вклад -- со старыми весами)
      const fz = new Set(frozen), act = []; for (let i = 0; i <= L; i++) if (!fz.has(i)) act.push(i); const n = act.length, A2 = new Float64Array(n * n), c2 = new Float64Array(n), mk = new Float64Array(n);
      let yy2 = yy; for (const f of frozen) { yy2 -= 2 * p.w[f] * cv[f]; for (const g of frozen) yy2 += p.w[f] * p.w[g] * A[f * m + g]; }
      act.forEach((a, x) => { let s2 = cv[a]; for (const f of frozen) s2 -= A[a * m + f] * p.w[f]; c2[x] = s2; mk[x] = mask[a]; act.forEach((b, y) => { A2[x * n + y] = A[a * m + b]; }); });
      const r2 = solve(A2, c2, n, Math.max(yy2, 0), mk);
      if (r2) { const w = new Float64Array(m), inv = new Float64Array(m); for (const f of frozen) { w[f] = p.w[f]; inv[f] = 1e-12; } act.forEach((a, x) => { w[a] = r2.w[x]; inv[a] = r2.inv[x]; }); r = { w, inv, sse: r2.sse, ops: r2.ops }; } else r = null;
    } else r = solve(A, cv, m, yy, mask);
    this.led.work(p, nr * m * m + (r ? r.ops : 0));
    if (!r) return;
    const sst = Math.max(yy - sy * sy / nr, 1e-9), dsse = new Float64Array(L);
    for (let i = 0; i < L; i++) dsse[i] = r.w[i] * r.w[i] / Math.max(r.inv[i], 1e-12);
    if (frozen) for (const i of frozen) dsse[i] = Math.max(dsse[i], cfg.DROP * sst * 10);   // замороженный вход не отпускается
    // вход, без которого почти ничего не теряется, отпускается (и подгонка заново)
    let worst = -1; for (let i = 0; i < L; i++) if (dsse[i] / sst < cfg.DROP && (worst < 0 || dsse[i] < dsse[worst])) worst = i;
    // CMERGE: из лишних входов первым отпускается тот, где нет понятия: два одинаковых на записи входа («второе» и «второе x
    // куда», пока второй предмет ходил только вверх) лишние оба, и без правила уходил любой -- часто тот, что обобщает
    if (cfg.CMERGE && worst >= 0 && this.hasConc(p.inputs[worst])) { let w2 = -1; for (let i = 0; i < L; i++) if (dsse[i] / sst < cfg.DROP && !this.hasConc(p.inputs[i]) && (w2 < 0 || dsse[i] < dsse[w2])) w2 = i; if (w2 >= 0) worst = w2; }
    if (worst >= 0 && depth < 3) { if (c.keep && this.evc && this.onCount(p.inputs[worst], t0, t1) >= 15) c.keep.delete(keyOf(p.inputs[worst]));   // связь, которая звучит часто и ничего не даёт, -- забыть и каналу
      p.inputs.splice(worst, 1); this.memOf(p); return this.fit(p, depth + 1); }
    p.w = r.w.slice(0, L); p.b = r.w[L]; p.x = null;
    p.dormant = !!(frozen && frozen.length === L && L > 0);
    if (cfg.KEEPW && this.evc) { p.gw = p.gw || new Map(); const fz = new Set(frozen || []);
      let sd = 0; for (let i = 0; i < L; i++) sd += dsse[i];
      // помнить стоит сильную связь: ту, что, пока слово звучало часто, несла не меньше пятой доли объяснённого частью (в тексте
      // слабые связи редких знаков, которые держались бы годами, только засоряли части)
      for (let i = 0; i < L; i++) { if (fz.has(i)) continue; const n = this.onCount(p.inputs[i], t0, t1); if (!(n >= 15 && n < Infinity)) continue;
        if (sd > 0 && dsse[i] / sd >= 0.2) { p.gw.set(keyOf(p.inputs[i]), p.w[i]); if (cfg.KPRIOR) { const k = keyOf(p.inputs[i]); let g = n;
          // KPLIFE: опора -- не круги одной записи, а все круги жизни, пока связь держалась (до KPLIFE): связь, которую мир
          // подтверждал 600 раз, не должна весить как 40. Новые круги -- те, что после прошлого счёта
          if (cfg.KPLIFE) { p.gl = p.gl || new Map(); const o = p.gl.get(k) || { n: 0, t: t0 - 1 }; o.n += this.onCount(p.inputs[i], Math.max(t0, o.t + 1), t1); o.t = t1; p.gl.set(k, o); g = Math.min(cfg.KPLIFE, Math.max(n, o.n)); }
          (p.gn = p.gn || new Map()).set(k, g); } } else p.gw.delete(keyOf(p.inputs[i])); } }
    if (frozenK && frozenK.length) { c.keep = c.keep || new Map(); for (const i of frozenK) if (Number.isFinite(p.w[i])) { const k = keyOf(p.inputs[i]), o = c.keep.get(k); c.keep.set(k, cfg.KPRIOR ? { d: p.inputs[i], w: p.w[i], n: o && o.n ? o.n : (p.gn && p.gn.get(k)) || 15, t: o && o.t !== undefined ? o.t : this.t } : { d: p.inputs[i], w: p.w[i] }); } }
    if (cfg.LRADAPT) { p.fw = Float64Array.from(p.w); p.fb = p.b; p.fwIn = p.inputs.slice(); }
    let s = 0; for (let i = 0; i < L; i++) s += dsse[i]; p.share = s > 0 ? dsse.map((v) => v / s) : null;
    p.fitMse = r.sse / nr;
    const note = c.note; if (this.cfg.NOTE && L > 0 && (!note || p.fitMse < note.mse || note.t < this.t - 4 * cfg.H)) c.note = { inputs: p.inputs.slice(), w: Float64Array.from(p.w), b: p.b, mse: p.fitMse, t: this.t };
  }
  search(p) {
    const cfg = this.cfg, G = this.goods, c = p.ch, L = p.inputs.length;
    let [t0, t1] = this.window([c.good, ...p.inputs]); t0 = Math.max(t0, t1 - cfg.SWIN + 1); const nr = t1 - t0 + 1;
    if (nr < 60) return false;
    // кандидаты наугад, до NCAND: две трети -- нервы, команды и товары органов, треть -- прогнозы других частей
    const have = new Set(p.inputs.map(keyOf)); have.add(keyOf(p.good));
    // ONEIN: одна связь -- один вход. «A» и «A было или ждал» на записи почти один сигнал; часть, у которой есть одно, не берёт
    // другое: иначе вес делится между ними, и каждый учится своему (A ~ +1.05 и A -0.88 -- связь, стёртая обходом памяти)
    const canon = (d) => { const lv = leavesOf(d).map((id) => (G.kind[id] === 'ожидание' && G.owner[id] ? G.owner[id].good : id)); const u = [...new Set(lv)].sort((a, b) => a - b); return u.length === 1 ? 'g' + u[0] : 'p' + u.join(','); };   // квадрат слова (0/1) -- то же слово
    const haveC = cfg.ONEIN ? new Set(p.inputs.map(canon)) : null;
    // ONEIN=2: и «B было или ждал» не берётся вместе с прогнозом части канала B («ждал B»): вдвоём они дают «B было» (обход
    // ожидания -- так вывод разучивался за 10 опровержений). «B» и «ждал B» вместе -- можно: это неожиданность
    const chOf = (d, kind) => (!isProd(d) && G.kind[d] === kind && G.owner[d] ? (kind === 'ожидание' ? G.owner[d].k : G.owner[d].ch ? G.owner[d].ch.k : -1) : -1);
    const fillCh = cfg.ONEIN >= 2 ? new Set(p.inputs.map((d) => chOf(d, 'ожидание'))) : null, predCh = cfg.ONEIN >= 2 ? new Set(p.inputs.map((d) => chOf(d, 'прогноз'))) : null;
    const clash = (d) => fillCh && ((chOf(d, 'прогноз') >= 0 && fillCh.has(chOf(d, 'прогноз'))) || (chOf(d, 'ожидание') >= 0 && predCh.has(chOf(d, 'ожидание'))));
    const cand = [], ck = new Set(), R = this.rng, nc = this.ch.length;
    const put = (d) => { const k = keyOf(d); if (!have.has(k) && !ck.has(k) && !(haveC && haveC.has(canon(d))) && !(clash && clash(d)) && !(cfg.CONC && CC.degenerate(this, d))) { ck.add(k); cand.push(d); } };
    const orgGoods = cfg.CONC && this.ccGoods.length ? [...(this.orgGoods || []), ...this.ccGoods] : this.orgGoods || [];
    const vis = (cfg.REG || cfg.REGA) && this.reg ? this.vis(c) : null;
    for (let k = 0; k < 4 * cfg.NCAND && cand.length < cfg.NCAND; k++) {
      let q = this.ch[R.int(nc)]; const x = R(); if (vis && x < 2 / 3) q = vis[R.int(vis.length)];   // REG: нервы -- своего отдела и сцены, прогнозы частей -- всех
      if (x < 2 / 3) { if (cfg.SURP && q.sg !== undefined && R() < 0.2) { if (this.surpOK(q, p)) put(q.sg); } else put(orgGoods.length && R() < 0.25 ? orgGoods[R.int(orgGoods.length)] : q.cmd >= 0 && !cfg.NOCOPY && R() < 0.3 ? q.cmd : q.good); }
      else { if (!q.parts.length) continue; put(q.parts[R.int(q.parts.length)].good); } }
    // остаток нынешней модели на записи
    const res = new Float64Array(nr);
    for (let t = t0; t <= t1; t++) { let s = p.b; for (let i = 0; i < L; i++) s += p.w[i] * valAt(G, t, p.inputs[i]); res[t - t0] = G.at(t + 1, c.good) - s; }
    // ATTN: внимание к мигу неожиданности. В ATTN кругах записи с самым большим остатком (канал сделал то, чего часть не
    // ждала) -- нервы, которые кругом раньше были необычны: прозвучавшее слово или сильный сдвиг (|x - среднее| больше 2.5
    // разброса); из них -- все пары и квадраты сдвигов. Так находится сочетание: «первое» и «вверх» прозвучали вместе
    // перед сдвигом первого предмета; «я» -- после сильной команды в любую сторону (квадрат)
    // кандидатов внимания -- не больше NCAND / 2 (по порядку: самый неожиданный круг первым) и только если канал плохо понят
    if (cfg.ATTN && this.unexpl(c) > cfg.PNEED) {
      const top = [], ac = []; for (let i = 0; i < nr; i++) { const a = Math.abs(res[i]); if (top.length < cfg.ATTN || a > top[top.length - 1][0]) { top.push([a, t0 + i]); top.sort((x, y) => y[0] - x[0]); if (top.length > cfg.ATTN) top.pop(); } }
      let ops = nr; const uq = (ids) => [...new Set(ids)].sort((a, b) => a - b);
      // событийность нервов (включён не больше CACT кругов -- слово) -- раз в 64 круга по последним SWIN кругам
      ops += this.evRefresh();
      // необычное в круге t: прозвучавшее слово (чем реже слово, тем раньше в очереди) или сильный сдвиг непрерывного нерва
      // (до 3 слов, самые редкие, и до 2 непрерывных нервов, самые сильные сдвиги)
      for (const [, t] of top) { const ow = [], oc = [];
        for (const q of (vis || this.ch)) { if (G.since[q.good] >= t) continue; const x = G.at(t, q.good), e = this.evc.m.get(q.good);
          if (e) { if (x > e.mid) ow.push([-Math.log(e.f), q.good]); continue; }
          const z = Math.abs(x - q.mean) / Math.sqrt(Math.max(q.var, 1e-9)); if (z > 2.5) oc.push([z, q.good]);
          if (cfg.SURP && q.sg !== undefined && G.since[q.sg] < t && this.surpOK(q, p)) { const sv = G.at(t, q.sg), zs = sv / Math.max(q.sgAvg, 1e-6); if (zs > 6 && sv > 0.25) oc.push([zs, q.sg]); } }
        ops += nc; ow.sort((x, y) => y[0] - x[0]); oc.sort((x, y) => y[0] - x[0]); const o = [...ow.slice(0, 3), ...oc.slice(0, 2)].map((x) => x[1]);
        for (let i = 0; i < o.length; i++) { if (G.kind[o[i]] === 'неожиданность') ac.push(o[i]); else if (cfg.SQ && !this.evc.m.has(o[i])) ac.push([o[i], o[i]]); for (let j = i + 1; j < o.length; j++) { const d = uq([o[i], o[j]]); if (d.length === 2) ac.push(d); } } }
      const n0 = cand.length; for (const d of ac) { if (cand.length - n0 >= cfg.NCAND / 2) break; put(d); }
      this.led.work(p, ops);
    }
    // признаки-произведения (только из нервов) -- если свой канал плохо понят: все пары из PSAMP нервов (две трети -- из самых
    // непредсказуемых по карте мира: лист произведения сам по себе с целью не связан, и вслепую пара среди сотен нервов почти
    // не находится), существующий признак x ещё один нерв, два признака вместе (этаж)
    if (cfg.PROD && this.unexpl(c) > cfg.PNEED) {
      const vg = vis ? new Set(vis.map((q) => q.good)) : null, map = vg ? this.unexplMap().filter((id) => vg.has(id)) : this.unexplMap(), nerve = () => (vis ? vis[R.int(vis.length)].good : this.ch[R.int(nc)].good), mk = (ids) => { const u = [...new Set(ids)].sort((a, b) => a - b); return u.length >= 2 && u.length === ids.length && u.length <= cfg.FDEG ? u : null; };
      const pool = new Set(); for (let k = 0; k < 4 * cfg.PSAMP && pool.size < cfg.PSAMP; k++) pool.add(R() < 2 / 3 ? map[R.int(Math.min(map.length, 2 * cfg.PSAMP))] : nerve());
      const pl = [...pool]; for (let i = 0; i < pl.length; i++) for (let j = i + 1; j < pl.length; j++) { const d = mk([pl[i], pl[j]]); if (d) put(d); }
      const base = p.inputs.filter((d) => isProd(d) || G.kind[d] === 'нерв');
      for (const d of base) for (let k = 0; k < 2; k++) { const e = mk([...leavesOf(d), nerve()]); if (e) put(e); }
      if (cfg.SQ) for (const d of base) if (!isProd(d)) put([d, d]);   // квадрат своего входа: «насколько сильно», без знака (порог, модуль)
      for (let i = 0; i < base.length; i++) for (let j = i + 1; j < base.length; j++) { const e = mk([...leavesOf(base[i]), ...leavesOf(base[j])]); if (e) put(e); }
    }
    let best = null, bg = 0, ops = 0; const evS = new Map();
    const gainOf = (id) => {
      let sinceMax = 0; for (const x of leavesOf(id)) sinceMax = Math.max(sinceMax, G.since[x]);
      if (sinceMax + 1 > t0 + nr / 2) return -1;
      let a = Math.max(t0, sinceMax + 1); ops += (t1 - a + 1) * (1 + leavesOf(id).length);
      if (cfg.ESUP && isProd(id)) { const s = CC.support(this, id, a, t1, evS.get(a) || evS.set(a, new Map()).get(a)); ops += s.ops; if (s.n < cfg.ESUP) return -1; }
      let sfE = 0, sffE = 0, sfrE = 0, srrE = 0, nE = 0, sfO = 0, sffO = 0, sfrO = 0, srrO = 0, nO = 0, srE = 0, srO = 0;
      for (let t = a; t <= t1; t++) { const f = valAt(G, t, id), r = res[t - t0];
        if (t & 1) { sfO += f; sffO += f * f; sfrO += f * r; srrO += r * r; srO += r; nO++; } else { sfE += f; sffE += f * f; sfrE += f * r; srrE += r * r; srE += r; nE++; } }
      if (nE < 20 || nO < 20) return -1;
      const cov = (sfr, sf, sr, nn) => sfr - sf * sr / nn, vr = (sff, sf, nn) => sff - sf * sf / nn;
      const vfE = vr(sffE, sfE, nE), vfO = vr(sffO, sfO, nO), vrE = vr(srrE, srE, nE), vrO = vr(srrO, srO, nO);
      if (vfE < 1e-6 * nE || vfO < 1e-6 * nO || vrE <= 0 || vrO <= 0) return -1;
      const cE = cov(sfrE, sfE, srE, nE), cO = cov(sfrO, sfO, srO, nO), gE = cE * cE / (vfE * vrE), gO = cO * cO / (vfO * vrO);
      return cE * cO > 0 && gE > cfg.GMIN && gO > cfg.GMIN ? gE : -1;
    };
    for (const id of cand) { const g = gainOf(id); if (g > bg) { bg = g; best = id; } }
    // CONC: мозг видит через понятия -- лучший кандидат через понятие, если объясняет почти столько же (src/concepts.js)
    // CMERGE: и если вход через понятие -- тот же сигнал на записи (связь с лучшим кандидатом не меньше 0.9): у редкого канала
    // (несколько событий на отрезке поиска) объяснённые доли двух одинаковых признаков расходятся от шума, а не по делу
    if (cfg.CONC && best !== null) { const alt = CC.through(this, best); if (alt !== null && !have.has(keyOf(alt))) { const ga = gainOf(alt);
      let same = false; if (cfg.CMERGE && ga > 0) { let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, nn = 0;
        for (let t = t0; t <= t1; t++) { const x = valAt(G, t, best), y = valAt(G, t, alt); sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; nn++; }
        const va = saa - sa * sa / nn, vb = sbb - sb * sb / nn, cab = sab - sa * sb / nn; same = va > 0 && vb > 0 && Math.abs(cab) / Math.sqrt(va * vb) >= 0.9; ops += 2 * nn; }
      if (ga > 0 && (same || ga >= (1 - cfg.CTIE) * bg)) best = alt; } }
    // FILL: и через ожидание -- то же слово, но «было или ждал»: если объясняет почти столько же (или тот же сигнал), берётся оно
    if (cfg.FILL && best !== null) { let ch = false; const alt = leavesOf(best).map((id) => { const q = G.kind[id] === 'нерв' ? this.ch[G.nerve[id]] : null; if (q && q.fg !== undefined && G.alive[q.fg]) { ch = true; return q.fg; } return id; });
      const a2 = alt.length === 1 ? alt[0] : alt.slice().sort((x, y) => x - y);
      if (ch && !have.has(keyOf(a2)) && !(clash && clash(a2))) { const ga = gainOf(a2); let same = false;
        if (ga > 0) { let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, nn = 0; for (let t = t0; t <= t1; t++) { const x = valAt(G, t, best), y = valAt(G, t, a2); sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; nn++; }
          const va = saa - sa * sa / nn, vb = sbb - sb * sb / nn, cab = sab - sa * sb / nn; same = va > 0 && vb > 0 && Math.abs(cab) / Math.sqrt(va * vb) >= 0.9; ops += 2 * nn; }
        if (ga > 0 && (same || ga >= (1 - cfg.CTIE) * bg)) best = a2; } }
    this.led.work(p, ops + nr * (L + 1));
    if (best === null) return false;
    if (p.inputs.length >= cfg.LMAX) return false;
    p.inputs.push(best); p.w = Float64Array.from([...p.w, 0]); this.memOf(p); p.x = null; this.fit(p);
    return true;
  }
  // роялти: ROYAL дохода прошлого круга -- входам по вкладу «без одного»
  // KEEPW: входы части с весом, где есть слово-событие, которое на отрезке записи молчит (включалось меньше 5 раз)
  // HIB=2: входы с весом, которые на записи почти всё время стоят -- отходят от своего обычного значения (медиана трёх точек
  // записи) меньше чем в 5 кругах: молчат, а не бесполезны. Как KEEPW для слов («меньше 5 раз на записи -- данных на подгонку
  // нет»), но для любого входа: выхода органа памяти, понятия, прогноза. Так и проснувшийся канал, у которого на записи пока
  // одно-два события после долгой тишины, не переучивает выученную связь по ним
  quietIdx(p, t0, t1) {
    if (t1 - t0 < 0.8 * this.cfg.H || p.w.length !== p.inputs.length) return null; const G = this.goods, out = [];
    p.inputs.forEach((d, i) => { if (!(Math.abs(p.w[i]) > 0.05)) return;
      const a = valAt(G, t0, d), b = valAt(G, (t0 + t1) >> 1, d), c = valAt(G, t1, d), ref = Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
      let off = 0; for (let t = t0; t <= t1; t++) if (Math.abs(valAt(G, t, d) - ref) > 1e-3 && ++off >= 5) return;
      out.push(i); });
    this.led.work(p, p.inputs.length * (t1 - t0));
    return out.length ? out : null;
  }
  silentIdx(p, t0, t1) {
    if (t1 - t0 < 0.8 * this.cfg.H) return null;   // запись ещё коротка (начало жизни, новый вход) -- «молчит» не значит «было и ушло»
    { const w = this.evRefresh(); if (w) this.led.work(p, w); }
    if (!this.evc || p.w.length !== p.inputs.length) return null; const G = this.goods, out = [];
    p.inputs.forEach((d, i) => { if (!(Math.abs(p.w[i]) > 0.05) || !p.gw || !p.gw.has(keyOf(d))) return;   // молчит -- только сильная связь
      for (const id of leavesOf(d)) { const nid = G.kind[id] === 'ожидание' && G.owner[id] ? G.owner[id].good : id;   // «было или ждал» слова -- то же слово
        if (!this.evc.known.has(nid)) continue; const mid = this.evc.mids.get(nid) ?? 0.5; let on = 0;
        for (let t = t0; t <= t1 && on < 5; t++) if (G.at(t, id) > mid) on++;
        if (on < 5) { out.push(i); return; } } });   // молчит или почти: меньше 5 раз на записи -- данных на подгонку нет
    this.led.work(p, out.length * (t1 - t0));
    return out.length ? out : null;
  }
  // сколько раз на отрезке звучали все слова-события входа вместе (Infinity -- слов в нём нет)
  onCount(d, t0, t1) { const G = this.goods, ids = []; for (const id of leavesOf(d)) { const nid = G.kind[id] === 'ожидание' && G.owner[id] ? G.owner[id].good : id; if (this.evc.known.has(nid)) ids.push([id, this.evc.mids.get(nid) ?? 0.5]); }
    if (!ids.length) return Infinity; let n = 0; for (let t = t0; t <= t1; t++) { let all = true; for (const [id, mid] of ids) if (!(G.at(t, id) > mid)) { all = false; break; } if (all) n++; } return n; }
  // KEEPW: новая часть канала начинает с того, что канал помнит о молчащих словах (веса держатся у канала, а не у части,
  // которая может разориться)
  inherit(p) { const c = p.ch; if (!c.keep) return; const have = new Set(p.inputs.map(keyOf));
    if (p.w.length !== p.inputs.length) { const w = new Float64Array(p.inputs.length); for (let i = 0; i < w.length && i < p.w.length; i++) w[i] = p.w[i]; p.w = w; }
    for (const [k, e] of c.keep) { if (!this.aliveIn(e.d)) { c.keep.delete(k); continue; } if (have.has(k) || p.inputs.length >= this.cfg.LMAX) continue;
      p.inputs.push(e.d); p.w = Float64Array.from([...p.w, e.w]); have.add(k); (p.gw = p.gw || new Map()).set(k, e.w); }
    this.memOf(p); }
  // FILL: части видят слова через ожидание (как через понятия, src/concepts.js reperceive): вход со словом пробуется в виде
  // «было или ждал»; если подгонка не хуже, чем на CTIE, часть берёт его. Работу несёт часть
  fillThrough() {
    const cfg = this.cfg, G = this.goods, N = this.ch.length; let n = 0; this.fillRot = ((this.fillRot || 0) + 7) % Math.max(1, N);
    for (let kk = 0; kk < N && n < cfg.CREP; kk++) { const c = this.ch[(this.fillRot + kk) % N]; for (const p of c.parts) {
      if (n >= cfg.CREP || p.inputs.length !== p.w.length) break;
      for (let i = 0; i < p.inputs.length; i++) { let ch = false; const alt = leavesOf(p.inputs[i]).map((id) => { const q = G.kind[id] === 'нерв' ? this.ch[G.nerve[id]] : null; if (q && q !== c && q.fg !== undefined && G.alive[q.fg]) { ch = true; return q.fg; } return id; });
        if (!ch) continue; const d2 = alt.length === 1 ? alt[0] : alt.slice().sort((x, y) => x - y), k2 = keyOf(d2);
        if (p.inputs.some((q) => keyOf(q) === k2)) continue;
        if (cfg.ONEIN >= 2 && !isProd(d2) && p.inputs.some((q) => !isProd(q) && G.kind[q] === 'прогноз' && G.owner[q] && G.owner[q].ch === G.owner[d2])) continue;   // ONEIN=2: не рядом с «ждал X»
        const tk = 'f' + keyOf(p.inputs[i]); p.ccTried = p.ccTried || new Map(); if (this.t - (p.ccTried.get(tk) ?? -1e9) < 5 * cfg.CSCAN) continue; p.ccTried.set(tk, this.t);
        const a2 = p.inputs.slice(); a2[i] = d2; const e0 = CC.fitErr(this, c, p.inputs), e1 = CC.fitErr(this, c, a2); n++; if (!e0 || !e1) continue;
        this.led.work(p, e0.ops + e1.ops);
        if (e1.mse <= e0.mse * (1 + cfg.CTIE) + 1e-12) { p.inputs[i] = d2; p.x = null; this.memOf(p); this.fit(p); break; } } } }
  }
  // REG=1 -- отделы. Нерв попадает в отдел по своему виду (как кора: зрительная, слуховая; вид знает мир -- это заданное
  // вручную деление), отдел не больше RSIZE нервов (больше -- новый отдел того же вида). Поиск части, строитель памяти и
  // внимание смотрят только на нервы своего отдела и на сцену (STAGE); товары органов, понятия и прогнозы частей видны всем
  regAdd(k, kind) {
    this.reg = this.reg || []; this.regMem = this.regMem || new Map(); this.regKind = this.regKind || new Map(); this.regVer = (this.regVer || 0) + 1; this.stage = this.stage || new Set();
    let r = this.regKind.get(kind); if (r === undefined || this.regMem.get(r).length >= this.cfg.RSIZE) { r = this.regMem.size; this.regKind.set(kind, r); this.regMem.set(r, []); }
    this.regMem.get(r).push(k); this.reg[k] = r;
  }
  vis(c) {
    if (!(this.cfg.REG || this.cfg.REGA) || !this.reg || this.reg[c.k] === undefined) return this.ch; const r = this.reg[c.k]; this.visCache = this.visCache || new Map(); let v = this.visCache.get(r);
    if (!v || v.ver !== this.regVer) { const set = new Set(this.regMem.get(r)); for (const k of this.stage) set.add(k); v = { ver: this.regVer, list: [...set].sort((a, b) => a - b).map((k) => this.ch[k]) }; this.visCache.set(r, v); }
    return v.list;
  }
  // REGA=1 -- отделы собирает сам мозг: раз в 2000 кругов связи «кто кого предсказывает» (вход части канала c -- нерв q,
  // по доле вклада) и «чья команда что двигает» (найденные исследователем отклики) сводятся в граф; сильнейшие связи
  // сливают нервы в отделы не больше RSIZE (жадно, по убыванию силы). Нерв без связей -- в общий отдел «ничьих» по RSIZE.
  // До первой сборки (2 записи) отделов нет: мозг видит всё
  regroup() {
    const cfg = this.cfg, G = this.goods, n = this.ch.length, w = new Map(), key = (a, b) => (a < b ? a * n + b : b * n + a);
    const add = (a, b, v) => { if (a === b || a < 0 || b < 0 || a >= n || b >= n) return; const k = key(a, b); w.set(k, (w.get(k) || 0) + v); };
    for (const c of this.ch) for (const p of c.parts) { if (!p.share || p.share.length !== p.inputs.length) continue;
      // (связь -- вклад входа в часть, которая что-то знает: доля x биты; слабые входы и части без знания -- шум, не связь)
      const q = Math.min(1, p.bitsAvg || 0); if (q < 0.05) continue;
      p.inputs.forEach((d, i) => { if (!(p.share[i] >= 0.15)) return; for (const id of leavesOf(d)) { const kd = G.kind[id]; if (kd === 'нерв' || kd === 'команда' || kd === 'ожидание' || kd === 'неожиданность') add(c.k, G.nerve[id], p.share[i] * q); } }); }
    for (const c of this.ch) if (c.port && c.port.eff) for (const e of c.port.eff) add(c.k, e.j, 2);   // команда нерва c двигает нерв j -- одно тело
    const par = Array.from({ length: n }, (_, i) => i), size = new Array(n).fill(1), find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (const [k, v] of [...w.entries()].sort((a, b) => b[1] - a[1])) { const a = find(Math.floor(k / n)), b = find(k % n); if (a === b || size[a] + size[b] > cfg.RSIZE) continue; par[b] = a; size[a] += size[b]; }
    const groups = new Map(); for (let i = 0; i < n; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
    this.reg = []; this.regMem = new Map(); let lone = null;
    for (const g of groups.values()) { if (g.length === 1) { if (!lone || this.regMem.get(lone).length >= cfg.RSIZE) { lone = this.regMem.size; this.regMem.set(lone, []); } this.regMem.get(lone).push(g[0]); this.reg[g[0]] = lone; continue; }
      const r = this.regMem.size; this.regMem.set(r, g); for (const k of g) this.reg[k] = r; }
    this.stage = this.stage || new Set(); this.regVer = (this.regVer || 0) + 1; this.stat.regroups = (this.stat.regroups || 0) + 1;
    this.sleepOps = (this.sleepOps || 0) + w.size;
  }
  // STAGE=K -- сцена: K самых редких слов-событий (заметное событие привлекает внимание) видны всем отделам; раз в 500 кругов
  stageUpdate() {
    this.stage = this.stage || new Set(); this.regVer = this.regVer || 0;
    const w = this.evRefresh(), G = this.goods, T = this.t, t0 = Math.max(1, T - this.cfg.H + 2);
    // событие -- то, что включается резко: включённые значения отстоят от выключенных больше чем на 3 их разброса (а не хвост
    // непрерывного нерва, который тоже бывает редко выше середины)
    const sharp = (id, e) => { let s0 = 0, s1 = 0, n0 = 0, s2 = 0; for (let t = t0; t <= T; t++) { const x = G.at(t, id); if (x > e.mid) { s1 += x; n0++; } else { s0 += x; s2 += x * x; } } const nOff = (T - t0 + 1) - n0; if (!n0 || nOff < 10) return false;
      const m0 = s0 / nOff, sd = Math.sqrt(Math.max(1e-9, s2 / nOff - m0 * m0)); return s1 / n0 - m0 > 3 * sd; };
    const ev = [...this.evc.m.entries()].filter(([id, e]) => e.n >= 3 && sharp(id, e)).sort((a, b) => a[1].f - b[1].f).slice(0, this.cfg.STAGE).map(([id]) => this.goods.nerve[id]);
    const ns = new Set(ev); let same = ns.size === this.stage.size; for (const k of ns) if (!this.stage.has(k)) same = false;
    if (!same) { this.stage = ns; this.regVer++; }
    if (w) { this.sleepOps = (this.sleepOps || 0) + w; }
  }
  // SLEEP=N -- сон: раз в N кругов мир стоит, а мозг по записи подгоняет все части, ищет там, где канал плохо понят (до SLS
  // поисков на часть), и смотрит через понятия без предела числа проб. Работу сна несёт тело, не части
  sleep() {
    const cfg = this.cfg, led = this.led; if (!this.sleeper) this.sleeper = led.open('сон', 'bank', 0, { payTo: false, mem: 0 });
    const before = new Map(); for (const q of led.parts.values()) before.set(q, q.opsRound);
    const crep = cfg.CREP; cfg.CREP = 1000;
    for (const c of this.ch) for (const p of c.parts.slice()) { if (p.age < 50 || !p.alive) continue; this.fit(p);
      if (this.unexpl(c) > cfg.PNEED) for (let i = 0; i < cfg.SLS && p.alive; i++) if (!this.search(p)) break; }
    if (cfg.CONC && cfg.SLEEPC) CC.sleep(this);
    cfg.CREP = crep;
    for (const q of led.parts.values()) { const b = before.get(q) ?? 0, d = q.opsRound - b; if (q !== this.sleeper && d > 0) { q.opsRound = b; led.ops[q.kind] -= d; led.ops['сон'] = (led.ops['сон'] || 0) + d; } }
    this.stat.sleeps = (this.stat.sleeps || 0) + 1;
  }
  // Номер павшего товара отдаётся следующему новому (Goods.free). Прежде ссылки оставались, и связь молча читала чужой товар: в мире
  // диалога за 20 000 кругов органы выбора держали 83 отданных номера в списке слежки и 10 в признаках модели, около половины -- чужим (разбор 22.10,
  // results/razbor/ИТОГ.md). Теперь, когда номер переходит к товару другого смысла (не к новому прогнозу того же нерва), все, кто
  // его держит, забывают его -- в тот же момент, до первого чтения. Пока номер никому не отдан, мёртвый товар и так не читается,
  // а наследник того же нерва -- тот же сигнал, поэтому там, где номер не переходил к чужому, поведение прежнее бит в бит.
  // (Первый вариант забывал номер сразу при смерти и для наследника тоже: в диалоге ответы «о движении» упали с 0.18 до 0.02 --
  // орган выбора терял прогноз канала при каждой смене части.)
  forget(id) {
    const has = (d) => (typeof d === 'number' ? d === id : Array.isArray(d) && d.includes(id));
    const keyHas = (k) => typeof k === 'string' && k.replace(/^[a-z]+/, '').split(',').some((x) => +x === id);
    for (const c of this.ch) {
      if (c.keep) for (const [k, e] of c.keep) if (has(e.d)) c.keep.delete(k);
      for (const p of c.parts) for (const M of [p.gw, p.gn, p.gl, p.ccTried, p.schTried]) if (M) for (const k of [...M.keys()]) if (keyHas(k)) M.delete(k);
    }
    EX.forget(this, id);
  }
  hasConc(d) { const G = this.goods; return leavesOf(d).some((id) => G.kind[id] === 'понятие'); }
  // неожиданность нерва несёт новое, только если нерв понят хотя бы наполовину: у непредсказуемого слова она -- то же слово
  // и только у непрерывного нерва: у слова (события) неожиданность -- почти само слово, двойник, через который не видят понятия
  surpOK(q, p) { const w = this.evRefresh(); if (w) this.led.work(p, w); if (this.evc.known.has(q.good)) return false; for (const p of q.parts) if (p.age > 50 && p.mse < 0.5 * q.var) return true; return false; }
  // событийность нервов (включён не больше CACT кругов -- слово) -- раз в 64 круга по последним SWIN кругам; это общее
  // восприятие, работу несёт орган понятий (нет его -- тот, кто спросил: вернётся число операций)
  // (по всей записи; нерв, хоть раз признанный словом, словом и помнится, пока не станет явно непрерывным: редкое слово
  // может молчать всю запись)
  // PLONG=N -- долгая запись событий (как гиппокамп): круг, где прозвучало знакомое слово, и круг после него хранятся N кругов
  // (запись товаров -- H кругов). Хранятся только нервы. Слова редки -- запись разрежена, и её хватает на десятки эпизодов,
  // когда в записи товаров их один-два. По ней строитель ищет память, которой на коротком отрезке не видно (src/memory.js)
  lrecPush(t) {
    const cfg = this.cfg, G = this.goods, L = this.lrec || (this.lrec = { rows: [], prev: false }); let ev = false;
    // событие для долгой записи -- редкое слово (звучит не чаще 5% кругов): частые слова и так на записи товаров, а запись, где
    // хранится почти каждый круг, -- не разреженная память, а вторая запись товаров (дорого и без пользы)
    // (частота слова -- скользящая за ~1000 кругов, своя у канала: на записи товаров слово, сказанное раз-два, «молчит»)
    if (this.evc) for (const c of this.ch) { if (!this.evc.known.has(c.good)) continue; const on = G.val[c.good] > (this.evc.mids.get(c.good) ?? 0.5) ? 1 : 0;
      c.lf = (c.lf ?? on) + 0.001 * (on - (c.lf ?? on)); if (on && c.lf <= 0.05) ev = true; }
    // и ошибка прогноза каждого канала в этом круге (e): долгая память должна объяснять то, чего части не ждали, а не то, что
    // они и так знают (иначе пара «второе -> вверх» по сырому значению спорила с понятием и ломала сложение)
    if (ev || L.prev) { const n = this.ch.length, v = new Float32Array(n), e = new Float32Array(n);
      for (let k = 0; k < n; k++) { const c = this.ch[k]; v[k] = G.val[c.good]; let pr = 0, np = 0; for (const p of c.parts) if (p.age >= 1) { pr += p.pred; np++; } e[k] = v[k] - (np ? pr / np : c.mean); }
      L.rows.push({ t, v, e }); }
    L.prev = ev; let cut = 0; while (cut < L.rows.length && L.rows[cut].t < t - cfg.PLONG) cut++; if (cut) L.rows.splice(0, cut);
    if (this.mem && this.mem.agent) this.led.work(this.mem.agent, this.ch.length);
  }
  // KHOLD: доля кругов записи, где нерв выше своей прежней середины. Слово, которое молчит, раз в сотни кругов задевает шумом
  // чтения свою середину (0.39 при середине 0.387) -- и без этого правила переставало быть словом: память его связей стиралась
  // как «звучит часто и ничего не даёт». Словом быть перестаёт нерв, который выше середины чаще, чем слово (CACT)
  aboveFrac(id, mid, e0) { const G = this.goods; let n = 0; for (let t = e0; t <= this.t; t++) if (G.at(t, id) > mid) n++; return n / Math.max(1, this.t - e0 + 1); }
  evRefresh() { if (this.evc && this.t - this.evc.t < 64) return 0; const cfg = this.cfg, G = this.goods, e0 = Math.max(1, this.t - cfg.H + 2), m = new Map(), known = this.evc ? this.evc.known : new Set(), mids = this.evc ? this.evc.mids : new Map();
    for (const q of this.ch) { if (G.since[q.good] >= e0) continue;
      // KHOLD: знакомое слово, которое на записи выше своей середины меньше 3 раз, молчит: середина и «слово» остаются прежними
      // (иначе середина пересчитывалась по шуму молчания -- 0.06 вместо 0.39 -- и шум становился «звучанием» слова)
      if (cfg.KHOLD && mids.has(q.good) && known.has(q.good) && this.aboveFrac(q.good, mids.get(q.good), e0) * (this.t - e0 + 1) < 3) continue;
      const e = CC.events(this, q.good, e0, this.t); if (e && e.f <= cfg.CACT) { m.set(q.good, e); known.add(q.good); mids.set(q.good, e.mid); } else if (e && !(mids.has(q.good) && (e.hi <= mids.get(q.good) || (cfg.KHOLD && this.aboveFrac(q.good, mids.get(q.good), e0) <= cfg.CACT)))) known.delete(q.good); }   // слово, которое молчит, -- всё равно слово: шум чтения (±0.3) не выше его середины
    this.evc = { t: this.t, m, known, mids }; const ops = this.ch.length * cfg.H * (cfg.KHOLD ? 3 : 2), oc = this.cc && this.cc.list.find((o) => o.alive); if (oc) { this.led.work(oc, ops); return 0; } return ops; }
  royalty(p) {
    const cfg = this.cfg, G = this.goods, B = cfg.ROYAL * p.incLast;
    if (!p.share || !p.inputs.length) return;
    for (let i = 0; i < p.inputs.length; i++) { const a0 = B * p.share[i]; if (!(a0 > 0)) continue;
      const lv = leavesOf(p.inputs[i]), a = a0 / lv.length;   // признак-произведение: доля -- поровну листьям
      for (const id of lv) { const o = G.owner[id];
      if (!o || !G.alive[id]) continue;
      if (G.kind[id] === 'нерв' || G.kind[id] === 'неожиданность' || G.kind[id] === 'ожидание') { const ps = o.parts; if (ps.length) for (const q of ps) this.led.earn(p, q, a / ps.length, 'часть->часть: роялти за нерв'); }
      else if (o.alive) this.led.earn(p, o, a, `часть->${o.kind}: роялти`); }
    }
  }
  kill(p, why) {
    const c = p.ch;
    // KEEPW: умирающая часть оставляет каналу то, что знала о молчащих словах
    if (this.cfg.KEEPW && p.inputs.length) { const [t0, t1] = this.window([c.good, ...p.inputs]); const fr = t1 - t0 >= 40 ? this.silentIdx(p, t0, t1) : null;
      if (fr) { c.keep = c.keep || new Map(); for (const i of fr) if (!c.keep.has(keyOf(p.inputs[i])) && Number.isFinite(p.w[i])) c.keep.set(keyOf(p.inputs[i]), this.cfg.KPRIOR ? { d: p.inputs[i], w: p.w[i], n: (p.gn && p.gn.get(keyOf(p.inputs[i]))) || 15, t: this.t } : { d: p.inputs[i], w: p.w[i] }); } }
    this.stat.deaths++; this.stat.deathsByKind[why] = (this.stat.deathsByKind[why] || 0) + 1;
    if (p.bitsAvg < 0.05 && this.t - p.born > 100) c.fails = Math.min(c.fails + 1, 12);
    this.led.close(p); c.parts.splice(c.parts.indexOf(p), 1);
    const G = this.goods, dead = p.good; G.kill(dead);
    for (const q of this.ch) for (const o of q.parts) { const i = o.inputs.indexOf(dead); if (i >= 0) { o.inputs.splice(i, 1); o.w = Float64Array.from([...o.w.slice(0, i), ...o.w.slice(i + 1)]); o.share = null; o.x = null; this.memOf(o); } }
    for (const q of this.ch) if (q.note && q.note.inputs.includes(dead)) q.note = null;
  }
  economy() {
    const cfg = this.cfg, led = this.led, R = this.rng;
    for (const c of this.ch) for (const p of c.parts.slice()) {
      // KEEPW: часть, все входы которой -- молчащие слова, спит: знание держит, аренду не платит (память без дела ничего не стоит)
      if ((cfg.KEEPW && p.dormant) || c.asleep) { p.age++; p.hungry = 0; p.incLast = p.inc; p.inc = 0; continue; }
      p.age++; led.rent(p, cfg.RENT);
      if (p.credit > cfg.CAP) led.move(p, 'bank', p.credit - cfg.CAP, 'часть->банк: налог сверх потолка');
      p.hungry = p.credit < 0 ? p.hungry + 1 : 0;
      p.incLast = p.inc; p.incAvg += 0.01 * (p.inc - p.incAvg); p.inc = 0;
      if (p.hungry > cfg.DIE) this.kill(p, 'долг');
    }
    EX.economy(this); MEM.economy(this); CC.economy(this);
    if (this.t % 2000 === 0) for (const c of this.ch) if (c.fails > 0) c.fails--;   // память о неудачах гаснет
    for (const c of this.ch) {
      if (c.parts.length >= cfg.PER || c.asleep) continue;
      if (this.t === 1) { while (c.parts.length < cfg.PER) { this.newPart(c, 'bank', cfg.START, null); this.stat.imm++; } continue; }
      let rich = null; for (const p of c.parts) if (!rich || p.credit > rich.credit) rich = p;
      if (rich && rich.credit > cfg.BIRTH + 5) {   // потомок богатого: половина цены -- ему, половина -- банку
        led.move(rich, 'bank', cfg.BIRTH / 2, 'часть->банк: рождение'); const ch = this.newPart(c, rich, cfg.BIRTH / 2, rich); if (cfg.KEEPW) this.inherit(ch); this.stat.births++;
      } else if (R() < cfg.IMM * Math.pow(cfg.IMMB, c.fails)) {   // пришелец: с книжкой канала
        const p = this.newPart(c, 'bank', cfg.START, null); this.stat.imm++;
        if (c.note) { const ok = c.note.inputs.filter((d) => this.aliveIn(d)); p.inputs = ok; p.w = new Float64Array(ok.length); this.memOf(p); }
        if (cfg.KEEPW) this.inherit(p);
        this.fit(p);                                // подгонка новичка -- за его счёт
      }
    }
  }
  partsAll() { const a = []; for (const c of this.ch) a.push(...c.parts); return a; }
}
module.exports = { Brain };

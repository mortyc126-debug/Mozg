'use strict';
// Мир неизвестных органов (NEURON4.md; ROADMAP нейрона-4, ступень «подключение органа»).
// Мозг видит только нервы: у каждого нерва в каждом круге есть значение (что он приносит в мозг) и мозг может подать на
// него команду (что он посылает по нерву). Что за нерв -- датчик, двигатель, ничего, -- мозгу не сказано: команда на
// входной нерв ни на что не действует, а у выходного нерва чтение -- только шум.
//
// Основа мира (видна с рождения):
//   источники   s(t+1) = r s(t) + шум, r -- от 0 до 0.9
//   смеси       m(t+1) = сочетание сегодняшних источников и смесей (1-WMP родителей) + шум WMN; разброс каждого канала 1
//   глубокие    d(t+1) = h(t), где h -- скрытый источник (AR с памятью до WHR): своё прошлое почти ничего не даёт
//   состояние   z(t+1) = ZA z(t) + b u(t+1-DLAG) + шум; u -- команда по нерву конечности (до подключения её нет)
//   цель        g -- уровень, меняется в среднем раз в GT кругов
// Польза движений (общий сигнал, его видят все, как дофамин): C = CPAY (2 - (z-g)^2) / 2 за круг. Платит мир не её, а вклад
// движений -- как роялти частям, «без него»: насколько C этого круга больше, чем у двойника z, которого никто никогда не
// двигал (тот же мир, тот же шум). Лепет стоит немного, хорошее управление окупается, а за то, что цель случайно ушла
// далеко, тот, кто двигает, не отвечает. Вклад одной последней команды (z без её b u) не годится: у z есть память, и когда
// z уже держится у цели, каждая следующая команда лишь чуть его подправляет -- хороший орган получал ~0.5 за круг и
// разорялся (правка нейрона-4, results/devices).
//
// Устройства (DEV=1, круг TPLUG): новые нервы в конце списка, вперемешку.
//   глаз (DEYE нервов)   e(t) = A h(t) + шум -- видит скрытые источники через неизвестное смешивание; по нему предсказуемы
//                        глубокие каналы
//   конечность (2 нерва) двигатель: команда u сдвигает z с усилением b (знак и величина неизвестны), сам нерв -- шум;
//                        чувство положения: p(t) = u(t-1) + шум
//   пустышка (DDUD)      белый шум, команды не слышит
// Пересадка (TSWAP): SWAPK=1 -- усиление конечности меняет знак; 2 -- ещё и двигатель с чувством положения меняются нервами.
//
// Слова «родителя» (WORDS -- битовая маска групп: 1 -- движение, 2 -- глаз, 4 -- польза). Группа 1: мир ещё и толкает z сам (толчок с вероятностью KICKP, размах около KICKA), а «родитель»
// называет, что случилось с z, -- одним из пяти слов на пяти нервах (в каждом круге высок ровно один), через WDLAG кругов
// после перехода:
//   «тихо»                          -- z сдвинулся мало;
//   «я вверх» / «я вниз»            -- z сдвинула команда мозга (b u больше WTH и больше толчка), по знаку сдвига;
//   «оно вверх» / «оно вниз»        -- z сдвинул толчок мира.
// Группа 2 (глаз): «светло» / «темно» -- скрытый источник 1 выше 0.8 / ниже -0.8 (его видит глаз; глубокий канал покажет
// его лишь кругом позже). Группа 3 (польза): «хорошо» / «плохо» -- z у цели (|z - g| < 0.5) / далеко (> 2).
// Мозгу не сказано, что это слова и о чём они: пять нервов среди прочих. Отличить «я» от «оно» можно, только если мозг
// знает свою команду (копия команды, чувство положения); NOCOPY=1 -- контроль: копии команды и чувства положения нет.
const { stream } = require('./rng');

class World {
  // voc -- общий словарь (WORLD=one, ONEVOC=1): нервы «вверх» / «вниз», общие с другими мирами (src/worldone.js)
  constructor(cfg, seed, voc = null) {
    this.cfg = cfg; this.seed = seed; this.voc = voc;
    const r = stream(seed, 'устройство мира'); this.rn = stream(seed, 'шум мира'); this.rg = stream(seed, 'цели');
    const c = cfg;
    this.ch = [];                           // каналы мира: { type, val, ... }
    const add = (o) => { o.val = 0; this.ch.push(o); return o; };
    this.src = []; for (let i = 0; i < c.WNS; i++) this.src.push(add({ type: 'источник', r: 0.9 * r() }));
    this.mix = [];
    for (let j = 0; j < c.WNM; j++) {
      const pool = [...this.src, ...this.mix], np = 1 + r.int(Math.min(c.WMP, pool.length)), par = [];
      while (par.length < np) { const q = pool[r.int(pool.length)]; if (!par.some((x) => x.p === q)) par.push({ p: q, w: r.sign() * (0.5 + 0.5 * r()) }); }
      this.mix.push(add({ type: 'смесь', par, k: 1 }));
    }
    this.hid = []; this.deep = [];
    for (let i = 0; i < c.WNH; i++) { const h = { type: 'скрытый', r: c.WHR * r(), val: 0 }; this.hid.push(h); this.deep.push(add({ type: 'глубокий', h })); }
    this.z = add({ type: 'состояние' }); this.g = add({ type: 'цель' });
    this.b = r.sign() * (0.7 + 0.8 * r());   // усиление конечности
    this.norm(r);
    // нервы: каналы основы вперемешку
    this.nerves = this.ch.map((ch) => ({ ch, kind: ch.type })); this.shuffle(this.nerves, r);
    // устройства -- заранее, подключаются на TPLUG
    this.dev = [];
    for (let k = 0; k < c.DEYE; k++) { const a = this.hid.map(() => r.gauss()), s = Math.hypot(...a) || 1; this.dev.push({ kind: 'глаз', a: a.map((x) => 0.95 * x / s), val: 0 }); }
    this.motor = { kind: 'двигатель', val: 0 }; this.prop = { kind: 'положение', val: 0 }; this.dev.push(this.motor, this.prop);
    for (let k = 0; k < c.DDUD; k++) this.dev.push({ kind: 'пустышка', val: 0 });
    this.shuffle(this.dev, r);
    this.plugged = false; this.uHist = new Float64Array(8); this.uPos = 0; this.t = 0;
    this.motorNerve = -1; this.propNerve = -1;
    if (c.WORDS) {                            // группы нервов-слов -- среди нервов основы, вперемешку
      this.rw = stream(seed, 'слова'); this.wg = [];
      const grp = (name, words) => { const g = { name, words, ch: words.map((w, i) => ({ type: 'слово', word: i, val: i === 0 ? 1 : 0 })), q: [], now: 0,
        st: { conf: words.map(() => new Float64Array(words.length)), lift: words.map(() => [0, 0, 0, 0]) } };
        for (let i = 0; i < c.WDLAG - 1; i++) g.q.push(0);   // слово перехода круга r видно в круге r + WDLAG
        for (const ch of g.ch) this.nerves.push({ ch, kind: 'слово' }); this.wg.push(g); return g; };
      // общий словарь (voc): фраза из двух слов -- своё «чьё / что» (heads) и общее «вверх / вниз» (dr: +1 / -1). Своих нервов
      // у группы -- только heads; hd[i] -- какое из них звучит в слове i (-1 -- ничего), dr[i] -- куда
      const vgrp = (name, words, heads, hd, dr) => { const g = grp(name, []); g.words = words; g.voc = true; g.hd = hd; g.dr = dr; g.drop = [0, 0];
        g.ch = heads.map((h) => ({ type: 'слово', head: h, val: 0 })); for (const ch of g.ch) this.nerves.push({ ch, kind: 'слово' });
        g.st = { conf: words.map(() => new Float64Array(words.length)), lift: words.map(() => [0, 0, 0, 0]) }; return g; };
      if (c.WORDS & 1) this.gMove = voc ? vgrp('движение', ['тихо', 'я вверх', 'я вниз', 'оно вверх', 'оно вниз'], ['я', 'оно'], [-1, 0, 0, 1, 1], [0, 1, -1, 1, -1])
        : grp('движение', ['тихо', 'я вверх', 'я вниз', 'оно вверх', 'оно вниз']);
      if (c.WORDS & 2) this.gEye = grp('глаз', ['—', 'светло', 'темно']);
      if (c.WORDS & 4) this.gGood = grp('польза', ['—', 'хорошо', 'плохо']);
      // опыт «слово вместо глаза» (WFAKE=1 -- контроль): «светло / темно» говорятся не о скрытом источнике 1, а о другом,
      // независимом процессе с той же памятью -- слово звучит так же часто, но о мире не говорит ничего
      if (c.WFAKE) { this.rf = stream(seed, 'подделка'); this.fakeH = { r: this.hid[0].r, val: 0 }; }
      // опыт «слово как просьба» (группа 8): родитель иногда просит «вверх» или «вниз» (с вероятностью RQP за круг, просьба
      // длится RQLEN кругов, слово звучит всё это время). Если сдвиг z командой мозга идёт в сторону просьбы, родитель доволен:
      // RQPAY x (направление x сдвиг) -- в пользу и в плату тому, кто двигал. RQFAKE=1 -- контроль: слово звучит о другой,
      // независимой просьбе (родитель доволен по настоящей, но мозг её не слышит)
      if (c.WORDS & 8) { this.gReq = voc ? vgrp('просьба', ['—', 'вверх', 'вниз'], ['давай'], [-1, 0, 0], [0, 1, -1]) : grp('просьба', ['—', 'вверх', 'вниз']); this.rq = stream(seed, 'просьбы');
        this.req = { d: 0, left: 0, fd: 0, fleft: 0, vis: 0, pay: 0, st: { n: 0, dot: 0, agree: 0, moved: 0, bn: 0, bdot: 0, bagree: 0, bmoved: 0 }, win: [] }; }
      // ступень 2 -- сказать (SPEAK=1): нерв «рта» на каждое слово всех групп, кроме «тихо» / «—» (команда на нерв -- сказать слово;
      // сказано то, чья команда больше SPTH и больше остальных) и нерв «улыбка» -- ответ родителя: +1, если сказанное верно
      // называет прошлое событие своей группы (то, что мозг уже видел, а родитель назовёт только в следующем круге), -SPNEG, если нет;
      // молчание -- 0. Ответ родителя входит в пользу (её видят все), а сказавшему мир платит SPAY за каждую единицу ответа.
      if (c.SPEAK) {
        // и «ухо» -- мозг слышит свой голос: в следующем круге на нерве уха -- был ли голос (1) или нет (0), как
        // младенец слышит свой лепет; так исследователь и находит нервы рта -- все они действуют на один нерв уха
        this.mouth = []; for (const g of this.wg) { g.last = 0; g.fr = g.words.map((_, i) => (i ? 0.1 : 0.6)); g.sp = { conf: g.words.map(() => new Float64Array(g.words.length)), win: [] }; if (g !== this.gReq || c.RQSAY) for (let i = 1; i < g.words.length; i++) this.mouth.push({ type: 'рот', g, word: i, val: 0 }); }
        // OWNV=1: ухо слышит и само слово -- своё слово звучит на том же нерве-слове, что и слово родителя (голос другой --
        // это видно по нерву громкости своего голоса). Так младенец узнаёт, какой звук какое слово: свой лепет похож на речь.
        this.smile = { type: 'улыбка', val: 0 }; this.ear = { type: 'ухо', val: 0 };
        for (const ch of this.mouth) this.nerves.push({ ch, kind: 'рот' }); this.nerves.push({ ch: this.smile, kind: 'улыбка' }, { ch: this.ear, kind: 'ухо' });
        this.approval = 0; this.spPay = null;
        // диалог (ASK=1): родитель спрашивает -- нервы вопроса, один на группу слов («что делал?», «что видишь?», «как тебе?»);
        // спрашивает (с вероятностью QP за круг) о группе, где только что что-то было; ответ ждёт в том же круге, когда мозг
        // слышит вопрос: верное слово этой группы -- +1, неверное или чужое -- -SPNEG, молчание -- 0; речь без вопроса -- -SPUNASK
        // RQSAY=0: слова просьбы мозг не говорит и о них не спрашивают (иначе свой голос звучит на нервах просьбы -- его «вверх»
        // становится просьбой самому себе)
        if (c.ASK) { this.qn = this.wg.filter((g) => g !== this.gReq || c.RQSAY).map((g) => ({ type: 'вопрос', g, val: 0 })); for (const ch of this.qn) this.nerves.push({ ch, kind: 'вопрос' });
          this.qAsk = null; this.qst = { by: this.wg.map(() => [0, 0, 0, 0]), unasked: [0, 0], win: [], conf: this.wg.map((g) => g.words.map(() => new Array(g.words.length + 1).fill(0))) }; }
      }
      this.shuffle(this.nerves, this.rw); this.selfWin = [];
    }
  }
  shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = r.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } }
  // разброс каждой смеси -- 1: множитель линейной части подбирается прогоном (по порядку, родители уже нормированы)
  norm(r) {
    const c = this.cfg, T = 20000, rr = stream(this.seed, 'нормировка');
    if (c.WNORM) {   // одна прогонка: множитель каждой смеси -- по разбросу её линейной части с начала прогонки; смесь j зависит только от
      // источников и смесей до неё, поэтому множители устанавливаются по порядку, как в точной нормировке (разбор 23.10, тело в 1 000 нервов)
      const s2 = new Float64Array(this.mix.length); let n = 0;
      for (const ch of this.ch) ch.val = 0;
      for (let t = 0; t < T; t++) {
        for (const s of this.src) s.nv = s.r * s.val + Math.sqrt(1 - s.r * s.r) * rr.gauss();
        for (let j = 0; j < this.mix.length; j++) { const m = this.mix[j]; let v = 0; for (const { p, w } of m.par) v += w * p.val;
          if (t > 200) s2[j] += v * v; if (t > 400) m.k = Math.sqrt(1 - c.WMN * c.WMN) / Math.sqrt(s2[j] / (t - 200) + 1e-12); m.nv = m.k * v + c.WMN * rr.gauss(); }
        for (const s of this.src) s.val = s.nv; for (const m of this.mix) m.val = m.nv;
      }
      for (const j in this.mix) { const m = this.mix[j]; m.k = Math.sqrt(1 - c.WMN * c.WMN) / Math.sqrt(s2[j] / (T - 201) + 1e-12); delete m.nv; }
      for (const s of this.src) delete s.nv;
      for (const ch of this.ch) ch.val = 0; for (const h of this.hid) h.val = 0; return;
    }
    for (let j = 0; j < this.mix.length; j++) {
      for (const ch of this.ch) ch.val = 0;
      let s2 = 0, n = 0;
      for (let t = 0; t < T; t++) { const lin = this.stepBase(rr, j); if (t > 200) { s2 += lin * lin; n++; } }
      this.mix[j].k = Math.sqrt(1 - c.WMN * c.WMN) / Math.sqrt(s2 / n + 1e-12);
    }
    for (const ch of this.ch) ch.val = 0; for (const h of this.hid) h.val = 0;
  }
  // шаг источников и смесей; upto -- до какой смеси (для нормировки), возвращает линейную часть смеси upto
  stepBase(rn, upto = Infinity) {
    const c = this.cfg; let lin = 0;
    const nv = new Map();
    for (const s of this.src) nv.set(s, s.r * s.val + Math.sqrt(1 - s.r * s.r) * rn.gauss());
    for (let j = 0; j < this.mix.length && j <= upto; j++) { const m = this.mix[j]; let v = 0; for (const { p, w } of m.par) v += w * p.val;
      if (j === upto) lin = v; nv.set(m, m.k * v + c.WMN * rn.gauss()); }
    for (const [ch, v] of nv) ch.val = v;
    return lin;
  }
  plug() {
    this.plugged = true;
    for (const d of this.dev) this.nerves.push({ dev: d, kind: d.kind });
    this.motorNerve = this.nerves.findIndex((n) => n.dev === this.motor); this.propNerve = this.nerves.findIndex((n) => n.dev === this.prop);
  }
  swap() {
    const c = this.cfg; this.b = -this.b;
    if (c.SWAPK === 2) { const a = this.nerves[this.motorNerve], b = this.nerves[this.propNerve]; [a.dev, b.dev] = [b.dev, a.dev]; [a.kind, b.kind] = [b.kind, a.kind];
      [this.motorNerve, this.propNerve] = [this.propNerve, this.motorNerve]; }
  }
  get n() { return this.nerves.length; }
  // что приносит нерв в этом круге (с шумом SN)
  observe(out) {
    const c = this.cfg, rn = this.rn;
    for (let k = 0; k < this.nerves.length; k++) { const nv = this.nerves[k]; out[k] = (nv.ch ? nv.ch.val : nv.dev.val) + c.SN * rn.gauss(); }
    return out;
  }
  // польза движений в этом круге (за z и g этого круга)
  comfort() { const d = this.z.val - this.g.val; return this.cfg.CPAY * (2 - d * d) / 2 + (this.mouth ? this.cfg.SPAY * this.approval : 0) + (this.req ? this.req.pay : 0); }
  // плата за сказанное слово: [номер нерва рта, сумма] -- тому, кто подал команду в прошлом круге
  speechPay() { return this.spPay; }
  // вклад последней команды в пользу этого круга (плата мира тому, кто её подал)
  marginal() { return this.marg || 0; }
  // шаг мира: u -- команды мозга этого круга по всем нервам
  advance(u) {
    const c = this.cfg, rn = this.rn, t = ++this.t;
    if (c.DEV && !this.plugged && t === c.TPLUG) this.plug();
    if (c.TSWAP && this.plugged && t === c.TSWAP) this.swap();
    const um = this.plugged ? u[this.motorNerve] || 0 : 0;
    this.uHist[this.uPos = (this.uPos + 1) % 8] = um;
    const uLag = this.uHist[(this.uPos - (c.DLAG - 1) + 8) % 8];
    const hNow = this.hid.map((h) => h.val);
    this.stepBase(rn);
    this.hid.forEach((h, i) => { h.val = h.r * h.val + Math.sqrt(1 - h.r * h.r) * rn.gauss(); this.deep[i].val = hNow[i]; });
    const ez = Math.sqrt(1 - c.ZA * c.ZA) * rn.gauss();
    // толчок мира (только в мире слов) -- внешнее событие: его получает и двойник без движений
    const kick = c.WORDS && this.rw() < c.KICKP ? (this.rw() < 0.5 ? -1 : 1) * c.KICKA * (0.75 + 0.5 * this.rw()) : 0;
    this.z.val = c.ZA * this.z.val + this.b * uLag + ez + kick; this.z0 = c.ZA * (this.z0 || 0) + ez + kick;   // z0 -- двойник без движений
    this.wSelf = this.b * uLag; this.wKick = kick;
    if (this.rg() < 1 / c.GT) this.g.val = this.rg.gauss();
    { const d = this.z.val - this.g.val, d0 = this.z0 - this.g.val; this.marg = c.CPAY * (d0 * d0 - d * d) / 2; }
    if (this.req) {                           // просьба, которую мозг слышал в круге своей команды: доволен ли родитель
      const R = this.req, dir = R.vis; R.pay = dir ? c.RQPAY * dir * this.wSelf : 0; this.marg += R.pay;
      if (this.plugged) { const late = this.t > c.ROUNDS / 2, mv = Math.abs(this.wSelf) > 0.3, ag = mv && Math.sign(this.wSelf) === dir;
        const wi = Math.floor((this.t - 1) / 1000), Wn = R.win[wi] || (R.win[wi] = [0, 0, 0, 0]);
        if (dir) { Wn[1]++; if (ag) Wn[0]++; if (late) { R.st.n++; R.st.dot += dir * this.wSelf; if (mv) R.st.moved++; if (ag) R.st.agree++; } }
        else { const pd = this.rq() < 0.5 ? -1 : 1; Wn[3]++; if (mv && Math.sign(this.wSelf) === pd) Wn[2]++;   // без просьбы -- со сторону наугад
          if (late) { R.st.bn++; R.st.bdot += pd * this.wSelf; if (mv) R.st.bmoved++; if (mv && Math.sign(this.wSelf) === pd) R.st.bagree++; } } } }
    // сказал ли мозг слово этим кругом (по командам этого круга) -- и ответ родителя
    if (this.mouth) {
      let best = -1, bv = c.SPTH; this.mouth.forEach((ch, i) => { const k = this.nerves.findIndex((nv) => nv.ch === ch), v = u[k] || 0; if (v > bv) { bv = v; best = i; } });
      // SPINFO: родителя радует новое -- за верное слово 1 минус то, как часто это слово верно (частоту родитель знает по опыту)
      const said = best >= 0 ? this.mouth[best] : null;
      let R = said ? (said.g.last === said.word ? (c.SPINFO ? 1 - said.g.fr[said.word] : 1) : -c.SPNEG) : 0;
      if (c.ASK) { const q = this.qAsk;
        if (q) { const ok = said && said.g === q && said.word === q.last; R = said ? (ok ? 1 : -c.SPNEG) : 0;
          const gi = this.wg.indexOf(q), wi = Math.floor((this.t - 1) / 1000), Wn = this.qst.win[wi] || (this.qst.win[wi] = [0, 0, 0, 0]); Wn[1]++; if (ok) Wn[0]++;
          if (this.t > c.ROUNDS / 2) { const B4 = this.qst.by[gi]; B4[3]++; if (ok) B4[0]++; else if (said) B4[1]++; else B4[2]++;
            this.qst.conf[gi][q.last][said ? (said.g === q ? said.word : q.words.length) : 0]++; } }
        else { R = said ? -c.SPUNASK : 0; const wi = Math.floor((this.t - 1) / 1000), Wn = this.qst.win[wi] || (this.qst.win[wi] = [0, 0, 0, 0]); Wn[3]++; if (said) Wn[2]++;
          if (this.t > c.ROUNDS / 2) { this.qst.unasked[1]++; if (said) this.qst.unasked[0]++; } } }
      this.approval = R; this.smile.val = R; this.ear.val = said ? 1 : 0; this.spPay = said ? [this.nerves.findIndex((nv) => nv.ch === this.mouth[best]), c.SPAY * R] : null;   // ухо слышит, что голос был (громкость), а не какое слово
      if (c.OWNV) for (const g of this.wg) g.own = said && said.g === g ? said.word : 0;   // свой голос услышит в следующем круге
      for (const g of this.wg) { const sg = said && said.g === g ? said.word : 0, wi = Math.floor((this.t - 1) / 1000), Wn = g.sp.win[wi] || (g.sp.win[wi] = [0, 0, 0, 0]);
        if (this.t > c.ROUNDS / 2) g.sp.conf[g.last][sg]++;
        if (g.last) { Wn[1]++; if (sg === g.last) Wn[0]++; } else { Wn[3]++; if (sg) Wn[2]++; } }
    }
    // родитель называет этот переход (слово прозвучит через WDLAG кругов): движение z -- «я» или «оно»; что видит глаз
    // (скрытый источник 1, который виден глазу, а глубокий канал покажет его лишь кругом позже); польза -- z у цели или далеко
    if (c.WORDS) {
      const say = (g, w) => { g.last = w; if (g.fr) for (let i = 0; i < g.fr.length; i++) g.fr[i] += 0.002 * ((i === w ? 1 : 0) - g.fr[i]); g.q.push(w); g.now = g.q.shift(); if (!g.voc) g.ch.forEach((ch, i) => { ch.val = i === g.now || (i && i === g.own) ? 1 : 0; }); };
      if (this.gMove) { const self = this.wSelf, kick = this.wKick; let w = 0;
        if (Math.abs(self) >= c.WTH && Math.abs(self) >= Math.abs(kick)) w = self > 0 ? 1 : 2; else if (Math.abs(kick) >= c.WTH) w = kick > 0 ? 3 : 4;
        say(this.gMove, w); }
      if (this.fakeH) { const f = this.fakeH; f.val = f.r * f.val + Math.sqrt(1 - f.r * f.r) * this.rf.gauss(); }
      if (this.gEye) { const h = this.fakeH ? this.fakeH.val : this.hid[0].val; say(this.gEye, h > 0.8 ? 1 : h < -0.8 ? 2 : 0); }
      if (this.gReq) { const R = this.req;   // просьба на следующий круг (её слышат в круге команды)
        if (R.left > 0) R.left--; else if (this.rq() < c.RQP) { R.d = this.rq() < 0.5 ? -1 : 1; R.left = c.RQLEN; }
        if (R.left === 0) R.d = 0;
        if (c.RQFAKE) { if (R.fleft > 0) R.fleft--; else if (this.rq() < c.RQP) { R.fd = this.rq() < 0.5 ? -1 : 1; R.fleft = c.RQLEN; } if (R.fleft === 0) R.fd = 0; }
        R.vis = R.d; const heard = c.RQFAKE ? R.fd : R.d, w = heard > 0 ? 1 : heard < 0 ? 2 : 0;
        this.gReq.now = w; this.gReq.last = w; if (!this.gReq.voc) this.gReq.ch.forEach((ch, i) => { ch.val = i === w ? 1 : 0; }); }
      if (this.gGood) { const d = this.z.val - this.g.val; say(this.gGood, d * d < 0.25 ? 1 : d * d > 4 ? 2 : 0); }
      // общий словарь: родитель говорит одну фразу за раз. Первой идёт просьба, потом описание движения, потом свой голос мозга
      // (он слышен, только если родитель молчит). Не прозвучавшая фраза пропадает (g.drop: [пропало, всего]); g.now -- то, что
      // прозвучало от родителя (по нему мерится, ждал ли мозг слова)
      if (this.voc) {
        const V = this.voc, vg = this.wg.filter((g) => g.voc).sort((a, b) => (b === this.gReq) - (a === this.gReq)); let win = null;
        for (const g of vg) if (!win && g.now > 0) win = [g, g.now];
        for (const g of vg) if (!win && c.OWNV && g.own > 0) win = [g, g.own];
        for (const g of vg) { for (const ch of g.ch) ch.val = 0; if (g.now > 0) { g.drop[1]++; if (!win || win[0] !== g || win[1] !== g.now) { g.drop[0]++; g.now = 0; } } }
        if (win) { const [g, w] = win; g.ch[g.hd[w]].val = 1; }
        const d = win ? win[0].dr[win[1]] : 0; V.up.val = d > 0 ? 1 : 0; V.dn.val = d < 0 ? 1 : 0; this.vocBusy = !!win;
      }
      if (this.qn) {                          // вопрос на следующий круг -- о группе, где только что что-то было
        const cand = this.wg.filter((g) => g.last && (g !== this.gReq || c.RQSAY)); this.qAsk = cand.length && this.rw() < c.QP ? cand[Math.floor(this.rw() * cand.length)] : null;
        for (const ch of this.qn) ch.val = ch.g === this.qAsk ? 1 : 0; }
    }
    // устройства (значения этого нового круга)
    for (const d of this.dev) {
      if (d.kind === 'глаз') { let v = 0; d.a.forEach((a, i) => { v += a * this.hid[i].val; }); d.val = v + Math.sqrt(1 - 0.95 * 0.95) * rn.gauss(); }
      else if (d.kind === 'пустышка') d.val = rn.gauss();
      else if (d.kind === 'положение') d.val = c.NOCOPY ? rn.gauss() : um;
      else d.val = 0;
    }
  }
  // понимает ли мозг слова: прогнозы частей о нервах-словах следующего круга против слова, которое прозвучит (после шага
  // мозга мир уже сделал шаг, g.now -- слово следующего круга). Матрицы -- во второй половине жизни, без кругов у пересадки;
  // «я / оно» по окнам в 1 000 кругов -- всю жизнь (видно, как мозг переучивается после пересадки).
  score(B) {
    const c = this.cfg; if (!c.WORDS) return;
    const late = this.t > c.ROUNDS / 2 && !(c.TSWAP && this.t > c.TSWAP - 200 && this.t < c.TSWAP + 3000);
    const pr = (C) => { if (!C) return 0; const ps = C.parts; let s = 0; for (const q of ps) s += q.pred; return ps.length ? s / ps.length : C.mean; }, fq = (C) => (C ? Math.max(C.mean, 0.005) : 0.1);
    for (const g of this.wg) {
      if (g.voc) {                            // общий словарь: сначала чьё (или тишина), потом куда -- по отношению прогноза к частоте
        const H = g.ch.map((ch) => B.ch[this.nerves.findIndex((nv) => nv.ch === ch)]), ph = H.map(pr), fh = H.map(fq);
        let bh = -1, bv = (1 - ph.reduce((a, b) => a + b, 0)) / Math.max(0.005, 1 - fh.reduce((a, b) => a + b, 0));
        ph.forEach((v, k) => { if (v / fh[k] > bv) { bv = v / fh[k]; bh = k; } });
        const D = B.dir || [], up = pr(D[0]) / fq(D[0]) >= pr(D[1]) / fq(D[1]) ? 1 : -1;
        const best = bh < 0 ? 0 : g.words.findIndex((_, i) => g.hd[i] === bh && g.dr[i] === up);
        if (late) g.st.conf[g.now][best]++;
        if (g === this.gMove && g.now > 0) { const wi = Math.floor((this.t - 1) / 1000), W = this.selfWin[wi] || (this.selfWin[wi] = [0, 0, 0, 0]);
          const isSelf = g.now <= 2, saidSelf = best === 1 || best === 2, saidOth = best >= 3;
          if (isSelf) { W[1]++; if (saidSelf) W[0]++; } else { W[3]++; if (saidOth) W[2]++; } }
        continue;
      }
      const idx = g.ch.map((ch) => this.nerves.findIndex((nv) => nv.ch === ch));
      const p = idx.map((k) => { const ps = B.ch[k] ? B.ch[k].parts : []; let s = 0; for (const q of ps) s += q.pred; return ps.length ? s / ps.length : (B.ch[k] ? B.ch[k].mean : 0); });
      // выбор слова -- по отношению прогноза к частоте слова (иначе почти всегда самое частое)
      const fr = idx.map((k) => (B.ch[k] ? Math.max(B.ch[k].mean, 0.005) : 0.1));
      let best = 0, bv = -Infinity; p.forEach((v, i) => { const r = v / fr[i]; if (r > bv) { bv = r; best = i; } });
      if (late) { g.st.conf[g.now][best]++; for (let i = 0; i < p.length; i++) { const L = g.st.lift[i]; if (g.now === i) { L[0] += p[i]; L[1]++; } else { L[2] += p[i]; L[3]++; } } }
      if (g === this.gMove && g.now > 0) { const wi = Math.floor((this.t - 1) / 1000), W = this.selfWin[wi] || (this.selfWin[wi] = [0, 0, 0, 0]);
        const isSelf = g.now <= 2, saidSelf = best === 1 || best === 2, saidOth = best >= 3;
        if (isSelf) { W[1]++; if (saidSelf) W[0]++; } else { W[3]++; if (saidOth) W[2]++; } }
    }
  }
  // врождённое внимание к голосу: за угаданное слово мир платит в WSAL раз больше (младенец с рождения слушает речь
  // охотнее других звуков); остальным нервам -- как обычно
  salience(k) { if (!this.wg || this.cfg.WSAL === 1) return 1; const nv = this.nerves[k]; return nv && nv.kind === 'слово' ? this.cfg.WSAL : 1; }
  wordReport() {
    if (!this.wg) return null;
    return { ...(this.req ? { req: { st: { ...this.req.st }, win: this.req.win.map((w) => (w ? w.slice() : [0, 0, 0, 0])) } } : {}), ask: this.qst ? { names: this.wg.map((g) => g.name), by: this.qst.by.map((x) => x.slice()), unasked: this.qst.unasked.slice(), conf: this.qst.conf.map((m) => m.map((r) => r.slice())), win: this.qst.win.map((w) => (w ? w.slice() : [0, 0, 0, 0])) } : null, speak: this.mouth ? this.wg.map((g) => ({ name: g.name, words: g.words, conf: g.sp.conf.map((r) => Array.from(r)), win: g.sp.win.map((w) => (w ? w.slice() : [0, 0, 0, 0])) })) : null, groups: this.wg.map((g) => ({ name: g.name, words: g.words, ...(g.drop ? { drop: g.drop.slice() } : {}), conf: g.st.conf.map((r) => Array.from(r)), lift: g.st.lift.map(([a, n, b, m]) => [n ? a / n : NaN, m ? b / m : NaN]) })), selfWin: this.selfWin.map((w) => (w ? w.slice() : [0, 0, 0, 0])) };
  }
  // правда о нервах -- только для замеров
  truth() { return this.nerves.map((nv) => nv.kind); }
}
module.exports = { World };

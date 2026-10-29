'use strict';
// Миры экзамена способностей (tools/exam.js). Каждый мир проверяет одну способность понимания. Слово для мозга здесь,
// как везде, -- безымянный нерв: 1, когда слово звучит, иначе 0. Плюс отвлекающие нервы (источники с памятью), чтобы
// мозгу было что искать и кроме нужного. Мир ничего не платит за движения; нервов-выходов нет.
//
// EXAM=перенос -- общее понятие: два имени одной вещи. Вещь L появляется с вероятностью XPL за круг; кругом позже её видно
// на нерве «предмет» S. Жизнь -- три доли:
//   1 (до 0.4 жизни)   родитель называет вещь то словом a, то словом b (наугад поровну): мозг может узнать, что a и b -- одно;
//   2 (до 0.8 жизни)   родитель говорит только a; у вещи появляется новое свойство -- нерв «следствие» Y кругом позже;
//   3 (до конца)       родитель говорит только b. Ждёт ли мозг следствия Y, услышав b, хотя b и Y ни разу не встречались?
//                      Первые XK раз следствие не показывается (проба): мозг не может переучиться, мера -- только его ожидание.
// Контроль (XCTRL=1): в доле 1 слово b называет другую, независимую вещь L2 (её видно на своём нерве S2); дальше -- так же.
// Тогда ждать Y по b нечем: перенос -- только через общее понятие «a и b -- одно».
//
// EXAM=антоним -- то же со знаком: a -- «вещь вверх» (+1 на S), b -- «вниз» (-1). В доле 2 вещь идёт только вверх (a), у неё
// новое свойство Y (тоже +1); в доле 3 -- только вниз (b). Ждёт ли мозг по b, что Y будет -1? Контроль -- как у переноса.
// Этот опыт не участвовал в постройке органа понятий: проверка, что механизм общий, а не подогнан под «перенос».
//
// EXAM=сложение -- сложение смысла: «первое / второе» (какой предмет) и «вверх / вниз» (куда). Событие: предмет o сдвигается
// в сторону d -- оба слова звучат в круге события, кругом позже нерв предмета o показывает d (другой -- 0). До 0.8 жизни
// сочетания «второе вниз» не бывает; потом бывают все четыре. Понял ли мозг «второе вниз», ни разу его не слышав: ждёт ли
// он, что второй предмет пойдёт вниз (-1), а не вверх (+1, как всегда было со «вторым»)? Первые XK раз «второе вниз» нерв
// предмета молчит (проба): переучиться не на чем, мера -- только ожидание мозга.
//
// EXAM=сложение3 -- то же с тремя предметами: до 0.8 жизни второй ходит только вверх, третий -- только вниз. Новые сочетания --
// «второе вниз» и «третье вверх». Этот опыт не участвовал в постройке схемы (src/concepts.js): проверка, что она общая.
//
// EXAM=память -- память разговора: родитель называет один из трёх предметов, через 3-12 кругов спрашивает «что было?», и кругом
// позже нерв ответа показывает тот предмет. Ждёт ли мозг верного ответа (случайно -- 33%)? Контроль: ответ -- случайный предмет.
//
// Экзамен готовности (tools/ready.js):
// EXAM=факт -- факт с одного раза. В эпизоде родитель говорит XFN фактов о разных предметах, каждый один раз: «имя k» и «вверх»
// или «вниз» вместе (свойство предмета в этом эпизоде -- новое, наугад). Через 5-20 кругов (XFLONG=1 -- через 100-400) он
// называет один из них -- кругом позже нерв «свойство» показывает его свойство. Ждёт ли мозг верного знака (наугад -- 50%)?
// Выучить «имя -> свойство» на всю жизнь нельзя: в каждом эпизоде свойства новые. Контроль: сказанное не связано с правдой.
// EXAM=цепочка -- вывод в два шага. Доля 1: за A кругом позже идёт B. Доля 2: за B кругом позже идёт C (A не бывает).
// Доля 3: A, а B не наступает (проба, первые XK раз), -- ждёт ли мозг C через два круга после A? A и C вместе не бывали
// ни разу: ждать C можно, только сложив «A -> B» и «B -> C». Контроль: в доле 2 C идёт за другим событием B2.
// EXAM=ключ -- цель за несколько шагов. Мотор двигает положение j (-3..3); побывал левее -2.2 -- ключ (нерв «ключ» горит);
// с ключом правее 2.2 -- награда (польза 3), попытка заново. Сразу направо идти бесполезно: сначала налево за ключом.
// Попытка -- XEPL кругов. Мера -- доля удачных попыток во второй половине жизни; рядом -- то же у лепета наугад.
// Контроль (XCTRL=1): награда правее 2.2 и без ключа -- цель в один шаг.
//
// EXAM=собеседник -- ложное убеждение (как опыт Салли и Энн). Предмет лежит в A или B, мозг это видит; родитель то смотрит, то
// нет (нерв «родитель смотрит»); кто-то спрашивает его «где?», и он отвечает -- по тому, что видел последним. Когда предмет переложили без него,
// родитель ошибается. Ждёт ли мозг в такие разы слова по мнению родителя, а не по правде?
const { stream } = require('./rng');

class WorldX {
  // ext -- общий словарь (WORLD=one, ONEVOC=1): нервы «вверх» / «вниз» общие с миром органов; сложение пишет в них только в круге
  // своего события, а пока говорит родитель мира органов (mute), событий нет -- родитель говорит одну фразу за раз
  constructor(cfg, seed, ext = null) {
    const c = cfg; this.cfg = c; this.seed = seed; this.t = 0; this.ext = ext; this.mute = false; this.nMute = 0;
    const r = stream(seed, 'устройство мира'); this.rn = stream(seed, 'шум мира'); this.re = stream(seed, 'события');
    this.ch = []; const add = (type, name) => { const o = { type, name, val: 0 }; this.ch.push(o); return o; };
    this.src = []; for (let i = 0; i < c.XND; i++) { const s = add('источник', 'источник'); s.r = 0.9 * r(); this.src.push(s); }
    this.kind = c.EXAM;
    if (c.EXAM === 'перенос' || c.EXAM === 'антоним') {
      this.sign = c.EXAM === 'антоним'; this.tr = true;
      this.a = add('слово', 'a'); this.bw = add('слово', 'b'); this.Sv = add('предмет', 'S'); this.S2 = add('предмет', 'S2'); this.Y = add('следствие', 'Y');
      this.L = 0; this.L2 = 0; this.word = null;
      this.st = { p1: [], p2: [], p3: [] };   // по долям: [круг, слово, прогноз Y, прогноз S]
    } else if (c.EXAM === 'сложение') {
      this.o1 = add('слово', 'первое'); this.o2 = add('слово', 'второе'); if (ext) { this.up = ext.up; this.dn = ext.dn; } else { this.up = add('слово', 'вверх'); this.dn = add('слово', 'вниз'); }
      this.S1 = add('предмет', 'S1'); this.S2 = add('предмет', 'S2');
      this.ev = null; this.st = [];          // [круг, предмет, сторона, прогноз S1, прогноз S2]
    } else if (c.EXAM === 'сложение3') {   // три предмета: второй до 0.8 жизни ходит только вверх, третий -- только вниз
      this.ow = [null, add('слово', 'первое'), add('слово', 'второе'), add('слово', 'третье')]; this.up = add('слово', 'вверх'); this.dn = add('слово', 'вниз');
      this.Sk = [null, add('предмет', 'S1'), add('предмет', 'S2'), add('предмет', 'S3')];
      this.ev = null; this.st = []; this.nH = [0, 0, 0, 0];   // [круг, предмет, сторона, прогнозы S1..S3]
    } else if (c.EXAM === 'память') {       // память разговора: назвал предмет -- через 3-12 кругов спросил «что было?» -- ответ
      this.mw = ['a', 'b', 'c'].map((x) => add('слово', x)); this.q = add('вопрос', 'что было?'); this.noise = add('слово', 'шум');
      this.rv = ['a', 'b', 'c'].map((x) => add('ответ', 'ответ ' + x)); this.ep = null; this.st = [];
      // XPHASE=1 (раунд 6, этап 3): со второй половины жизни -- другие слова d, e, f и другие нервы ответа (первые молчат): то же
      // устройство на новых нервах. Мера (вторая половина жизни) -- как быстро мозг находит память для новых
      if (c.XPHASE) { this.mw2 = ['d', 'e', 'f'].map((x) => add('слово', x)); this.rv2 = ['d', 'e', 'f'].map((x) => add('ответ', 'ответ ' + x)); this.mw1 = this.mw; this.rv1 = this.rv; }
    } else if (c.EXAM === 'собеседник') {   // ложное убеждение: родитель говорит, где предмет, по тому, что видел сам
      this.see = [add('предмет', 'видно A'), add('предмет', 'видно B')]; this.here = add('родитель', 'родитель смотрит'); this.sw = [add('слово', '«в A»'), add('слово', '«в B»')]; this.ask = add('вопрос', '«где?»');
      this.loc = 0; this.present = 1; this.belief = 0; this.st = [];
    } else if (c.EXAM === 'порядок' || c.EXAM === 'счёт' || c.EXAM === 'правило' || c.EXAM === 'больше' || c.EXAM === 'интервал' || c.EXAM === 'счёт до метки' || c.EXAM === 'до метки' || c.EXAM === 'из трёх до метки' || c.EXAM === 'первое после метки') {
      // задачи нового рода (раунд 6, этап 4; придуманы после заморозки языка кирпичиков src/compose.js). Как факт: в круге
      // вопроса мозг должен ждать свойство верного знака, кругом позже нерв «свойство» показывает правду
      //   порядок: A и B звучат в эпизоде оба, в случайном порядке (через 1-4 круга); через 3-8 кругов -- вопрос; свойство +1,
      //            если первым было A, иначе -1
      //   счёт:    слово X звучит 1 или 2 раза (через 2-4 круга); через 2-5 кругов -- вопрос; свойство +1, если X было дважды
      //   правило: в начале эпизода -- подсказка C1 или C2; через 4-10 кругов -- стимул S+ или S- (он же вопрос); свойство --
      //            знак стимула при C1 и обратный при C2
      //   больше:   (этап 4б, после заморозки языка v2) X и Y звучат по 1-3 раза, не поровну, вперемешку через 1-3 круга;
      //             через 2-5 кругов -- вопрос; свойство +1, если X больше
      //   интервал: (этап 4б) X, через 1-2 или 5-8 кругов -- Y; через 2-14 кругов -- вопрос; свойство +1, если промежуток короткий
      // контроль (XCTRL=1): свойство наугад
      const n = (x) => add('слово', x);
      if (c.EXAM === 'больше' || c.EXAM === 'интервал') { this.wX = n('X'); this.wY = n('Y'); this.Q = n('вопрос'); }
      //   счёт до метки: (раунд 7, после заморозки CGROW) X 1 или 2 раза, метка M, после неё X ещё 0-2 раза, вопрос; свойство +1,
      //                  если до метки X был дважды
      //   до метки:      a / b 2-4 раза до метки M и 1-3 раза после, вопрос; свойство +1, если последним до метки было a
      if (c.EXAM === 'счёт до метки') { this.wX = n('X'); this.wM = n('метка'); this.Q = n('вопрос'); }
      if (c.EXAM === 'до метки') { this.wA = n('a'); this.wB = n('b'); this.wM = n('метка'); this.Q = n('вопрос'); }
      //   из трёх до метки:   (раунд 8, после заморозки CSTRUCT) a / b / c 1-3 раза, последним перед меткой -- a или b, после
      //                       метки ещё 1-3 слова; свойство +1, если последним до метки было a
      //   первое после метки: a / b 1-3 раза до метки и 3-5 после; свойство +1, если первым после метки было a
      if (c.EXAM === 'из трёх до метки') { this.wA = n('a'); this.wB = n('b'); this.wC = n('c'); this.wM = n('метка'); this.Q = n('вопрос'); }
      if (c.EXAM === 'первое после метки') { this.wA = n('a'); this.wB = n('b'); this.wM = n('метка'); this.Q = n('вопрос'); }
      if (c.EXAM === 'порядок') { this.wA = n('A'); this.wB = n('B'); this.Q = n('вопрос'); }
      if (c.EXAM === 'счёт') { this.wX = n('X'); this.Q = n('вопрос'); }
      if (c.EXAM === 'правило') { this.c1 = n('C1'); this.c2 = n('C2'); this.sp = n('S+'); this.sm = n('S-'); }
      this.noise = n('шум'); this.P = add('предмет', 'свойство'); this.ep = null; this.gap = 0; this.st = [];
    } else if (c.EXAM === 'факт') {
      this.nm = [0, 1, 2, 3].map((i) => add('слово', 'имя ' + i)); this.up = add('слово', 'вверх'); this.dn = add('слово', 'вниз'); this.P = add('предмет', 'свойство');
      this.ep = null; this.gap = 0; this.st = [];
    } else if (c.EXAM === 'цепочка') {
      this.A = add('событие', 'A'); this.Bv = add('событие', 'B'); this.C = add('событие', 'C'); this.B2 = add('событие', 'B2');
      this.due = new Map(); this.evA = new Map(); this.evB = new Map(); this.nA3 = 0; this.st = { ref: [], test: [], base: [] };
    } else if (c.EXAM === 'ключ') {
      this.mot = add('мотор', 'мотор'); this.echo = add('положение', 'эхо'); this.pos = add('состояние', 'где'); this.key = add('ключ', 'ключ');
      this.j = 0; this.k = 0; this.age = 0; this.rew = 0; this.done = false; this.rnd = { j: 0, k: 0, age: 0 }; this.st = { ep: 0, ok: 0, rep: 0, rok: 0 };
    } else throw new Error(`EXAM=${c.EXAM}: нет такого мира экзамена`);
    this.nerves = this.ch.map((ch) => ({ ch, kind: ch.type })); this.shuffle(this.nerves, r);
    this.plugged = false; this.motorNerve = -1; this.propNerve = -1; this.b = 0; this.z = { val: 0 }; this.g = { val: 0 }; this.uHist = new Float64Array(8); this.uPos = 0;
    this.T1 = Math.round(0.4 * c.ROUNDS); this.T2 = Math.round(0.8 * c.ROUNDS);
    if (this.kind === 'ключ') { this.plugged = true; this.motorNerve = this.nerves.findIndex((nv) => nv.ch === this.mot); this.propNerve = this.nerves.findIndex((nv) => nv.ch === this.echo); }
  }
  shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = r.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } }
  get n() { return this.nerves.length; }
  observe(out) { const sn = this.cfg.SN; for (let k = 0; k < this.nerves.length; k++) out[k] = this.nerves[k].ch.val + sn * this.rn.gauss(); return out; }
  comfort() { return this.kind === 'ключ' ? this.rew : 0; }
  marginal() { return this.kind === 'ключ' ? this.rew : 0; }
  truth() { return this.nerves.map((nv) => nv.kind); }
  idx(ch) { return (this.off || 0) + this.nerves.findIndex((nv) => nv.ch === ch); }   // off -- сдвиг номеров в общем мире (src/worldone.js)
  // значения следующего круга (t + 1)
  advance(u) {
    const c = this.cfg, t = ++this.t, re = this.re;
    for (const s of this.src) s.val = s.r * s.val + Math.sqrt(1 - s.r * s.r) * this.rn.gauss();
    if (this.kind === 'факт') { this.stepFact(t); return; }
    if (this.kind === 'порядок' || this.kind === 'счёт' || this.kind === 'правило' || this.kind === 'больше' || this.kind === 'интервал' || this.kind === 'счёт до метки' || this.kind === 'до метки' || this.kind === 'из трёх до метки' || this.kind === 'первое после метки') { this.stepNew(t); return; }
    if (this.kind === 'цепочка') { this.stepChain(t); return; }
    if (this.kind === 'ключ') { this.stepKey(t, u); return; }
    if (this.kind === 'память') {
      // эпизод: круг упоминания -- задержка D -- вопрос -- ответ кругом позже (на нерве ответа -- упомянутый предмет; в контроле --
      // случайный). Между упоминанием и вопросом других упоминаний нет; слово «шум» звучит наугад (10%)
      if (c.XPHASE && t === Math.floor(c.ROUNDS / 2) + 1) { for (const w of this.mw) w.val = 0; for (const r of this.rv) r.val = 0; this.mw = this.mw2; this.rv = this.rv2; this.ep = null; }
      for (const w of this.mw) w.val = 0; this.q.val = 0; for (const r of this.rv) r.val = 0; this.noise.val = re() < 0.1 ? 1 : 0;
      const E = this.ep; this.qNow = null;
      if (E && E.stage === 'ответ') { this.rv[E.ans].val = 1; this.ep = null; }
      else if (E && E.stage === 'ждёт' && t >= E.tq) { this.q.val = 1; E.stage = 'ответ'; this.qNow = E; }
      else if (!E && re() < c.XPM) { const o = Math.min(2, Math.floor(re() * 3)), D = c.XDMIN + Math.min(c.XDMAX - c.XDMIN, Math.floor(re() * (c.XDMAX - c.XDMIN + 1))); this.mw[o].val = 1;
        this.ep = { o, tq: t + D, stage: 'ждёт', ans: c.XCTRL ? Math.min(2, Math.floor(re() * 3)) : o }; }
      return;
    }
    if (this.kind === 'собеседник') {
      // предмет перекладывают (8% за круг), родитель уходит и приходит (5% за круг); пока смотрит, он знает, где предмет; отвечает
      // на вопрос (и когда не смотрит) -- где предмет, по его мнению
      if (re() < 0.08) this.loc = 1 - this.loc; if (re() < 0.05) this.present = 1 - this.present; if (this.present) this.belief = this.loc;
      this.see[0].val = this.loc === 0 ? 1 : 0; this.see[1].val = this.loc === 1 ? 1 : 0; this.here.val = this.present;
      // кто-то спрашивает родителя «где?» (20% за круг), и в следующем круге родитель отвечает
      const say = this.asked; this.asked = re() < 0.2; this.ask.val = this.asked ? 1 : 0;
      this.sw[0].val = say && this.belief === 0 ? 1 : 0; this.sw[1].val = say && this.belief === 1 ? 1 : 0;
      this.said = say ? { b: this.belief, loc: this.loc, last: this.lastSaid ?? 0 } : null; if (say) this.lastSaid = this.belief;
      return;
    }
    if (this.tr) {
      // что было в круге t: вещь L (её видно сейчас на S, следствие -- на Y), вещь L2 (на S2)
      this.Sv.val = this.L; this.S2.val = this.L2; this.Y.val = t - 1 > this.T1 && !this.probe ? this.L : 0;
      this.L = re() < c.XPL ? 1 : 0; this.L2 = re() < c.XPL ? 1 : 0;
      let w = null;
      if (this.sign) {                        // антоним: вещь идёт вверх (a, +1) или вниз (b, -1); в доле 2 -- только вверх, в доле 3 -- только вниз
        if (this.L) this.L = t <= this.T1 ? (re() < 0.5 ? 1 : -1) : t <= this.T2 ? 1 : -1;
        if (t <= this.T1) { if (this.L) w = c.XCTRL ? (this.L > 0 ? 'a' : null) : this.L > 0 ? 'a' : 'b'; if (c.XCTRL && this.L2 && !w) w = 'b'; }
        else if (this.L) w = this.L > 0 ? 'a' : 'b';
      } else if (t <= this.T1) { if (this.L) w = c.XCTRL ? 'a' : re() < 0.5 ? 'a' : 'b'; if (c.XCTRL && this.L2 && !w) w = 'b'; }
      else if (t <= this.T2) { if (this.L) w = 'a'; }
      else if (this.L) w = 'b';
      // проба: первые XK раз в доле 3 следствие не показывается -- мозг не может переучиться, видно только, чего он ждёт
      this.probe = false; if (t > this.T2 && w === 'b') { this.nB3 = (this.nB3 || 0) + 1; this.probe = this.nB3 <= c.XK; }
      this.word = w; this.a.val = w === 'a' ? 1 : 0; this.bw.val = w === 'b' ? 1 : 0;
    } else if (this.kind === 'сложение3') {
      const e = this.ev; for (let k = 1; k <= 3; k++) this.Sk[k].val = e && e.o === k && !e.probe ? e.d : 0;
      const held = (o, d) => (o === 2 && d === -1) || (o === 3 && d === 1);
      let ev = null;
      if (re() < c.XPL) { for (let k = 0; k < 20 && !ev; k++) { const o = 1 + Math.min(2, Math.floor(re() * 3)), d = re() < 0.5 ? 1 : -1; if (t > this.T2 || !held(o, d)) ev = { o, d }; } }
      if (ev && held(ev.o, ev.d)) { this.nH[ev.o]++; ev.probe = this.nH[ev.o] <= c.XK; }   // проба: первые XK раз каждого нового сочетания нерв предмета молчит
      this.ev = ev; for (let k = 1; k <= 3; k++) this.ow[k].val = ev && ev.o === k ? 1 : 0; this.up.val = ev && ev.d === 1 ? 1 : 0; this.dn.val = ev && ev.d === -1 ? 1 : 0;
    } else {
      const e = this.ev; this.S1.val = e && e.o === 1 ? e.d : 0; this.S2.val = e && e.o === 2 && !e.probe ? e.d : 0;
      let ev = null;
      if (re() < c.XPL) { for (let k = 0; k < 20 && !ev; k++) { const o = re() < 0.5 ? 1 : 2, d = re() < 0.5 ? 1 : -1; if (t > this.T2 || !(o === 2 && d === -1)) ev = { o, d }; } }
      // проба: первые XK раз «второе вниз» нерв предмета молчит -- мозг не переучивается, мера -- только его ожидание
      if (ev && this.mute) { ev = null; this.nMute++; }
      if (ev && ev.o === 2 && ev.d === -1) { this.nHeld = (this.nHeld || 0) + 1; ev.probe = this.nHeld <= c.XK; }
      this.ev = ev; this.o1.val = ev && ev.o === 1 ? 1 : 0; this.o2.val = ev && ev.o === 2 ? 1 : 0;
      if (!this.ext || ev) { this.up.val = ev && ev.d === 1 ? 1 : 0; this.dn.val = ev && ev.d === -1 ? 1 : 0; }
    }
  }
  stepFact(t) {
    const c = this.cfg, re = this.re; for (const w of this.nm) w.val = 0; this.up.val = 0; this.dn.val = 0; this.P.val = 0; this.qNow = null;
    let E = this.ep;
    if (E && E.stage === 'ответ') { this.P.val = E.ans; this.ep = null; this.gap = 3 + Math.floor(re() * 5); return; }
    if (!E) { if (this.gap > 0) { this.gap--; return; }
      const ks = [0, 1, 2, 3]; this.shuffle(ks, { int: (n) => Math.min(n - 1, Math.floor(re() * n)) });
      const facts = ks.slice(0, c.XFN).map((k) => { const p = re() < 0.5 ? 1 : -1; return { k, p, say: c.XCTRL ? (re() < 0.5 ? 1 : -1) : p }; });
      E = this.ep = { facts, told: 0, next: t, ask: Math.min(c.XFN - 1, Math.floor(re() * c.XFN)), stage: 'говорит' }; }
    if (t < E.next) return;
    if (E.told < E.facts.length) { const f = E.facts[E.told++]; this.nm[f.k].val = 1; (f.say > 0 ? this.up : this.dn).val = 1;
      E.next = E.told < E.facts.length ? t + 3 + Math.floor(re() * 6) : t + (c.XFLONG ? 100 + Math.floor(re() * 301) : 5 + Math.floor(re() * 16)); return; }
    const f = E.facts[E.ask]; this.nm[f.k].val = 1; E.stage = 'ответ'; E.ans = f.p; this.qNow = { t, ans: f.p };
  }
  stepNew(t) {
    const c = this.cfg, re = this.re, K = this.kind, ri = (a, b) => a + Math.floor(re() * (b - a + 1));
    for (const w of [this.wA, this.wB, this.wC, this.Q, this.wX, this.wY, this.wM, this.c1, this.c2, this.sp, this.sm]) if (w) w.val = 0; this.P.val = 0; this.qNow = null; this.noise.val = re() < 0.1 ? 1 : 0;
    let E = this.ep;
    if (E && E.stage === 'ответ') { this.P.val = E.ans; this.ep = null; this.gap = ri(3, 8); return; }
    if (!E) { if (this.gap > 0) { this.gap--; return; }
      const say = [];   // [круг от начала, нерв]
      let ans;
      if (K === 'порядок') { const aFirst = re() < 0.5, d = ri(1, 4); say.push([0, aFirst ? this.wA : this.wB], [d, aFirst ? this.wB : this.wA], [d + ri(3, 8), this.Q]); ans = aFirst ? 1 : -1; }
      if (K === 'счёт') { const two = re() < 0.5; let at = 0; say.push([0, this.wX]); if (two) { at = ri(2, 4); say.push([at, this.wX]); } say.push([at + ri(2, 5), this.Q]); ans = two ? 1 : -1; }
      if (K === 'правило') { const r1 = re() < 0.5, sP = re() < 0.5; say.push([0, r1 ? this.c1 : this.c2], [ri(4, 10), sP ? this.sp : this.sm]); ans = (sP ? 1 : -1) * (r1 ? 1 : -1); }
      if (K === 'больше') { let nx = ri(1, 3), ny = ri(1, 3); while (ny === nx) ny = ri(1, 3); const seq = [...Array(nx).fill(this.wX), ...Array(ny).fill(this.wY)];
        for (let i = seq.length - 1; i > 0; i--) { const j = Math.floor(re() * (i + 1)); [seq[i], seq[j]] = [seq[j], seq[i]]; }
        let at = 0; seq.forEach((w, i) => { if (i) at += ri(1, 3); say.push([at, w]); }); say.push([at + ri(2, 5), this.Q]); ans = nx > ny ? 1 : -1; }
      // вопрос через 2-14 кругов после Y (широко): по следу Y промежуток не угадать (50%), по следу X -- не больше 69%
      if (K === 'интервал') { const short = re() < 0.5, d = short ? ri(1, 2) : ri(5, 8); say.push([0, this.wX], [d, this.wY], [d + ri(2, 14), this.Q]); ans = short ? 1 : -1; }
      if (K === 'счёт до метки') { const two = re() < 0.5, after = ri(0, 2); let at = 0; const seq = [...Array(two ? 2 : 1).fill(this.wX), this.wM, ...Array(after).fill(this.wX)];
        seq.forEach((w, i) => { if (i) at += ri(1, 3); say.push([at, w]); }); say.push([at + ri(2, 5), this.Q]); ans = two ? 1 : -1; }
      if (K === 'до метки') { const pre = Array.from({ length: ri(2, 4) }, () => (re() < 0.5 ? this.wA : this.wB)), post = Array.from({ length: ri(1, 3) }, () => (re() < 0.5 ? this.wA : this.wB));
        let at = 0; [...pre, this.wM, ...post].forEach((w, i) => { if (i) at += ri(1, 3); say.push([at, w]); }); say.push([at + ri(2, 5), this.Q]); ans = pre[pre.length - 1] === this.wA ? 1 : -1; }
      if (K === 'из трёх до метки') { const w3 = () => [this.wA, this.wB, this.wC][Math.min(2, Math.floor(re() * 3))], last = re() < 0.5 ? this.wA : this.wB;
        const pre = [...Array.from({ length: ri(1, 3) }, w3), last], post = Array.from({ length: ri(1, 3) }, w3);
        let at = 0; [...pre, this.wM, ...post].forEach((w, i) => { if (i) at += ri(1, 3); say.push([at, w]); }); say.push([at + ri(2, 5), this.Q]); ans = last === this.wA ? 1 : -1; }
      if (K === 'первое после метки') { const pre = Array.from({ length: ri(1, 3) }, () => (re() < 0.5 ? this.wA : this.wB)), post = Array.from({ length: ri(3, 5) }, () => (re() < 0.5 ? this.wA : this.wB));
        let at = 0; [...pre, this.wM, ...post].forEach((w, i) => { if (i) at += ri(1, 3); say.push([at, w]); }); say.push([at + ri(2, 5), this.Q]); ans = post[0] === this.wA ? 1 : -1; }
      if (c.XCTRL) ans = re() < 0.5 ? 1 : -1;
      E = this.ep = { t0: t, say, i: 0, ans, stage: 'говорит' }; }
    while (E.i < E.say.length && t - E.t0 >= E.say[E.i][0]) { const [, w] = E.say[E.i++]; w.val = 1;
      if (E.i === E.say.length) { E.stage = 'ответ'; this.qNow = { t, ans: E.ans }; } }
  }
  stepChain(t) {
    const c = this.cfg, re = this.re, at = (k, ch) => { this.due.set(k, [...(this.due.get(k) || []), ch]); };
    for (const ch of [this.A, this.Bv, this.C, this.B2]) ch.val = 0;
    for (const ch of this.due.get(t) || []) ch.val = 1; this.due.delete(t);
    if (re() < c.XPL) {
      if (t <= this.T1) { this.A.val = 1; at(t + 1, this.Bv); }
      else if (t <= this.T2) { if (c.XCTRL) { this.B2.val = 1; at(t + 1, this.C); } else { this.Bv.val = 1; at(t + 1, this.C); } }
      else { this.A.val = 1; this.nA3++; const probe = this.nA3 <= c.XK; this.evA.set(t, probe); if (!probe) { at(t + 1, this.Bv); at(t + 2, this.C); } } }
    if (c.XCTRL && t > this.T1 && t <= this.T2 && re() < c.XPL) this.Bv.val = 1;   // в контроле B звучит так же часто, но C за ним не идёт
    if (this.Bv.val) this.evB.set(t, 1);
  }
  stepKey(t, u) {
    const c = this.cfg, um = u && this.motorNerve >= 0 ? u[this.motorNerve] || 0 : 0, uc = Math.max(-1.5, Math.min(1.5, um)), late = t > c.ROUNDS / 2;
    this.echo.val = um; this.mot.val = 0; this.rew = 0;
    const step = (s, v) => { if (s.done) { s.j = 0; s.k = 0; s.age = 0; s.done = false; } s.j = Math.max(-3, Math.min(3, s.j + 0.4 * v + 0.05 * this.rn.gauss())); s.age++;
      if (s.j <= -2.2) s.k = 1; if ((s.k || c.XCTRL) && s.j >= 2.2) { s.done = true; return 1; } if (s.age >= c.XEPL) { s.done = true; return 0; } return -1; };
    const r = step(this, uc); if (r === 1) this.rew = 3; if (r >= 0 && late) { this.st.ep++; this.st.ok += r; }
    // тот же мир под лепетом наугад (размах BAMP) -- сколько удачи дала бы случайность
    const rr = step(this.rnd, Math.max(-1.5, Math.min(1.5, c.BAMP * this.re.gauss()))); if (rr >= 0 && late) { this.st.rep++; this.st.rok += rr; }
    this.pos.val = this.j; this.key.val = this.k;
  }
  // ожидание мозга: средний прогноз частей канала (как в мире слов) -- что мозг ждёт на нерве в следующем круге
  expect(B, ch) { const c = B.ch[this.idx(ch)]; if (!c || !c.parts.length) return c ? c.mean : 0; let s = 0; for (const p of c.parts) s += p.pred; return s / c.parts.length; }
  // после шага мозга (круг t) мир уже сделал шаг: прогнозы частей -- о круге t + 1, слово/событие -- круга t... нет: слово
  // уже нового круга. Поэтому прогноз запоминается здесь, а сверяется со словом, на котором он был сделан, -- в следующем круге.
  score(B) {
    const t = this.t;
    if (this.kind === 'факт' || this.kind === 'порядок' || this.kind === 'счёт' || this.kind === 'правило' || this.kind === 'больше' || this.kind === 'интервал' || this.kind === 'счёт до метки' || this.kind === 'до метки' || this.kind === 'из трёх до метки' || this.kind === 'первое после метки') {   // прогноз свойства, сделанный в круге вопроса, -- против правды
      if (this.qPrev) this.st.push([this.qPrev.t, this.qPrev.ans, this.expect(B, this.P)]);
      this.qPrev = this.qNow; return; }
    if (this.kind === 'цепочка') {            // ожидание C в этом круге, сделанное кругом раньше: после A два круга назад (проба), после B
      const e = this.expect(B, this.C);       // кругом назад (доля 2, поздно), и в тихие круги
      if (this.evA.has(t - 2) && this.evA.get(t - 2) && !this.evB.has(t - 1)) this.st.test.push(e);
      else if (t > this.T2 - 2000 && t <= this.T2 && this.evB.has(t - 1)) this.st.ref.push(e);
      else if (t > this.T2 - 2000 && t <= this.T2 + 4000 && !this.evA.has(t - 2) && !this.evA.has(t - 1) && !this.evB.has(t - 1) && !this.evB.has(t - 2)) this.st.base.push(e);
      this.evA.delete(t - 3); this.evB.delete(t - 3); return; }
    if (this.kind === 'ключ') return;
    if (this.kind === 'память') {             // прогноз ответа, сделанный в круге вопроса, -- против упомянутого предмета
      if (this.qPrev) this.st.push([this.qPrev.t, this.qPrev.ans, this.rv.map((r) => this.expect(B, r))]);
      this.qPrev = this.qNow ? { t, ans: this.qNow.ans } : null; return; }
    if (this.kind === 'собеседник') {         // ожидание «в A» / «в B», сделанное кругом раньше, -- против сказанного
      if (this.said && this.expPrev) this.st.push([t, this.said.b, this.said.loc, this.expPrev, this.said.last]);
      this.expPrev = this.sw.map((w) => this.expect(B, w)); return; }
    if (this.kind === 'сложение3') { const prev = this.pend; this.pend = { t, e: this.ev };
      if (prev) this.st.push([prev.t, prev.e ? prev.e.o : 0, prev.e ? prev.e.d : 0, this.expect(B, this.Sk[1]), this.expect(B, this.Sk[2]), this.expect(B, this.Sk[3])]); return; }
    if (this.tr) {
      const prev = this.pend; this.pend = { t, w: this.word, y: null, s: null };
      // прогноз этого круга сделан мозгом на слове прошлого круга -- его запоминаем у прошлой записи
      if (prev) { prev.y = this.expect(B, this.Y); prev.s = this.expect(B, this.Sv); (prev.t <= this.T1 ? this.st.p1 : prev.t <= this.T2 ? this.st.p2 : this.st.p3).push([prev.t, prev.w, prev.y, prev.s]); }
    } else {
      const prev = this.pend; this.pend = { t, e: this.ev };
      if (prev) this.st.push([prev.t, prev.e ? prev.e.o : 0, prev.e ? prev.e.d : 0, this.expect(B, this.S1), this.expect(B, this.S2)]);
    }
  }
  // итог экзамена
  result() {
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
    if (this.kind === 'факт' || this.kind === 'порядок' || this.kind === 'счёт' || this.kind === 'правило' || this.kind === 'больше' || this.kind === 'интервал' || this.kind === 'счёт до метки' || this.kind === 'до метки' || this.kind === 'из трёх до метки' || this.kind === 'первое после метки') {   // доля вопросов (вторая половина жизни), где мозг ждёт свойство верного знака
      const late = this.st.filter((r) => r[0] > this.cfg.ROUNDS / 2), ok = late.filter((r) => Math.sign(r[2]) === r[1]).length;
      return { acc: ok / Math.max(1, late.length), dot: mean(late.map((r) => r[1] * r[2])), n: late.length };
    }
    if (this.kind === 'цепочка') { const S = this.st, b = mean(S.base), ref = mean(S.ref) - b, test = mean(S.test) - b;
      // first10 -- то же по первым 10 пробам (мера добавлена после раунда 3, в сдаче не участвует): вывод, который мир потом
      // опровергает (A без B -- и C нет), мозг вправе разучить; first10 показывает, был ли вывод, до того как он разучен
      const t10 = mean(S.test.slice(0, 10)) - b;
      return { ref, test, chain: test / ref, first10: t10 / ref, n: S.test.length }; }
    if (this.kind === 'ключ') { const S = this.st; return { ok: S.ok / Math.max(1, S.ep), rnd: S.rok / Math.max(1, S.rep), ep: S.ep }; }
    if (this.kind === 'память') {             // доля вопросов, где мозг ждёт ответом упомянутый предмет (случайно -- 33%)
      const late = this.st.filter((r) => r[0] > this.cfg.ROUNDS / 2), ok = late.filter((r) => r[2].indexOf(Math.max(...r[2])) === r[1]).length;
      return { acc: ok / Math.max(1, late.length), n: late.length };
    }
    if (this.kind === 'собеседник') {         // ложное убеждение: родитель думает не то, что на деле; ждёт ли мозг слова по мнению родителя
      // три трудных случая: ложное и совпадает с прошлым словом (по правде -- мимо), верное и новое -- родитель видел, как
      // переложили (по прошлому слову -- мимо), ложное и новое (мимо и то и другое)
      const late = this.st.filter((r) => r[0] > this.cfg.ROUNDS / 2), ok = (rows) => rows.filter((r) => r[3][r[1]] > r[3][1 - r[1]]).length / Math.max(1, rows.length);
      const c1 = late.filter((r) => r[1] !== r[2] && r[1] === r[4]), c2 = late.filter((r) => r[1] === r[2] && r[1] !== r[4]), c3 = late.filter((r) => r[1] !== r[2] && r[1] !== r[4]);
      return { falseOld: ok(c1), seenNew: ok(c2), falseNew: ok(c3), plain: ok(late.filter((r) => r[1] === r[2] && r[1] === r[4])), n: [c1.length, c2.length, c3.length] };
    }
    if (this.kind === 'сложение3') {         // мера: (ждёт «вниз» у второго + ждёт «вверх» у третьего) / 2
      const S = this.st, test = S.filter((r) => r[0] > this.T2), base = (k) => mean(S.filter((r) => r[0] > this.T2 - 2000 && r[0] <= this.T2 && r[1] === 0).map((r) => r[2 + k]));
      const h2 = mean(test.filter((r) => r[1] === 2 && r[2] === -1).slice(0, this.cfg.XK).map((r) => r[4])) - base(2), h3 = mean(test.filter((r) => r[1] === 3 && r[2] === 1).slice(0, this.cfg.XK).map((r) => r[5])) - base(3);
      return { held: -(-h2 + h3) / 2, h2, h3 };   // held -- как у «сложения»: минус -- верно
    }
    if (this.tr) {
      const S = this.st, lift = (rows, w, k) => mean(rows.filter((r) => r[1] === w).map((r) => r[k])) - mean(rows.filter((r) => r[1] === null).map((r) => r[k]));
      const p2late = S.p2.filter((r) => r[0] > this.T2 - 2000), p1late = S.p1.filter((r) => r[0] > this.T1 - 2000);
      // начало доли 3: первые XK раз, когда прозвучало b, и круги без слова за то же время
      const firstB = S.p3.filter((r) => r[1] === 'b').slice(0, this.cfg.XK), tEnd = firstB.length ? firstB[firstB.length - 1][0] : this.T2, p3early = S.p3.filter((r) => r[0] <= tEnd);
      const p3late = S.p3.filter((r) => r[0] > this.cfg.ROUNDS - 1000);
      // антоним: по b ждать надо -1 -- перенос со знаком минус (1 -- «вниз» вполне, 0 -- ничего, -1 -- «вверх»)
      const sg = this.sign ? -1 : 1, ref = lift(p2late, 'a', 2), tr = sg * lift(p3early, 'b', 2);
      return { ref, early: tr, transfer: tr / ref, late: sg * lift(p3late, 'b', 2) / ref, sB1: sg * lift(p1late, 'b', 3), sB3: sg * lift(p3early, 'b', 3), nB: firstB.length };
    }
    const S = this.st, test = S.filter((r) => r[0] > this.T2), held = test.filter((r) => r[1] === 2 && r[2] === -1).slice(0, this.cfg.XK);
    const by = (o, d, k) => mean(test.filter((r) => r[1] === o && r[2] === d).map((r) => r[k]));
    const base2 = mean(S.filter((r) => r[0] > this.T2 - 2000 && r[0] <= this.T2 && r[1] === 0).map((r) => r[4]));
    return { held: mean(held.map((r) => r[4])) - base2, nHeld: held.length, ...(this.ext ? { muted: this.nMute } : {}), s1up: by(1, 1, 3), s1dn: by(1, -1, 3), s2up: by(2, 1, 4) - base2 };
  }
}
module.exports = { WorldX };

'use strict';
// Исследователь и моторные органы: мозг сам выясняет, что за нервы у него есть (NEURON4.md; ROADMAP нейрона-4).
// Мозг не знает о нерве ничего -- ни смысла, ни направления. Карта тела (port у каждого канала) -- знание мозга о нервах:
//   неизвестен -> проба -> входной | выходной (с действиями: какой нерв и через сколько кругов сдвигает команда)
// Проба -- лепет, как у младенца: исследователь подаёт на нерв команду ±BAMP со знаком наугад, сразу на все пробуемые нервы
// (знаки независимы, поэтому действия разных нервов не путаются), и ищет на записи, какие нервы через 1..LAGS кругов
// сдвигаются вместе с командой (на чётных и нечётных кругах, с одним знаком, сильнее ZSIG стандартных ошибок; порог растёт
// с числом проверок за жизнь мира так, чтобы ложных находок было ZFALSE -- на 70 нервах цифр иначе выходило 3 ложных
// «двигателя» на 8 миров). Ничего не
// сдвинулось за TMAX кругов -- нерв входной (и перепроверяется раз в RETEST кругов: органы меняются).
// Для выходного нерва исследователь строит моторный орган и платит за постройку; орган владеет нервом (только он подаёт
// на него команды), получает плату мира за пользу движений, платит аренду, цену движений, роялти нервам, которые читает,
// и долю дохода строителю. Модель органа -- ценность команды по записи: польза через lag кругов как квадратичная функция
// команды u с членами u·x_j для выбранных нервов x_j (поиск, как у частей). Команда -- вершина параболы (плюс проба).
// Нервы модели орган находит сам: сначала -- те, что сдвигает его команда, потом -- поиском по остатку.
// Пирс и Кейперс (1997): агент с неразмеченными датчиками и двигателями сначала находит, что делают его команды;
// Бонгард, Зыков, Липсон (2006): робот выясняет устройство своего тела пробами и строит по нему поведение.
const { solve } = require('./linalg');
const CC = require('./concepts');

function init(B) {
  return { agent: null, motors: [], choosers: [], oracle: null, built: 0, firstEff: -1, firstMotor: -1, log: [], body: [] };
}
// карта тела -- что мозг двигает сам: выходные нервы с живым органом и что сдвигает их команда. Мозг ведёт журнал её
// версий: когда она меняется (орган построен или разорился, нерв найден выходным), -- новая запись «было -> стало».
function bodySig(B) {
  return B.ch.filter((c) => c.port.st === 'выходной' && c.port.owner && c.port.owner.alive)
    .map((c) => `${c.k}->` + c.port.eff.filter((e) => e.lag === c.port.eff[0].lag).map((e) => e.j).sort((a, b) => a - b).join('/')).join(', ');
}
function bodyWatch(B) {
  const sig = bodySig(B), body = B.ex.body, last = body.length ? body[body.length - 1] : null;
  if (!last || last.sig !== sig) {
    body.push({ t: B.t, sig, was: last ? last.sig : null });
  }
}
function newNerve(B, c) { c.port = { st: 'неизвестен', t0: 0, next: 0, eff: [], owner: null, fails: 0 }; }

function decide(B) {
  const cfg = B.cfg, ex = B.ex, W = B.world;
  if (cfg.EXPL === 2) {                     // вшитый потолок: команда по истинной модели конечности
    if (!W.plugged) return;
    if (!ex.oracle) ex.oracle = B.led.open('вшитый', 'bank', 0, { payTo: false, mem: 0 });
    // z через DLAG кругов: команды, уже посланные, -- по истинной модели; эта команда ставит его на цель
    let zp = W.z.val; for (let i = cfg.DLAG - 2; i >= 0; i--) zp = cfg.ZA * zp + W.b * W.uHist[(W.uPos - i + 8) % 8];
    const k = W.motorNerve, u = Math.max(-cfg.UMAX, Math.min(cfg.UMAX, (W.g.val - cfg.ZA * zp) / W.b));
    B.u[k] = u; B.drv[k] = ex.oracle; return;
  }
  if (cfg.EXPL !== 1) return;
  for (const m of ex.motors) { const k = m.port.k; B.u[k] = motorU(B, m); B.drv[k] = m; }
  for (const h of ex.choosers) chooserAct(B, h);
  const a = ex.agent; if (!a) return;
  for (const c of B.ch) {
    const P = c.port;
    if (P.st === 'неизвестен') { P.st = 'проба'; P.t0 = B.t; P.acc = new Float64Array(B.ch.length * cfg.LAGS * 12); P.n0 = B.ch.length; P.sw = null; }
    if (P.st === 'проба') { B.u[c.k] = cfg.BAMP * B.rng.gauss(); B.drv[c.k] = a; B.led.work(a, 1); }
  }
}

// ---------------------------------------------------------------- анализ пробы
// Каждый круг: команда пробуемого нерва L кругов назад против нынешнего значения каждого нерва -- суммы по чётности круга
// команды (n, Σb, Σy, Σbb, Σyy, Σby). Пересчитывать всю запись не нужно: накопление дешевле в N раз.
function accumulate(B) {
  const cfg = B.cfg, G = B.goods, T = B.t, a = B.ex.agent; let ops = 0;
  for (const c of B.ch) { const P = c.port; if (P.st !== 'проба') continue;
    if (P.n0 !== B.ch.length) { P.t0 = T; P.acc = new Float64Array(B.ch.length * cfg.LAGS * 12); P.n0 = B.ch.length; P.sw = null; continue; }   // нервов стало больше -- проба заново
    for (let L = 1; L <= cfg.LAGS; L++) { const tb = T - L; if (tb < P.t0) continue;
      // только круги, когда нерв двигал сам исследователь своим лепетом: чужая команда (опыт коры -- постоянный толчок)
      // не случайна, совпадает с медленным дрейфом мира и давала ложный «выходной»
      const h = B.drvHist[L]; if (!h || h[c.k] !== a) continue;
      const b = G.at(tb, c.cmd), par = tb & 1;
      for (const q of B.ch) { const y = G.val[q.good], h = ((q.k * cfg.LAGS + L - 1) * 2 + par) * 6, A = P.acc;
        A[h]++; A[h + 1] += b; A[h + 2] += y; A[h + 3] += b * b; A[h + 4] += y * y; A[h + 5] += b * y; }
      ops += B.ch.length * 6;
      if (cfg.CIMIT) {                       // форма отклика: среднее нерва при слабой, средней и сильной команде
        const S = P.sw || (P.sw = new Float64Array(B.ch.length * cfg.LAGS * 6)), bin = b < -0.7 * cfg.BAMP ? 0 : b > 0.7 * cfg.BAMP ? 2 : 1;
        for (const q of B.ch) { const o = (q.k * cfg.LAGS + L - 1) * 6 + 2 * bin; S[o]++; S[o + 1] += G.val[q.good]; }
        ops += B.ch.length * 2; } } }
  if (a && ops) B.led.work(a, ops);
}
// порог одной половины: проверок за жизнь мира много (нерв x нерв x задержка x взгляды x перепроверки) -- на 70 нервах
// цифр порог 4.5 давал ложный «выходной» в 3 мирах из 8; порог растёт так, чтобы ложных находок за жизнь было ZFALSE
const qtail = (x) => { const t = 1 / (1 + 0.2316419 * x), d = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  return d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); };
function zHalf(cfg, K) {
  const N = K * K * cfg.LAGS * (Math.floor((cfg.TMAX - cfg.TMIN) / 25) + 1) * (1 + cfg.ROUNDS / cfg.RETEST), q = Math.sqrt(cfg.ZFALSE / 2 / N);
  let lo = 0, hi = 10; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (qtail(m) > q) lo = m; else hi = m; }
  return Math.max(cfg.ZSIG / Math.SQRT2, hi);
}
// z связи пробы нерва с нервом j через L кругов (обе половины вместе) -- по накопленным суммам
function probeZ(B, P, j, L) { const cfg = B.cfg, A = P.acc; if (!A || L < 1 || L > cfg.LAGS) return 0; let z = 0;
  for (const par of [0, 1]) { const h = ((j * cfg.LAGS + L - 1) * 2 + par) * 6, n = A[h]; if (n < 20) return 0;
    const vb = A[h + 3] - A[h + 1] ** 2 / n, vy = A[h + 4] - A[h + 2] ** 2 / n; z += vb > 0 && vy > 0 ? (A[h + 5] - A[h + 1] * A[h + 2] / n) / Math.sqrt(vb * vy) * Math.sqrt(n) : 0; }
  return Math.abs(z) / Math.SQRT2; }
function analyze(B, c) {
  const cfg = B.cfg, P = c.port, A = P.acc, eff = [], thr = zHalf(cfg, B.ch.length);
  for (const q of B.ch) for (let L = 1; L <= cfg.LAGS; L++) {
    const z = [0, 1].map((par) => { const h = ((q.k * cfg.LAGS + L - 1) * 2 + par) * 6, n = A[h]; if (n < 20) return 0;
      const vb = A[h + 3] - A[h + 1] ** 2 / n, vy = A[h + 4] - A[h + 2] ** 2 / n;
      return vb > 0 && vy > 0 ? (A[h + 5] - A[h + 1] * A[h + 2] / n) / Math.sqrt(vb * vy) * Math.sqrt(n) : 0; });
    if (Math.abs(z[0]) > thr && Math.abs(z[1]) > thr && z[0] * z[1] > 0) eff.push({ j: q.k, lag: L, z: (z[0] + z[1]) / Math.SQRT2 });
  }
  B.led.work(B.ex.agent, B.ch.length * cfg.LAGS * 12);
  return eff;
}

function think(B) {
  const cfg = B.cfg, ex = B.ex;
  if (cfg.EXPL !== 1) return;
  if (B.t % 25 === 0) bodyWatch(B);
  // карта: входные нервы перепроверяются
  for (const c of B.ch) if (c.port.st === 'входной' && B.t >= c.port.next) c.port.st = 'неизвестен';
  const need = B.ch.some((c) => c.port.st === 'неизвестен' || c.port.st === 'проба');
  if (!ex.agent && need) ex.agent = B.led.open('исследователь', 'bank', cfg.ECRED, { payTo: false, mem: 8 });   // рождается по нужде
  const a = ex.agent;
  if (a) accumulate(B);
  if (a && B.t % 25 === 0) for (const c of B.ch) {
    const P = c.port; if (P.st !== 'проба' || B.t - P.t0 < cfg.TMIN) continue;
    const eff = analyze(B, c);
    if (eff && eff.length) {
      P.st = 'выходной'; P.eff = eff.sort((x, y) => Math.abs(y.z) - Math.abs(x.z)); P.known = { eff: P.eff.slice(), t: B.t };   // помнит, на что действует нерв
      if (ex.firstEff < 0 && B.world.plugged && c.k === B.world.motorNerve) ex.firstEff = B.t;
      ex.log.push(`круг ${B.t}: нерв ${c.k} -- выходной: ` + P.eff.map((e) => `сдвигает нерв ${e.j} через ${e.lag} (z=${e.z.toFixed(1)})`).join(', '));
      build(B, c);
    } else if (B.t - P.t0 >= cfg.TMAX) { P.st = 'входной'; P.next = B.t + cfg.RETEST * (1 + B.rng()); P.eff = []; }
  }
  // моторные органы думают: подгонка модели ценности, иногда -- поиск нового нерва для модели
  for (const h of ex.choosers) if ((B.t + h.id) % cfg.CFIT === 0 && (!cfg.CSURP || needFit(B, h))) chooserFit(B, h);
  if (cfg.MLONG) for (const m of ex.motors) motorAcc(B, m);   // суммы мотора -- каждый круг
  if (cfg.MPLAN) for (const m of ex.motors) { planStep(B, m); if ((B.t + m.id) % cfg.MFIT === 0) planFit(B, m); if ((B.t + m.id) % (4 * cfg.MFIT) === 2) planSearch(B, m); }
  if (cfg.MVAL) for (const m of ex.motors) { valRecord(B, m); const v = vrOf(B, m); if ((B.t + m.id) % cfg.MVFIT === 0 || (v && !v.ok && (B.t + m.id) % cfg.MFIT === 0)) valFit(B, m); }
  for (const m of ex.motors) if (cfg.MVAL !== 2 && (B.t + m.id) % cfg.MFIT === 0) { if (!m.good && m.fits % 4 === 3) pickLag(B, m); else motorFit(B, m); if ((!m.ok || m.fits % 4 === 1) && m.S.length < cfg.MFEAT) motorSearch(B, m); }
}

// ---------------------------------------------------------------- моторный орган
// CIMIT: нерв -- выключатель, а не мышца: его главный отклик есть только при сильной команде (средние при слабой и средней
// команде почти равны, при сильной -- сдвиг), у мышцы отклик ровный (три средних -- на одной прямой)
function isSwitch(B, c) {
  const cfg = B.cfg, P = c.port, S = P.sw, e = P.eff[0]; if (!S || !e) return false;
  const o = (e.j * cfg.LAGS + e.lag - 1) * 6; if (S[o] < 20 || S[o + 2] < 20 || S[o + 4] < 20) return false;
  const m0 = S[o + 1] / S[o], m1 = S[o + 3] / S[o + 2], m2 = S[o + 5] / S[o + 4];
  P.shape = [m0, m1, m2];
  return Math.abs(m1 - m0) < 0.25 * Math.abs(m2 - m1);
}
function build(B, c) {
  const cfg = B.cfg, ex = B.ex, a = ex.agent, P = c.port;
  if (cfg.CIMIT) { P.switch = isSwitch(B, c); if (P.switch && joinChooser(B, c)) return; }
  else if (cfg.CHOOSE && joinChooser(B, c)) return;
  // знание принадлежит нерву (как записная книжка канала у частей): орган, разорившийся не от тревоги, а от долга, пока
  // учился, оставляет нерву горизонт, нервы модели и принятую модель -- новый орган начинает с них (MNOTE)
  const N = cfg.MNOTE && P.note && B.t - P.note.t < 3000 && P.note.S.every((id) => B.goods.alive[id]) ? P.note : null;
  const lag = N ? N.lag : P.eff[0].lag, S = N ? (N.good ? N.good.S.slice() : N.S.slice()) : [];
  if (!N && !cfg.MNOPE) for (const e of P.eff) if (e.lag === lag && e.j !== c.k && S.length < cfg.MFEAT && !S.includes(B.ch[e.j].good)) S.push(B.ch[e.j].good);
  const m = B.led.open('мотор', a, cfg.MCRED, { port: P, lag, S, coef: null, fits: 0, payTo: true, inputs: S, share: null, incLast: 0, mem: 8 + dimOf(S.length), born: B.t, builder: a });
  P.k = c.k; P.owner = m; ex.motors.push(m); ex.built++;
  if (ex.firstMotor < 0 && B.world.plugged && c.k === B.world.motorNerve) ex.firstMotor = B.t;
  if (N) { if (N.good) { m.good = { coef: Float64Array.from(N.good.coef), S: N.good.S.slice(), lim: N.good.lim }; m.coef = Float64Array.from(N.good.coef); } P.note = null; }
  else pickLag(B, m);
  // новый орган сразу ищет нервы своей модели по записи пробы, пока находятся (за свой счёт)
  for (let i = 0; i < cfg.MFEAT && m.S.length < cfg.MFEAT; i++) { const n0 = m.S.length; motorSearch(B, m); if (m.S.length === n0) break; }
}
// MVAL=1 -- ценность положения по долгой записи (правка 39 нейрона-3, MTGT=3). У мотора своя запись из MVH кругов: нервы
// всех каналов, кроме своего, и польза. Раз в MFIT кругов -- ценность V(x) = b0 + b x: линейная подгонка дисконтированной
// будущей пользы (MGAMV) по записи; цель модели мотора в круге t -- прирост с ценностью d(t) = C(t) + MGAMV V(x(t)) - V(x(t-1)).
// Еда редкая и приходит через десятки кругов, но запах растёт сразу -- и ценность это видит без подсказки.
// запись принадлежит нерву, а не органу: разорившийся мотор не уносит её с собой
const vrOf = (B, m) => (B.vrs || (B.vrs = new Map())).get(m.port.k);
function yAt(B, m, t) { const v = B.cfg.MVAL ? vrOf(B, m) : null; return B.cfg.MVAL && v && v.ok ? v.td[t % B.cfg.H] : B.goods.at(t, B.comfortGood); }
// прирост с ценностью в этом круге -- для сверки обещания с полученным (запись этого круга ещё не сделана)
function tdNow(B, m) {
  const cfg = B.cfg, G = B.goods, v = vrOf(B, m), C = G.val[B.comfortGood]; if (!v || !v.ok || !v.last) return C;
  let a = v.b[0], b = v.b[0]; for (let i = 0; i < v.F; i++) { a += v.b[1 + i] * G.val[v.ids[i]]; b += v.b[1 + i] * v.last[i]; } return C + cfg.MGAMV * a - b;
}
function valRecord(B, m) {
  const cfg = B.cfg, G = B.goods, own = m.port.k;
  const ids = B.ch.filter((c) => c.k !== own).map((c) => c.good);
  let v = vrOf(B, m); if (!v || v.ids.length !== ids.length || v.ids.some((id, i) => id !== ids[i])) B.vrs.set(own, v = { ids, F: ids.length, n: 0, x: new Float32Array(cfg.MVH * ids.length), c: new Float32Array(cfg.MVH), b: null, ok: false, td: new Float64Array(cfg.H), last: null, u: new Float32Array(cfg.MVH), lin: null });
  const row = v.n % cfg.MVH, F = v.F, x = new Float64Array(F);
  for (let i = 0; i < F; i++) { x[i] = G.val[ids[i]]; v.x[row * F + i] = x[i]; } v.c[row] = G.val[B.comfortGood]; v.u[row] = B.u[own]; v.n++;
  if (v.ok) { const V = (z) => { let s = v.b[0]; for (let i = 0; i < F; i++) s += v.b[1 + i] * z[i]; return s; };
    v.td[B.t % cfg.H] = G.val[B.comfortGood] + cfg.MGAMV * V(x) - (v.last ? V(v.last) : V(x)); }
  v.last = x; B.led.work(m, 2 * F + 2);
}
function valFit(B, m) {
  const cfg = B.cfg, v = vrOf(B, m); if (!v) return;
  const T = Math.min(v.n, cfg.MVH), F = v.F, cut = Math.ceil(3 / (1 - cfg.MGAMV)); if (T - cut < 200) return;
  const ord = new Int32Array(T); for (let i = 0; i < T; i++) ord[i] = (v.n - T + i) % cfg.MVH;   // от старых к новым
  const Gr = new Float64Array(T); let acc = 0; for (let i = T - 1; i >= 1; i--) { acc = v.c[ord[i]] + cfg.MGAMV * acc; Gr[i - 1] = acc; }   // будущая польза после ряда
  const d = F + 1, A = new Float64Array(d * d), cv = new Float64Array(d), f = new Float64Array(d); let yy = 0;
  for (let i = 0; i < T - cut; i++) { const r = ord[i]; f[0] = 1; for (let k = 0; k < F; k++) f[1 + k] = v.x[r * F + k]; const y = Gr[i]; yy += y * y;
    for (let a = 0; a < d; a++) { cv[a] += f[a] * y; for (let b = 0; b <= a; b++) A[a * d + b] += f[a] * f[b]; } }
  for (let a = 0; a < d; a++) for (let b = 0; b < a; b++) A[b * d + a] = A[a * d + b];
  const mask = new Float64Array(d); for (let i = 1; i < d; i++) mask[i] = 1e-3;
  const r = solve(A, cv, d, yy, mask); B.led.work(m, T * d * d + (r ? r.ops : 0)); if (!r) return;
  v.b = Float64Array.from(r.w); v.ok = true;
  // прирост с ценностью -- заново за последние H кругов записи
  const H = cfg.H, n0 = Math.max(1, T - H + 1), V = (row) => { let s = v.b[0]; for (let k = 0; k < F; k++) s += v.b[1 + k] * v.x[row * F + k]; return s; };
  for (let i = n0; i < T; i++) { const t = B.t - (T - 1 - i); v.td[t % H] = v.c[ord[i]] + cfg.MGAMV * V(ord[i]) - V(ord[i - 1]); }
  B.led.work(m, H * 2 * F);
  if (cfg.MVAL === 2) linFit(B, m, v, T, ord);
}
// MVAL=2: какая команда при каких нервах ведёт к приросту ценности -- d(j+1) ~ b0 + b (x(j) - mu) + u(j) (a0 + a (x(j) - mu)).
// Команда -- сумма a (x - mu) с силой MVGAIN разброса по записи; a0 отброшено: «всегда в одну сторону» -- это кружение.
// MNOPE: нервы, которые команда сдвигает сама, в команду не входят (иначе -- «продолжай, как делал»).
function linFit(B, m, v, T, ord) {
  const cfg = B.cfg, F = v.F, V = (row) => { let s = v.b[0]; for (let k = 0; k < F; k++) s += v.b[1 + k] * v.x[row * F + k]; return s; };
  const own = new Set(cfg.MNOPE ? (m.port.eff || []).map((e) => B.ch[e.j] && B.ch[e.j].good) : []), use = v.ids.map((id) => !own.has(id));
  const mu = new Float64Array(F); for (let i = 0; i < T; i++) for (let k = 0; k < F; k++) mu[k] += v.x[ord[i] * F + k] / T;
  const d = 2 * F + 2, A = new Float64Array(d * d), cv = new Float64Array(d), f = new Float64Array(d); let yy = 0;
  for (let i = 0; i < T - 1; i++) { const r = ord[i], r1 = ord[i + 1], y = v.c[r1] + cfg.MGAMV * V(r1) - V(r), u = v.u[r]; yy += y * y;
    f[0] = 1; for (let k = 0; k < F; k++) f[1 + k] = v.x[r * F + k] - mu[k]; f[F + 1] = u; for (let k = 0; k < F; k++) f[F + 2 + k] = use[k] ? u * f[1 + k] : 0;
    for (let a = 0; a < d; a++) { cv[a] += f[a] * y; for (let b = 0; b <= a; b++) A[a * d + b] += f[a] * f[b]; } }
  for (let a = 0; a < d; a++) for (let b = 0; b < a; b++) A[b * d + a] = A[a * d + b];
  const mask = new Float64Array(d).fill(1e-3); mask[0] = 0;
  const r = solve(A, cv, d, yy, mask); B.led.work(m, T * d * d + (r ? r.ops : 0)); if (!r) return;
  const a = Array.from({ length: F }, (_, k) => (use[k] ? r.w[F + 2 + k] : 0));
  let s2 = 0; for (let i = 0; i < T; i++) { let s = 0; for (let k = 0; k < F; k++) s += a[k] * (v.x[ord[i] * F + k] - mu[k]); s2 += s * s; }
  const g = cfg.MVGAIN / Math.sqrt(Math.max(1e-12, s2 / T));
  v.lin = { a: a.map((x) => Math.max(-8, Math.min(8, g * x))), mu, fits: (v.lin ? v.lin.fits : 0) + 1 };
  m.good = m.good || { S: [], coef: new Float64Array(3), lim: cfg.UMAX, lin: true };   // для хозяйства: у органа есть модель
}
// признаки ряда t -- полная квадратичная модель по команде u и нервам модели x: [u, u^2, u x_i, x_i, x_i x_j (i <= j), 1].
// Члены без u нужны: при управлении команда почти задана нервами, и пропущенные x_i x_j перетекали бы в оценку u^2 и u x.
const dimOf = (k) => 3 + 2 * k + (k * (k + 1)) / 2;
function feats(B, m, t, f) {
  const G = B.goods, c = B.ch[m.port.k], u = G.at(t, c.cmd), S = m.S, k = S.length, x = m.xb || (m.xb = new Float64Array(16));
  for (let i = 0; i < k; i++) x[i] = G.at(t, S[i]);
  f[0] = u; f[1] = u * u; let o = 2; for (let i = 0; i < k; i++) f[o++] = u * x[i]; for (let i = 0; i < k; i++) f[o++] = x[i];
  for (let i = 0; i < k; i++) for (let j = i; j < k; j++) f[o++] = x[i] * x[j]; f[o] = 1;
}
// MLONG=1: память мотора длиннее записи. Суммы подгонки (матрица признаков, связь с пользой) копятся каждый круг с забыванием
// MDECAY (память ~ 1 / (1 - MDECAY) кругов); при смене нервов модели, горизонта или разрыве -- заново по записи. Редкие
// события (слово просьбы звучит в 17% кругов) на записи в 512 кругов дают десятки строк -- оценка их члена u x шумит.
function accSums(B, m, t0, t1) {
  const G = B.goods, d = dimOf(m.S.length), A = new Float64Array(d * d), cv = new Float64Array(d), f = new Float64Array(d); let yy = 0, um = 0, n = 0;
  for (let t = t0; t <= t1; t++) { feats(B, m, t, f); const y = yAt(B, m, t + m.lag); yy += y * y; um = Math.max(um, Math.abs(f[0])); n++;
    for (let i = 0; i < d; i++) { cv[i] += f[i] * y; for (let j = 0; j <= i; j++) A[i * d + j] += f[i] * f[j]; } }
  B.led.work(m, n * d * d);
  return { A, cv, yy, um, n };
}
function motorAcc(B, m) {
  const cfg = B.cfg, G = B.goods, c = B.ch[m.port.k], key = m.S.join(',') + '|' + m.lag + '|' + (m.since || 0);
  const t0 = Math.max(B.t - cfg.H + 1, G.since[c.cmd], m.since || 0, ...m.S.map((id) => G.since[id])) + 1, t1 = B.t - m.lag;
  if (!m.acc || m.acc.key !== key) { if (t1 - t0 + 1 < 40) { m.acc = null; return; } m.acc = { key, ...accSums(B, m, t0, t1), last: t1 }; return; }
  const a = m.acc, d = dimOf(m.S.length), q = cfg.MDECAY, f = new Float64Array(d);
  for (let t = a.last + 1; t <= t1; t++) { feats(B, m, t, f); const y = yAt(B, m, t + m.lag);
    for (let i = 0; i < d * d; i++) a.A[i] *= q; for (let i = 0; i < d; i++) a.cv[i] *= q; a.yy *= q; a.n = a.n * q + 1; a.um = Math.max(a.um * q, Math.abs(f[0]));
    a.yy += y * y; for (let i = 0; i < d; i++) { a.cv[i] += f[i] * y; for (let j = 0; j <= i; j++) a.A[i * d + j] += f[i] * f[j]; } }
  a.last = t1; B.led.work(m, d * d);
}
function motorFit(B, m, depth = 0) {
  const cfg = B.cfg, G = B.goods, c = B.ch[m.port.k], k = m.S.length, d = dimOf(k);
  const t0 = Math.max(B.t - cfg.H + 1, G.since[c.cmd], m.since || 0, ...m.S.map((id) => G.since[id])) + 1, t1 = B.t - m.lag; let nr = t1 - t0 + 1;
  if (nr < 40) return;
  let A, cv, yy, um;
  if (cfg.MLONG) { motorAcc(B, m); if (!m.acc) return; const a = m.acc; A = Float64Array.from(a.A); cv = Float64Array.from(a.cv); yy = a.yy; um = a.um; nr = Math.round(a.n); }
  else { A = new Float64Array(d * d); cv = new Float64Array(d); yy = 0; um = 0; const f = new Float64Array(d);
    for (let t = t0; t <= t1; t++) { feats(B, m, t, f); const y = yAt(B, m, t + m.lag); yy += y * y; um = Math.max(um, Math.abs(f[0]));
      for (let i = 0; i < d; i++) { cv[i] += f[i] * y; for (let j = 0; j <= i; j++) A[i * d + j] += f[i] * f[j]; } } }
  for (let i = 0; i < d; i++) for (let j = 0; j < i; j++) A[j * d + i] = A[i * d + j];
  const mask = new Float64Array(d); for (let i = 0; i < d - 1; i++) mask[i] = 1e-4;
  const r = solve(A, cv, d, yy, mask); B.led.work(m, (cfg.MLONG ? 0 : nr * d * d) + (r ? r.ops : 0));
  if (!r) return;
  // вклад каждого нерва модели: все члены, где он есть (для роялти и чтобы отпустить бесполезный)
  const dl = (i) => r.w[i] ** 2 / Math.max(r.inv[i], 1e-12), ds = new Float64Array(k);
  for (let i = 0; i < k; i++) { ds[i] += dl(2 + i) + dl(2 + k + i); }
  let o = 2 + 2 * k; for (let i = 0; i < k; i++) for (let j = i; j < k; j++) { const v = dl(o++); ds[i] += i === j ? v : v / 2; if (i !== j) ds[j] += v / 2; }
  const s = ds.reduce((x, y) => x + y, 0);
  // нерв, который три подгонки подряд почти ничего не даёт, отпускается (одна подгонка -- мало: цель может долго стоять на месте)
  m.low = m.low || new Map();
  for (let i = 0; i < k; i++) m.low.set(m.S[i], ds[i] < 0.02 * s ? (m.low.get(m.S[i]) || 0) + 1 : 0);
  if (k > 1 && depth < 2) { let worst = -1; for (let i = 0; i < k; i++) if (m.low.get(m.S[i]) >= 3 && (worst < 0 || ds[i] < ds[worst])) worst = i;
    if (worst >= 0) { m.low.delete(m.S[worst]); m.S = m.S.filter((_, i) => i !== worst); return motorFit(B, m, depth + 1); } }
  m.coef = r.w; m.fits++; m.mem = 8 + d;   // память -- коэффициенты модели (матрица подгонки временная)
  m.share = s > 0 ? Float64Array.from(ds, (v) => v / s) : null; m.inputs = m.S;
  // зона доверия: модель знает только те команды, что были на записи; парабола принята, если её кривизна отрицательна
  // и заметна (больше 2.5 стандартных ошибок) -- иначе вершина может уйти в край и разорить орган
  m.uLim = Math.min(cfg.UMAX, Math.max(2 * cfg.BAMP, 2 * um));
  const se = Math.sqrt(r.sse / Math.max(1, nr - d) * Math.max(r.inv[1], 0));
  m.ok = r.w[1] < -cfg.MSIG * se; m.tq = se > 0 ? -r.w[1] / se : 0;
  if (m.ok) { m.good = { coef: Float64Array.from(r.w), S: m.S.slice(), lim: m.uLim }; }   // принятая модель держится, пока новая не принята
}
// поиск нерва для модели: кандидат примеряется целым блоком [u x, x, x^2] к остатку модели -- подгонка на чётных кругах,
// проверка на нечётных (доля объяснённого остатка вне подгонки)
// горизонт модели: на какой задержке польза заметнее всего зависит от команды (кривизна по u в стандартных ошибках) --
// команда может сдвигать разное через разное число кругов, и сильнейшее действие не обязательно то, за которое платят
function pickLag(B, m) {
  const cfg = B.cfg; let best = m.lag, bt = -Infinity;
  for (let L = 1; L <= cfg.LAGS; L++) { m.lag = L; motorFit(B, m); if (m.tq > bt) { bt = m.tq; best = L; } }
  m.lag = best; motorFit(B, m);
}
function motorSearch(B, m) {
  const cfg = B.cfg, G = B.goods, c = B.ch[m.port.k], k = m.S.length, d = dimOf(k);
  if (!m.coef) return;
  const t0 = Math.max(B.t - cfg.H + 1, G.since[c.cmd], m.since || 0, ...m.S.map((id) => G.since[id])) + 1, t1 = B.t - m.lag; const nr = t1 - t0 + 1;
  if (nr < 80) return;
  const f = new Float64Array(d), res = new Float64Array(nr), us = new Float64Array(nr);
  for (let t = t0; t <= t1; t++) { feats(B, m, t, f); let s = 0; for (let i = 0; i < d; i++) s += m.coef[i] * f[i]; res[t - t0] = yAt(B, m, t + m.lag) - s; us[t - t0] = f[0]; }
  let best = -1, bg = cfg.MGMIN;
  const A = new Float64Array(16), cv = new Float64Array(4), g = new Float64Array(4), mask = new Float64Array([1e-3, 1e-3, 1e-3, 0]);
  // CONC: кандидаты -- и понятия; лучший нерв-вид понятия сравнивается с понятием (мотор тоже видит через понятия)
  let ids = B.ch.filter((q) => q.k !== c.k).map((q) => q.good); if (cfg.CONC) ids.push(...B.ccGoods);
  if (cfg.MNOPE) { const own = new Set((m.port.eff || []).map((e) => B.ch[e.j] && B.ch[e.j].good)); ids = ids.filter((id) => !own.has(id)); }
  // MSRCH > 0: кандидаты -- MSRCH наугад (перебор всех нервов на большом теле стоил мотору ~2.5 за круг при доходе ~5)
  if (cfg.MSRCH && ids.length > cfg.MSRCH) { const pick = new Set(); for (let i = 0; i < 4 * cfg.MSRCH && pick.size < cfg.MSRCH; i++) pick.add(ids[B.rng.int(ids.length)]); ids = [...pick]; }
  const gainOf = (id) => { if (m.S.includes(id) || G.since[id] + 1 > t0 || !G.alive[id]) return -1;
    A.fill(0); cv.fill(0); let yy = 0;
    for (let t = t0 + (t0 & 1); t <= t1; t += 2) { const x = G.at(t, id), r = res[t - t0]; g[0] = us[t - t0] * x; g[1] = x; g[2] = x * x; g[3] = 1; yy += r * r;
      for (let i = 0; i < 4; i++) { cv[i] += g[i] * r; for (let j = 0; j < 4; j++) A[i * 4 + j] += g[i] * g[j]; } }
    const sol = solve(A, cv, 4, yy, mask); if (!sol) return -1;
    let e0 = 0, e1 = 0, sr = 0, n = 0;
    for (let t = t0 + 1 - (t0 & 1); t <= t1; t += 2) { const x = G.at(t, id), r = res[t - t0], p = sol.w[0] * us[t - t0] * x + sol.w[1] * x + sol.w[2] * x * x + sol.w[3]; e0 += r * r; e1 += (r - p) ** 2; sr += r; n++; }
    const v = e0 - sr * sr / n; return v > 0 ? (e0 - e1) / v : 0; };
  for (const id of ids) { const gain = gainOf(id); if (gain > bg) { bg = gain; best = id; } }
  if (cfg.CONC && best >= 0) { const o = B.cc.viewOf.get(best); if (o && o.alive && G.alive[o.good] && !m.S.includes(o.good)) { const ga = gainOf(o.good); if (ga >= (1 - cfg.CTIE) * bg) best = o.good; } }
  B.led.work(m, (cfg.CONC || cfg.MSRCH ? ids.length : B.ch.length) * nr * 14);
  if (best >= 0) { m.S = [...m.S, best]; motorFit(B, m); }
}
// сверка действия с результатом (как ACHECK правки 69): орган помнит, какую пользу обещала его модель, и сравнивает с
// полученной. Если полученная устойчиво хуже обычного (см. ниже), модели
// больше нет веры: тело изменилось. Орган снова лепечет и учится только на записи после разрыва, а входные нервы мозг
// перепроверяет -- вдруг двигатель теперь другой. Если веры нет MGIVE кругов, орган отпускает нерв.
function motorCheck(B, m) {
  const cfg = B.cfg, C = cfg.MVAL ? tdNow(B, m) : B.goods.val[B.comfortGood], q = m.pend && m.pend.get(B.t);
  if (q === undefined) return;
  m.pend.delete(B.t);
  // расхождение «получено - обещано» в среднем отрицательно и без поломки: команда выбрана там, где модель обещает больше
  // всего, и обещание завышено. Поэтому сверка -- не с нулём, а с обычным расхождением: короткое среднее (20 кругов) против
  // долгого (500), в единицах разброса, 30 кругов подряд; явный провал (4 разброса, 3 круга подряд) -- сразу
  const e = C - q; m.eN = (m.eN || 0) + 1;
  if (m.eN === 1) { m.eL = e; m.eM = e; m.eV = 1; }
  m.eM += 0.05 * (e - m.eM); m.eL += 0.002 * (e - m.eL); m.eV += 0.01 * ((e - m.eL) ** 2 - m.eV);
  m.eBad = m.eN > 200 && m.eM < m.eL - cfg.MSUR * Math.sqrt(m.eV) ? (m.eBad || 0) + 1 : 0;
  m.eHard = m.eN > 200 && e < m.eL - 4 * Math.sqrt(m.eV) ? (m.eHard || 0) + 1 : 0;   // явный провал: 3 круга подряд хуже обычного на 4 разброса
  if (m.eBad >= 30 || m.eHard >= 3) {
    B.ex.log.push(`круг ${B.t}: мотор нерва ${m.port.k} -- полученная польза хуже обычного (${(m.eM - m.eL).toFixed(2)}), веры модели нет`);
    m.good = null; m.since = B.t; m.eN = 0; m.eBad = 0; m.eHard = 0; m.lostAt = B.t; m.breaks = (m.breaks || 0) + 1;
    recheck(B);
  }
}
// тело изменилось (модель мотора подвела или мотор разорился) -- входные нервы перепроверяются в ближайшие 600 кругов
function recheck(B) { for (const c of B.ch) if (c.port.st === 'входной') c.port.next = Math.min(c.port.next, B.t + 600 * B.rng()); }
// MPLAN=1 -- действие по модели мира. Мотор учит две вещи вместо одной «пользы от команды»:
//   прогноз   j(t+L) = a + b j(t) + beta u(t) -- куда сдвинется нерв, на который действует команда
//             (из найденных исследователем), без команды и от команды;
//   ценность  польза(t+L) = c0 + c1 j + c2 j^2 + сумма d_i j x_i + сумма e_i x_i -- какое состояние хорошо в этом
//             положении (x -- нервы модели мотора: цель, слово просьбы, ...).
// Цель j* = -(c1 + сумма d_i x_i) / (2 c2) -- лучшее состояние сейчас; команда u = (j* - прогноз без команды) / beta.
// Состояние меняется и само (толчки мира, шум), поэтому ценность состояний видна на всех кругах, а не только по
// малому лепету команды -- её оценка точнее. Суммы копятся каждый круг с забыванием MDECAY; провал прогноза (тело
// изменилось) -- заново. Нерв j -- тот из сдвигаемых командой, чьё значение лучше всего объясняет пользу.
// признак плана -- товар или произведение товаров (PPROD=1: «давай» x «куда»)
const pLv = (d) => (Array.isArray(d) ? d : [d]), pAt = (G, t, d) => (Array.isArray(d) ? d.reduce((v, id) => v * G.at(t, id), 1) : G.at(t, d));
const pVal = (G, d) => (Array.isArray(d) ? d.reduce((v, id) => v * G.val[id], 1) : G.val[d]), pSince = (G, d) => (Array.isArray(d) ? Math.max(...d.map((id) => G.since[id])) : G.since[d]);
const pAlive = (G, d) => (Array.isArray(d) ? d.every((id) => G.alive[id]) : G.alive[d]), pKey = (d) => pLv(d).join('*');
function planPick(B, m) {
  const cfg = B.cfg, G = B.goods, P = m.port, T = B.t, t0 = Math.max(1, T - 256), t1 = T - cfg.LAGS - 1; let best = -1, br = cfg.MTD ? 4 : 0.02, bl = 1;
  // кандидаты: нервы, которые команда сдвигает (сверх их собственного прошлого) надёжно -- z наклона по команде больше 4
  const cg = B.ch[P.k].cmd; if (cg < 0 || G.since[cg] >= t0) return [-1, 1];
  // задержка -- та, на которой команда сдвигает нерв сильнее всего (своя у прогноза, не у модели пользы от команды)
  // кандидаты -- как у поиска части: не все нервы, а NCAND наугад плюс нервы модели и прежняя цель (перебор всех нервов
  // на большом теле стоил мотору больше его запаса -- в общем мире он разорялся сразу после рождения)
  const cand = new Set(); if (m.pl && m.pl.j >= 0) cand.add(B.ch[m.pl.j]); for (const id of m.S) if (G.kind[id] === 'нерв') cand.add(B.ch[G.nerve[id]]);
  // MHOLD: и то, что о нерве известно: цели прежних планов этого нерва (порт помнит их и после смерти мотора) и нервы, которые
  // его команда двигает по наблюдениям исследователя. На большом теле NCAND наугад из 70 нервов цель почти не находят
  if (cfg.MHOLD) { for (const j of P.planJ || []) if (B.ch[j]) cand.add(B.ch[j]); for (const e of P.eff || []) if (B.ch[e.j]) cand.add(B.ch[e.j]); }
  for (let i = 0; i < 4 * cfg.NCAND && cand.size < cfg.NCAND + m.S.length + 1; i++) cand.add(B.ch[B.rng.int(B.ch.length)]);
  for (const q of cand) { if (q.k === P.k) continue; const id = q.good; if (G.since[id] >= t0) continue; let lag = 0, bz = 4, pers = 0;
    for (let L = 1; L <= cfg.LAGS; L++) { const A = new Float64Array(9), cv = new Float64Array(3); let yy = 0;
      for (let t = t0; t <= t1; t++) { const f = [1, G.at(t, id), G.at(t, cg)], y = G.at(t + L, id); yy += y * y; for (let a = 0; a < 3; a++) { cv[a] += f[a] * y; for (let b = 0; b < 3; b++) A[a * 3 + b] += f[a] * f[b]; } }
      const r = solve(A, cv, 3, yy, new Float64Array([0, 1e-4, 1e-4])); if (!r) continue; const se = Math.sqrt(r.sse / Math.max(1, t1 - t0 - 3) * Math.max(r.inv[2], 0));
      if (Math.abs(r.w[2]) > bz * se) { bz = Math.abs(r.w[2]) / se; lag = L; pers = r.w[1]; } }
    if (!lag) continue;
    // MTD: состояние, которое держит сдвиг (|b| > 0.5: куда сдвинул -- там и осталось), а не эхо самой команды
    if (cfg.MTD) { const sc = Math.abs(pers) > 0.5 ? bz * Math.min(1, Math.abs(pers)) : 0; if (sc > br) { br = sc; best = q.k; bl = lag; } continue; }   // MTD: цель плана -- нерв, который команда двигает надёжнее всех (ценность придёт по цепочке)
    const A = new Float64Array(9), cv = new Float64Array(3); let yy = 0, sy = 0, n = 0;
    for (let t = t0; t <= t1; t++) { const j = G.at(t + lag, id), y = G.at(t + lag, B.comfortGood), f = [1, j, j * j]; yy += y * y; sy += y; n++;
      for (let a = 0; a < 3; a++) { cv[a] += f[a] * y; for (let b = 0; b < 3; b++) A[a * 3 + b] += f[a] * f[b]; } }
    const r = solve(A, cv, 3, yy, new Float64Array([0, 1e-4, 1e-4])); if (!r) continue; const r2 = 1 - r.sse / Math.max(1e-9, yy - sy * sy / n);
    if (r2 > br) { br = r2; best = q.k; bl = lag; } }
  B.led.work(m, cand.size * (t1 - t0) * 12 * (cfg.LAGS + 1));
  if (cfg.MHOLD && best >= 0) { P.planJ = (P.planJ || []).filter((j) => j !== best); P.planJ.unshift(best); P.planJ.length = Math.min(P.planJ.length, 3); }
  return [best, bl];
}
function planStep(B, m) {
  const cfg = B.cfg, G = B.goods, c = B.ch[m.port.k];
  if (!m.pl || B.t >= m.pl.repick) { let [j, lag] = planPick(B, m);
    // MTD: собственная политика делает команду функцией состояния, и по записи связь «команда -> состояние» видна хуже;
    // прежняя цель плана, пока прогноз его не подвёл, держится
    if (cfg.MTD && j < 0 && m.pl && m.pl.j >= 0 && m.pl.F) { j = m.pl.j; lag = m.pl.lag; }
    // MHOLD=2: работающий план (цель та же, прогноз и ценность выучены) задержку не меняет: новая задержка -- новый план с нуля,
    // а та, что сильнее по z на последних 256 кругах, часто лишь шум (положение сдвигается и через 1, и через 3 круга)
    if (cfg.MHOLD >= 2 && m.pl && m.pl.j === j && m.pl.ok && m.pl.V && lag !== m.pl.lag) lag = m.pl.lag;
    if (!m.pl || m.pl.j !== j || m.pl.lag !== lag) m.pl = { j, lag, key: '', fkey: '', reset: m.pl ? m.pl.reset : 0, S: [] }; m.pl.repick = B.t + 1000; }
  const pl = m.pl; if (pl.j < 0) return; const lag = pl.lag; pl.S = pl.S.filter((d) => pAlive(G, d)); const S = pl.S;
  // прогноз зависит только от нерва и задержки (не от нервов модели), его суммы живут дольше; ценность -- и от нервов модели
  const fkey = lag + '|' + pl.j + '|' + (pl.reset || 0), key = S.map(pKey).join(',') + '|' + fkey, k = S.length, dV = 3 + 2 * k, dF = 3, dR = 2 + 2 * k;
  if (pl.fkey !== fkey) Object.assign(pl, { fkey, AF: new Float64Array(dF * dF), cF: new Float64Array(dF), yF: 0, nF: 0, eS: 0, eL: 0, bad: 0, F: null, lastF: B.t - lag - 1 });
  // новый набор нервов -- суммы ценности заново, по всей записи (повтор кругов записи)
  if (pl.key !== key) Object.assign(pl, { key, AV: new Float64Array(dV * dV), cV: new Float64Array(dV), yV: 0, AR: new Float64Array(dR * dR), cR: new Float64Array(dR), yR: 0, n: 0, last: Math.max(0, B.t - cfg.H + 1), V: null, Rw: null, ok: false });
  const jg = B.ch[pl.j].good, q = cfg.MDECAY, fV = new Float64Array(dV), fF = new Float64Array(dF), fR = new Float64Array(dR);
  // MTD: ценность -- не польза следующего шага, а польза плюс ценность следующего состояния (с забыванием MTD), плюс
  // любопытство: малопосещённое состояние (корзина положения и биты слов-событий плана) ценнее -- мозг идёт туда, где не был
  const td = cfg.MTD > 0, vNext = (t) => { if (!pl.V || pl.V.length !== dV) return 0; const j = G.at(t + lag, jg); let v = pl.V[0] + pl.V[1] * j + pl.V[2] * j * j;
    for (let i = 0; i < k; i++) { const xi = pAt(G, t, S[i]); v += pl.V[3 + i] * j * xi + pl.V[3 + k + i] * xi; } return v; };
  // MHOLD: где нерв цели бывал -- знание о теле, а не о плане: держится у порта мотора на нерв цели и переживает новый план
  // (смену задержки, набора) и смерть мотора. Иначе новый план начинал отрезок с того места, где тело стояло, и любопытство
  // не могло позвать туда, где тело уже бывало, но этот план -- нет: ключ слева так и не находился
  if (td && cfg.MHOLD && pl.lo === undefined) { const sp = (m.port.span = m.port.span || new Map()).get(pl.j); if (sp) { pl.lo = sp.lo; pl.hi = sp.hi; } }
  if (td) { const jv = G.val[jg]; pl.lo = Math.min(pl.lo ?? jv, jv); pl.hi = Math.max(pl.hi ?? jv, jv); if (cfg.MHOLD) (m.port.span = m.port.span || new Map()).set(pl.j, { lo: pl.lo, hi: pl.hi });
    pl.nov = pl.nov || new Map(); const kb = novKey(B, pl, jv, (d) => pVal(G, d)); for (const [kk, v] of pl.nov) pl.nov.set(kk, v * 0.999); pl.nov.set(kb, (pl.nov.get(kb) || 0) + 1); }
  for (let t = Math.min(pl.last, pl.lastF) + 1; t <= B.t - lag - (td ? 1 : 0); t++) {
    if (t < 1 || G.since[jg] >= t || G.since[c.cmd] >= t || S.some((d) => pSince(G, d) >= t)) continue;
    const j1 = G.at(t + lag, jg), j0 = G.at(t, jg), u = G.at(t, c.cmd), x = S.map((d) => pAt(G, t, d));
    let y = G.at(t + lag, B.comfortGood); if (td && t > pl.last) { y += cfg.MCUR / Math.sqrt(1 + (pl.nov.get(novKey(B, pl, j1, (d) => pAt(G, t + lag, d))) || 0)) + cfg.MTD * vNext(t + 1); }
    fV[0] = 1; fV[1] = j1; fV[2] = j1 * j1; for (let i = 0; i < k; i++) { fV[3 + i] = j1 * x[i]; fV[3 + k + i] = x[i]; }
    fF[0] = 1; fF[1] = j0; fF[2] = u;
    if (t > pl.lastF) {
    // провал прогноза: короткое среднее ошибки против долгого -- тело изменилось, учиться заново
    if (pl.F) { let p = 0; for (let i = 0; i < dF; i++) p += pl.F[i] * fF[i]; const e = (j1 - p) ** 2; pl.eS += 0.05 * (e - pl.eS); pl.eL += 0.002 * (e - pl.eL);
      pl.bad = pl.nF > 500 && pl.eS > 4 * pl.eL ? pl.bad + 1 : 0;
      if (pl.bad > 50) { pl.reset = (pl.reset || 0) + 1; pl.key = ''; pl.fkey = ''; pl.F = null; pl.V = null; pl.ok = false; B.ex.log.push(`круг ${B.t}: мотор нерва ${m.port.k} -- прогноз нерва ${pl.j} подвёл, учится заново`); return; } }
    for (let i = 0; i < dF * dF; i++) pl.AF[i] *= q; for (let i = 0; i < dF; i++) pl.cF[i] *= q; pl.yF *= q; pl.nF = pl.nF * q + 1;
    for (let a = 0; a < dF; a++) { pl.cF[a] += fF[a] * j1; for (let b = 0; b < dF; b++) pl.AF[a * dF + b] += fF[a] * fF[b]; } pl.yF += j1 * j1; pl.lastF = t; }
    if (t <= pl.last) continue;
    for (let i = 0; i < dV * dV; i++) pl.AV[i] *= q; for (let i = 0; i < dV; i++) pl.cV[i] *= q; pl.yV *= q; pl.n = pl.n * q + 1;
    for (let a = 0; a < dV; a++) { pl.cV[a] += fV[a] * y; for (let b = 0; b < dV; b++) pl.AV[a * dV + b] += fV[a] * fV[b]; } pl.yV += y * y;
    // плата за само действие: что остаётся от пользы после ценности состояния -- против команды (родитель доволен самим
    // движением, а не тем, где состояние оказалось)
    if (pl.V) { let v = 0; for (let i = 0; i < dV; i++) v += pl.V[i] * fV[i]; const yr = y - v;
      fR[0] = 1; fR[1] = u; for (let i = 0; i < k; i++) { fR[2 + i] = u * x[i]; fR[2 + k + i] = x[i]; }
      for (let i = 0; i < dR * dR; i++) pl.AR[i] *= q; for (let i = 0; i < dR; i++) pl.cR[i] *= q; pl.yR *= q;
      for (let a = 0; a < dR; a++) { pl.cR[a] += fR[a] * yr; for (let b = 0; b < dR; b++) pl.AR[a * dR + b] += fR[a] * fR[b]; } pl.yR += yr * yr; }
    pl.last = t; }
  B.led.work(m, dV * dV + dF * dF);
}
function planFit(B, m) {
  const cfg = B.cfg, pl = m.pl; if (!pl || pl.j < 0 || !pl.AV || pl.n < 100 || pl.nF < 100) return;
  const k = pl.S.length, dV = 3 + 2 * k, dF = 3, n = pl.n;
  const rV = solve(Float64Array.from(pl.AV), Float64Array.from(pl.cV), dV, pl.yV, new Float64Array(dV).fill(1e-4)), rF = solve(Float64Array.from(pl.AF), Float64Array.from(pl.cF), dF, pl.yF, new Float64Array(dF).fill(1e-4));
  B.led.work(m, (rV ? rV.ops : 0) + (rF ? rF.ops : 0));
  if (!rV || !rF) return;
  const seC = Math.sqrt(rV.sse / Math.max(1, n - dV) * Math.max(rV.inv[2], 0)), seB = Math.sqrt(rF.sse / Math.max(1, pl.nF - dF) * Math.max(rF.inv[2], 0));
  pl.V = rV.w; pl.F = rF.w; pl.ok = (cfg.MTD ? true : rV.w[2] < -cfg.MSIG * seC) && Math.abs(rF.w[2]) > 3 * seB;
  const dR = 2 + 2 * k; let rR = null; if (pl.yR > 0) { rR = solve(Float64Array.from(pl.AR), Float64Array.from(pl.cR), dR, pl.yR, new Float64Array(dR).fill(1e-4)); pl.Rw = rR ? rR.w : null; }
  // PDROP: нерв плана, чей вклад (все его члены в ценности и в плате за действие) три подгонки подряд меньше 2% вклада всех
  // нервов, отпускается -- иначе ранний случайный набор занимает все места, и слово просьбы в план уже не попадает
  if (cfg.PDROP && k > 0 && rR) { const dl = (r, i) => r.w[i] ** 2 / Math.max(r.inv[i], 1e-12), c = new Float64Array(k);
    for (let i = 0; i < k; i++) c[i] = dl(rV, 3 + i) + dl(rV, 3 + k + i) + dl(rR, 2 + i) + dl(rR, 2 + k + i);
    const tot = c.reduce((a, b) => a + b, 0); pl.low = pl.low || new Map(); let worst = -1;
    for (let i = 0; i < k; i++) { const id = pl.S[i], lo = c[i] < 0.02 * tot && !(cfg.MCUR2 && pl.dep && pl.dep.includes(id)) ? (pl.low.get(id) || 0) + 1 : 0; pl.low.set(id, lo); if (lo >= 3 && (worst < 0 || c[i] < c[worst])) worst = i; }
    if (worst >= 0 && B.t - (pl.changed || 0) > 500) { pl.low.delete(pl.S[worst]); pl.S = pl.S.filter((_, i) => i !== worst); pl.changed = B.t; } }
}
// нервы модели плана -- свой поиск: кандидат примеряется блоком [j x, u x, x] к остатку пользы после ценности и платы
// за действие (подгонка на чётных кругах записи, проверка на нечётных), как поиск нерва моторной модели
function planSearch(B, m) {
  const cfg = B.cfg, G = B.goods, pl = m.pl, c = B.ch[m.port.k]; if (!pl || !pl.V || !pl.Rw || pl.S.length >= cfg.MFEAT) return;
  if (cfg.PDROP && B.t - (pl.changed || 0) < 400) return;   // набор только что менялся -- суммы ещё не собраны заново
  const k = pl.S.length, lag = pl.lag, jg = B.ch[pl.j].good, T = B.t, t0 = Math.max(1, T - cfg.H + 2, G.since[c.cmd] + 1, G.since[jg] + 1, ...pl.S.map((d) => pSince(G, d) + 1)), t1 = T - lag;
  if (t1 - t0 < 100 || pl.Rw.length !== 2 + 2 * k) return;
  const n = t1 - t0 + 1, res = new Float64Array(n), J = new Float64Array(n), U = new Float64Array(n);
  for (let t = t0; t <= t1; t++) { const j1 = G.at(t + lag, jg), u = G.at(t, c.cmd), x = pl.S.map((d) => pAt(G, t, d)); let v = pl.V[0] + pl.V[1] * j1 + pl.V[2] * j1 * j1, r = pl.Rw[0] + pl.Rw[1] * u;
    for (let i = 0; i < k; i++) { v += pl.V[3 + i] * j1 * x[i] + pl.V[3 + k + i] * x[i]; r += pl.Rw[2 + i] * u * x[i] + pl.Rw[2 + k + i] * x[i]; }
    res[t - t0] = G.at(t + lag, B.comfortGood) - v - r; J[t - t0] = j1; U[t - t0] = u; }
  let best = -1, bg = cfg.MGMIN; const A = new Float64Array(16), cv = new Float64Array(4), f = new Float64Array(4);
  const cand = new Set(); for (let i = 0; i < 4 * cfg.NCAND && cand.size < cfg.NCAND; i++) cand.add(B.ch[B.rng.int(B.ch.length)]);   // NCAND наугад
  // MHOLD: и нервы, которые по модели мира зависят от нерва цели (у частей их каналов нерв цели -- вход): то, что меняется,
  // когда тело куда-то пришло (ключ берётся слева), -- кандидат в состояние плана прежде случайного нерва
  if (cfg.MHOLD) { let ops = 0; const dep = []; for (const q of B.ch) { if (q.k === pl.j || q.k === c.k) continue; ops += q.parts.length;
    let wd = 0; for (const p of q.parts) p.inputs.forEach((d, i) => { if ((Array.isArray(d) ? d : [d]).includes(jg) && p.share) wd = Math.max(wd, p.share[i] || 0); });
    if (wd > 0) { cand.add(q); dep.push([wd, q.k]); } } B.led.work(m, ops);
    // MCUR2: следствия нерва цели (самые сильные два) -- часть состояния плана сразу, до всякой пользы: любопытство видит
    // «ключ взят» как новое состояние, и ценность может зависеть от него раньше, чем ключ принёс награду
    // (однажды найденное следствие остаётся в состоянии: его вход в модели мира может ослабнуть -- ключ держит сам себя, -- а
    // без него план терял ключ и с ним все удачи)
    if (cfg.MCUR2) { dep.sort((a, b) => b[0] - a[0]); const nd = dep.slice(0, 2).map((x) => B.ch[x[1]].good); pl.dep = [...new Set([...(pl.dep || []).filter((g) => B.goods.alive[g]), ...nd])].slice(0, 3);
      for (const g of pl.dep) if (!pl.S.includes(g) && pl.S.length < cfg.MFEAT) { pl.S = [...pl.S, g]; pl.changed = B.t; return; } } }
  // PPROD: и произведения -- нерв плана x нерв наугад (как у поиска части: признак x ещё один нерв), и они же через понятия.
  // Так в план попадает «давай» x «куда»: в общем словаре «вверх» звучит и в просьбе, и в описании, и плата -- только за просьбу
  const ids = [...cand].map((q) => q.good), have = new Set(pl.S.map(pKey));
  if (cfg.PPROD) { const base = pl.S.filter((d) => !Array.isArray(d)), ev = new Map(), t0s = Math.max(t0, T - cfg.H + 2);
    for (let i = 0; i < cfg.NCAND && base.length; i++) { const x = base[B.rng.int(base.length)], y = B.ch[B.rng.int(B.ch.length)].good; if (x === y) continue;
      const d = [x, y].sort((a, b) => a - b), alt = cfg.CONC ? CC.through(B, d) : null;
      for (const e of alt !== null && Array.isArray(alt) ? [d, alt] : [d]) { if (have.has(pKey(e)) || (cfg.CONC && CC.degenerate(B, e))) continue;
        if (cfg.ESUP) { const sp = CC.support(B, e, t0s, t1, ev); B.led.work(m, sp.ops); if (sp.n < cfg.ESUP) continue; }
        ids.push(e); have.add(pKey(e)); } } }
  // ATTN: и пары слов, звучавших в кругах с самым большим остатком платы (как у поиска части: внимание к мигу неожиданности)
  if (cfg.PPROD && cfg.ATTN && B.evc) { const top = [], ev = new Map(), t0s = Math.max(t0, T - cfg.H + 2);
    for (let i = 0; i < n; i++) { const a = Math.abs(res[i]); if (top.length < cfg.ATTN || a > top[top.length - 1][0]) { top.push([a, t0 + i]); top.sort((x, y) => y[0] - x[0]); if (top.length > cfg.ATTN) top.pop(); } }
    for (const [, t] of top) { const on = []; for (const [id, e] of B.evc.m) if (G.alive[id] && G.since[id] < t && G.at(t, id) > e.mid) on.push([-Math.log(e.f), id]);
      on.sort((x, y) => y[0] - x[0]); const o = on.slice(0, 4).map((x) => x[1]);
      for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++) { const d = [o[i], o[j]].sort((a, b) => a - b), alt = cfg.CONC ? CC.through(B, d) : null;
        for (const e of alt !== null && Array.isArray(alt) ? [d, alt] : [d]) { if (have.has(pKey(e)) || (cfg.CONC && CC.degenerate(B, e))) continue;
          if (cfg.ESUP) { const sp = CC.support(B, e, t0s, t1, ev); B.led.work(m, sp.ops); if (sp.n < cfg.ESUP) continue; }
          ids.push(e); have.add(pKey(e)); } } }
    B.led.work(m, n + B.evc.m.size * cfg.ATTN); }
  for (const id of ids) { if (!Array.isArray(id)) { const q = B.ch[G.nerve[id]]; if (q.k === c.k || q.k === pl.j || pl.S.includes(id)) continue; } if (pSince(G, id) >= t0) continue;
    A.fill(0); cv.fill(0); let yy = 0;
    for (let t = t0 + (t0 & 1); t <= t1; t += 2) { const i = t - t0, x = pAt(G, t, id); f[0] = J[i] * x; f[1] = U[i] * x; f[2] = x; f[3] = 1; yy += res[i] ** 2; for (let a = 0; a < 4; a++) { cv[a] += f[a] * res[i]; for (let b = 0; b < 4; b++) A[a * 4 + b] += f[a] * f[b]; } }
    const sol = solve(A, cv, 4, yy, new Float64Array([1e-3, 1e-3, 1e-3, 0])); if (!sol) continue;
    let e0 = 0, e1 = 0, sr = 0, nn = 0;
    for (let t = t0 + 1 - (t0 & 1); t <= t1; t += 2) { const i = t - t0, x = pAt(G, t, id), p = sol.w[0] * J[i] * x + sol.w[1] * U[i] * x + sol.w[2] * x + sol.w[3]; e0 += res[i] ** 2; e1 += (res[i] - p) ** 2; sr += res[i]; nn++; }
    const v = e0 - sr * sr / nn, gain = v > 0 ? (e0 - e1) / v : 0; if (gain > bg) { bg = gain; best = id; } }
  B.led.work(m, ids.length * n * 20);
  if (best !== -1) { pl.S = [...pl.S, best]; pl.changed = B.t; }
}
// MTD: корзина состояния для любопытства -- положение (8 корзин между нижней и верхней границей) и биты слов-событий плана
function novKey(B, pl, j, val) { const span = Math.max(1e-6, (pl.hi ?? 1) - (pl.lo ?? 0)), b = Math.max(0, Math.min(7, Math.floor(8 * (j - (pl.lo ?? 0)) / span)));
  let bits = ''; if (B.evc) for (const d of pl.S) { if (Array.isArray(d) || !B.evc.known.has(d)) continue; bits += val(d) > (B.evc.mids.get(d) ?? 0.5) ? '1' : '0'; if (bits.length >= 3) break; }
  // MCUR2: и биты следствий нерва цели (выше среднего своего канала или нет) -- даже если это не слово
  if (B.cfg.MCUR2 && pl.dep) for (const g of pl.dep) { const q = B.ch[B.goods.nerve[g]]; if (q && B.goods.alive[g]) bits += '|' + (val(g) > q.mean ? '1' : '0'); }
  return b + ':' + bits; }
function planU(B, m) {
  const G = B.goods, pl = m.pl, k = pl.S.length, x = pl.S.map((d) => pVal(G, d)), V = pl.V, F = pl.F, j0 = G.val[B.ch[pl.j].good];
  let lin = V[1]; for (let i = 0; i < k; i++) lin += V[3 + i] * x[i]; let jStar = -lin / (2 * V[2]);
  // MTD: лучшее состояние -- на всём досягаемом отрезке: вершина, если ценность выпукла вверх, иначе тот край, где ценность выше
  // (края -- на десятую часть внутрь: у стены команда уже не двигает, и прогноз «куда сдвину» там врёт)
  if (B.cfg.MTD && pl.lo !== undefined) { const sp = pl.hi - pl.lo, lo = pl.lo + 0.1 * sp, hi = pl.hi - 0.1 * sp, val = (j) => lin * j + V[2] * j * j, cands = [lo, hi]; if (V[2] < 0) cands.push(Math.max(lo, Math.min(hi, jStar)));
    jStar = cands.reduce((a, b) => (val(b) > val(a) ? b : a)); const jNo0 = F[0] + F[1] * j0;
    // плата за само действие (родитель доволен движением в сторону просьбы) -- как без MTD, если ценность выпукла вверх
    let r0 = 0; if (V[2] < 0 && pl.Rw && pl.Rw.length === 2 + 2 * k) { r0 = pl.Rw[1]; for (let i = 0; i < k; i++) r0 += pl.Rw[2 + i] * x[i]; }
    return (jStar - jNo0) / F[2] - (V[2] < 0 ? r0 / (2 * V[2] * F[2] * F[2]) : 0); }
  const jNo = F[0] + F[1] * j0;
  // польза = ценность(j) + r(x) u: вершина -- цель состояния, сдвинутая платой за само действие
  let r = 0; if (pl.Rw && pl.Rw.length === 2 + 2 * k) { r = pl.Rw[1]; for (let i = 0; i < k; i++) r += pl.Rw[2 + i] * x[i]; }
  return (jStar - jNo) / F[2] - r / (2 * V[2] * F[2] * F[2]);
}
function motorU(B, m) {
  const cfg = B.cfg, G = B.goods, M = m.good; let u, lim = cfg.BAMP, q;
  if (cfg.MVAL === 2) { const v = vrOf(B, m);   // форма правки 39: команда линейна по нервам
    if (v && v.lin) { let s = 0; for (let k = 0; k < v.F; k++) s += v.lin.a[k] * (G.val[v.ids[k]] - v.lin.mu[k]); B.led.work(m, 2 * v.F + 2);
      return Math.max(-cfg.UMAX, Math.min(cfg.UMAX, s + cfg.MVSIG * B.rng.gauss())); } }
  motorCheck(B, m);
  if (cfg.MPLAN && m.pl && m.pl.ok && m.pl.V && m.pl.F && m.pl.V.length === 3 + 2 * m.pl.S.length && m.pl.S.every((d) => pAlive(G, d)) && (!m.arb || m.arb.mode === 'план')) {   // действие по модели мира
    const L = m.uLim || cfg.UMAX, up = planU(B, m);
    if (Number.isFinite(up)) { u = Math.max(-L, Math.min(L, up)) + cfg.MNOISE * B.rng.gauss(); B.led.work(m, 4 * m.S.length + 8); return u; } }
  if (M && M.S.every((id) => G.alive[id])) { const w = M.coef, k = M.S.length; let a1 = w[0]; for (let i = 0; i < k; i++) a1 += w[2 + i] * G.val[M.S[i]]; u = -a1 / (2 * w[1]); lim = M.lim; }
  else u = cfg.BAMP * B.rng.gauss(), lim = 2 * cfg.BAMP;   // принятой модели нет -- лепет (за вклад «без одного» он стоит ~ b^2 u^2)
  u = Math.max(-lim, Math.min(lim, u)) + cfg.MNOISE * B.rng.gauss();
  if (M) { const f = new Float64Array(m.fb || 32), k = M.S.length; let o = 2, s = 0; const x = M.S.map((id) => G.val[id]);
    f[0] = u; f[1] = u * u; for (let i = 0; i < k; i++) f[o++] = u * x[i]; for (let i = 0; i < k; i++) f[o++] = x[i];
    for (let i = 0; i < k; i++) for (let j = i; j < k; j++) f[o++] = x[i] * x[j]; f[o] = 1;
    for (let i = 0; i <= o; i++) s += M.coef[i] * f[i]; (m.pend || (m.pend = new Map())).set(B.t + m.lag, s); }
  B.led.work(m, 4 * m.S.length + 8);
  return u;
}

function economy(B) {
  const cfg = B.cfg, ex = B.ex, led = B.led;
  for (const m of ex.motors.slice()) {
    m.age++; const rent = led.rent(m, cfg.RENT);
    const inc = m.inc; m.incLast = inc; m.inc = 0; m.incAvg += 0.01 * (inc - m.incAvg);
    // ESAVG: доля строителя -- от средней прибыли, а не от каждого удачного круга: при скачущем доходе (±10 за круг при
    // среднем 3) доля с одних удачных кругов съедала у мотора ~1 за круг, и прибыльный мотор разорялся
    m.rentAvg = (m.rentAvg ?? rent) + 0.01 * (rent - (m.rentAvg ?? rent));
    const share = cfg.ESAVG ? cfg.ESHARE * Math.max(0, m.incAvg - m.rentAvg) : inc > rent ? cfg.ESHARE * (inc - rent) : 0;
    if (share > 0 && ex.agent && ex.agent.alive) led.move(m, ex.agent, share, 'мотор->исследователь: доля строителя');   // доля прибыли, а не дохода
    if (m.credit > cfg.CAP) led.move(m, 'bank', m.credit - cfg.CAP, 'мотор->банк: налог сверх потолка');
    m.hungry = m.credit < 0 ? m.hungry + 1 : 0;
    // MPLAN: план или привычка (модель пользы от команды) -- что платит больше. Блоки по 100 кругов: в 90% -- лучший по
    // средней плате мира, в 10% -- другой (проверка); оценка -- скользящая по блокам (забывание 0.9) (как выбор между расчётом и привычкой
    // у животных: Daw и др., 2005)
    if (cfg.MPLAN && cfg.MARB && m.pl && m.pl.ok) { const A = m.arb || (m.arb = { mode: 'план', end: B.t + 100, sum: 0, n: 0, val: { 'план': null, 'привычка': null } });
      A.sum += inc; A.n++;
      if (B.t >= A.end) { const v = A.sum / A.n; A.val[A.mode] = A.val[A.mode] === null ? v : 0.9 * A.val[A.mode] + 0.1 * v;
        const other = A.mode === 'план' ? 'привычка' : 'план', best = A.val[other] === null ? other : A.val['план'] >= A.val['привычка'] ? 'план' : 'привычка';
        A.mode = A.val[other] === null ? other : B.rng() < 0.9 ? best : (best === 'план' ? 'привычка' : 'план'); A.end = B.t + 100; A.sum = 0; A.n = 0; } }
    // MHOLD: мотор, у которого есть план (цель и прогноз, куда команда её сдвигает), модель мира уже имеет -- без привычки
    // (пользы прямо от команды) он нерв не отпускает. Цель в несколько шагов привычки не даёт: польза приходит не за команду
    const hasPlan = cfg.MHOLD && cfg.MPLAN && m.pl && m.pl.j >= 0 && m.pl.F; if (hasPlan) m.lostAt = B.t;
    if (!m.good && !hasPlan && B.t - (m.lostAt ?? m.born) > cfg.MGIVE) { m.hungry = cfg.DIE + 1; ex.log.push(`круг ${B.t}: мотор нерва ${m.port.k} отпускает нерв -- ${cfg.MGIVE} кругов без модели`); }
    // OLINE: в долгу дольше DIE кругов умирает только орган, который в среднем не окупается (средний доход за ~100 кругов
    // меньше аренды); прибыльный орган с провалом дохода живёт в долг (в общем мире доход мотора скачет, а запас -- CAP)
    const viable = (o, rent) => cfg.OLINE && o.incAvg > rent && o.credit > -cfg.OLINE * o.incAvg;
    if (m.hungry > cfg.DIE && !viable(m, rent)) {                // орган разорился: нерв снова неизвестен -- может, это уже другой орган
      led.close(m); ex.motors.splice(ex.motors.indexOf(m), 1);
      const P = m.port; P.owner = null; P.fails++;
      P.note = { t: B.t, lag: m.lag, S: m.S.slice(), good: m.good && m.good.S.every((id) => B.goods.alive[id]) ? { coef: Float64Array.from(m.good.coef), S: m.good.S.slice(), lim: m.good.lim } : null };
      if (P.fails <= 2) P.st = 'неизвестен'; else { P.st = 'входной'; P.next = B.t + 500 * 2 ** Math.min(P.fails, 6); }
      ex.log.push(`круг ${B.t}: моторный орган нерва ${P.k} разорился (${P.fails}-й раз)`); recheck(B);
    }
  }
  for (const h of ex.choosers.slice()) {
    h.age++; const rent = led.rent(h, cfg.RENT); const inc = h.inc; h.incLast = inc; h.inc = 0; h.incAvg += 0.01 * (inc - h.incAvg);
    h.rentAvg = (h.rentAvg ?? rent) + 0.01 * (rent - (h.rentAvg ?? rent));
    const share = cfg.ESAVG ? cfg.ESHARE * Math.max(0, h.incAvg - h.rentAvg) : inc > rent ? cfg.ESHARE * (inc - rent) : 0;
    if (share > 0 && ex.agent && ex.agent.alive) led.move(h, ex.agent, share, 'выбор->исследователь: доля строителя');
    if (h.credit > cfg.CAP) led.move(h, 'bank', h.credit - cfg.CAP, 'выбор->банк: налог сверх потолка');
    h.hungry = h.credit < 0 ? h.hungry + 1 : 0;
    if (h.hungry > cfg.DIE && !(cfg.OLINE && h.incAvg > rent && h.credit > -cfg.OLINE * h.incAvg)) { led.close(h); ex.choosers.splice(ex.choosers.indexOf(h), 1);
      // CKEEP: мозг помнит, что нерв -- кнопка (рот): нерв не уходит на новую пробу (в большом теле она тонет в чужом
      // лепете и в нажатиях живого органа выбора), а ждёт нового органа выбора в состоянии «кнопка»
      for (const k of h.nerves) { const P = B.ch[k].port; P.owner = null; P.fails++; P.st = cfg.CKEEP && (P.switch || cfg.CKEEPA) && P.known ? 'кнопка' : 'неизвестен'; if (cfg.CKEEPA) { P.btn = { j: h.target, lag: h.lag, at: B.t + cfg.CKEEP }; } }
      if (cfg.CKEEPK) (ex.keepOrg = ex.keepOrg || new Map()).set(h.target + ':' + h.lag, { nerves: h.nerves.slice(), arch: h.arch, W: h.W, Fa: h.Fa, Cx: h.Cx, F: h.F, watch: h.watch, wAt: h.wAt, obM: h.obM, obC: h.obC, obH: h.obH, pv: h.pv, coin: h.coin });
      if (cfg.CKEEP) ex.btnAt = B.t + cfg.CKEEP;
      ex.log.push(`круг ${B.t}: орган выбора нервов ${h.nerves.join(', ')} разорился`); }
  }
  // CKEEP: кнопки без органа -- через CKEEP кругов новый орган выбора из них (с запасом, как у нового органа; учится заново)
  // CKEEPA: кнопки помнят цель своего органа и собираются в орган с той же целью (живой -- или новый из них же)
  if (cfg.CKEEPA) { const btn = B.ch.filter((c) => c.port.st === 'кнопка' && c.port.btn && B.t >= c.port.btn.at);
    const groups = new Map(); for (const c of btn) { const key = c.port.btn.j + ':' + c.port.btn.lag; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(c); }
    for (const [, cs] of groups) { const b0 = cs[0].port.btn; let h = ex.choosers.find((x) => x.target === b0.j && x.lag === b0.lag);
      if (!h) { const c0 = cs[0]; c0.port.st = 'выходной'; c0.port.eff = c0.port.known.eff.slice(); formChooser(B, c0, null, b0.j, b0.lag); h = ex.choosers[ex.choosers.length - 1]; }
      for (const c of cs) { c.port.st = 'выходной'; c.port.eff = c.port.known.eff.slice(); c.port.owner = h; c.port.k = c.k; if (!h.nerves.includes(c.k)) h.nerves.push(c.k); c.port.btn = null; }
      // CKEEPK: новый орган из тех же кнопок получает знание разорившегося -- запись, модели, список; долг прощён, знание -- нет
      const kp = cfg.CKEEPK && ex.keepOrg && ex.keepOrg.get(b0.j + ':' + b0.lag);
      if (kp && kp.nerves.length === h.nerves.length && kp.nerves.every((k) => h.nerves.includes(k))) { h.nerves = kp.nerves.slice(); for (const k of ['arch', 'W', 'Fa', 'Cx', 'F', 'watch', 'wAt', 'obM', 'obC', 'obH', 'pv', 'coin']) if (kp[k] !== undefined) h[k] = kp[k]; ex.keepOrg.delete(b0.j + ':' + b0.lag); }
      h.own = null; ex.log.push(`круг ${B.t}: орган выбора снова -- из кнопок ${h.nerves.join(', ')} (цель -- нерв ${b0.j})${kp ? ', со знанием прежнего' : ''}`); } }
  if (cfg.CKEEP && !cfg.CKEEPA && !ex.choosers.length && B.t >= (ex.btnAt || 0)) { const btn = B.ch.filter((c) => c.port.st === 'кнопка');
    if (btn.length) { const c0 = btn[0]; c0.port.st = 'выходной'; c0.port.eff = c0.port.known.eff.slice(); formChooser(B, c0, null, c0.port.eff[0].j, c0.port.eff[0].lag);
      const h = ex.choosers[ex.choosers.length - 1]; for (const c of btn.slice(1)) { c.port.st = 'выходной'; c.port.eff = c.port.known.eff.slice(); c.port.owner = h; c.port.k = c.k; h.nerves.push(c.k); }
      h.own = null; ex.log.push(`круг ${B.t}: орган выбора снова -- из кнопок ${h.nerves.join(', ')}`); } }
  if (cfg.CKEEP && !cfg.CKEEPA && ex.choosers.length) for (const c of B.ch) if (c.port.st === 'кнопка') { const h = ex.choosers[0]; c.port.st = 'выходной'; c.port.eff = c.port.known.eff.slice(); c.port.owner = h; c.port.k = c.k; if (!h.nerves.includes(c.k)) h.nerves.push(c.k); h.own = null; }
  const a = ex.agent;
  if (a) { a.age++; a.mem = 8 + B.ch.length; led.rent(a, cfg.RENT);
    a.incLast = a.inc; a.inc = 0;
    if (a.credit > cfg.CAP * 4) led.move(a, 'bank', a.credit - cfg.CAP * 4, 'исследователь->банк: налог сверх потолка');
    a.hungry = a.credit < 0 ? a.hungry + 1 : 0;
    const idle = !B.ch.some((c) => c.port.st === 'проба' || c.port.st === 'неизвестен');
    if (a.hungry > cfg.DIE || (idle && a.credit < cfg.ECRED / 4)) { led.close(a); ex.agent = null; }   // нечего пробовать и мало денег -- уходит
  }
}

// ---------------------------------------------------------------- орган выбора (CHOOSE)
// Несколько выходных нервов действуют на один и тот же нерв (у младенца -- разные звуки, на которые отвечает родитель):
// это не одна непрерывная конечность, а выбор одного из многих действий. Исследователь отдаёт такие нервы одному органу
// выбора. Каждый круг орган выбирает: молчать или «нажать» один из своих нервов (команда SPTH + 1, остальным -- 0).
// Учится на том, что ему платит мир за последствия (как моторный орган -- на вкладе движений): для каждого действия --
// ценность как линейная функция нескольких своих товаров круга выбора (нервы и прогнозы частей; отбираются по связи с
// платой за это действие). Нажимает действие с наибольшей ценностью, если она больше нуля; с вероятностью CEPS -- наугад.
function joinChooser(B, c) {
  const cfg = B.cfg, ex = B.ex, P = c.port;
  if (cfg.CIMIT) {                          // выключатели -- в один орган выбора (один голос: нажать можно один)
    if (ex.choosers.length) { const h = ex.choosers[0]; if (!h.nerves.includes(c.k)) { h.nerves.push(c.k); P.owner = h; P.k = c.k; h.own = null; ex.log.push(`круг ${B.t}: нерв ${c.k} -- выключатель, в орган выбора`); } return true; }
    return formChooser(B, c, null, P.eff[0].j, P.eff[0].lag);   // первый выключатель -- орган выбора из одного нерва
  }
  const j = P.eff[0].j, lag = P.eff[0].lag;
  let h = ex.choosers.find((x) => x.target === j && x.lag === lag);
  // CJOINZ: самый сильный отклик нерва -- свой (ухо слышит свой звук), но цель уже живого органа выбора (громкость) он тоже
  // сдвигает, пусть и слабее порога находки, -- это брат: в тот же орган
  if (!h && cfg.CJOINZ) h = ex.choosers.find((x) => x.target >= 0 && probeZ(B, P, x.target, x.lag) > cfg.CJOINZ);
  if (h) { if (!h.nerves.includes(c.k)) { h.nerves.push(c.k); P.owner = h; P.k = c.k; ex.log.push(`круг ${B.t}: нерв ${c.k} -- в орган выбора (цель -- нерв ${j})`); } return true; }
  // другой нерв, который действует (или действовал -- мозг это помнит) на тот же нерв с той же задержкой
  const d = B.ch.find((q) => q !== c && q.port.known && q.port.known.eff[0].j === j && q.port.known.eff[0].lag === lag);
  if (!d) return false;
  return formChooser(B, c, d, j, lag);
}
function formChooser(B, c, d, j, lag) {
  const cfg = B.cfg, ex = B.ex, P = c.port;
  const m = d && d.port.owner;
  if (m && m.kind === 'мотор') { B.led.close(m); ex.motors.splice(ex.motors.indexOf(m), 1); }
  if (d) { d.port.st = 'выходной'; d.port.eff = d.port.known.eff.slice(); }
  const h = B.led.open('выбор', ex.agent && ex.agent.alive ? ex.agent : 'bank', cfg.MCRED, { nerves: d ? [d.k, c.k] : [c.k], target: j, lag, payTo: false, F: [], W: null, arch: [], last: null, born: B.t, mem: 8, incLast: 0 });
  if (d) { d.port.owner = h; d.port.k = d.k; } P.owner = h; P.k = c.k; ex.choosers.push(h); ex.built++;
  ex.log.push(d ? `круг ${B.t}: нервы ${d.k} и ${c.k} действуют на один нерв ${j} -- орган выбора` : `круг ${B.t}: нерв ${c.k} -- выключатель (отклик только на сильную команду) -- орган выбора`);
  return true;
}
// признак органа выбора: товар или (CPROD) произведение двух товаров -- «спросили о движении» × «было движение вверх»
// CWATCH: орган выбора следит не за всеми товарами мозга, а за списком из CWATCH (хранить снимки всех товаров дорого):
// сначала -- нервы (то, что мозг чувствует), остальное -- прогнозы частей наугад; список понемногу меняется
function watchList(B, h) {
  const cfg = B.cfg, G = B.goods;
  if (!h.watch) { h.watch = []; h.wAt = new Map(); h.fits = 0; }
  h.watch = h.watch.filter((id) => G.alive[id]);
  // CWBEST: в списке всегда -- лучший прогноз каждого нерва (что мозг ждёт увидеть): слово, выученное как знание («по звуку
  // жду: еда справа»), так становится признаком для решения; места -- за счёт прогнозов наугад
  if (cfg.CWBEST) { const best = []; for (const c of B.ch) { let bp = null; for (const p of c.parts) if (p.age >= 1 && G.alive[p.good] && (!bp || p.mse < bp.mse)) bp = p; if (bp) best.push(bp.good); }
    const keep = new Set([...B.ch.map((c) => c.good), ...best]);
    for (const id of best) if (!h.watch.includes(id)) { if (h.watch.length >= cfg.CWATCH) { const k = h.watch.findIndex((x) => !keep.has(x) && !(h.F || []).includes(x)); if (k >= 0) h.watch.splice(k, 1); } h.watch.push(id); h.wAt.set(id, B.t); } }
  if (h.watch.length < cfg.CWATCH) {
    const nerves = [...B.ch.map((c) => c.good), ...(cfg.WOFFER && B.mem ? B.mem.organs.filter((o) => o.offer).flatMap((o) => o.outs) : [])].filter((id) => G.alive[id] && !h.watch.includes(id));   // память для решений -- наравне с нервами
    const parts = candGoods(B).filter((id) => G.kind[id] !== 'нерв' && !h.watch.includes(id));
    for (const id of nerves) { if (h.watch.length >= cfg.CWATCH) break; h.watch.push(id); h.wAt.set(id, B.t); }
    while (h.watch.length < cfg.CWATCH && parts.length) { const id = parts.splice(B.rng.int(parts.length), 1)[0]; h.watch.push(id); h.wAt.set(id, B.t); }
  }
  return h.watch;
}
const fval = (f, get) => (Array.isArray(f) ? get(f[0]) * get(f[1]) : get(f));
// CIMIT: «своё слово» нерва органа выбора и воображение -- что мозг услышит, если промолчит: лучшая часть нерва-слова на
// нынешних значениях, команды -- нули. Это его вера в слово, которое сейчас скажет родитель (подражание: сказать то же)
// CPHR=1: своё слово может быть фразой. Если у нерва нет своего отдельного отклика (в общем словаре «я вверх» звучит на «я»,
// общем с «я вниз», и на «вверх», общем с «оно вверх»), но набор его откликов -- свой, ни у кого другого такого нет, то своё
// слово -- этот набор, а воображаемое -- что прозвучат все его слова вместе (произведение)
function ownWords(B, h) {
  const effOf = (q) => (B.ch[q].port.eff.length ? B.ch[q].port.eff : B.ch[q].port.known ? B.ch[q].port.known.eff : []).filter((e) => e.lag === h.lag && e.z > 0);
  h.own = h.nerves.map((k) => { const E = effOf(k);
    const mine = E.filter((e) => !h.nerves.some((q) => q !== k && effOf(q).some((f) => f.j === e.j && f.lag === e.lag)));
    if (mine.length) return mine[0].j;
    // (отклик, общий для всех нервов рта, -- «ухо», громкость своего голоса -- в фразу не входит: он не отличает слов)
    if (B.cfg.CPHR) { const all = (j) => h.nerves.every((q) => q === k || effOf(q).some((f) => f.j === j)), Ek = E.filter((e) => !all(e.j)), key = (es) => es.map((e) => e.j).sort((a, b) => a - b).join(','), kk = key(Ek);
      if (Ek.length >= 2 && Ek.length <= 3 && !h.nerves.some((q) => q !== k && key(effOf(q).filter((e) => !all(e.j))) === kk)) return Ek.map((e) => e.j); }
    return -1; });
}
function imagine(B, j) {
  const c = B.ch[j], G = B.goods; let bp = null; for (const p of c.parts) if (p.w && p.w.length === p.inputs.length && (!bp || p.mse < bp.mse)) bp = p;
  if (!bp) return null;
  const gv = (id) => (G.kind[id] === 'команда' ? 0 : G.val[id]); let s = bp.b;
  bp.inputs.forEach((d, i) => { let v = 1; for (const id of (typeof d === 'number' ? [d] : d)) v *= gv(id); s += bp.w[i] * v; });
  return s;
}
const candGoods = (B) => { const G = B.goods, ids = []; for (const c of B.ch) { ids.push(c.good); for (const p of c.parts) ids.push(p.good); } if (B.cfg.WOFFER && B.mem) for (const o of B.mem.organs) if (o.offer) ids.push(...o.outs); return ids.filter((id) => G.alive[id]); };
function chooserAct(B, h) {
  const cfg = B.cfg, G = B.goods;
  // плата за прошлое действие -- в архив
  // CTRACE: след заслуги -- строке прошлого круга достаётся и доля платы этого (первый звук фразы помогает второму)
  // след -- только если плата этого круга и правда зависит от прошлого действия (доля разброса, объяснённая прошлым
  // действием, не меньше CTRACEM): в мире, где каждый круг -- своя история, чужая плата -- лишь шум
  if (cfg.CTRACE && h.prevRow && h.prevRow.t === B.t - 1) { const yn = h.lastPayT === B.t ? h.lastPay : 0, a0 = h.prevRow.a, T = (h.tr = h.tr || { n: 0, s: 0, s2: 0, na: new Map(), sa: new Map() });
    T.n++; T.s += yn; T.s2 += yn * yn; T.na.set(a0, (T.na.get(a0) || 0) + 1); T.sa.set(a0, (T.sa.get(a0) || 0) + yn);
    let ok = true; if (cfg.CTRACEM > 0) { const m = T.s / T.n, v = T.s2 - T.n * m * m; let b = 0; for (const [a, n] of T.na) b += n * (T.sa.get(a) / n - m) ** 2; const k = T.na.size; ok = T.n >= cfg.CTRACEN && v > 1e-9 && b / v >= cfg.CTRACEM && b / v >= 10 * (k - 1) / T.n; if (cfg.CTRACEDBG) { T.ok = (T.ok || 0) + (ok ? 1 : 0); if (T.n % (cfg.CTRACEDBG > 1 ? cfg.CTRACEDBG : 5000) === 0) console.error('след', T.n, k, (b / v).toFixed(3), (T.ok / T.n).toFixed(2)); } }
    if (ok) h.prevRow.y += cfg.CTRACE * yn; }
  if (cfg.CTRACE) h.prevRow = null;
  if (h.last && h.last.a > 0) { const y = h.lastPayT === B.t ? h.lastPay : 0; h.arch.push({ a: h.last.a, y, v: h.last.v }); if (h.arch.length > cfg.CARCHS) h.arch.shift();
    if (cfg.CTRACE) { h.prevRow = h.arch[h.arch.length - 1]; h.prevRow.t = B.t; }
    if (cfg.CSURP && h.last.pv !== undefined) { h.sE = (h.sE || 0) + (y - h.last.pv) ** 2; h.nE = (h.nE || 0) + 1; }
    // CPREQ: какая модель лучше предсказывает плату на новых данных (до подгонки на них): простая (все признаки, без
    // ветвей и проверки произведений) или сложная; действовать -- лучшей
    if (cfg.CPREQ && h.last.pA !== undefined && h.last.pB !== undefined) { const r = 0.01; h.eA = (h.eA ?? (y - h.last.pA) ** 2) + r * ((y - h.last.pA) ** 2 - (h.eA ?? 0)); h.eB = (h.eB ?? (y - h.last.pB) ** 2) + r * ((y - h.last.pB) ** 2 - (h.eB ?? 0)); h.nPQ = (h.nPQ || 0) + 1;
      if (h.nPQ >= 50) { if (!h.useA && h.eA < 0.95 * h.eB) h.useA = true; else if (h.useA && h.eB < 0.95 * h.eA) h.useA = false; } } }
  let a = 0; const im = new Map();
  if (cfg.CIMIT) { if (!h.own || h.own.length !== h.nerves.length) ownWords(B, h);
    h.own.forEach((j, i) => { if (Array.isArray(j)) { let x = 1; for (const q of j) { const y = imagine(B, q); if (y === null) { x = null; break; } x *= Math.max(0, y); } if (x !== null) im.set('im' + i, x); }
      else if (j >= 0) { const x = imagine(B, j); if (x !== null) im.set('im' + i, x); } }); B.led.work(h, 8 * h.nerves.length); }
  if (cfg.COBV) obvLearn(B, h);
  const ob = cfg.COBV ? obvScores(B, h) : null;
  if (ob && cfg.COBV === 1) ob.forEach((x, i) => im.set('ob' + i, x));
  let babble = false;
  const yieldNow = cfg.CYIELD && B.ex.agent && h.target >= 0 && B.ch.some((c) => c.port.st === 'проба' && !h.nerves.includes(c.k) && probeZ(B, c.port, h.target, h.lag) > 2) && B.rng() < cfg.CYIELD;   // уступить пробе: нерв на пробе уже похож на брата (сдвигает ту же цель) -- орган иногда молчит, иначе его голос заглушает пробу
  if (yieldNow) a = 0;
  else if (B.rng() < cfg.CEPS * (B.t - h.born < cfg.CBABL ? 1 : 0.3)) { a = 1 + B.rng.int(h.nerves.length); babble = true; }   // лепет стихает, когда орган подрос
  else if (ob && cfg.COBV >= 2) { let bv = -Infinity; ob.forEach((x, i) => { if (x > bv) { bv = x; a = i + 1; } });
    // COBV=3: слова для этого смысла у меня нет (лучший звук почти ничего не сдвигает) -- беру звук, который пока ничего не
    // значит: новое слово, а не чужое занятое
    // COBV=4: говорю, чтобы исправить то, что слушающий (я сам на его месте) понял бы неверно, не ломая верного; если тихо --
    // и так всё верно, молчу; если неверное есть, а исправить нечем, -- новое слово: звук, который пока ничего не значит
    // COBV=5: изобретение слова (именная игра Стилса). Если мой слушающий понял бы неверно, а исправить нечем (ни один звук не
    // ведёт его к верному), -- за этим решением закрепляется свободный звук (тот, что сейчас меньше всего значит), и я
    // говорю его каждый раз, когда это решение нужно и другие слова тут не помогают; слово, так и не ставшее понятным за
    // COBVR раз, отпускаю. Иначе -- как COBV=2 (звук, сильнее всего ведущий понимание к верному)
    // COBV=6: то же, но «исправить есть чем» -- только звуком, который ничего верного не ломает (иначе слово-пучок, «горькая
    // справа», мешает назвать одно «справа»)
    if (cfg.COBV === 6) for (const o of ob.org) { const br = (i) => ob.org.some((p) => p !== o && !p.wrong && !p.fixBy.includes(i) && p.breakBy && p.breakBy.includes(i)); o.fixable = o.fixBy.some((i) => !br(i)); }
    if (cfg.COBV === 5 || cfg.COBV === 6) { if (!h.coin) h.coin = new Map();
      const used = new Set([...h.coin.values()].map((c) => c.u));
      for (const o of ob.org) if (o.wrong && !o.fixable && !h.coin.has(o.key)) { let lo = Infinity, u = -1; ob.mu.forEach((x, i) => { if (used.has(i)) return; const v = x + 1e-9 * B.rng(); if (v < lo) { lo = v; u = i; } }); if (u >= 0) { h.coin.set(o.key, { u, n: 0, t: B.t }); used.add(u); } }
      for (const o of ob.org) if (o.wrong && o.fixable && h.coin.has(o.key)) h.coin.get(o.key).ok = true;   // слово стало понятным
      const needNow = ob.org.filter((o) => o.wrong && !o.fixable && h.coin.has(o.key));
      const D = (h.dbg5 = h.dbg5 || { calls: 0, unexp: 0, said: 0, retired: 0, blocked: 0 }); D.calls++; if (ob.org.some((o) => o.wrong && !o.fixable)) D.unexp++;
      if (needNow.length && Math.max(...ob.need) > 0) D.blocked++;
      if (needNow.length && !(Math.max(...ob.need) > 0)) { const c = h.coin.get(needNow[0].key); a = c.u + 1; c.n++; D.said++; if (!c.ok && c.n > cfg.COBVR) { h.coin.delete(needNow[0].key); D.retired++; } } }
    if (cfg.COBV === 4) { (h.dbgW = h.dbgW || [0, 0, 0, 0, 0])[Math.min(4, ob.nWrong)]++; if (!ob.nWrong) a = 0; else { let bn = -Infinity; ob.forEach((x, i) => { const v = ob.need[i] + 1e-3 * x; if (v > bn) { bn = v; a = i + 1; } });
        if (!(Math.max(...ob.need) > 0)) { let lo = Infinity; ob.mu.forEach((x, i) => { const v = x + 1e-9 * B.rng(); if (v < lo) { lo = v; a = i + 1; } }); } } }
    if (cfg.COBV === 3) { const mmax = Math.max(...ob.mu); if (!(bv > cfg.COBVM * mmax) || mmax <= 0) { let lo = Infinity; ob.mu.forEach((x, i) => { const v = x + 1e-9 * B.rng(); if (v < lo) { lo = v; a = i + 1; } }); } } }
  else if (h.W || cfg.CIMIT) { const gv = (id) => (typeof id === 'string' ? im.get(id) ?? 0 : G.alive[id] ? G.val[id] : 0); let bv = 0;
    for (let i = 0; i < h.nerves.length; i++) { const w = h.W && h.W[i], cx = h.Cx && h.Cx[i]; let v;
      if (cfg.CPREQ && h.useA && h.WA && h.WA[i]) v = linVal(h.WA[i], h.FA[i], gv);
      else if (cx) v = cxVal(cx, gv);
      else if (w) { v = w[0]; h.Fa[i].forEach((id, f) => { v += w[1 + f] * fval(id, gv); }); }
      else if (im.has('im' + i)) v = im.get('im' + i) - cfg.CIMTH;   // модели ещё нет -- подражание: сказать слово, которое вот-вот скажет родитель
      else continue;
      if (v > bv) { bv = v; a = i + 1; } } }
  const v = new Map(); if (a > 0) { for (const id of (cfg.CWATCH ? watchList(B, h) : candGoods(B))) if (G.alive[id]) v.set(id, G.val[id]); for (const [k, x] of im) v.set(k, x); }
  h.last = { a, v };
  if (cfg.CPREQ && a > 0 && h.W) { const gv = (id) => (typeof id === 'string' ? im.get(id) ?? 0 : G.alive[id] ? G.val[id] : 0), i = a - 1;   // прогнозы платы обеих моделей -- для честного сравнения на новых данных
    if (h.WA && h.WA[i]) h.last.pA = linVal(h.WA[i], h.FA[i], gv);
    const cx = h.Cx && h.Cx[i]; if (cx) h.last.pB = cxVal(cx, gv); else if (h.W[i]) h.last.pB = linVal(h.W[i], h.Fa[i], gv); }
  if (cfg.COBV && h.obH) h.obH = [babble ? a - 1 : -1, h.obH[0]];   // копия команды учится только на лепете: выбор наугад -- опыт, а не совпадение с тем, что видит мозг
  if (cfg.CSURP && a > 0 && h.W) { const gv = (id) => (typeof id === 'string' ? im.get(id) ?? 0 : G.alive[id] ? G.val[id] : 0), w = h.W[a - 1], cx = h.Cx && h.Cx[a - 1];   // прогноз платы за сделанное -- для удивления
    if (cx) h.last.pv = cxVal(cx, gv); else if (w) { let p = w[0]; h.Fa[a - 1].forEach((id, f) => { p += w[1 + f] * fval(id, gv); }); h.last.pv = p; } } h.nerves.forEach((k, i) => { B.u[k] = i + 1 === a ? cfg.SPTH + 1 : 0; B.drv[k] = h; });
  B.led.work(h, 8 + 4 * h.F.length * h.nerves.length + v.size);
  h.mem = 8 + h.arch.length * (h.arch.length ? h.arch[h.arch.length - 1].v.size : 0);
}
// COBV: «говорю тем, чем понимаю». Свои отклики каждого действия органа (по задержкам) -- то, что мозг услышит от себя;
// для каждого звука i -- воображаемое: нервы-отклики звука i (задержка 1) включены, моего прошлого звука (задержка 2) --
// тоже, остальные отклики -- нули; база -- то же без звука i. Для каждого другого органа выбора: какое действие он выбрал бы
// сейчас (по-настоящему) и насколько звук i сдвигает его ценности к этому действию против лучшего другого
function chVal(h, i, gv) { const cx = h.Cx && h.Cx[i]; if (cx) return cxVal(cx, gv); const w = h.W && h.W[i]; if (!w) return 0; let v = w[0]; h.Fa[i].forEach((id, f) => { v += w[1 + f] * fval(id, gv); }); return v; }
// Свои отклики -- не из пробы исследователя (там -- только самый сильный общий отклик, громкость), а копия команды: орган
// помнит, что было с нервами через 1 и 2 круга после каждого своего действия (скользящие средние), и отклик звука i --
// нерв, который после i выше, чем после других звуков, на COBVD (общий всем звукам отклик так не проходит)
function obvLearn(B, h) {
  const G = B.goods, n = h.nerves.length, K = B.ch.length;
  if (!h.obM || h.obM[0].length !== n * K) { h.obM = [new Float64Array(n * K), new Float64Array(n * K)]; h.obC = [new Float64Array(n), new Float64Array(n)]; h.obH = [-1, -1]; }
  for (let L = 0; L < 2; L++) { const a = h.obH[L]; if (a < 0 || a >= n) continue; h.obC[L][a]++; const r = Math.max(0.002, 1 / h.obC[L][a]), M = h.obM[L];
    for (let q = 0; q < K; q++) M[a * K + q] += r * (G.val[B.ch[q].good] - M[a * K + q]); }
  B.led.work(h, 2 * K);
  // COBVP: чей взгляд у слушающего. Когда я слышу чужой звук (ухо, отклик моего рта, звучит, а я этого звука не говорил),
  // я -- слушающий; нерв, который в такие круги почти молчит, хотя вообще живой, -- мой личный (глаза видящего): слушающий
  // его не знает, и в воображении он -- каким бывает, когда слушаю я
  // (не только нервы: прогноз части, построенный на моих глазах, -- тоже личный; поэтому -- по всем товарам, скользящие средние)
  if (B.cfg.COBVP) { const cap = G.val.length; if (!h.pv || h.pv.eA.length !== cap) h.pv = { eA: new Float64Array(cap), eH: new Float64Array(cap), mH: new Float64Array(cap), nH: 0, aA: new Float64Array(cap), qA: new Float64Array(cap), qH: new Float64Array(cap) };
    const E = obvEff(B, h), P = h.pv; if (!E) return;
    const mine = h.last && h.last.a > 0 ? new Set(E[h.last.a - 1].filter((e) => e.lag === 1).map((e) => e.j)) : new Set();
    const heardOther = E.some((es) => es.some((e) => e.lag === 1 && !mine.has(e.j) && G.val[B.ch[e.j].good] > 0.5));
    // (по разбросу, а не по модулю: прогноз части на моих глазах, когда слушаю, -- не ноль, а постоянная)
    const N = G.n; for (let id = 0; id < N; id++) if (G.alive[id]) { const v = G.val[id]; P.eA[id] += 0.002 * (Math.abs(v) - P.eA[id]); P.aA[id] += 0.002 * (v - P.aA[id]); P.qA[id] += 0.002 * (v * v - P.qA[id]); }
    if (heardOther) { P.nH++; const r = Math.max(0.005, 1 / P.nH); for (let id = 0; id < N; id++) if (G.alive[id]) { const v = G.val[id]; P.eH[id] += r * (Math.abs(v) - P.eH[id]); P.mH[id] += r * (v - P.mH[id]); P.qH[id] += r * (v * v - P.qH[id]); } }
    B.led.work(h, 3 * N); }
}
function obvEff(B, h) {
  const cfg = B.cfg, n = h.nerves.length, K = B.ch.length; if (!h.obM) return null;
  return h.nerves.map((k, i) => { const out = [];
    for (let L = 0; L < 2; L++) { if (h.obC[L][i] < 50) continue; const M = h.obM[L];
      for (let q = 0; q < K; q++) { if (h.nerves.includes(q)) continue; let o = 0, no = 0; for (let j = 0; j < n; j++) if (j !== i && h.obC[L][j] >= 50) { o += M[j * K + q]; no++; }
        const d = no ? M[i * K + q] - o / no : 0; if (d > cfg.COBVD && (!out[L] || d > out[L].d)) out[L] = { j: q, lag: L + 1, d }; } }
    return out.filter(Boolean); });   // на каждой задержке -- один, самый свой отклик
}
function obvScores(B, h) {
  const cfg = B.cfg, G = B.goods, n = h.nerves.length; if (n < 2) return null;
  const E = obvEff(B, h);
  if (!E || E.some((e) => !e.some((x) => x.lag === 1))) return null;
  const all = new Set(E.flat().map((e) => B.ch[e.j].good)), prev = h.last && h.last.a > 0 ? h.last.a - 1 : -1;
  const others = B.ex.choosers.filter((q) => q !== h && q.W && q.nerves.length >= 2); if (!others.length) return null;
  const real = (id) => (typeof id === 'string' ? 0 : G.alive[id] ? G.val[id] : 0);
  const priv = new Map(), P = h.pv;
  if (cfg.COBVP && P && P.nH >= 50) { for (let id = 0; id < G.n; id++) { if (!G.alive[id] || all.has(id)) continue; const vA = P.qA[id] - P.aA[id] ** 2, vH = P.qH[id] - P.mH[id] ** 2; if (vA > 1e-3 && vH < cfg.COBVPR * vA) priv.set(id, P.mH[id]); }
    // и моё тело: отклики моих же действий (ушёл, ел) -- у слушающего свои, в воображении -- каким бывает, когда слушаю я
    for (const q of B.ex.choosers) if (q !== h) for (const k of q.nerves) for (const e of (B.ch[k].port.eff || [])) { const id = B.ch[e.j].good; if (!all.has(id)) priv.set(id, P.mH[id]); } }
  const imag = (i) => { const on = new Set(); if (i >= 0) for (const e of E[i]) if (e.lag === 1) on.add(B.ch[e.j].good); if (prev >= 0) for (const e of E[prev]) if (e.lag === 2) on.add(B.ch[e.j].good);
    return (id) => (all.has(id) ? (on.has(id) ? cfg.COBVON : 0) : priv.has(id) ? priv.get(id) : real(id)); };
  const base = imag(-1), sc = new Array(n).fill(0), mu = new Array(n).fill(0), need = new Array(n).fill(0); let nWrong = 0; const org = [];   // mu -- насколько звук вообще что-то значит для меня
  for (const q of others) { const m = q.nerves.length; let as = 0, bv = -Infinity; for (let j = 0; j < m; j++) { const v = chVal(q, j, real); if (v > bv) { bv = v; as = j; } }
    // у органа с ветвями контекста слушает та ветвь, в которой звук сдвигает ценности сильнее («если бы я услышал --
    // откликнулась бы слушающая часть меня»), даже если сейчас контекст -- другой (я вижу сам)
    const vs = (j, gv, side) => { const cx = q.Cx && q.Cx[j]; if (!cx || side < 0) return chVal(q, j, gv); const w = cx.W[side]; let v = w[0]; cx.FS[side].forEach((id, f) => { v += w[1 + f] * fval(id, gv); }); return v; };
    let side = -1;
    if (!cfg.COBVP && q.Cx && q.Cx.some(Boolean)) { let best = -1; for (const sd of [0, 1]) { let tot = 0; for (let i = 0; i < n; i++) { const g = imag(i); for (let j = 0; j < m; j++) tot += Math.abs(vs(j, g, sd) - vs(j, base, sd)); } if (tot > best) { best = tot; side = sd; } } }
    const b0 = []; for (let j = 0; j < m; j++) b0.push(vs(j, base, side));
    // COBV=4: что понял бы я сам, если бы сейчас было тихо (только сказанное раньше), -- и верно ли это
    let bd = 0, bb = -Infinity, fixable = false; const fixBy = [], breakBy = []; for (let j = 0; j < m; j++) if (b0[j] > bb) { bb = b0[j]; bd = j; } const wrong = bd !== as; if (wrong) nWrong++;
    if (cfg.COBVDBG) (h.dbg = h.dbg || []).push({ q: q.nerves.slice(), as, bd, b0: b0.slice(), real: Array.from({ length: m }, (_, j) => chVal(q, j, real)), cx: q.Cx ? q.Cx.map((c) => c && { c: c.c, thr: c.thr, side: base(c.c) > c.thr ? 1 : 0, rs: real(c.c) > c.thr ? 1 : 0 }) : null });
    for (let i = 0; i < n; i++) { const g = imag(i); const d = [], vi = []; for (let j = 0; j < m; j++) { const x = vs(j, g, side); vi.push(x); d.push(x - b0[j]); }
      let o = -Infinity; for (let j = 0; j < m; j++) if (j !== as && d[j] > o) o = d[j]; sc[i] += d[as] - o; for (let j = 0; j < m; j++) mu[i] += Math.abs(d[j]);
      let di = 0, bi = -Infinity; for (let j = 0; j < m; j++) if (vi[j] > bi) { bi = vi[j]; di = j; }
      need[i] += wrong ? (di === as ? 1 : 0) : (di === as ? 0 : -1); if (wrong && di === as) { fixable = true; fixBy.push(i); } if (!wrong && di !== as) breakBy.push(i); }
    org.push({ key: q.id + ':' + as, wrong, fixable, fixBy, breakBy }); }
  B.led.work(h, 4 * n * others.length * 2 * 10);
  sc.mu = mu; sc.need = need; sc.nWrong = nWrong; sc.org = org; return sc;
}
function linVal(w, F, gv) { let v = w[0]; F.forEach((id, f) => { v += w[1 + f] * fval(id, gv); }); return v; }
// CCTX: ценность действия по ветви контекста -- своя модель для каждой стороны нерва-контекста
function cxVal(cx, gv) { const s = gv(cx.c) > cx.thr ? 1 : 0, w = cx.W[s]; let v = w[0]; cx.FS[s].forEach((id, f) => { v += w[1 + f] * fval(id, gv); }); return v; }
// CSURP: пора ли подгонять -- модели нет, давно не подгонялся или удивление выросло
function needFit(B, h) { const cfg = B.cfg;
  if (!h.W || h.W.some((w) => !w) || B.t - (h.fitT || 0) >= cfg.CFITMAX) return true;
  return (h.nE || 0) >= 30 && h.sE / h.nE > cfg.CSURP * Math.max(h.fitE || 0, 1e-6); }
// CCTX: поиск нерва-контекста для действия. Дёшево: остаток одной модели сравнивается с признаками, умноженными на сторону
// контекста (если правило по сторонам разное, остаток с ними связан); два лучших кандидата -- на честную проверку:
// подгонка ветвей на чётных рядах, сверка на нечётных против одной модели на тех же рядах
function ctxFit(B, h, ra, sc, cands, Fu, res, prev) {
  const cfg = B.cfg, G = B.goods; let ops = 0;
  if (!res || ra.length < 48) return { cx: null, ops };
  // CCTXK: полный поиск контекста -- раз в CCTXK подгонок (он -- главная работа органа); между ними прежняя ветвь только
  // переподгоняется на своём нерве, а без ветви орган живёт одной моделью
  const quick = cfg.CCTXK > 1 && (h.nFit || 0) % cfg.CCTXK !== 0;
  if (quick && !(prev && G.alive[prev.c])) return { cx: null, ops };
  // признаки ветви: свои слова (подражание) и их сочетания -- всегда, как в общей модели; дальше -- лучшие простые
  const own0 = Fu.filter((id) => typeof id === 'string' || (Array.isArray(id) && typeof id[0] === 'string'));
  const Fb = [...own0, ...sc.filter((x) => !Array.isArray(x[0]) && !own0.includes(x[0])).map((x) => x[0])].slice(0, Math.max(own0.length, Math.min(cfg.CFEAT, Math.floor(ra.length / 16))));
  if (!Fb.length) return { cx: null, ops };
  const get = (r, id) => fval(id, (q) => r.v.get(q) ?? 0);
  const e = ra.map((r) => { let p = res.w[0]; Fu.forEach((id, f) => { p += res.w[1 + f] * get(r, id); }); return r.y - p; });
  const nv = quick ? [] : cands.filter((id) => typeof id === 'number' && G.kind[id] === 'нерв').slice(0, cfg.CCTXN);
  const score = [];
  for (const c of nv) { let m = 0; for (const r of ra) m += r.v.get(c) ?? 0; const thr = m / ra.length;
    const sg = ra.map((r) => ((r.v.get(c) ?? 0) > thr ? 1 : -1)); let n1 = 0; for (const s of sg) if (s > 0) n1++;
    if (n1 < 20 || ra.length - n1 < 20) continue;
    let tot = 0;
    for (const x of [null, ...Fb]) { let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; const n = ra.length;
      for (let i = 0; i < n; i++) { const z = sg[i] * (x === null ? 1 : get(ra[i], x)), y = e[i]; sx += z; sy += y; sxx += z * z; syy += y * y; sxy += z * y; }
      const vx = sxx - sx * sx / n, vy = syy - sy * sy / n, cv = sxy - sx * sy / n; tot += vx > 1e-9 && vy > 1e-9 ? cv * cv / (vx * vy) : 0; }
    score.push([c, thr, tot]); }
  ops += ra.length * nv.length * (Fb.length + 2);
  score.sort((x, y) => y[2] - x[2]);
  const fit = (rows, FF) => { const mm = 1 + FF.length, M = new Float64Array(mm * mm), cv = new Float64Array(mm); let y2 = 0;
    for (const r of rows) { const f = [1, ...FF.map((id) => get(r, id))]; y2 += r.y * r.y; for (let i = 0; i < mm; i++) { cv[i] += f[i] * r.y; for (let k = 0; k < mm; k++) M[i * mm + k] += f[i] * f[k]; } }
    const mk = new Float64Array(mm); for (let i = 1; i < mm; i++) mk[i] = cfg.RIDGE * 10; ops += rows.length * mm * mm; return solve(M, cv, mm, y2, mk); };
  const err = (rows, w, FF) => { let s = 0; for (const r of rows) { let p = w[0]; FF.forEach((id, f) => { p += w[1 + f] * get(r, id); }); s += (r.y - p) ** 2; } return s; };
  const tr = ra.filter((r, i) => !(i & 1)), te = ra.filter((r, i) => i & 1);
  const one = quick ? { w: [] } : fit(tr, Fu); if (!one) return { cx: null, ops };
  const eOne = quick ? 0 : err(te, one.w, Fu); let sy = 0, sy2 = 0; for (const r of te) { sy += r.y; sy2 += r.y * r.y; } const vy = sy2 - sy * sy / Math.max(1, te.length);
  // признаки ветви: CCTXF=1 -- свои у каждой стороны (лучшие по связи с платой на рядах этой стороны: при «вижу / слышу»
  // глаза важны в одной ветви, уши -- в другой), иначе -- общие лучшие
  const own = (rows) => { if (!cfg.CCTXF) return Fb; const sc2 = cands.map((id) => { let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
      for (const r of rows) { const x = r.v.get(id); if (x === undefined) continue; n++; sx += x; sy += r.y; sxx += x * x; syy += r.y * r.y; sxy += x * r.y; }
      const vx = sxx - sx * sx / n, vv = syy - sy * sy / n, cv = sxy - sx * sy / n; return [id, n > 5 && vx > 1e-9 && vv > 1e-9 ? cv * cv / (vx * vv) : 0]; });
    ops += rows.length * cands.length; sc2.sort((x, y) => y[1] - x[1]); return sc2.slice(0, Math.max(1, Math.min(cfg.CFEAT, Math.floor(rows.length / 16)))).map((x) => x[0]); };
  let best = null;
  if (quick) { let m = 0; for (const r of ra) m += r.v.get(prev.c) ?? 0; best = { c: prev.c, thr: m / ra.length }; }
  else for (const [c, thr] of score.slice(0, 2)) {
    const side = (r) => ((r.v.get(c) ?? 0) > thr ? 1 : 0), FS = [0, 1].map((s) => own(tr.filter((r) => side(r) === s))), W = [0, 1].map((s) => fit(tr.filter((r) => side(r) === s), FS[s]));
    if (!W[0] || !W[1]) continue;
    const eB = [0, 1].reduce((a, s) => a + err(te.filter((r) => side(r) === s), W[s].w, FS[s]), 0);
    if (eOne - eB > cfg.CCTXM * vy && (!best || eB < best.eB)) best = { c, thr, eB };
  }
  if (!best) return { cx: null, ops };
  const side = (r) => ((r.v.get(best.c) ?? 0) > best.thr ? 1 : 0), FS = [0, 1].map((s) => own(ra.filter((r) => side(r) === s))), Wf = [0, 1].map((s) => fit(ra.filter((r) => side(r) === s), FS[s]));
  if (!Wf[0] || !Wf[1]) return { cx: null, ops };
  return { cx: { c: best.c, thr: best.thr, F: cfg.CCTXF ? null : Fb, FS, W: Wf.map((x) => Array.from(x.w)), sse: Wf[0].sse + Wf[1].sse }, ops };
}
function gramFit(B, ra, F, check) {
  const cfg = B.cfg, m = 1 + F.length, Ge = new Float64Array(m * m), Go = new Float64Array(m * m), ce = new Float64Array(m), co = new Float64Array(m); let ye = 0, yo = 0;
  const f = new Float64Array(m); f[0] = 1;
  ra.forEach((r, i) => { for (let k = 0; k < F.length; k++) f[k + 1] = fval(F[k], (q) => r.v.get(q) ?? 0); const G = i & 1 ? Go : Ge, c = i & 1 ? co : ce;
    if (i & 1) yo += r.y * r.y; else ye += r.y * r.y; for (let a = 0; a < m; a++) { c[a] += f[a] * r.y; for (let k = 0; k < m; k++) G[a * m + k] += f[a] * f[k]; } });
  const sub = (G, c, idx) => { const n = idx.length, M = new Float64Array(n * n), v = new Float64Array(n); for (let a = 0; a < n; a++) { v[a] = c[idx[a]]; for (let k = 0; k < n; k++) M[a * n + k] = G[idx[a] * m + idx[k]]; } return [M, v]; };
  const mask = (n) => { const mk = new Float64Array(n); for (let i = 1; i < n; i++) mk[i] = cfg.RIDGE * 10; return mk; };
  const all = [...Array(m).keys()], add = [0, ...F.map((id, k) => (Array.isArray(id) ? -1 : k + 1)).filter((k) => k > 0)];
  let use = all;
  if (check) { const err = (idx) => { const [M, v] = sub(Ge, ce, idx), sl = solve(M, v, idx.length, ye, mask(idx.length)); if (!sl) return Infinity; const [Mo, vo] = sub(Go, co, idx); let e = yo;
      for (let a = 0; a < idx.length; a++) { e -= 2 * sl.w[a] * vo[a]; for (let k = 0; k < idx.length; k++) e += sl.w[a] * Mo[a * idx.length + k] * sl.w[k]; } return e; };
    const no = Go[0], vy = yo - co[0] * co[0] / Math.max(1, no);
    if (!(err(add) - err(all) > cfg.CPRODM * vy)) use = add; }
  const G = new Float64Array(m * m), c = new Float64Array(m); for (let i = 0; i < m * m; i++) G[i] = Ge[i] + Go[i]; for (let i = 0; i < m; i++) c[i] = ce[i] + co[i];
  const [M, v] = sub(G, c, use), res = solve(M, v, use.length, ye + yo, mask(use.length));
  let resAll = null; if (cfg.CPREQ) { if (use === all) resAll = res; else { const [Ma, va] = sub(G, c, all); resAll = solve(Ma, va, m, ye + yo, mask(m)); } }
  return { Fu: use.slice(1).map((k) => F[k - 1]), res, resAll, ops: ra.length * m * m };
}
function chooserFit(B, h) {
  const cfg = B.cfg, A = h.nerves.length, rows = h.arch; if (rows.length < 20) return;
  h.nFit = (h.nFit || 0) + 1;
  // у каждого действия -- свои товары (о своём движении, о глазе, о пользе говорят по разным признакам): CFEAT товаров
  // с наибольшей связью (r^2) значения в круге выбора с платой за это действие, и своя модель ценности по ним
  const cands = (cfg.CWATCH ? watchList(B, h) : candGoods(B)).filter((id) => { let n = 0; for (const r of rows) if (r.v.has(id)) n++; return n >= (cfg.CWATCH ? 0.3 : 0.8) * rows.length; });
  const best = new Map();                  // лучшая связь товара с платой хоть за одно действие -- для смены списка
  h.Fa = []; h.W = []; let ops = 0, sseAll = 0, nAll = 0; const Cx = new Array(A).fill(null);
  for (let a = 1; a <= A; a++) {
    const ra = rows.filter((r) => r.a === a); if (ra.length < 12) { h.Fa.push([]); h.W.push(null); continue; }
    const sc = cands.map((id) => { let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
      for (const r of ra) { const x = r.v.get(id); if (x === undefined) continue; const y = r.y; n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
      const vx = sxx - sx * sx / n, vy = syy - sy * sy / n, cv = sxy - sx * sy / n; return [id, vx > 1e-9 && vy > 1e-9 ? cv * cv / (vx * vy) : 0]; });
    ops += ra.length * cands.length * 2;
    for (const [id, r2] of sc) best.set(id, Math.max(best.get(id) || 0, r2));
    sc.sort((x, y) => y[1] - x[1]);
    const imk = 'im' + (a - 1), forced = [];
    if (cfg.CIMIT && ra.filter((r) => r.v.has(imk)).length >= 0.5 * ra.length) {   // своё слово -- признак всегда, и его сочетания с лучшими товарами
      forced.push(imk); for (const [id] of sc.slice(0, cfg.CPROD || 4)) forced.push([imk, id]); }
    if (cfg.COBV === 1 && ra.filter((r) => r.v.has('ob' + (a - 1))).length >= 0.5 * ra.length) forced.push('ob' + (a - 1));   // согласованность с собственным пониманием -- признак всегда
    if (cfg.CPROD) {                       // ответ зависит от сочетания: произведения пар из лучших CPROD товаров
      const T = sc.slice(0, cfg.CPROD).map((x) => x[0]);
      for (let i = 0; i < T.length; i++) for (let k = i + 1; k < T.length; k++) { const f = [T[i], T[k]]; let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
        for (const r of ra) { const x = fval(f, (id) => r.v.get(id) ?? 0), y = r.y; n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
        const vx = sxx - sx * sx / n, vy = syy - sy * sy / n, cv = sxy - sx * sy / n; sc.push([f, vx > 1e-9 && vy > 1e-9 ? cv * cv / (vx * vy) : 0]); }
      ops += ra.length * T.length * T.length; sc.sort((x, y) => y[1] - x[1]);
      if (cfg.CPAIRN) {                    // CPAIRN: пары нервов, хотя бы у одного из которых нет своей связи с платой
        const G = B.goods, nv = cands.filter((id) => typeof id === 'number' && G.kind[id] === 'нерв').slice(0, cfg.CPAIRN), have = new Set(sc.map((x) => (Array.isArray(x[0]) ? x[0].join('*') : '')));
        for (let i = 0; i < nv.length; i++) for (let k = i + 1; k < nv.length; k++) { const f = [nv[i], nv[k]]; if (have.has(f.join('*'))) continue; let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
          for (const r of ra) { const x = fval(f, (id) => r.v.get(id) ?? 0), y = r.y; n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
          const vx = sxx - sx * sx / n, vy = syy - sy * sy / n, cv = sxy - sx * sy / n; sc.push([f, vx > 1e-9 && vy > 1e-9 ? cv * cv / (vx * vy) : 0]); }
        ops += ra.length * nv.length * nv.length / 2; sc.sort((x, y) => y[1] - x[1]);
      }
    }
    const F = [...forced, ...sc.slice(0, Math.max(0, Math.min(cfg.CFEAT, Math.floor(ra.length / 6)) - forced.length)).map((x) => x[0])].slice(0, Math.max(forced.length, Math.min(cfg.CFEAT, Math.floor(ra.length / 6)))), m = 1 + F.length;
    // CGRAM: суммы для подгонки (матрица произведений признаков) -- за один проход по записи, отдельно по чётным и нечётным
    // рядам; проверка произведений и итоговая модель -- из этих сумм, без новых проходов (то же самое, втрое дешевле)
    if (cfg.CGRAM) { const g = gramFit(B, ra, F, cfg.CPRODV && F.some((id) => Array.isArray(id)) && ra.length >= 24); ops += g.ops;
      h.Fa.push(g.Fu); h.W.push(g.res ? Array.from(g.res.w) : null); if (g.res) { sseAll += g.res.sse; nAll += ra.length; }
      if (cfg.CPREQ) { (h.FA = h.FA || [])[a - 1] = F; (h.WA = h.WA || [])[a - 1] = g.resAll ? Array.from(g.resAll.w) : null; }
      if (cfg.CCTX) { const r = ctxFit(B, h, ra, sc, cands, g.Fu, g.res, h.Cx && h.Cx[a - 1]); ops += r.ops; Cx[a - 1] = r.cx; if (r.cx) { sseAll += r.cx.sse - (g.res ? g.res.sse : 0); } }
      continue; }
    // CPRODV: произведения -- только если без них хуже на проверке (подгонка на чётных рядах, сверка на нечётных)
    let Fu = F;
    if (cfg.CPRODV && F.some((id) => Array.isArray(id)) && ra.length >= 24) {
      const Fadd = F.filter((id) => !Array.isArray(id));
      const err = (FF) => { const mm = 1 + FF.length, M2 = new Float64Array(mm * mm), c2 = new Float64Array(mm); let y2 = 0;
        const row = (r) => [1, ...FF.map((id) => fval(id, (q) => r.v.get(q) ?? 0))];
        ra.forEach((r, i) => { if (i & 1) return; const f = row(r); y2 += r.y * r.y; for (let a2 = 0; a2 < mm; a2++) { c2[a2] += f[a2] * r.y; for (let k = 0; k < mm; k++) M2[a2 * mm + k] += f[a2] * f[k]; } });
        const mk = new Float64Array(mm); for (let i = 1; i < mm; i++) mk[i] = cfg.RIDGE * 10;
        const sl = solve(M2, c2, mm, y2, mk); if (!sl) return Infinity; let e = 0;
        ra.forEach((r, i) => { if (!(i & 1)) return; const f = row(r); let p = 0; for (let a2 = 0; a2 < mm; a2++) p += sl.w[a2] * f[a2]; e += (r.y - p) ** 2; }); return e; };
      const eF = err(F), eA = err(Fadd); ops += 2 * ra.length * m * m;
      // мера -- доля разброса платы на проверке, а не доля ошибки: иначе произведение двух шумных нервов «объясняет» шум
      // датчиков (усредняет его) и проходит порог, хотя самой платы не объясняет
      let sy = 0, sy2 = 0, n2 = 0; ra.forEach((r, i) => { if (i & 1) { sy += r.y; sy2 += r.y * r.y; n2++; } }); const vy = sy2 - sy * sy / Math.max(1, n2);
      if (!(eA - eF > cfg.CPRODM * vy)) Fu = Fadd;
    }
    const mu = 1 + Fu.length, M = new Float64Array(mu * mu), cv = new Float64Array(mu); let yy = 0;
    for (const r of ra) { const f = [1, ...Fu.map((id) => fval(id, (q) => r.v.get(q) ?? 0))]; yy += r.y * r.y; for (let i = 0; i < mu; i++) { cv[i] += f[i] * r.y; for (let k = 0; k < mu; k++) M[i * mu + k] += f[i] * f[k]; } }
    const mask = new Float64Array(mu); for (let i = 1; i < mu; i++) mask[i] = cfg.RIDGE * 10;
    const res = solve(M, cv, mu, yy, mask); h.Fa.push(Fu); h.W.push(res ? Array.from(res.w) : null); ops += ra.length * mu * mu;
    if (res) { sseAll += res.sse; nAll += ra.length; }
    if (cfg.CCTX) { const r = ctxFit(B, h, ra, sc, cands, Fu, res, h.Cx && h.Cx[a - 1]); ops += r.ops; Cx[a - 1] = r.cx; if (r.cx) { sseAll += r.cx.sse - (res ? res.sse : 0); } }
  }
  if (cfg.CCTX) h.Cx = Cx;
  if (cfg.CSURP) { h.fitE = nAll ? sseAll / nAll : 0; h.sE = 0; h.nE = 0; h.fitT = B.t; }
  h.F = [...new Set([...h.Fa.flat(2), ...(h.Cx || []).filter(Boolean).flatMap((c) => [c.c, ...c.FS.flat(2)])])].filter((id) => typeof id === 'number');
  if (cfg.CIMIT) ownWords(B, h);
  if (cfg.CWATCH && h.fits++ % 3 === 2) {   // смена списка: самые слабые товары (не в моделях, наблюдаемые давно) -- на новые наугад
    const used = new Set(h.F), old = h.watch.filter((id) => !used.has(id) && B.t - h.wAt.get(id) > cfg.CARCHS && best.has(id));
    old.sort((x, y) => best.get(x) - best.get(y));
    const drop = new Set(old.slice(0, Math.ceil(h.watch.length / 8))), pool = candGoods(B).filter((id) => !h.watch.includes(id));
    h.watch = h.watch.filter((id) => !drop.has(id) && B.goods.alive[id]);
    while (h.watch.length < cfg.CWATCH && pool.length) { const id = pool.splice(B.rng.int(pool.length), 1)[0]; h.watch.push(id); h.wAt.set(id, B.t); }
    ops += candGoods(B).length;
  }
  B.led.work(h, ops);
}
// Номер умершего товара отдали товару другого смысла (Brain.forget). Органы выбора: номер уходит из списка слежки, а в признаках модели
// и в строках архива заменяется надгробием -- строкой, которой нет ни у одного товара: признак читается как 0 (так читался и
// мёртвый товар), прошлые значения в архиве остаются под надгробием, новый товар под тем же номером с ними не смешивается.
// Моторы: мёртвое понятие уходит из нервов модели; принятая модель с ним остаётся непригодной (-1), как и была; план и
// записка нерва (MNOTE) его забывают.
function forget(B, id) {
  const ex = B.ex, tomb = '†' + id + '.' + (ex.forgot = (ex.forgot || 0) + 1);
  const hit = (f) => f === id || (Array.isArray(f) && f.includes(id));
  const ren = (f) => (f === id ? tomb : Array.isArray(f) && f.includes(id) ? f.map((x) => (x === id ? tomb : x)) : f);
  const renList = (L) => (Array.isArray(L) && L.some(hit) ? L.map(ren) : L);
  const rk = (v) => { if (v && v.has(id)) { v.set(tomb, v.get(id)); v.delete(id); } };
  const scrub = (h) => {
    if (h.watch) { const i = h.watch.indexOf(id); if (i >= 0) h.watch.splice(i, 1); }
    if (h.wAt) h.wAt.delete(id);
    if (h.Fa) h.Fa = h.Fa.map(renList);
    if (h.FA) h.FA = h.FA.map(renList);
    if (h.F) h.F = renList(h.F);
    if (h.Cx) for (const cx of h.Cx) if (cx) { if (cx.c === id) cx.c = tomb; if (cx.F) cx.F = renList(cx.F); if (cx.FS) cx.FS = cx.FS.map(renList); }
    if (h.arch) for (const r of h.arch) rk(r.v);
    if (h.last) rk(h.last.v);
    if (h.pv) for (const k of ['eA', 'eH', 'mH', 'aA', 'qA', 'qH']) if (h.pv[k] && id < h.pv[k].length) h.pv[k][id] = 0;
  };
  for (const h of ex.choosers) scrub(h);
  if (ex.keepOrg) for (const kp of ex.keepOrg.values()) scrub(kp);
  for (const m of ex.motors) {
    if (m.S.includes(id)) { m.S = m.S.filter((x) => x !== id); m.inputs = m.S; m.share = null; m.coef = null; m.acc = null; m.mem = 8 + dimOf(m.S.length); }
    if (m.low) m.low.delete(id);
    if (m.good && m.good.S.includes(id)) m.good = { ...m.good, S: m.good.S.map((x) => (x === id ? -1 : x)) };
    if (m.pl) { if (m.pl.S && m.pl.S.some(hit)) m.pl.S = m.pl.S.filter((d) => !hit(d)); if (m.pl.low) m.pl.low.delete(id); if (m.pl.dep) m.pl.dep = m.pl.dep.filter((g) => g !== id); }
  }
  for (const c of B.ch) if (c.port && c.port.note && c.port.note.S.includes(id)) c.port.note = null;
}
// перенос выученного потомку (как правка 44 нейрона-3): ценность и форма мотора MVAL по нервам -- без записи и без частей.
// Потомок сам заново находит двигатель лепетом, но его моторный орган сразу получает ценность и веса родителя, а запись --
// свою, с нуля: при первой подгонке веса ставятся по его собственной жизни.
function libSave(B) { const out = []; for (const [k, v] of (B.vrs || new Map())) if (v.ok) out.push({ k, ids: v.ids.slice(), b: Array.from(v.b), lin: v.lin ? { a: v.lin.a.slice(), mu: Array.from(v.lin.mu), fits: v.lin.fits } : null }); return { ver: 1, n: B.world.n, vrs: out }; }
function libLoad(B, L) {
  const cfg = B.cfg; if (!L || L.n !== B.world.n) return false; B.syncNerves();
  for (const e of L.vrs) { if (e.ids.some((id) => !B.goods.alive[id] || B.goods.kind[id] !== 'нерв')) continue; const F = e.ids.length;
    (B.vrs || (B.vrs = new Map())).set(e.k, { ids: e.ids.slice(), F, n: 0, x: new Float32Array(cfg.MVH * F), c: new Float32Array(cfg.MVH), u: new Float32Array(cfg.MVH), b: Float64Array.from(e.b), ok: true, td: new Float64Array(cfg.H), last: null,
      lin: e.lin ? { a: e.lin.a.slice(), mu: Float64Array.from(e.lin.mu), fits: e.lin.fits } : null, inherited: true }); }
  return true;
}
module.exports = { init, newNerve, decide, think, economy, libSave, libLoad, forget };

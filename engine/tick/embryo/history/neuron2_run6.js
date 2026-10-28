#!/usr/bin/env node
'use strict';
/* ============================================================
   НЕЙРОН-2 -- пересборка по итогам оценки чернового нейрона
   Правка 2: потомство по доходу, замер «мир платит всем поровну»,
   все постоянные настраиваются, перестановочный нуль в выводе.
   Правка 3: закон учёбы -- в генах (RULE=1).
   Правка 4: мир со связанными входами (RHO, MIX) -- проверка, выведет ли
   отбор LMS точно, когда Хебб с забыванием даёт кривые веса.
   Правка 5: выход части -- её вычисление. У части два товара: сырой датчик
   и свой прогноз; покупатель выбирает сам. Ген числа связей выброшен.
   Правка 6: мир с прошлым глубже любого канала (DEEP). Отдельный источник 8
   и канал 9, который завтра повторяет источник 8, каким тот был DEEP кругов
   назад. Ни один датчик этого прошлого не видит: донести его может только сеть.
   Правка 7: сигнал на продажу (SIGNAL=1). Третий товар части -- сигнал, который
   учится не на её задаче, а на ошибках покупателей: каждый покупатель возвращает
   продавцу свою ошибку, умноженную на вес связи. Рыночный аналог обратного
   распространения; так часть может стать передатчиком, если за это платят.
   Сигнал нормирован по своей силе и ограничен (как частота разрядов у нейрона),
   а связь живёт, пока заметен её ВКЛАД (вес на силу входа), а не голый вес:
   иначе крошечный сигнал с огромным шумным весом держал место зря.
   Связь ради сигнала держится, только пока сигнал покупают.
   Правка 8: проба не портит прогноз (TRY=1). Пробная связь читается и учится
   на остатке ошибки, но в оплачиваемый прогноз входит, лишь когда докажет
   пользу. Иначе каждая проба впрыскивала шум в прогноз, мир платил меньше,
   бедные переставали искать -- и с тремя товарами миры вымирали на старте.
   Правка 9: подсказка соседей (IMIT). С тремя товарами и десятью каналами
   вслепую родителей ищут слишком долго: непроводные беднеют и мрут, заселенцы
   с 30 тактами не успевают найти никого, а богатые платят за них снова и снова,
   пока не разорятся, -- так вымер мир глубины 2. Теперь часть поиска копирует
   проверенную связь соседа по каналу: кто у кого покупает -- открыто.
   Пробовалось и выброшено: закрывать канал для заселения после неудачи на
   удваивающийся срок. Каналы не могли пополниться, мельчали, и из 12 миров
   вымерли 11.
   Правка 10: замена павшего продавца (REPLACE). Передатчик глубины 2 жил на
   одной нитке: бедный источник 8 -> часть-передатчик -> канал 9. Когда этот
   источник умирал, рвалась вся цепочка, и собрать её заново было почти
   невозможно. Теперь проверенная связь с датчиком или прогнозом при смерти
   продавца переходит к другому продавцу того же товара в том же канале: такие
   товары равноценны. Сигнал у каждой части свой, поэтому сигнал соседа павшего
   продавца по каналу (часто родни) берётся на пробу, а не сразу.
   Правка 11: спрос направляет предложение. Нужды канала 9 глубины 2 никто не
   видел: его части бедны и не могли даже попробовать чужой сигнал, а продавцы
   не знали, что их покупатели несчастны. Теперь проба бесплатна, как образец
   товара (FREE_TRY), а продавец, чьи покупатели сильно ошибаются, чаще ищет
   новые входы для своего сигнала (DEMAND).
   Правка 12: кредит на проверенное (DEBT). Передатчик собирался во всех мирах,
   но стоило ему раз порваться, бедный канал 9 уже не мог заплатить за чтение
   даже найденного заново -- и цепочка гибла. Теперь проверенную связь можно
   читать в долг до DEBT тактов; смерть по-прежнему через DIE кругов в минусе.
   Правка 13: запасные передатчики (KIN). Передатчик глубины 2 -- одна часть со
   своим особым сигналом; она гибнет, и цепочка с ней. Теперь потомок передатчика
   наследует не только его входы и сигнал, но и память о спросе, и держит входы
   сигнала, пока спрос не забыт (память растёт быстро, а гаснет медленно). Когда
   продавец сигнала погибает, покупатель получает на пробу не случайного соседа,
   а того, чей сигнал собран из тех же входов, -- обычно его потомка, и получает его
   связь сразу проверенной: пересадка не должна стоить покупателю двадцати кругов.

   Правка 14: слой еды и петля истощения (EAT=1), по предрегистрации PRELOOP3.
   Канал F и восемь добытчиков. F(t+1) = (c8(t-DEEP) - LOOP*среднее_названное_место) /
   делитель: куда добытчики пошли, оттуда еда уходит. В петлю входит САМО названное
   место, а не признак попадания, поэтому петля работает всегда и её сила не зависит
   от умелости. Место -- доля значения F; границы долей -- выборочные квантили самого
   F по первой половине прогона, замороженные на измеряемую вторую, поэтому доли
   равновероятны по построению и пол равен 1/M. Добытчик платит ACT и называет долю,
   в которую попал его прогноз; постоянный фонд FOOD делится между назвавшими верно и
   сгорает, если не угадал никто. За сжатие F мир не платит. RANDACT -- нуль А
   (место жребием), SHUFACT -- нуль Б (действие из случайного прошлого круга),
   LOOP=0 -- нуль В (мир без петли). EAT=0 воспроизводит прежний мир побитово.

   1. Читающему есть польза. Мир -- поток из 8 каналов, связанных
      причинно: три источника, остальные завтра повторяют сочетание
      других сегодня. Мир платит части за сжатие её канала: столько
      тактов, сколько бит на круг она экономит, предсказывая его.
      Чтение соседа -- покупка сведений: читающий платит прочитанному.
      Товаров два: сырой датчик и прогноз, сделанный в прошлом круге, --
      сигнал идёт с задержкой в круг, как по аксону. Цепочка прогнозов
      может нести прошлое дальше, чем его держит любой датчик.
   2. Синапс живёт, пока несёт вес. Новая связь -- проба: если за
      TRIAL кругов её вес не вырос, она отмирает. Связи находит УЧЁБА
      внутри одной жизни -- без размножения они находятся так же.
   3. Жизнь и смерть. Аренда за место, банкрот умирает, случайный сбой
      освобождает места. Место в канале достаётся потомку части того же
      канала; шанс пропорционален её доходу (SELECT=1), а не жребию среди
      накопивших на копию (SELECT=0). Копия уносит связи и веса.
   4. Зачем хозяйство: не находить связи, а не давать отбору их разобрать.
      Проверка: SHARE=1 -- мир делит всю плату за биты поровну на всех,
      и польза от чтения больше не достаётся читающему. SHARE_AT -- с
      какого круга: так отбор проверяется на уже собранной сети.
   5. Закон учёбы -- в генах. Вес меняется на (a*s' - b*p)*x - c*w, где x --
      вход, s' -- что потом увидел свой датчик, p -- своё предсказание, w --
      сам вес. Три местных слагаемых: Хебб с исходом, анти-Хебб со своим
      выходом, забывание. LMS -- частный случай a = b, c = 0. Основатели
      получают случайные a, b, c; найдёт ли отбор LMS сам? RULE=0 -- LMS
      задан рукой, как в правке 2.
   6. Всё синхронно, порядок номеров ни на что не влияет.
   7. Седьмое правило: медианы; возраст -- и умерших, и живых; рядом
      с долей верных связей -- перестановочный нуль.

   Все постоянные читаются из окружения, действующие печатаются в начале
   прогона: ручка не может молча не сработать. WORLD=0 -- мир без
   причинности, у каждой части свой поток.
   ============================================================ */

const num = (n, d) => {
  const v = process.env[n];
  if (v === undefined || v.trim() === '') return d;
  const x = +v; if (Number.isNaN(x)) throw new Error(`${n}: не число`);
  return x;
};
const CFG = {};
const K = (n, d) => (CFG[n] = num(n, d));
const WORLD  = K('WORLD', 1);         // 1 причинный мир, 0 у каждой части свой поток
const DEEP   = K('DEEP', 0);          // 0 нет; 1, 2 -- глубина прошлого для канала 9
const EAT    = K('EAT', 0);            // 1 слой еды: канал F, добытчики, действие, петля истощения
const SLOW   = K('SLOW', 0);           // 1 медленный канал S: скрытая L (AR rho) сквозь шум, лежащий в самом мире
const SRHO   = K('SRHO', 0.98);        // медленность L
const SSIG   = K('SSIG', 1);           // шум наблюдения в самом мире -- один на все части канала
const SELFREC = K('SELFREC', 0);        // 1 вес на собственный вчерашний прогноз (возвратная связь на себя)
const WSLEARN = K('WSLEARN', 1);        // 1 этот вес учится LMS, 0 закреплён
const WS0    = K('WS0', 0);             // начальный (или закреплённый) вес на себя у частей прочих каналов
const WS0S   = K('WS0S', 0);           // то же у частей медленного канала
const HOLD   = K('HOLD', 0);          // 1: в тишине на месте молчащего датчика -- собственное ожидание части; 2: только для самой части, покупатели видят молчание
const HCAP   = K('HCAP', 0);          // > 0: в тишине при HOLD усиление части на себя (wSelf + ws) не выше HCAP по модулю
const FREEPRUNE = K('FREEPRUNE', 1);  // разбор: 0 -- в тишине связи не отмирают и не ищутся, их возраст заморожен
const FREEMETA = K('FREEMETA', 1);    // разбор: 0 -- в тишине нет аренды, платы за чтения, поиска, смертей и рождений
const ECOSLEEP = K('ECOSLEEP', 0);    // 1: в тишине деньги не ходят (нет аренды, платы за чтения, поиска, рождений), часы хозяйства стоят; сбои идут
const REL3 = K('REL3', 0);            // проба строки 5: правило канала 3 -- 0 (c0+c1), 1 (c0-c1), 2 (c0+c2); замер может менять w.rel3 на ходу
const PERTURB = K('PERTURB', 0);      // проба строки 5 (нуль): столько лишних жребиев после создания мира -- другая история шума
const NODATA = K('NODATA', 0);        // 1: в тишине оценки мощности входа из мира (r2, r2s, zv, zv5) не обновляются -- у них нет данных
const WAKEGRACE = K('WAKEGRACE', 0);  // разбор: после тишины столько кругов жизни связи не судятся
const NOFAULTQUIET = K('NOFAULTQUIET', 0);   // разбор: 1 -- в тишине сбоев нет
const ZVFREEZE = K('ZVFREEZE', 0);    // разбор: 1 -- в тишине нормировка сигнала (zv, zv5) не обновляется
const RELSIG = K('RELSIG', 0);        // 1: путь сигнала судится по доле с тем же окном, что у мощности входа (zv5, шаг 0.05)
const RELPRUNE = K('RELPRUNE', 0);    // 1: связь судится по доле своей мощности в мощности датчика части, а не по абсолютной
const PAYL   = K('PAYL', 0);          // 1: мир платит медленному каналу по знанию настоящей L, а не по сжатию датчика
const SPROTECT = K('SPROTECT', 0);      // разбор: части медленного канала без аренды и бессмертны
const ORDER  = K('ORDER', 0);         // проба строки 8: каналы событий A, B и отчёта Q о порядке A->B (+) или B->A (-)
const ORDERSHUF = K('ORDERSHUF', 0);
const DLINE = K('DLINE', 0);          // > 0: товар «датчик с линией» -- покупатель сам держит историю входа на DLINE кругов, у связи DLINE+1 отводов
const PROTECTQ = K('PROTECTQ', 0);    // разбор строки 8: части канала Q без аренды и бессмертны
const QDELAY = K('QDELAY', 0);        // разбор строки 8: частям канала Q даром линия задержки A и B на 0-6 кругов, веса учит LMS  // нуль строки 8: знак отчёта -- жребий, не связанный с порядком
const N      = K('N', WORLD ? 8 * ((DEEP ? 10 : 8) + (EAT ? 1 : 0) + (SLOW ? 1 : 0) + (ORDER ? 3 : 0)) : 64);   // мест (по 8 на канал)
const ROUNDS = K('ROUNDS', 100000);
const SN     = K('SN', 0.1);          // шум датчика
const PAY    = K('PAY', 1);           // тактов за бит сжатия
const RENT   = K('RENT', 0.4);        // аренда места за круг
const PRICE  = K('PRICE', 0.3);       // одно чтение, уходит прочитанному
const C_LINK = K('C_LINK', 1);        // поиск связи
const SEARCH = K('SEARCH', 0.2);      // шанс поиска за круг при urge = 1
const TRIAL  = K('TRIAL', 20);        // проба связи, кругов
const PRUNE  = K('PRUNE', 0.15);      // порог веса после пробы
const DIE    = K('DIE', 50);          // кругов в минусе до смерти
const FAULT  = K('FAULT', 1 / 3000);  // сбой: шанс смерти за круг
const BIRTH  = K('BIRTH', 60);        // цена копии; потомок получает половину
const CAP    = K('CAP', 200);         // потолок копилки
const START  = K('START', 200);       // стартовый запас основателей
const BETA   = K('BETA', 0.02);       // окно оценки ошибки, около 50 кругов
const GAIN   = K('GAIN', 0.01);       // окно оценки дохода, около 100 кругов
const SELECT = K('SELECT', 1);        // 1 потомство по доходу, 0 жребий среди накопивших
const SELPOW = K('SELPOW', 1);        // насколько круто шанс потомства растёт с доходом
const SHARE  = K('SHARE', 0);         // 1 мир делит плату за биты поровну на всех
const SHARE_AT = K('SHARE_AT', 0);    // с какого круга делить поровну (чтобы сеть успела собраться)
const RULE   = K('RULE', 0);          // 1 закон учёбы в генах, 0 LMS рукой. По умолчанию рукой: на 24 сидах
                                      // генный закон давал 1.88 бита против 2.89 и 4 вымирания из 24 против 0.
                                      // При этом отбор закон НЕ игнорирует: пустой отсчёт (жребий и мутация
                                      // без мира, отбора и смерти) даёт 1.4% похожих на LMS, а мир держит
                                      // 7-41%. Обогащает банкротство, а не выбор родителя: удалённость от
                                      // LMS связана с потомством на 0.00
const MUT    = K('MUT', 1);           // множитель мутации генов закона (0 -- закон не меняется)
const SEED_RULE = K('SEED_RULE', 0);  // > 0: основатели начинают с LMS (a = b = SEED_RULE, c ~ 0)
const WMAX   = K('WMAX', 8);          // предел силы синапса
const RHO    = K('RHO', 0);           // связь источников между собой (0 -- независимы)
const MIX    = K('MIX', 1);           // вес второго родителя в смесях (1 -- поровну)
const SIGNAL = K('SIGNAL', 1);        // 1 у части есть сигнал на продажу, обучаемый ошибками покупателей
const ZLR    = K('ZLR', 0.05);        // скорость учёбы сигнала
const TRY    = K('TRY', 1);           // 1 пробная связь не входит в оплачиваемый прогноз
const IMIT   = K('IMIT', 0.5);        // доля поисков по подсказке соседей по каналу
const REPLACE = K('REPLACE', 1);      // 1 проверенная связь переходит к равноценному продавцу
const FREE_TRY = K('FREE_TRY', 1);    // 1 пробное чтение бесплатно, как образец
const DEMAND = K('DEMAND', 0.2);      // добавочный поиск продавца, когда его покупатели ошибаются
const DEBT   = K('DEBT', 20);         // сколько можно задолжать за чтение проверенных связей
const KIN    = K('KIN', 1);           // 1 запасные передатчики: наследуемый спрос и замена родичем
const M_PL   = K('M', 4);              // сколько мест у еды
const LOOP   = K('LOOP', 0.5);        // сила истощения: куда пошли, оттуда еда уходит
const ACT    = K('ACT', 0.5);         // цена одного действия, сгорает
const FOOD   = K('FOOD', 3);          // постоянный фонд за круг, делится между угадавшими
const RANDACT = K('RANDACT', 0);      // нуль А: место называется жребием
const SHUFACT = K('SHUFACT', 0);      // нуль Б: действие берётся из случайного прошлого круга этой же части
const DECIDE = K('DECIDE', 0);         // 1 действие -- решение: таблица сдвигов, учится ТОЛЬКО на еде
const QLR    = K('QLR', 0.05);        // скорость учёбы таблицы сдвигов
const EXPL   = K('EXPL', 0.1);        // доля разведочных действий
const NOPRED = K('NOPRED', 0);        // прогон без прогноза: доля отсчёта постоянна
const LAG    = K('LAG', 0);           // запаздывающий мир: F смещается средним ПОЗАПРОШЛОГО круга
const GAINM  = K('GAINM', 0);          // 1 решение как величина: множитель прогноза, учится только на еде
const SIG    = K('SIG', 0.1);         // размах возмущения множителя
const SLR    = K('SLR', 0.02);        // скорость учёбы множителя
const MUL0   = K('MUL0', 1);          // начальный множитель (для прямого замера оптимума)
const SIGMIX = K('SIGMIX', 0);         // 1 смешанный мир: на чётных местах разброс SIGA, на нечётных SIGB
const SIGA   = K('SIGA', 0);
const SIGB   = K('SIGB', 0.1);
const HID    = K('HID', 0);           // 1 скрытая величина h: при h=1 еда в зеркальной доле; прогноз её не видит
const HQ     = K('HQ', 0.02);         // вероятность, что h перевернётся за круг
const LOOK   = K('LOOK', 0.8);        // цена взгляда на h
const LOOKN  = K('LOOKN', 0);         // закреплённый рукой взгляд: смотреть, если с прошлого прошло >= LOOKN кругов (0 -- никогда)
const ORACLE = K('ORACLE', 0);
const LOSEK  = K('LOSEK', 0);          // взгляд после K промахов подряд (0 -- выключено)        // проверка 0: каждый добытчик знает h даром
const KEEP   = K('KEEP', 0);          // сколько истощения остаётся на следующий круг: 0 -- последствие на один круг
const LMAX   = K('LMAX', 4);          // физический предел связей у части (не ген; при 8 генный закон вымирал чаще)
const CHW = WORLD ? (DEEP ? 10 : 8) : N;          // каналы без еды
const FCH = EAT ? CHW : -1;                       // канал еды идёт следующим номером
const SCH = SLOW ? CHW + (EAT ? 1 : 0) : -1;       // медленный канал идёт после канала еды
const OCH = ORDER ? CHW + (EAT ? 1 : 0) + (SLOW ? 1 : 0) : -1;   // каналы A, B, Q идут последними
const CH = CHW + (EAT ? 1 : 0) + (SLOW ? 1 : 0) + (ORDER ? 3 : 0), V = 1 + SN * SN;
const PEV = 1 / 13.5, SEV = 1 / Math.sqrt(PEV * (1 - PEV)), SQ = 1 / Math.sqrt(PEV);   // частота событий за круг и нормировки к единичной дисперсии
const VS = 1 + SSIG * SSIG + SN * SN;              // дисперсия датчика медленного канала
if (SLOW && !WORLD) throw new Error('медленный канал требует WORLD=1');
if (EAT && (!FREEPRUNE || !FREEMETA)) throw new Error('тишина со всеми правилами не поддержана в мире еды');
if ((REL3 || PERTURB) && (RHO !== 0 || MIX !== 1)) throw new Error('проба строки 5 рассчитана на RHO=0 и MIX=1');
if (DLINE && RULE) throw new Error('линия задержки поддержана только при LMS');
if (HCAP && !HOLD) throw new Error('предел HCAP действует только при HOLD=1');
if (PAYL && !SLOW) throw new Error('плата за знание L требует медленного канала (SLOW=1)');
if (SELFREC && RULE) throw new Error('связь на себя поддержана только при законе LMS (RULE=0)');
const FDIV = Math.sqrt(1 + LOOP * LOOP * (M_PL * M_PL - 1) / 12);   // держит дисперсию F около 1
const mPlace = (a) => a - (M_PL - 1) / 2;         // место как число: -1.5 ... +1.5 при M=4
const NF = EAT ? Array.from({ length: N }, (_, i) => i).filter((i) => i % CH === FCH).length : 0;
if (EAT && (!WORLD || !DEEP)) throw new Error('слой еды требует WORLD=1 и DEEP>=1: F стоит на скрытом прошлом c8');
if (EAT && M_PL < 2) throw new Error('M должно быть не меньше 2');
// делители, чтобы у каждого канала дисперсия была 1 при любых RHO и MIX
const K3 = Math.sqrt(1 + MIX * MIX + 2 * MIX * RHO), K4 = Math.sqrt(1 + MIX * MIX - 2 * MIX * RHO);
const C34 = (RHO - MIX * RHO + MIX - MIX * MIX * RHO) / (K3 * K4);          // связь каналов 3 и 4
const K7 = RHO === 0 && MIX === 1 ? 1 : Math.sqrt(1 + MIX * MIX - 2 * MIX * C34); // 1 -- старый мир точно
if (START > CAP) throw new Error('START выше CAP: запас сгорит в первый же круг');
const PARENTS = [[], [], [], [0, 1], [1, 2], [0, 2], [3], [3, 4]]; // только для замеров
// вчерашний прогноз несёт вчерашнее: для него верны и родители, и родители родителей
const GRAND = PARENTS.map((ps) => [...new Set(ps.flatMap((q) => PARENTS[q]))]);

function makeRNG(seed) {                  // mulberry32: числа совпадут на любой машине
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clampW = (v) => (v > WMAX ? WMAX : v < -WMAX ? -WMAX : v);

const binOf = (w, v) => { if (!w.fq) return -1; let i = 0; while (i < w.fq.length && v >= w.fq[i]) i++; return i; };
const carZ = (q) => q.zz > 1e-9 && q.cz * q.cz / q.zz >= 0.25;
const carP = (q) => q.pp > 1e-9 && q.cp * q.cp / q.pp >= 0.25;
const hasRelay = (w, p) => p.links.some((l) => { const q = w.parts[l.j];
  return q && l.age >= TRIAL && Math.abs(l.w) * Math.sqrt(l.r2 || 1) >= PRUNE &&
    ((l.k === 2 && carZ(q)) || (l.k === 1 && carP(q))); });

function worldStep(w) {
  const c = w.c, n = new Float64Array(CH), g = () => gauss(w.rnd);
  if (!WORLD) { for (let k = 0; k < CH; k++) n[k] = 0.9 * c[k] + Math.sqrt(0.19) * g(); }
  else {
    // источники почти непредсказуемы сами по себе: их части живут тем, что их читают
    // RHO > 0: у источников общая составляющая, и входы смесей связаны между собой;
    // MIX != 1: смесь не вдоль общей оси входов, и Хебб с забыванием её не подстроит
    const gc = RHO ? g() : 0;
    for (let k = 0; k < 3; k++)
      n[k] = 0.5 * c[k] + Math.sqrt(0.75) * (RHO ? Math.sqrt(RHO) * gc + Math.sqrt(1 - RHO) * g() : g());
    const rel = w.rel3 ?? REL3;          // проба строки 5 (при 0 -- мир прежний)
    n[3] = rel === 1 ? (c[0] - MIX * c[1]) / K4 : rel === 2 ? (c[0] + MIX * c[2]) / K3 : (c[0] + MIX * c[1]) / K3;
    n[4] = (c[1] - MIX * c[2]) / K4;
    n[5] = (c[0] - MIX * c[2]) / K4;
    n[6] = c[3];
    n[7] = (c[3] - MIX * c[4]) / (rel ? Math.sqrt(3) : K7);   // при rel 1 и 2 ковариация c3 и c4 меняет знак: дисперсия разности 3
    if (DEEP) {                           // источник 8 и канал 9: c9(t+1) = c8(t - DEEP)
      n[8] = 0.5 * c[8] + Math.sqrt(0.75) * g();
      const hid = w.h8[DEEP];
      n[9] = hid;
      // канал еды стоит на том же скрытом прошлом, но с истощением: куда пошли, оттуда уходит
      if (EAT) {
        let a = LAG ? w.abarOld : w.abar;
        if (KEEP > 0) {                   // долгое истощение: след съеденного тянется, общий вес тот же
          w.depPrev = w.dep; w.dep = KEEP * w.dep + (1 - KEEP) * a; a = w.dep;
        }
        n[FCH] = (hid - LOOP * a) / FDIV; w.hid = hid;
      }
      w.h8.unshift(n[8]); w.h8.length = DEEP + 1;
    }
    if (SLOW) {                           // медленная скрытая величина и её зашумлённое наблюдение
      w.L = SRHO * w.L + Math.sqrt(1 - SRHO * SRHO) * g();
      n[SCH] = w.L + SSIG * g();
    }
    if (ORDER) {                          // проба строки 8: эпизод -- событие X, через g кругов другое, через d -- отчёт о порядке
      const o = w.ord || (w.ord = { ph: 0, t: 0, x: 0, g: 0, d: 0 });
      let ea = 0, eb = 0, q = 0;
      if (o.ph === 0) {
        if (w.rnd() < 0.1) { o.x = w.rnd() < 0.5 ? 0 : 1; o.g = 1 + Math.floor(3 * w.rnd()); o.d = 1 + Math.floor(2 * w.rnd()); o.t = 0; o.ph = 1; if (o.x === 0) ea = 1; else eb = 1; }
      } else {
        o.t++;
        if (o.t === o.g) { if (o.x === 0) eb = 1; else ea = 1; }
        if (o.t === o.g + o.d) { q = ORDERSHUF ? (w.rnd() < 0.5 ? 1 : -1) : (o.x === 0 ? 1 : -1); o.ph = 0; }
      }
      n[OCH] = (ea - PEV) * SEV; n[OCH + 1] = (eb - PEV) * SEV; n[OCH + 2] = q * SQ;
      if (QDELAY) { (w.ohA ||= []).unshift(n[OCH]); (w.ohB ||= []).unshift(n[OCH + 1]); w.ohA.length = 7; w.ohB.length = 7; }
    }
  }
  w.c = n;
}

// гены: urge -> как часто искать связи; закон учёбы: a, b, c (RULE=1)
// или скорость lr при заданном LMS (RULE=0). Сколько связей держать, решает цена.
function newPart(w, slot, par) {
  const r = w.rnd, mut = (v) => clamp(v * Math.exp(MUT * 0.2 * gauss(r)), 1e-4, 2);
  let g;
  if (par) {
    g = { urge: clamp(par.g.urge + 0.08 * gauss(r), 0, 1) };
    if (EAT) g.act = clamp(par.g.act + 0.08 * gauss(r), 0, 1);
    if (RULE) { g.a = mut(par.g.a); g.b = mut(par.g.b); g.c = mut(par.g.c); }
    else g.lr = clamp(par.g.lr * Math.exp(0.25 * gauss(r)), 0.001, 1);
  } else {
    g = { urge: r() };
    if (EAT) g.act = r();               // начальный разброс частоты действий -- равномерный, как у urge
    if (RULE) {                         // жребий тянется всегда, чтобы поток чисел не разошёлся
      const ra = 0.001 + 0.3 * r(), rb = 0.001 + 0.3 * r(), rc = 0.001 + 0.3 * r();
      if (SEED_RULE > 0) { g.a = SEED_RULE; g.b = SEED_RULE; g.c = 0.001; } else { g.a = ra; g.b = rb; g.c = rc; }
    }
    else g.lr = Math.exp(Math.log(0.01) + r() * Math.log(30));
  }
  const p = { slot, ch: slot % CH, g, credit: par ? BIRTH / 2 : START,
    hungry: 0, age: 0, r2s: 1, links: [], wSelf: 0, ws: SELFREC ? (slot % CH === SCH ? WS0S : WS0) : 0, xs: 0,
    mse: (SLOW && slot % CH === SCH) ? VS : V, s: 0, x: null, xl: null, pred: 0, outP: 0, bits: 0, mseL: 1,
    uSelf: SIGNAL ? 0.05 * gauss(r) : 0, z: 0, zOut: 0, xOld: null, xlOld: null, zv: 0.01, zv5: 0.01, zb: 0,
    cz: 0, zz: 0, cp: 0, pp: 0,          // только для замеров: связь товаров с нужным каналу 9 прошлым
    dem: 0,                               // сглаженная сумма квадратов ошибок покупателей сигнала
    c0: 0, gain: 0, fromWorld: 0, fromReads: 0,
    ph: [], ate: 0, nAct: 0, nHit: 0, hb: -1, hAge: 0, miss: 0,      // прошлые намерения (для нуля Б) и счёт действий
    q: DECIDE ? new Float64Array(M_PL) : null,   // оценка выгоды каждого сдвига, учится только на еде
    mul: GAINM ? MUL0 : 1, mbase: 0 };                          // множитель прогноза и бегущее среднее своей еды
  if (par && par.ch === p.ch) {           // копия на том же месте уносит связи и веса
    p.links = par.links.map((l) => { const m = { j: l.j, k: l.k, w: l.w, u: l.u, r2: l.r2, age: l.age }; if (l.tw) { m.tw = Float64Array.from(l.tw); m.buf = l.buf.slice(); } return m; });
    p.wSelf = par.wSelf; p.mse = par.mse; if (PAYL) p.mseL = par.mseL; if (RELPRUNE) p.r2s = par.r2s; p.uSelf = par.uSelf;
    if (SELFREC) p.ws = par.ws;            // потомок наследует вес на себя
    if (KIN) { p.zb = par.zb; p.zv = par.zv; if (RELSIG) p.zv5 = par.zv5; }   // потомок помнит спрос на сигнал родителя
    if (DECIDE) p.q = Float64Array.from(par.q);  // потомок наследует таблицу сдвигов, как связи
    if (GAINM) { p.mul = par.mul; p.mbase = par.mbase; }   // потомок наследует множитель
  }
  return p;
}

function create(seed) {
  const w = { rnd: makeRNG(seed), round: 0, parts: [], c: new Float64Array(CH), births: 0,
    deaths: { bank: 0, fault: 0 }, deadAges: [], h8: new Array(DEEP + 1).fill(0),
    pruned: [0, 0, 0, 0], lost: [0, 0, 0, 0], colon: 0,
    L: 0, h: 0, abar: 0, abarOld: 0, dep: 0, depPrev: 0, hid: 0, acts: [], fsamp: [], fq: null,    // среднее названное место, выборка F, границы долей
    fs: { acts: 0, hits: 0, rounds: 0, fed: 0, winners: 0, burn: 0, sf: 0, n: 0,
          sum: 0, sum2: 0, actsRelay: 0, hitsRelay: 0, actsBare: 0, hitsBare: 0, spent: 0, paid: 0,
          byK: new Map(), dUse: new Array(M_PL).fill(0), dHit: new Array(M_PL).fill(0), pert: 0, pertCh: 0,
          sA: {}, sH: {}, sF: {}, occ: {}, looks: 0, hOne: 0, kA: 0, kH: 0, bA: 0, bH: 0 } };  // сколько связей каждого товара отмерло и сколько потеряно со смертью продавца
  for (let k = 0; k < CH; k++) w.c[k] = gauss(w.rnd);
  for (let i = 0; i < N; i++) w.parts.push(newPart(w, i, null));
  for (let k = 0; k < PERTURB; k++) w.rnd();   // нуль строки 5: другая история шума при тех же начальных условиях
  return w;
}

function kill(w, p, why) {
  w.parts[p.slot] = null; w.deaths[why]++;
  if (w.round >= ROUNDS / 2) w.deadAges.push(p.age);
  const kin = REPLACE ? w.parts.filter((q) => q && q.ch === p.ch) : [];   // равноценные продавцы
  // из чего собран сигнал: входы по (канал, товар) с их весами -- чтобы найти родича с тем же сигналом
  const prof = (o) => { const m = new Map([['self', Math.abs(o.uSelf)]]);
    for (const l of o.links) { const t = w.parts[l.j]; if (t) { const key = t.ch + ':' + l.k; m.set(key, (m.get(key) || 0) + Math.abs(l.u)); } }
    return m; };
  const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (const [k, v] of a) { na += v * v; d += v * (b.get(k) || 0); }
    for (const v of b.values()) nb += v * v; return na && nb ? d / Math.sqrt(na * nb) : 0; };
  const pp = KIN ? prof(p) : null;
  for (const q of w.parts) {
    if (!q) continue;
    const gone = [];
    q.links = q.links.filter((l) => { if (l.j !== p.slot) return true; l.dead = true; w.lost[l.k]++; gone.push(l); return false; });
    for (const l of gone) {               // проверенная связь -- к другому продавцу того же канала
      if (!REPLACE || l.age < TRIAL) continue;
      const c = kin.filter((o) => o !== q && !q.links.some((m) => m.j === o.slot && m.k === l.k));
      // датчик и прогноз равноценны -- связь переходит проверенной; сигнал у каждой части свой,
      // поэтому сигнал соседа по каналу (часто родни с похожим сигналом) берётся на пробу
      if (!c.length) continue;
      let pick = null;
      if (KIN && l.k === 2) {              // сигнал: родич с тем же составом сигнала, если такой есть
        let best = 0.5; for (const o of c) { const v = cos(pp, prof(o)); if (v > best) { best = v; pick = o; } }
      }
      const asKin = !!pick;                // родич с тем же сигналом -- товар равноценен, проба не нужна
      if (l.k === 2) { if (asKin) w.kinPick = (w.kinPick || 0) + 1; else w.kinMiss = (w.kinMiss || 0) + 1; }
      if (!pick) pick = c[Math.floor(w.rnd() * c.length)];
      const nl = { j: pick.slot, k: l.k, w: l.w, u: l.u, r2: l.r2, age: l.k === 2 && !asKin ? 0 : l.age };
      if (l.tw) { nl.tw = Float64Array.from(l.tw); nl.buf = l.buf.slice(); }
      q.links.push(nl);
    }
  }
}

function pickByGain(pool, r) {            // шанс растёт с доходом; SELPOW -- насколько круто
  const wt = (p) => (SELPOW === 1 ? p.gain : Math.pow(p.gain, SELPOW));
  let sum = 0; for (const p of pool) sum += wt(p);
  let t = r() * sum;
  for (const p of pool) { t -= wt(p); if (t <= 0) return p; }
  return pool[pool.length - 1];
}

function round(w) {
  worldStep(w);
  const P = w.parts, inc = new Float64Array(N);
  const quiet = w.silent, frozenL = quiet && !FREEPRUNE, noMeta = quiet && !FREEMETA;
  const sleep = quiet && ECOSLEEP, money = noMeta || sleep;   // money: в этом круге деньги не ходят
  const nod = quiet && NODATA;
  let grace = false;
  if (WAKEGRACE) { if (quiet) w.wake = WAKEGRACE; else if (w.wake > 0) { grace = true; w.wake--; } }
  // датчики; прогноз прошлого круга выставляется на продажу до того, как его перезапишут
  if (quiet) {                            // тишина: мир живёт, датчики молчат; на месте своего датчика -- своё ожидание (HOLD)
    if (RULE) throw new Error('тишина со всеми правилами поддержана только при LMS');
    for (const p of P) if (p) { p.c0 = p.credit; p.outP = p.pred; p.zOut = p.z; p.s = HOLD === 1 ? p.outP : 0; p.sh = HOLD ? p.outP : 0; }
  } else
  for (const p of P) if (p) { p.c0 = p.credit; p.s = w.c[p.ch] + SN * gauss(w.rnd); p.outP = p.pred; p.zOut = p.z; }
  if (EAT) {                              // границы долей, раздача еды, замеры второй половины
    const f = w.c[FCH];
    if (w.round < ROUNDS / 2) {           // границы -- выборочные квантили первой половины, потом заморожены
      w.fsamp.push(f);
      if (w.fsamp.length >= 1000 && w.round % 1000 === 0) {
        const a = [...w.fsamp].sort((x, y) => x - y);
        w.fq = []; for (let i = 1; i < M_PL; i++) w.fq.push(a[Math.floor(i * a.length / M_PL)]);
      }
    }
    if (HID && w.rnd() < HQ) w.h = 1 - w.h;   // скрытая величина живёт своей жизнью
    let truth = binOf(w, f);
    if (HID && w.h === 1 && truth >= 0) truth = M_PL - 1 - truth;   // при h=1 еда в зеркальной доле
    const win = truth >= 0 ? w.acts.filter((a) => a.place === truth) : [];
    const share = win.length ? FOOD / win.length : 0;
    for (const a of win) { const b = P[a.slot]; if (b) { b.credit += share; b.ate += share; b.nHit++; } }
    if (LOSEK) for (const a of w.acts) { const b = P[a.slot]; if (!b) continue;   // своя удача и неудача
      if (a.place === truth) b.miss = 0; else b.miss++; }
    if (GAINM) for (const a of w.acts) {    // множитель учится ТОЛЬКО на еде: возмущение на награду
      const b = P[a.slot]; if (!b) continue;
      const rew = a.place === truth ? share : 0;
      b.mul = clamp(b.mul + SLR * (rew - b.mbase) * a.eps, 0.2, 1.8);
      b.mbase += 0.01 * (rew - b.mbase);
    }
    if (DECIDE) for (const a of w.acts) {   // таблица учится ТОЛЬКО на еде, ошибка прогноза в неё не входит
      const b = P[a.slot]; if (!b || !b.q) continue;
      const rew = a.place === truth ? share : 0;
      b.q[a.d] += QLR * (rew - b.q[a.d]);
    }
    if (w.round >= ROUNDS / 2) {
      const S = w.fs; S.n++; S.sum += f; S.sum2 += f * f; if (HID && w.h === 1) S.hOne++;
      for (const q of P) if (q && q.ch === FCH) S.occ[q.slot] = (S.occ[q.slot] || 0) + 1;
      S.acts += w.acts.length; S.hits += win.length;
      if (w.acts.length) { S.rounds++; S.spent += ACT * w.acts.length; if (win.length) S.paid += FOOD;
        const e = S.byK.get(w.acts.length) || [0, 0]; e[0]++; e[1] += win.length; S.byK.set(w.acts.length, e);
        if (win.length) S.fed++; else S.burn++; }
      S.winners += win.length;
      for (const a of w.acts) { const q = P[a.slot]; if (!q) continue;
        S.dUse[a.d]++; if (a.place === truth) S.dHit[a.d]++;
        S.sA[a.slot] = (S.sA[a.slot] || 0) + 1;
        if (HID) { if (a.know) { S.kA++; if (a.place === truth) S.kH++; } else { S.bA++; if (a.place === truth) S.bH++; } }
        if (a.place === truth) { S.sH[a.slot] = (S.sH[a.slot] || 0) + 1; S.sF[a.slot] = (S.sF[a.slot] || 0) + share; }
        if (hasRelay(w, q)) { S.actsRelay++; if (a.place === truth) S.hitsRelay++; }
        else { S.actsBare++; if (a.place === truth) S.hitsBare++; } }
      if (w.fq) { let ok = 0;             // есть ли в этом круге самосогласованное место
        for (let a = 0; a < M_PL; a++) {
          const push = KEEP > 0 ? KEEP * w.depPrev + (1 - KEEP) * mPlace(a) : mPlace(a);
          if (binOf(w, (w.hid - LOOP * push) / FDIV) === a) ok++; }
        if (ok) S.sf++; }
    }
    w.abarOld = w.abar; w.acts = []; w.abar = 0;
  }
  if (DEEP) {                             // замер: насколько выставленные товары несут c8(t - DEEP)
    const tau = w.h8[DEEP];
    for (const p of P) if (p) {
      p.cz += 0.01 * (p.zOut * tau - p.cz); p.zz += 0.01 * (p.zOut * p.zOut - p.zz);
      p.cp += 0.01 * (p.outP * tau - p.cp); p.pp += 0.01 * (p.outP * p.outP - p.pp);
    }
  }

  // расчёт за прошлое предсказание: учёба (нормированный LMS) и плата мира
  let bank = 0, alive = 0;
  const fb = SIGNAL ? new Float64Array(N) : null, dm = DEMAND ? new Float64Array(N) : null;
  for (const p of P) {
    if (!p) continue;
    alive++;
    if (!p.x) { p.bits = 0; continue; }
    const e = (quiet ? p.sh : p.s) - p.pred;   // в тишине -- ошибка против того, что стоит на месте датчика
    if (SIGNAL) for (const l of p.xl) if (l.k === 2 && !l.dead) {   // ошибка обратно продавцу
      fb[l.j] += e * l.w; if (DEMAND) dm[l.j] += e * e;
    }
    if (!quiet) p.mse += BETA * (e * e - p.mse);   // оценка ошибки -- для платы мира; в тишине касания нет
    let nrm = 1; for (let i = 0; i < p.x.length; i++) if (i === 0 || !p.xt[i - 1]) nrm += p.x[i] * p.x[i];
    if (SELFREC) nrm += p.xs * p.xs;
    if (QDELAY && p.hx) for (const v of p.hx) nrm += v * v;
    if (DLINE) for (let i = 0; i < p.xl.length; i++) { const l = p.xl[i]; if (l.xb && !p.xt[i]) for (const v of l.xb) nrm += v * v; }
    if (RULE) {                           // (a*s' - b*p)*x - c*w, нормировано входом
      const { a, b, c } = p.g, hs = a * p.s - b * p.pred;
      p.wSelf = clampW(p.wSelf + (hs * p.x[0] - c * p.wSelf) / nrm);
      for (let i = 0; i < p.xl.length; i++) {
        const l = p.xl[i], xi = p.x[i + 1];
        l.w = clampW(l.w + (hs * xi - c * l.w) / (p.xt[i] ? 1 + xi * xi : nrm));
      }
    } else {                              // LMS рукой; проба учится на остатке ошибки
      const k = p.g.lr * e / nrm;
      p.wSelf = clampW(p.wSelf + k * p.x[0]);
      if (SELFREC && WSLEARN) p.ws = clamp(p.ws + k * p.xs, -0.99, 0.99);   // возвратный путь не усиливает сверх 0.99
      if (QDELAY && p.hx) for (let i = 0; i < p.hx.length; i++) p.wd[i] = clampW(p.wd[i] + k * p.hx[i]);
      for (let i = 0; i < p.xl.length; i++) {
        const l = p.xl[i], xi = p.x[i + 1];
        if (DLINE && l.xb) {               // связь-линия: отводы учатся вместе с нулевым
          let nt = 1 + xi * xi; for (const v of l.xb) nt += v * v;
          const kt = p.xt[i] ? p.g.lr * e / nt : k;
          l.w = clampW(l.w + kt * xi);
          for (let j = 0; j < l.xb.length; j++) l.tw[j] = clampW(l.tw[j] + kt * l.xb[j]);
          continue;
        }
        l.w = clampW(l.w + (p.xt[i] ? p.g.lr * e * xi / (1 + xi * xi) : k * xi));
      }
    }
    if (quiet) {}                         // в тишине мир не платит, биты не пересчитываются
    else if (PAYL && SLOW && p.ch === SCH) {   // последствия зависят от мира, а не от шума датчика; учёба L не видит
      const eL = w.L - p.pred; p.mseL += BETA * (eL * eL - p.mseL);
      p.bits = Math.max(0, 0.5 * Math.log2(1 / Math.max(p.mseL, 1e-6)));
    } else
    p.bits = Math.max(0, 0.5 * Math.log2(((SLOW && p.ch === SCH) ? VS : V) / Math.max(p.mse, 1e-6)));
    if (!(EAT && p.ch === FCH)) bank += PAY * p.bits;   // за сжатие канала еды не платят
  }
  if (DEMAND) for (const p of P) if (p) p.dem += 0.02 * (dm[p.slot] - p.dem);
  if (SIGNAL) for (const p of P) {       // продавцы учат сигнал на ошибках покупателей
    if (!p || !p.xOld || !fb[p.slot]) continue;
    let n2 = 1; for (const v of p.xOld) n2 += v * v;
    const k = ZLR * fb[p.slot] / (n2 * Math.sqrt(p.zv + 1e-9));   // сигнал нормирован: градиент идёт через делитель
    p.uSelf = clampW(p.uSelf + k * p.xOld[0]);
    for (let i = 0; i < p.xlOld.length; i++) { const l = p.xlOld[i]; l.u = clampW(l.u + k * p.xOld[i + 1]); }
  }
  const shared = SHARE && w.round >= SHARE_AT;
  for (const p of P) {
    if (!p) continue;
    const pay = quiet ? 0 : (EAT && p.ch === FCH) ? 0 : (shared ? bank / alive : PAY * p.bits);
    p.credit += pay; p.fromWorld += pay;
  }

  // аренда, чтение, новое предсказание; пробные связи читаются первыми
  const zr = SIGNAL ? new Float64Array(N) : null;   // сколько раз купили сигнал части
  for (const p of P) {
    if (!p) continue;
    if (!(SPROTECT && p.ch === SCH) && !(PROTECTQ && p.ch === OCH + 2) && !money) p.credit -= RENT;
    const order = p.links.slice().sort((a, b) =>
      (b.age < TRIAL) - (a.age < TRIAL) || Math.abs(b.w) - Math.abs(a.w));
    const sv = quiet ? p.sh : p.s, capq = quiet && HCAP > 0 && HOLD;
    if (RELPRUNE && !nod) p.r2s += 0.05 * (sv * sv - p.r2s);   // мощность того, что стоит на месте датчика
    const x = [sv], xl = [], xt = [];
    for (const l of order) {
      if (!(FREE_TRY > 0 && l.age < TRIAL)) {   // проба -- бесплатный образец, остальное за плату
        if (!money) {
        if (p.credit < PRICE - DEBT) break;   // в долг -- не глубже DEBT
        p.credit -= PRICE; inc[l.j] += PRICE;
        }
      }
      const v = l.k === 2 ? P[l.j].zOut : l.k === 1 ? P[l.j].outP : P[l.j].s;   // 0 и 3 -- датчик
      x.push(v); xl.push(l); xt.push(TRY > 0 && l.age < TRIAL);
      if (DLINE && l.k === 3) {           // линия у покупателя: отводы 1..DLINE -- значения прошлых кругов
        if (!l.buf) { l.buf = new Array(DLINE).fill(0); l.tw = new Float64Array(DLINE); }
        l.xb = l.buf.slice(); l.buf.unshift(v); l.buf.length = DLINE;
      }
      if (SIGNAL) { if (!nod) l.r2 += 0.05 * (v * v - l.r2); if (l.k === 2) zr[l.j]++; }
    }
    let pred = capq ? 0 : p.wSelf * sv;   // проба в оплачиваемый прогноз не входит
    for (let i = 0; i < xl.length; i++) if (!xt[i]) { pred += xl[i].w * x[i + 1]; if (xl[i].xb) for (let j = 0; j < xl[i].xb.length; j++) pred += xl[i].tw[j] * xl[i].xb[j]; }
    if (capq) pred += clamp(p.wSelf + (SELFREC ? p.ws : 0), -HCAP, HCAP) * p.outP;   // в тишине усиление на себя под пределом
    else if (SELFREC) pred += p.ws * p.outP;     // собственный вчерашний прогноз
    if (SIGNAL) {                          // сигнал: смесь входов, нормированная по силе и ограниченная
      let z = p.uSelf * sv; for (let i = 0; i < xl.length; i++) z += xl[i].u * x[i + 1];
      const zfr = (quiet && ZVFREEZE) || nod;   // 1 -- замораживает zv и zv5, 2 -- только zv
      if (!zfr) p.zv += 0.01 * (z * z - p.zv); p.z = clamp(z / Math.sqrt(p.zv + 1e-9), -4, 4);
      if (RELSIG && !(zfr && ZVFREEZE === 1) && !nod) p.zv5 += 0.05 * (z * z - p.zv5);   // мощность сигнала в окне мощности входа -- для суда о связи
    }
    if (QDELAY && p.ch === OCH + 2 && w.ohA) {   // линия задержки: вход не покупается, дан
      const hx = Array.from(w.ohA, (v) => v || 0).concat(Array.from(w.ohB, (v) => v || 0));   // Array.from не пропускает пустые места, map -- пропускает
      if (!p.wd) p.wd = new Float64Array(hx.length);
      for (let i = 0; i < hx.length; i++) pred += p.wd[i] * hx[i];
      p.pred = pred; p.hx = hx;
    }
    if (SELFREC) p.xs = p.outP;
    p.xOld = p.x; p.xlOld = p.xl; p.pred = pred; p.x = x; p.xl = xl; p.xt = xt;
  }
  for (let i = 0; i < N; i++) if (P[i]) {
    P[i].credit += inc[i]; P[i].fromReads += inc[i];
    if (SIGNAL) P[i].zb += (KIN ? (zr[i] > P[i].zb ? 0.2 : 0.002) : 0.02) * (zr[i] - P[i].zb);   // спрос: быстро растёт, медленно гаснет
  }
  if (EAT && w.fq && !quiet) {            // действие: добытчик платит ACT и называет долю; в тишине не действует никто
    let sum = 0, k = 0;
    for (const p of P) {
      if (!p || p.ch !== FCH) continue;
      if (HID) p.hAge++;
      if (p.credit < ACT || w.rnd() >= p.g.act) continue;
      p.credit -= ACT; p.nAct++;          // цена сгорает, а не достаётся кому-то
      let eps = 0, pv = p.pred;
      if (GAINM) { const sg = SIGMIX ? (p.slot % 2 === 0 ? SIGA : SIGB) : SIG;
        eps = sg > 0 ? sg * gauss(w.rnd) : 0; pv = (p.mul + eps) * p.pred;
        if (w.round >= ROUNDS / 2) { w.fs.pert++; if (binOf(w, pv) !== binOf(w, p.mul * p.pred)) w.fs.pertCh++; } }
      const base = (DECIDE && NOPRED) ? binOf(w, 0) : binOf(w, pv);   // доля, в которую попал прогноз
      let d = 0;
      if (DECIDE) {                       // решение: сдвиг от прогноза, выбранный по таблице
        if (EXPL > 0 && w.rnd() < EXPL) d = Math.floor(w.rnd() * M_PL);   // разведка, тоже за ACT
        else { let b = 0; for (let i = 1; i < M_PL; i++) if (p.q[i] > p.q[b]) b = i; d = b; }
      }
      let want = (base + d) % M_PL;
      if (HID) {                          // знание h: даром (проверка 0) или за взгляд
        if (ORACLE) p.hb = w.h;
        else if (LOOKN > 0 && (p.hb < 0 || p.hAge >= LOOKN) && p.credit >= LOOK) {
          p.credit -= LOOK; p.hb = w.h; p.hAge = 0;
          if (w.round >= ROUNDS / 2) w.fs.looks++;
        }
        else if (LOSEK > 0 && p.miss >= LOSEK && p.credit >= LOOK) {   // K промахов подряд -- знание устарело
          p.credit -= LOOK; p.hb = w.h; p.hAge = 0; p.miss = 0;
          if (w.round >= ROUNDS / 2) w.fs.looks++;
        }
        if (p.hb === 1) want = M_PL - 1 - want;   // знающий, что h=1, называет зеркальную долю
      }
      let place = want;
      if (RANDACT) place = Math.floor(w.rnd() * M_PL);                                  // нуль А
      else if (SHUFACT && p.ph.length) place = p.ph[Math.floor(w.rnd() * p.ph.length)]; // нуль Б
      p.ph.push(want); if (p.ph.length > 1000) p.ph.shift();
      w.acts.push({ slot: p.slot, place, d, eps, know: p.hb >= 0 ? 1 : 0 });
      sum += mPlace(place); k++;
    }
    w.abar = k ? sum / k : 0;             // истощение: среднее по названным местам
  }

  // связи: отмирание пустых, поиск новых
  for (const p of P) {
    if (!p) continue;
    if (!frozenL) {
    for (const l of p.links) l.age++;
    if (!grace) p.links = p.links.filter((l) => {    // связь живёт, пока несёт вес -- для прогноза или для сигнала
      const keep = l.age < TRIAL || (SIGNAL
        ? (l.tw ? Math.hypot(l.w, ...l.tw) : Math.abs(l.w)) * Math.sqrt(RELPRUNE ? l.r2 * ((SLOW && p.ch === SCH) ? VS : V) / Math.max(p.r2s, 1e-300) : l.r2) >= PRUNE ||   // вклад в свой прогноз
          (p.zb > 0.3 && Math.abs(l.u) * Math.sqrt(l.r2 / (RELSIG ? p.zv5 : p.zv)) >= PRUNE)  // вклад в сигнал, пока его покупают
        : Math.abs(l.w) >= PRUNE);
      if (!keep) { l.dead = true; if (l.age >= TRIAL) w.pruned[l.k]++; } return keep; });
    }
    if (!frozenL && !money && p.links.length < LMAX && p.credit >= C_LINK && w.rnd() < p.g.urge * SEARCH) {
      p.credit -= C_LINK;                 // поиск платный, даже неудачный
      let j, k, hint = null;
      if (IMIT > 0 && w.rnd() < IMIT) {   // подсказка: проверенная связь соседа по каналу
        const sibs = P.filter((q) => q && q !== p && q.ch === p.ch && q.links.some((l) => l.age >= TRIAL));
        if (sibs.length) {
          const q = sibs[Math.floor(w.rnd() * sibs.length)], good = q.links.filter((l) => l.age >= TRIAL);
          hint = good[Math.floor(w.rnd() * good.length)];
        }
      }
      if (hint) { j = hint.j; k = hint.k; }
      else {
        j = Math.floor(w.rnd() * N); const q = w.rnd();   // товар: 0 датчик, 1 прогноз, 2 сигнал
        k = DLINE ? (q < 0.25 ? 0 : q < 0.5 ? 1 : q < 0.75 ? 2 : 3) : SIGNAL ? (q < 1 / 3 ? 0 : q < 2 / 3 ? 1 : 2) : (q < 0.5 ? 0 : 1);
      }
      if (P[j] && j !== p.slot && !p.links.some((l) => l.j === j && l.k === k))
        p.links.push({ j, k, w: 0, u: SIGNAL ? 0.05 * gauss(w.rnd) : 0, r2: 1, age: 0 });
    }
    if (DEMAND && !frozenL && !money && p.links.length < LMAX && p.credit >= C_LINK && w.rnd() < DEMAND * Math.min(1, p.dem)) {
      p.credit -= C_LINK;                 // покупатели недовольны -- продавец ищет новый вход для сигнала
      const j = Math.floor(w.rnd() * N), q = w.rnd(), k = DLINE ? (q < 0.25 ? 0 : q < 0.5 ? 1 : q < 0.75 ? 2 : 3) : q < 1 / 3 ? 0 : q < 2 / 3 ? 1 : 2;
      if (P[j] && j !== p.slot && !p.links.some((l) => l.j === j && l.k === k))
        p.links.push({ j, k, w: 0, u: 0.05 * gauss(w.rnd), r2: 1, age: 0 });
    }
    if (!sleep) p.gain += GAIN * (p.credit - p.c0 - p.gain);   // доход за круг, сглаженный; во сне часы хозяйства стоят
    p.age++;
  }

  // смерть: банкротство или сбой
  for (const p of P) {
    if (!p) continue;
    if (!sleep) p.hungry = p.credit < 0 ? p.hungry + 1 : 0;
    if (SPROTECT && p.ch === SCH) continue;
    if (PROTECTQ && p.ch === OCH + 2) continue;
    if (noMeta) continue;
    if (!sleep && p.hungry > DIE) kill(w, p, 'bank');   // во сне банкротства нет, сбои идут
    else if (!(quiet && NOFAULTQUIET) && w.rnd() < FAULT) kill(w, p, 'fault');
  }

  // потолок копилки и рождение. Расти можно только в своей нише: место в канале
  // занимает потомок богатой части того же канала. Чужой может заселить канал,
  // только когда своих богатых нет, а канал заполнен меньше чем наполовину:
  // иначе один бедный выживший запирал канал навсегда (так вымер канал 9 при
  // DEEP=1 и распустился целый мир при DEEP=2), а заселять всё подряд нельзя --
  // богатые плодят обречённых.
  for (const p of P) if (p && p.credit > CAP) p.credit = CAP;
  const free = []; for (let i = 0; i < N; i++) if (!P[i]) free.push(i);
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(w.rnd() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
  const ok = (p) => p && p.credit >= BIRTH && (!SELECT || p.gain > 0);
  if (!money) for (const s of free) {
    const k = s % CH;
    let pool = P.filter((p) => ok(p) && p.ch === k);
    if (!pool.length && 2 * P.filter((p) => p && p.ch === k).length < Math.ceil(N / CH)) pool = P.filter(ok);
    if (!pool.length) continue;
    const par = SELECT ? pickByGain(pool, w.rnd) : pool[Math.floor(w.rnd() * pool.length)];
    par.credit -= BIRTH; P[s] = newPart(w, s, par); w.births++;
    if (par.ch !== k) w.colon++;          // заселение чужого канала
  }
  w.round++;
}

const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);

// перестановочный нуль: все перестановки родительских списков каналов 3..7, кроме настоящей
const PERMS = (() => {
  const idx = [3, 4, 5, 6, 7], out = [];
  const rec = (a, rest) => { if (!rest.length) { out.push(a); return; }
    rest.forEach((v, i) => rec([...a, v], rest.filter((_, j) => j !== i))); };
  rec([], idx);
  return out.filter((a) => a.some((v, i) => v !== idx[i]));
})();

function stats(w) {
  const A = w.parts.filter(Boolean);
  const S = A.filter((p) => WORLD && (p.ch < 3 || p.ch === 8)), X = A.filter((p) => !WORLD || (p.ch >= 3 && p.ch <= 7));
  const D9 = A.filter((p) => WORLD && DEEP && p.ch === 9);
  let f8 = 0, a9 = 0;
  // носитель прошлого: часть, чей выставленный прогноз или сигнал связан с нужным каналу 9
  // прошлым (r^2 >= 0.25). Передатчик -- любая устоявшаяся связь канала 9 с таким товаром,
  // каким бы путём он ни собрался.
  const carriers = DEEP ? A.filter((q) => q.ch !== 9 && (carZ(q) || carP(q))) : [];
  let z9 = 0, relay = 0;
  for (const p of D9) {
    let has = false;
    for (const l of p.links) {
      const v = Math.abs(l.w); a9 += v;
      if (l.k === 1 && w.parts[l.j].ch === 8) f8 += v;
      if (l.k === 2) z9 += v;
      const q = w.parts[l.j];
      if (l.age >= TRIAL && v * Math.sqrt(l.r2 || 1) >= PRUNE && ((l.k === 2 && carZ(q)) || (l.k === 1 && carP(q)))) has = true;
    }
    if (has) relay++;
  }
  const carCh = new Array(CH).fill(0); for (const q of carriers) carCh[q.ch]++;
  const L = []; for (const p of X) for (const l of p.links) L.push([p.ch, w.parts[l.j].ch, Math.abs(l.w), l.k]);
  let wp = 0, wz = 0, wa = 0; for (const [, , v, k] of L) { wa += v; if (k === 1) wp += v; if (k === 2) wz += v; }
  const L2 = L.filter((e) => e[3] < 2);   // верность меряется по датчикам и прогнозам; сигнал может нести что угодно
  // верная связь: датчик настоящего родителя или прогноз родителя либо деда
  const good = (tab) => ([c, t, , k]) => tab(c)[0].includes(t) || (k === 1 && tab(c)[1].includes(t));
  const share = (ok) => { let r = 0, a = 0; for (const e of L2) { a += e[2]; if (ok(e)) r += e[2]; } return a ? r / a : NaN; };
  const truth = (c) => [PARENTS[c], GRAND[c]];
  const right = WORLD ? share(good(truth)) : NaN;
  const nul = WORLD ? PERMS.reduce((s, a) => s + share(good((c) => [PARENTS[a[c - 3]], GRAND[a[c - 3]]])), 0) / PERMS.length : NaN;
  const byCount = WORLD && L2.length ? L2.filter(good(truth)).length / L2.length : NaN;
  return { alive: A.length, births: w.births, bank: w.deaths.bank, fault: w.deaths.fault,
    deadAge: med(w.deadAges), liveAge: med(A.map((p) => p.age)),
    linksS: med(S.map((p) => p.links.length)), linksX: med(X.map((p) => p.links.length)),
    right, nul, byCount, bitsS: med(S.map((p) => p.bits)), bitsX: med(X.map((p) => p.bits)),
    pShare: wa ? wp / wa : NaN, zShare: wa ? wz / wa : NaN, bits9: med(D9.map((p) => p.bits)), f8: a9 ? f8 / a9 : NaN,
    z9: a9 ? z9 / a9 : NaN, relay: D9.length ? relay / D9.length : NaN, n9: D9.length,
    carriers: carriers.length, carCh: carCh.map((v, i) => (v ? `${i}:${v}` : '')).filter(Boolean).join(' '), urge: med(A.map((p) => p.g.urge)), lr: RULE ? NaN : med(A.map((p) => p.g.lr)),
    ba: RULE ? med(A.map((p) => p.g.b / p.g.a)) : NaN, ca: RULE ? med(A.map((p) => p.g.c / p.g.a)) : NaN,
    a: RULE ? med(A.map((p) => p.g.a)) : NaN,
    lms: RULE && A.length ? A.filter((p) => p.g.b / p.g.a > 0.8 && p.g.b / p.g.a < 1.25 && p.g.c / p.g.a < 0.1).length / A.length : NaN,
    food: EAT ? (() => { const Q = w.fs, F = A.filter((p) => p.ch === FCH);
      const vF = Q.n ? Q.sum2 / Q.n - (Q.sum / Q.n) ** 2 : NaN;
      const byK = [...Q.byK.entries()].sort((a, b) => a[0] - b[0])
        .map(([k, e]) => `${k}:${(100 * e[1] / (k * e[0])).toFixed(0)}%`).join(' ');
      return { share: Q.acts ? Q.hits / Q.acts : NaN,          // ОСНОВНАЯ МЕРА: доля верных действий
        rate: Q.n && NF ? Q.acts / (Q.n * NF) : NaN,           // частота действий на добытчика за круг
        winners: Q.fed ? Q.winners / Q.fed : NaN,              // сколько угадавших, когда угадали
        burn: Q.rounds ? Q.burn / Q.rounds : NaN,              // доля кругов с действиями, где фонд сгорел
        varF: vF, sf: Q.n ? Q.sf / Q.n : NaN,                  // дисперсия F и доля кругов с самосогласованным местом
        relay: Q.actsRelay ? Q.hitsRelay / Q.actsRelay : NaN, bare: Q.actsBare ? Q.hitsBare / Q.actsBare : NaN,
        nRelay: Q.actsRelay, nBare: Q.actsBare, acts: Q.acts, byK,
        dUse: Q.dUse.map((c, i) => `${i}:${(100 * c / Math.max(1, Q.acts)).toFixed(0)}%`).join(' '),
        dHit: Q.dUse.map((c, i) => `${i}:${c ? (100 * Q.dHit[i] / c).toFixed(0) : '-'}%`).join(' '),
        qArg: DECIDE && F.length ? (() => { const c = new Array(M_PL).fill(0);
          for (const p of F) { let b = 0; for (let i = 1; i < M_PL; i++) if (p.q[i] > p.q[b]) b = i; c[b]++; }
          return c.map((v, i) => `${i}:${v}`).join(' '); })() : '',
        net: Q.acts ? (Q.paid - Q.spent) / Q.acts : NaN,   // чистыми на одно действие
        give: Q.n ? Q.paid / Q.n : NaN,                    // сколько еды мир отдаёт за круг

        alive: F.length, gAct: med(F.map((p) => p.g.act)), bitsF: med(F.map((p) => p.bits)),
        pertCh: Q.pert ? Q.pertCh / Q.pert : NaN,   // как часто возмущение меняет названную долю
        gain: GAINM && F.length ? med(F.map((p) => p.mul)) : NaN,
        gainAll: GAINM ? F.map((p) => p.mul.toFixed(2)).join(',') : '' }; })() : null,
    readShare: med(S.map((p) => p.fromReads / Math.max(1e-9, p.fromReads + p.fromWorld))),
    minus: A.filter((p) => p.credit < 0).length };
}

// ПАУЗА (путь Б, замер нехватки): входа нет, хозяйство и пластичность заморожены, идёт только ток.
// Каждая часть выставляет вчерашние прогноз и сигнал и считает новые теми же формулами, что в round.
function pauseRound(w) {
  const P = w.parts;
  for (const p of P) if (p) { p.s = HOLD === 1 ? p.pred : 0; p.outP = p.pred; p.zOut = p.z; }   // свой датчик молчит; при HOLD=1 на его месте ожидание
  for (const p of P) {
    if (!p) continue;
    const sh = HOLD === 2 ? p.outP : p.s;   // что часть подставляет себе на место датчика
    let pred = HOLD ? p.wSelf * sh : 0, z = HOLD ? p.uSelf * sh : 0;   // без HOLD вклад датчика равен нулю
    for (const l of p.links) {
      const q = P[l.j]; if (!q) continue;
      const v = l.k === 2 ? q.zOut : l.k === 1 ? q.outP : q.s;
      if (!(TRY > 0 && l.age < TRIAL)) { pred += l.w * v; if (l.tw) for (let j = 0; j < l.tw.length; j++) pred += l.tw[j] * l.buf[j]; }   // проба в прогноз не входит, как в round
      if (l.tw) { l.buf.unshift(v); l.buf.length = DLINE; }   // с шага 64: в паузе история линии сдвигается тем, что видят покупатели
      if (SIGNAL) z += l.u * v;
    }
    if (HCAP > 0) {                       // предел: вклад части на себя заменяется ограниченным (sh и p.outP здесь равны)
      const own = p.wSelf + (SELFREC ? p.ws : 0);
      pred += clamp(own, -HCAP, HCAP) * p.outP - p.wSelf * sh;
    } else
    if (SELFREC) pred += p.ws * p.outP;     // в паузе возвратная связь на себя тоже работает
    p.pred = pred;
    if (SIGNAL) p.z = clamp(z / Math.sqrt(p.zv + 1e-9), -4, 4);   // нормировка заморожена
  }
}

function freeRound(w) { w.silent = true; round(w); w.silent = false; }   // круг свободной активности: все правила ткани, касания мира нет

module.exports = { create, round, stats, CFG, pauseRound, SCH, worldStep, freeRound, OCH };

if (require.main === module) {
  const f = (v, d = 2) => (Number.isNaN(v) ? '-' : v.toFixed(d));
  const pc = (v) => (Number.isNaN(v) ? '-' : `${(100 * v).toFixed(0)}%`);
  console.log((WORLD ? 'ПРИЧИННЫЙ МИР' : 'ПРОВЕРКА: у каждой части свой поток') +
    ` | плата: ${SHARE ? `ПОРОВНУ на всех с круга ${SHARE_AT}` : 'каждому за его биты'} | потомство: ${SELECT ? 'по доходу' : 'жребий среди накопивших'} | закон учёбы: ${RULE ? 'в генах' : 'LMS рукой'}`);
  console.log('постоянные: ' + Object.entries(CFG).map(([k, v]) => `${k}=${+v.toPrecision(4)}`).join(' ') + '\n');
  const SEEDS = (process.env.SEEDS || '1,2,3').split(',').map(Number);
  for (const seed of SEEDS) {
    const w = create(seed);
    console.log(`сид ${seed}`);
    for (let r = 1; r <= ROUNDS; r++) {
      round(w);
      if ([1000, 20000, 50000, ROUNDS].includes(r)) {
        const s = stats(w);
        console.log(`  круг ${String(r).padStart(6)}: живых ${s.alive} | связей: у источников ${s.linksS}, у остальных ${s.linksX}` +
          (WORLD ? ` | вес на верных ${pc(s.right)} (нуль ${pc(s.nul)}), по счёту ${pc(s.byCount)}` : '') +
          ` | на прогнозах ${pc(s.pShare)}` + (SIGNAL ? `, на сигналах ${pc(s.zShare)}` : '') + ` веса` +
          ` | бит: источники ${f(s.bitsS)}, остальные ${f(s.bitsX)}` +
          (DEEP ? ` | КАНАЛ 9 (глубина ${DEEP}): частей ${s.n9}, бит ${f(s.bits9)}, на прогнозах источника 8 ${pc(s.f8)} веса` +
            (SIGNAL ? `, на сигналах ${pc(s.z9)}, с передатчиком ${pc(s.relay)} частей; носителей прошлого ${s.carriers}` +
              (s.carriers ? ` (каналы ${s.carCh})` : '') : '') : '') +
          (s.food ? `\n          ЕДА: доля верных действий ${pc(s.food.share)} (пол ${(100/M_PL).toFixed(0)}%) на ${s.food.acts} действиях` +
            ` | добытчиков живых ${s.food.alive}/${NF}, ген частоты ${f(s.food.gAct)}, действий на добытчика ${f(s.food.rate, 3)}` +
            ` | угадавших зараз ${f(s.food.winners)}, фонд сгорел в ${pc(s.food.burn)} кругов с действиями` +
            ` | чистыми на действие ${f(s.food.net, 3)}, еды отдано за круг ${f(s.food.give)}` +
            ` | самосогласованное место есть в ${pc(s.food.sf)} кругов | дисперсия F ${f(s.food.varF)}` +
            ` | с передатчиком ${pc(s.food.relay)} (${s.food.nRelay}), без ${pc(s.food.bare)} (${s.food.nBare})` +
            (s.food.byK ? ` | по числу действующих ${s.food.byK}` : '') : '') +
          (RULE ? ` | закон: b/a ${f(s.ba)}, c/a ${f(s.ca)}, a ${f(s.a, 3)}, похожих на LMS ${pc(s.lms)}` : ''));
        if (r === ROUNDS) console.log(`  итог: рождений ${s.births}, смертей банкрот/сбой ${s.bank}/${s.fault} | возраст умерших ${s.deadAge}, живых ${s.liveAge}` +
          ` | гены: urge ${f(s.urge)}` + (RULE ? '' : `, lr ${f(s.lr, 3)}`) +
          (WORLD ? ` | доход источников от чтения ${pc(s.readShare)}` : '') + ` | в минусе ${s.minus}`);
      }
    }
  }
}

// Чтение шага 73 (PRE73_UNBOUNDED.md §4-5): проверка меры на известной правде, затем ворота на свежих сидах
const fs = require('fs');
const load = (s) => fs.readFileSync(`out/gate73_${s}.tsv`, 'utf8').trim().split('\n').map((l) => l.split('\t').map(Number))
  .map(([seed, T, c, full, rl, rs, mx]) => ({ seed, T, c, full, rl, rs, mx }));
const V = [4302, 4801, 4802, 4803, 4804, 4805, 4806].flatMap(load), G = [4811, 4812, 4813, 4814, 4815, 4816].flatMap(load);
const boom = V.filter((x) => x.mx > 20), missed = boom.filter((x) => !(x.rl > 1));
const bounded = V.filter((x) => x.full > 1 && !(x.rl > 1)), bBoom = bounded.filter((x) => x.mx > 20);
const fa = V.filter((x) => x.rl > 1 && !(x.mx > 20));
const s = (a) => a.map((x) => `${x.seed} T${x.T} ц${x.c} (ρ ${x.rl.toFixed(3)}, полный ${x.full.toFixed(3)}, |прогноз| ${x.mx.toExponential(1)})`).join('; ');
console.log(`ПРОВЕРКА МЕРЫ (сиды 4302, 4801-4806, тишин ${V.length})`);
console.log(`  взрывов (|прогноз| > 20): ${boom.length}; из них с ρ_LC > 1: ${boom.length - missed.length}${missed.length ? ' | ПРОПУЩЕНЫ: ' + s(missed) : ''}`);
console.log(`  полный радиус > 1 при ρ_LC <= 1 (ограниченные петли): ${bounded.length}, взрывов среди них ${bBoom.length}${bBoom.length ? ': ' + s(bBoom) : ''}`);
console.log(`  ложные тревоги (ρ_LC > 1 без взрыва): ${fa.length} из ${V.filter((x) => x.rl > 1).length}${fa.length ? ': ' + s(fa) : ''}`);
const ok = !missed.length && !bBoom.length && boom.length > 0;
console.log(`  -> мера ${ok ? 'ГОДНА' : 'НЕ ГОДНА' + (boom.length ? '' : ' (взрывов нет -- проверять нечем)')}`);
console.log(`\nВОРОТА (сиды 4811-4816, тишин ${G.length})`);
const nl = G.filter((x) => x.rl > 1).length, ns = G.filter((x) => x.rs > 1).length, gb = G.filter((x) => x.mx > 20).length;
console.log(`  ρ_LC > 1: ${nl}; ρ_LS > 1: ${ns}; полный LC > 1: ${G.filter((x) => x.full > 1).length}; взрывов по правде: ${gb}`);
if (nl >= 4) console.log(`  -> ${ok ? (ns <= nl / 4 ? 'ПРОЙДЕНЫ' : 'НЕ ПРОЙДЕНЫ') : 'не читаются (мера не годна)'}`);
else {
  const d = load(4302).filter((x) => x.rl > 1 && !(x.T === 30 && x.c >= 76));
  const bad = d.filter((x) => x.rs >= 1);
  console.log(`  ρ_LC > 1 меньше 4 -- решает сид 4302: тишин с ρ_LC > 1 до порчи ${d.length}, из них ρ_LS >= 1: ${bad.length}${bad.length ? ': ' + s(bad) : ''}`);
  console.log(`  -> ${ok ? (d.length && !bad.length ? 'ПРОЙДЕНЫ (по сиду 4302)' : 'НЕ ПРОЙДЕНЫ') : 'не читаются (мера не годна)'}`);
}

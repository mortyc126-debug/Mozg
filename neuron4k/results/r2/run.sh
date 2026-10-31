#!/bin/sh
# Р2: 24 мира на условие, по 4 сразу. Запуск: sh results/r2/run.sh <папка вывода>
D=$(cd "$(dirname "$0")" && pwd); O=$1; mkdir -p $O
for c in "S 1 0" "SS 1 1" "K 2 1"; do set -- $c; : > $O/r2_$1.jsonl; done
for s in $(seq 1 24); do for c in "S 1 0" "SS 1 1" "K 2 1"; do set -- $c; echo "$s $1 $2 $3"; done; done | xargs -P 4 -L 1 sh -c 'node '"$D"'/hear.js $0 $2 $3 >> '"$O"'/r2_$1.jsonl'

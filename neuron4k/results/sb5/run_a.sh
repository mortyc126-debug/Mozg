#!/bin/sh
# Сб5, проход 1: вскрытия 24 миров (до круга 20000), по 4 сразу. Запуск: sh results/sb5/run_a.sh <папка>
D=$(cd "$(dirname "$0")" && pwd); O=$1; mkdir -p $O
seq 1 24 | xargs -P 4 -I{} node $D/autopsy.js {} $O 20000

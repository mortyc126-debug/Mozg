#!/bin/sh
# Сб6: 24 мира, свои гипотезы мозга, по 4 сразу. Запуск: sh results/sb3/run.sh <папка вывода>
D=$(cd "$(dirname "$0")/../sb1" && pwd); O=$1; mkdir -p $O; : > $O/sb6_M.jsonl
seq 1 24 | xargs -P 4 -I{} sh -c "node $D/hear.js {} 1 '{\"CV3\":1,\"PLSAL\":1,\"CHYP\":1}' >> $O/sb6_M.jsonl"

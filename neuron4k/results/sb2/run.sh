#!/bin/sh
# Сб2: 24 мира с языком v3, по 4 сразу. Запуск: sh results/sb2/run.sh <папка вывода>
D=$(cd "$(dirname "$0")/../sb1" && pwd); O=$1; mkdir -p $O; : > $O/sb2_P.jsonl
seq 1 24 | xargs -P 4 -I{} sh -c "node $D/hear.js {} 1 '{\"CV3\":1}' >> $O/sb2_P.jsonl"

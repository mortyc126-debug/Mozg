#!/bin/sh
# Сб3: 24 мира, язык v3 + внимание вперёд, по 4 сразу. Запуск: sh results/sb3/run.sh <папка вывода>
D=$(cd "$(dirname "$0")/../sb1" && pwd); O=$1; mkdir -p $O; : > $O/sb3_V.jsonl
seq 1 24 | xargs -P 4 -I{} sh -c "node $D/hear.js {} 1 '{\"CV3\":1,\"CLAG\":5,\"CPMIN\":2}' >> $O/sb3_V.jsonl"

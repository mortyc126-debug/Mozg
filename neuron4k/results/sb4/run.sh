#!/bin/sh
# Сб4: 24 мира, язык v3 + яркие миги в долгой записи, по 4 сразу. Запуск: sh results/sb3/run.sh <папка вывода>
D=$(cd "$(dirname "$0")/../sb1" && pwd); O=$1; mkdir -p $O; : > $O/sb4_G.jsonl
seq 1 24 | xargs -P 4 -I{} sh -c "node $D/hear.js {} 1 '{\"CV3\":1,\"PLSAL\":1}' >> $O/sb4_G.jsonl"

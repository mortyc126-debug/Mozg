#!/bin/sh
# Сб5, проход 2: 24 мира с предложениями изобретателя (inv_<сид>.json) с круга 20000, по 4 сразу.
# Запуск: sh results/sb5/run_b.sh <папка с inv_*.json> <папка вывода>
D=$(cd "$(dirname "$0")/../sb1" && pwd); I=$1; O=$2; mkdir -p $O; : > $O/sb5_I.jsonl
seq 1 24 | xargs -P 4 -I{} sh -c "CINVFILE=$I/inv_{}.json node $D/hear.js {} 1 '{\"CV3\":1,\"PLSAL\":1,\"CINV\":1,\"CINVT\":20000}' >> $O/sb5_I.jsonl"

#!/bin/sh
# Сб1: 24 мира со сборщиком, по 4 сразу. Запуск: sh results/sb1/run.sh <папка вывода>
D=$(cd "$(dirname "$0")" && pwd); O=$1; mkdir -p $O; : > $O/sb1_C.jsonl
C='{"WMEM":0,"PARA":0,"COMP":1,"CV2":1,"CSWEEP":1,"CGROW":1,"CSTRUCT":1,"CFAST":3,"CRNG":1}'
seq 1 24 | xargs -P 4 -I{} sh -c "node $D/hear.js {} 1 '$C' >> $O/sb1_C.jsonl"

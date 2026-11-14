#!/bin/sh
# Ступень 10: 24 мира на условие, по 4 сразу. Запуск: sh results/s10/run.sh
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js; B="BG=1 SPEAK=1 SPX=1 MAP=0 HLAG=10 INV=1 SPT=1 FIXF=1 NAV=1"
seq 1 24 | xargs -P 4 -I{} node $T {} $B BARR=1 PFC=1 > $D/s10_C.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B BARR=1 PFC=2 PFCM=0 > $D/s10_C0.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B PFC=1 > $D/s10_OC.jsonl

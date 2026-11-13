#!/bin/sh
# Ступень 7: 24 мира на условие, по 4 сразу. Запуск: sh results/s7/run.sh
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam7.js; B="BG=1 SPEAK=1 SPX=1 MAP=0 HLAG=10 INV=1 SPT=1 KLAM=2 KLAMS=8 KSERV=12 BMEM=0.9"
seq 1 24 | xargs -P 4 -I{} node $T {} $B TWO=1 BSOC=1 > $D/s7_Z.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B TWO=2 BSOC=1 > $D/s7_K.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B TWO=1 BSOC=0 > $D/s7_B.jsonl

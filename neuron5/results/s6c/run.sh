#!/bin/sh
# Ступень 6в: 24 мира на условие, по 4 сразу. Запуск: sh results/s6c/run.sh
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js; B="BG=1 SPEAK=1 SPX=1 REQ=1 MAP=0 HLAG=10 INV=1 SPT=1"
seq 1 24 | xargs -P 4 -I{} node $T {} $B VJIT=6 THAL=2 > $D/s6c_FRT.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B THAL=2 > $D/s6c_G0RT.jsonl

#!/bin/sh
# Ступень 8: 24 мира на условие, по 4 сразу. Запуск: sh results/s8/run.sh
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js; B="BG=1 SPEAK=1 SPX=1 MAP=0 HLAG=10 INV=1 SPT=1 MSIG=0.3 MTMIN=2.5"
seq 1 24 | xargs -P 4 -I{} node $T {} $B BARR=1 > $D/s8_B.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B BARR=1 MOT=1 > $D/s8_M.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B BARR=1 MOT=2 > $D/s8_M0.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B > $D/s8_O.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B MOT=1 > $D/s8_OM.jsonl

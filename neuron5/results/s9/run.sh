#!/bin/sh
# Ступень 9: 24 мира на условие, по 4 сразу. Запуск: sh results/s9/run.sh
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js; B="BG=1 SPEAK=1 SPX=1 MAP=0 HLAG=10 INV=1 SPT=1 FIXF=1"
seq 1 24 | xargs -P 4 -I{} node $T {} $B BARR=1 > $D/s9_B.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B BARR=1 NAV=1 > $D/s9_N.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B BARR=1 NAV=2 > $D/s9_N0.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B > $D/s9_O.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B NAV=1 > $D/s9_ON.jsonl

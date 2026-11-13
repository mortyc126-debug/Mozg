#!/bin/sh
# Ступень 6: 24 мира на условие, по 4 сразу. Запуск: sh results/s6/run.sh
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js; B="BG=1 SPEAK=1 SPX=1 REQ=1 MAP=0 HLAG=10"
seq 1 24 | xargs -P 4 -I{} node $T {} $B > $D/s6_G0.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B VJIT=6 > $D/s6_G.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B VJIT=6 INV=1 > $D/s6_F.jsonl

#!/bin/sh
# Ступень 2а: 24 мира на условие, по 4 сразу. Запуск: sh results/s2a/run.sh
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js
seq 1 24 | xargs -P 4 -I{} node $T {} > $D/s2a_R.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 BLR=0 > $D/s2a_B0.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 > $D/s2a_B.jsonl

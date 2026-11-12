#!/bin/sh
# Ступень 2б: 24 мира на условие, по 4 сразу. Запуск: sh results/s2b/run.sh
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 BCTX=1 > $D/s2b_O.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 BCTX=2 > $D/s2b_K.jsonl

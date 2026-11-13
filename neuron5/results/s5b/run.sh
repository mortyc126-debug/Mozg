#!/bin/sh
# Ступень 5б: 24 мира на условие, по 4 сразу. Запуск: sh results/s5b/run.sh (REQP -- из ПЛАН.md §5, по счёту Пв)
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 SPEAK=1 SPX=1 > $D/s5b_S.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 SPEAK=1 SPX=1 REQ=1 > $D/s5b_P0.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 SPEAK=1 SPX=1 REQ=1 SPB=1 > $D/s5b_P.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 SPEAK=1 SPX=1 REQ=2 SPB=1 REQP=$(cat $D/reqp.txt) > $D/s5b_K.jsonl

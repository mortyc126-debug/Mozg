#!/bin/sh
# Ступень 5: 24 мира на условие, по 4 сразу. Запуск: sh results/s5/run.sh (REQP -- из ПЛАН.md §6, по счёту П)
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 SPEAK=1 REQ=1 > $D/s5_P0.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 SPEAK=1 REQ=1 SPB=1 > $D/s5_P.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 SPEAK=1 REQ=2 SPB=1 REQP=0.000975 > $D/s5_K.jsonl

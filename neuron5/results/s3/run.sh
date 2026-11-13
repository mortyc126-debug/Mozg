#!/bin/sh
# Ступень 3: 24 мира, по 4 сразу. Запуск: sh results/s3/run.sh
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 SPEAK=1 SPX=1 REQ=1 MAP=0 > $D/s3_I.jsonl

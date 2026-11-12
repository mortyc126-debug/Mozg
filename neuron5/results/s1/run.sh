#!/bin/sh
# Ступень 1: 24 мира на условие, по 4 сразу. Запуск: sh results/s1/run.sh
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js
seq 1 24 | xargs -P 4 -I{} node $T {} > $D/s1_S.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} VOICE=2 > $D/s1_K.jsonl

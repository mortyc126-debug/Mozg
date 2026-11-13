#!/bin/sh
# Ступень 4: 24 мира на условие, по 4 сразу. Запуск: sh results/s4/run.sh
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 SPEAK=1 > $D/s4_S.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 SPEAK=2 > $D/s4_N.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} BG=1 SPEAK=1 SPEV=0 > $D/s4_L.jsonl

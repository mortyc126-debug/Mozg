#!/bin/sh
# Ступень 11, часть А: мир запасов годится? 24 мира на условие, по 4 сразу. Запуск: sh results/s11/run_a.sh
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js; B="BG=1 SPEAK=1 SPX=1 MAP=0 HLAG=10 INV=1 SPT=1 NAV=1 SEAS=1"
seq 1 24 | xargs -P 4 -I{} node $T {} $B > $D/s11_A.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B SHAND=7 > $D/s11_R.jsonl

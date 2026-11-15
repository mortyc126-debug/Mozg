#!/bin/sh
# Ступень 11, часть Б: мозг учится запасать сам. 24 мира на условие, по 4 сразу. Запуск: sh results/s11/run_b.sh
D=$(cd "$(dirname "$0")" && pwd); T=$D/../../tools/exam1.js; B="BG=1 SPEAK=1 SPX=1 MAP=0 HLAG=10 INV=1 SPT=1 NAV=1 SEAS=1"
seq 1 24 | xargs -P 4 -I{} node $T {} $B BCAR=1 > $D/s11_B.jsonl
seq 1 24 | xargs -P 4 -I{} node $T {} $B BCAR=2 > $D/s11_B0.jsonl

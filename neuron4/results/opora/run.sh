#!/bin/bash
# правка «опора»: парные прогоны BRAIN=8 против BRAIN=8 SUPLOO=1 (results/opora/ПЛАН.md); база на мирах 17-24 -- results/proverka17/newkind_17-24.txt
cd "$(dirname "$0")/../.."
O=results/opora
run() { local f=$1; shift; [ -s $O/$f ] && grep -q "СДАНО\|медиана\|понято" $O/$f && return; "$@" > $O/$f 2>&1; }
run nk_17-24_sup.txt node tools/newkind.js SEEDS=17-24 SIZES=1 BRAIN=8 SUPLOO=1
run img_base.txt node neuron4.js WORLD=img SEEDS=1-8 BRAIN=8
run img_sup.txt node neuron4.js WORLD=img SEEDS=1-8 BRAIN=8 SUPLOO=1
run nk_9-16_base.txt node tools/newkind.js SEEDS=9-16 SIZES=1 BRAIN=8
run nk_9-16_sup.txt node tools/newkind.js SEEDS=9-16 SIZES=1 BRAIN=8 SUPLOO=1
run mix_base.txt node neuron4.js WORLD=mix WK=32 SEEDS=1-8 BRAIN=8
run mix_sup.txt node neuron4.js WORLD=mix WK=32 SEEDS=1-8 BRAIN=8 SUPLOO=1
run exam_base.txt node tools/exam.js SEEDS=1-8 BRAIN=8
run exam_sup.txt node tools/exam.js SEEDS=1-8 BRAIN=8 SUPLOO=1
run ready_base.txt node tools/ready.js SEEDS=1-8 SIZES=1,4 BRAIN=8
run ready_sup.txt node tools/ready.js SEEDS=1-8 SIZES=1,4 BRAIN=8 SUPLOO=1
echo done > $O/run.done

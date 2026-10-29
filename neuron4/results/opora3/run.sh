#!/bin/bash
# правка «опора-3»: этапы по ПЛАН.md (A -- готовность, B -- способности, C -- новый род, D -- цифры и смесь); задания экзаменов -- в *.jsonl (прогон переживает перезапуск). Аргумент -- вариант: L или LO
cd "$(dirname "$0")/../.."
O=results/opora3; V=$1
case "$V" in O3) X="BRAIN=9 SUPLOO=2" ;; esac
run() { local f=$1; shift; [ -s $O/$f ] && grep -q "СДАНО\|медиана\|понято" $O/$f && return; "$@" > $O/$f 2>&1; }
case "$2" in
  A) run ready_$V.txt node tools/ready.js SEEDS=1-8 SIZES=1,4 $X JOBFILE=$O/ready_$V.jsonl ;;
  B) run exam_$V.txt node tools/exam.js SEEDS=1-8 $X JOBFILE=$O/exam_$V.jsonl ;;
  C) run nk17_$V.txt node tools/newkind.js SEEDS=17-24 SIZES=1 $X JOBFILE=$O/nk17_$V.jsonl; run nk9_$V.txt node tools/newkind.js SEEDS=9-16 SIZES=1 $X JOBFILE=$O/nk9_$V.jsonl ;;
  D) run img_$V.txt node neuron4.js WORLD=img SEEDS=1-8 $X; run mix_$V.txt node neuron4.js WORLD=mix WK=32 SEEDS=1-8 $X ;;
esac

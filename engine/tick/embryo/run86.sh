cd /home/user/Mozg/engine/tick/embryo
case "$2" in Ю) X="" ;; ЮО) X="IMPRINT=1" ;; нуль) X="IMPRINT=1 ORDERSHUF=1" ;; esac
case "$1" in
  s) env $(cat embryo.env) $X LABEL=$3 PERTURB=$4 node savings.js $5 $6 $7 $8 >> out/savings86_$2.tsv ;;
  b) env $(cat embryo.env) $X $5 node battery.js $3 $4 >> out/battery86_$2.tsv ;;
  o) env $(cat embryo.env) ORDER=1 $X node order.js $3 $2 >> out/order86.tsv ;;
esac

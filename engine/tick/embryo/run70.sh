cd /home/user/Mozg/engine/tick/embryo
case "$2" in Ю) X="" ;; ЮС) X="CSEARCH=16" ;; ЮЛ) X="DLINE=6" ;; ЮЛС) X="DLINE=6 CSEARCH=16" ;; esac
case "$1" in
  b) env $(cat embryo.env) $X $5 node battery.js $3 $4 >> out/battery70_$2.tsv ;;
  o) env $(cat embryo.env) ORDER=1 $X node order.js $3 $2 >> out/order70.tsv ;;
esac

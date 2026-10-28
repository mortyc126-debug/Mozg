cd /home/user/Mozg/engine/tick/embryo
case "$2" in Б) X="" ;; Ю) X="YOUTH=1000" ;; ЮЛ) X="YOUTH=1000 DLINE=6" ;; esac
case "$1" in
  b) env $(cat embryo.env) $X $5 node battery.js $3 $4 >> out/battery67_$2.tsv ;;
  o) env $(cat embryo.env) ORDER=1 $X node order.js $3 $2 >> out/order67.tsv ;;
esac

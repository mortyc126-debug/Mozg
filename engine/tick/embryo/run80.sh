cd /home/user/Mozg/engine/tick/embryo
case "$2" in
  ЮЛС140) X="DLINE=6 CSEARCH=16 TRIAL=140" ;; ЮЛСП) X="DLINE=6 CSEARCH=16 QPAY=32" ;; ЮЛС140П) X="DLINE=6 CSEARCH=16 TRIAL=140 QPAY=32" ;;
  нуль) X="DLINE=6 CSEARCH=16 TRIAL=140 QPAY=32 ORDERSHUF=1" ;; Ю) X="" ;; ЮЛС) X="DLINE=6 CSEARCH=16" ;; Б140) X="DLINE=6 CSEARCH=16 TRIAL=140" ;;
esac
case "$1" in
  o) env $(cat embryo.env) ORDER=1 $X node order.js $3 $2 >> out/order80.tsv ;;
  b) env $(cat embryo.env) $X $5 node battery.js $3 $4 >> out/battery80_$2.tsv ;;
esac

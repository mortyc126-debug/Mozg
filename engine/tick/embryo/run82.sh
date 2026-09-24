cd /home/user/Mozg/engine/tick/embryo
case "$2" in
  Ю) X="" ;; ЮЛС) X="DLINE=6 CSEARCH=16" ;; ЮЛСЗ) X="DLINE=6 CSEARCH=16 LFREEZE=1" ;;
  ЮЛСЗП) X="DLINE=6 CSEARCH=16 LFREEZE=1 QPAY=32" ;; нуль) X="DLINE=6 CSEARCH=16 LFREEZE=1 QPAY=32 ORDERSHUF=1" ;;
esac
case "$1" in
  o) env $(cat embryo.env) ORDER=1 $X node order.js $3 $2 >> out/order82.tsv ;;
  b) env $(cat embryo.env) $X $5 node battery.js $3 $4 >> out/battery82_$2.tsv ;;
esac

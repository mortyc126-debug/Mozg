cd /home/user/Mozg/engine/tick/embryo
case "$1" in
  b) env $(cat embryo.env) DLINE=6 $4 node battery.js $2 $3 >> out/battery61.tsv ;;
  o) env $(cat embryo.env) DLINE=6 ORDER=1 $4 node order.js $2 $3 >> out/order61.tsv ;;
esac

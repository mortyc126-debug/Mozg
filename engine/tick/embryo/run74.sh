cd /home/user/Mozg/engine/tick/embryo
case "$2" in Ю) X="" ;; ЮП) X="HOLDS=1" ;; старая) X="" ;; esac
case "$1" in
  b) env $(cat embryo.env) $X $5 node battery.js $3 $4 >> out/battery74_$2.tsv ;;
  d) env $(cat embryo.env) $X $5 node battery.js $3 $4 >> out/battery74d_$2.tsv ;;
  i) env $(cat embryo.env) node battery_old74.js $3 $4 > out/battery74_id_old.tsv ;;
esac

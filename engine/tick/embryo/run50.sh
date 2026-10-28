cd /home/user/Mozg/engine/tick/embryo
case "$1" in
  b) env $(cat embryo.env) RELSIG=1 $4 node battery.js $2 $3 >> out/battery50.tsv ;;
  c) env $(cat embryo.env) RELSIG=1 FREE_F=0 node battery.js $2 проверка3 >> out/check50.tsv ;;
  t) env $(cat embryo.env) RELSIG=1 node trace.js $2 $3 оба >> out/trace50.tsv ;;
  l) env $(cat embryo.env) RELSIG=1 node links.js $2 >> out/links50.tsv ;;
esac

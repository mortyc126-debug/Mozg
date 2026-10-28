cd /home/user/Mozg/engine/tick/embryo
case "$1" in
  b) env $(cat embryo.env) NODATA=1 $4 node battery.js $2 $3 >> out/battery57.tsv ;;
  w) env $(cat embryo.env) NODATA=$3 node wake.js $2 N$3 >> out/wake57.tsv ;;
esac

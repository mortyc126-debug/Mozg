cd /home/user/Mozg/engine/tick/embryo
case "$1" in
  i0) env $(cat embryo.env) node battery_old76.js $2 зародыш > out/id76_old.tsv ;;
  i1) env $(cat embryo.env) node battery.js $2 зародыш > out/id76_new.tsv ;;
  К0) env $(cat embryo.env) FREE_F=0 FREE_L=0 node battery.js $2 проверка3 >> out/check76_К0.tsv ;;
  КС) env $(cat embryo.env) WIPE3=1 node battery.js $2 проверка3 >> out/check76_КС.tsv ;;
  Ю) env $(cat embryo.env) node battery.js $2 проверка3 >> out/check76_Ю.tsv ;;
esac

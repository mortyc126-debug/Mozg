cd /home/user/Mozg/engine/tick/embryo
case "$1" in
  С0) X="RELSIG=0" ;;
  С1) X="RELSIG=1" ;;
  С2) X="RELSIG=1 ZVFREEZE=1" ;;
esac
env $(cat embryo.env) $X node norm.js $2 $1 >> out/norm51.tsv

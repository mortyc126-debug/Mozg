cd /home/user/Mozg/engine/tick/embryo
case "$2" in n10) X="LOOKN=10" ;; n30) X="LOOKN=30" ;; n100) X="LOOKN=100" ;; K2) X="LOSEK=2" ;; LL) X="LLEARN=1" ;; esac
env $(cat embryo.env) HID=1 HQ=$1 LOOK=0.8 $X node run90.js $3 "HQ=$1 $2" >> out/exp91.tsv

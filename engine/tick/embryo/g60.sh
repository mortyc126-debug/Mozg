cd /home/user/Mozg/engine/tick/embryo
case "$1" in Г0) X="" ;; Г1) X="PROTECTQ=1" ;; Г2) X="QDELAY=1" ;; Г3) X="PROTECTQ=1 QDELAY=1" ;; esac
env $(cat embryo.env) ORDER=1 $X node order.js $2 $1 >> out/gate60.tsv

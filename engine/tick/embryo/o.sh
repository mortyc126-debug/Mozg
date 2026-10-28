cd /home/user/Mozg/engine/tick/embryo
case "$1" in порядок) X="ORDER=1" ;; нуль) X="ORDER=1 ORDERSHUF=1" ;; esac
env $(cat embryo.env) $X node order.js $2 $1 >> out/order59.tsv

cd /home/user/Mozg/engine/tick/embryo
case "$1" in порядок) X="" ;; нуль) X="ORDERSHUF=1" ;; esac
env $(cat embryo.env) YOUTH=1000 DLINE=6 ORDER=1 CHIST=1 $X $3 node gate68.js $2 $1 >> out/gate68${4}.tsv

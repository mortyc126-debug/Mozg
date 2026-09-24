cd /home/user/Mozg/engine/tick/embryo
case "$1" in порядок) X="" ;; нуль-время) X="ORDERTSHUF=1" ;; нуль-знак) X="ORDERSHUF=1" ;; esac
env $(cat embryo.env) YOUTH=1000 DLINE=6 ORDER=1 CHIST=1 $X node diag69b.js $2 $1 >> out/diag69b.tsv

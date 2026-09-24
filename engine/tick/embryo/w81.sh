cd /home/user/Mozg/engine/tick/embryo
case "$1" in ЮЛС) X="DLINE=6 CSEARCH=16" ;; Б140) X="DLINE=6 CSEARCH=16 TRIAL=140" ;; esac
env $(cat embryo.env) $X node where81.js $2 $1 >> out/where81.tsv

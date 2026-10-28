cd /home/user/Mozg/engine/tick/embryo
case "$1" in ЮЛС140) X="TRIAL=140" ;; ЮЛС) X="" ;; esac
env $(cat embryo.env) ORDER=1 DLINE=6 CSEARCH=16 $X node econ79.js $2 $1 >> out/econ79.tsv

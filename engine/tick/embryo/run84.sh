cd /home/user/Mozg/engine/tick/embryo
case "$2" in Ю) X="" ;; ЮЛС) X="DLINE=6 CSEARCH=16" ;; ЮЛСОК) X="DLINE=6 CSEARCH=16 LEXP=1 LCAP=1" ;; esac
env $(cat embryo.env) $X $5 node battery.js $3 $4 >> out/battery84_$2.tsv

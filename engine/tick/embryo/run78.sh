cd /home/user/Mozg/engine/tick/embryo
case "$1" in ЮЛС) X="DLINE=6 CSEARCH=16" ;; ЮЛС100) X="DLINE=6 CSEARCH=16 TRIAL=100" ;; ЮЛС140) X="DLINE=6 CSEARCH=16 TRIAL=140" ;; ЮЛ140) X="DLINE=6 TRIAL=140" ;; esac
env $(cat embryo.env) ORDER=1 $X node order.js $2 $1 >> out/order78.tsv

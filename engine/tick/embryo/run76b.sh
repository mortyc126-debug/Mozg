cd /home/user/Mozg/engine/tick/embryo
case "$2" in Ю) X="" ;; ЮП) X="HOLDS=1" ;; esac
env $(cat embryo.env) $X $4 node battery.js $3 $1 >> out/battery76_$2.tsv

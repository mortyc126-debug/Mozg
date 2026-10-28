cd /home/user/Mozg/engine/tick/embryo
case "$1" in Б) X="" ;; П) X="PAUSEX=1" ;; ПЛ) X="PAUSEX=1 DLINE=6" ;; esac
env $(cat embryo.env) $X $4 node battery.js $2 $3 >> out/battery66_$1.tsv

cd /home/user/Mozg/engine/tick/embryo
case "$1" in Н1) X="" ;; Н2) X="ZVFREEZE=2" ;; esac
env $(cat embryo.env) $X node norm.js $2 $1 >> out/norm54.tsv

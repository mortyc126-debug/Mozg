cd /home/user/Mozg/engine/tick/embryo
case "$1" in Д1) X="" ;; Д2) X="NOFAULTQUIET=1" ;; esac
env $(cat embryo.env) $X node deaths.js $2 $1 >> out/deaths52.tsv

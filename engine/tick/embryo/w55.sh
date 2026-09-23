cd /home/user/Mozg/engine/tick/embryo
case "$1" in П1) X="" ;; П2) X="WAKEGRACE=20" ;; esac
env $(cat embryo.env) $X node wake.js $2 $1 >> out/wake55.tsv

cd /home/user/Mozg/engine/tick/embryo
case "$1" in 00) X="" ;; Z0) X="ZVFREEZE=2" ;; 0G) X="WAKEGRACE=20" ;; ZG) X="ZVFREEZE=2 WAKEGRACE=20" ;; esac
env $(cat embryo.env) $X node wake.js $2 $1 >> out/fact56.tsv

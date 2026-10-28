cd /home/user/Mozg/engine/tick/embryo
env $(cat embryo.env) DLINE=$1 $4 node battery.js $2 $3 >> out/battery64_d$1.tsv

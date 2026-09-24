cd /home/user/Mozg/engine/tick/embryo
env $(cat embryo.env) LABEL=$1 PERTURB=$2 node savings.js $3 $4 $5 $6 >> out/savings89.tsv

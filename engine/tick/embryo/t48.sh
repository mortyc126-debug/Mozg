cd /home/user/Mozg/engine/tick/embryo
env $(cat embryo.env) ECOSLEEP=$1 RELPRUNE=$2 node trace.js $3 $4 $5

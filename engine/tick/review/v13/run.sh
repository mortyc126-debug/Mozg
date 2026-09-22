cd /home/user/Mozg/engine/tick/review/v13
for s in 1 2 3 4 5 6 7 8; do DEEP=$1 SIGNAL=$2 node cmp.js $3 $s; done

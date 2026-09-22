cd /home/user/Mozg/engine/tick/review/v13
k=$1; s=$2
env DEEP=1 $k=0 node cmp.js neuron2.js $s | sed "s/^/$k=0\t/"

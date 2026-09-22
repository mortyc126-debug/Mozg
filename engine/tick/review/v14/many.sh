cd /home/user/Mozg/engine/tick/review/v14
env DEEP=$1 node cmp.js neuron2.js $2 | sed "s/^/d$1\t/"

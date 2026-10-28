cd /home/user/Mozg/engine/tick/review/v14
env DEEP=2 RULE=0 node cmp.js neuron2.js $1 | sed "s/^/r0\t/"

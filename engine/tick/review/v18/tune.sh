cd /home/user/Mozg/engine/tick/review/v18
env DEEP=2 EAT=1 LOOP=0.5 RANDACT=1 FOOD=$1 ACT=$2 ROUNDS=100000 SEEDS=1 node neuron2.js 2>&1 | grep 'ЕДА' | tail -1 | sed "s|^|FOOD=$1 ACT=$2 \||"

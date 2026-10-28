cd /home/user/Mozg/engine/tick/review/v21
env DEEP=2 EAT=1 LOOP=0.5 FOOD=10 ACT=0.8 M=4 ROUNDS=100000 GAINM=1 SIG=0.1 SLR=0 KEEP=$1 node run.js "$2" "шум_K=$1"

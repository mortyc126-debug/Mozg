cd /home/user/Mozg/engine/tick/review/v22
if [ "$1" = "0" ]; then EXTRA="GAINM=0"; else EXTRA="GAINM=1 SIG=$1 SLR=0"; fi
env DEEP=2 EAT=1 LOOP=0.5 FOOD=10 ACT=0.8 M=4 ROUNDS=100000 KEEP=0.9 $EXTRA node run.js "$2" "σ=$1"

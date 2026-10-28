cd /home/user/Mozg/engine/tick/review/v24
if [ "$2" = "L" ]; then EXTRA="LOOKN=0 LOSEK=2"; else EXTRA="LOOKN=$2 LOSEK=0"; fi
env DEEP=2 EAT=1 LOOP=0.5 FOOD=10 ACT=0.8 M=4 KEEP=0 ROUNDS=100000 HID=1 HQ=$1 LOOK=0.8 $EXTRA node run23.js "$3" "HQ=$1 $2"

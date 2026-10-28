cd /home/user/Mozg/engine/tick/review/v23
case "$1" in
  знает) EXTRA="ORACLE=1" ;; никогда) EXTRA="LOOKN=0" ;; *) EXTRA="LOOKN=$1" ;;
esac
env DEEP=2 EAT=1 LOOP=0.5 FOOD=10 ACT=0.8 M=4 KEEP=0 ROUNDS=100000 HID=1 HQ=0.02 LOOK=0.8 $EXTRA node run23.js "$2" "$1"

cd /home/user/Mozg/engine/tick/review/v19
C=$1; S=$2
case "$C" in
  А) EXTRA="DECIDE=0 LAG=0" ;;
  Б) EXTRA="DECIDE=1 LAG=0" ;;
  В) EXTRA="DECIDE=0 LAG=1" ;;
  Г) EXTRA="DECIDE=1 LAG=1" ;;
  безПрогноза) EXTRA="DECIDE=1 LAG=0 NOPRED=1" ;;
esac
env DEEP=2 EAT=1 LOOP=0.5 FOOD=10 ACT=0.8 M=4 ROUNDS=100000 QLR=0.05 EXPL=0.05 $EXTRA node run.js "$S" "$C"
